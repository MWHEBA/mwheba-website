import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import { APIError, createLocalReq, type Payload, type PayloadRequest } from 'payload';
import type { Cart } from '@/payload-types';
import { calculateCartSummary, hydrateCartLines } from './cartCalculator';
import {
  CART_OPERATION_WINDOW,
  cartRelationId,
  isRetiredCart,
  parseAppliedOperations,
  retireCartOperations,
  sameCartLine,
  type CartItem,
} from './cartStorage';

export async function findActiveCustomerCart(payload: Payload, customerId: number, req?: PayloadRequest): Promise<Cart | null> {
  const { docs: [cart] } = await payload.find({
    collection: 'carts',
    where: { and: [{ customer: { equals: customerId } }, { purchasedAt: { exists: false } }] },
    sort: '-id',
    limit: 1,
    depth: 0,
    req,
  });
  return cart ?? null;
}

function mergeLines(destination: Cart, source: Cart) {
  const items = [...(destination.items ?? [])];
  const movedLineIds = new Map<string, string>();
  for (const sourceItem of source.items ?? []) {
    const existingIndex = items.findIndex((targetItem) => sameCartLine(targetItem, sourceItem));
    const existing = items[existingIndex];
    if (existing) {
      const quantity = existing.quantity + sourceItem.quantity;
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new APIError('INVALID_QUANTITY: The merged quantity exceeds the allowed range.', 422, undefined, true);
      }
      items[existingIndex] = { ...existing, quantity };
    } else {
      // Payload array row IDs are unique across all carts. The retired source retains its lines.
      const movedItem: CartItem = { ...sourceItem, id: randomUUID() };
      items.push(movedItem);
      if (sourceItem.id && movedItem.id) movedLineIds.set(sourceItem.id, movedItem.id);
    }
    if (sourceItem.id && existing?.id) movedLineIds.set(sourceItem.id, existing.id);
  }
  return { items, movedLineIds };
}

function mergedOperations(destination: Cart, source: Cart) {
  const destinationKeys = parseAppliedOperations(destination.appliedOperations);
  const sourceKeys = parseAppliedOperations(source.appliedOperations);
  const keys = new Set<string>();
  // Keep the most recent entries from both carts within the normal replay window.
  for (let index = 0; keys.size < CART_OPERATION_WINDOW && index < Math.max(sourceKeys.length, destinationKeys.length); index++) {
    if (sourceKeys[index]) keys.add(sourceKeys[index]);
    if (destinationKeys[index]) keys.add(destinationKeys[index]);
  }
  return [...keys].slice(0, CART_OPERATION_WINDOW);
}

async function transferArtwork(
  payload: Payload,
  req: PayloadRequest,
  customerId: number,
  sourceId: number,
  destinationId: number,
  movedLineIds: Map<string, string>,
) {
  const { docs } = await payload.find({
    collection: 'artwork-assets',
    where: { and: [
      { status: { equals: 'pending_order' } },
      { or: [{ cart: { equals: sourceId } }, { ownerSession: { equals: String(sourceId) } }] },
      { or: [{ uploader: { exists: false } }, { uploader: { equals: customerId } }] },
    ] },
    pagination: false,
    depth: 0,
    req,
  });
  for (const asset of docs) {
    await payload.update({
      collection: 'artwork-assets',
      id: asset.id,
      data: {
        cart: destinationId,
        uploader: customerId,
        ownerSession: null,
        lineItemId: asset.lineItemId ? movedLineIds.get(asset.lineItemId) ?? null : null,
      },
      depth: 0,
      req,
    });
  }
}

/** Called only with verified Payload auth and a cart ID obtained from the signed guest cookie. */
export async function reconcileCustomerCart(
  payload: Payload,
  customerId: number,
  guestCartId: number | null,
  initialize: boolean,
): Promise<Cart | null> {
  const db = payload.db as unknown as PostgresAdapter;
  const retryLimit = 20;
  for (let attempt = 0; attempt < retryLimit; attempt++) {
    const transactionID = await db.beginTransaction();
    if (!transactionID) throw new Error('Cart reconciliation requires a PostgreSQL transaction.');

    try {
      const tx = db.sessions?.[transactionID]?.db;
      if (!tx) throw new Error('Cart reconciliation requires an active transaction connection.');
      const tryLock = async (id: number) => {
        const result = await tx.execute<{ acquired: boolean }>(sql`SELECT pg_try_advisory_xact_lock(${id}::bigint) AS acquired`);
        return result.rows[0]?.acquired === true;
      };

      // The negative customer key serializes cart creation per account. Positive cart keys
      // share the namespace used by withCartLock and are always acquired in ascending order.
      if (!await tryLock(-customerId)) continue;
      const req = await createLocalReq({ req: { transactionID }, context: {
        preserveCartSubtotal: true,
        isTrustedOrderWorkflow: true,
      } }, payload);
      let destination = await findActiveCustomerCart(payload, customerId, req);
      const idsToLock = [guestCartId, destination?.id].filter((id): id is number => id != null).sort((left, right) => left - right);
      let locked = true;
      for (const id of new Set(idsToLock)) {
        if (!await tryLock(id)) {
          locked = false;
          break;
        }
      }
      if (!locked) continue;

      if (destination) {
        destination = await payload.findByID({ collection: 'carts', id: destination.id, depth: 0, disableErrors: true, req });
        if (!destination || destination.purchasedAt || isRetiredCart(destination) || cartRelationId(destination.customer) !== customerId) continue;
      }
      const source = guestCartId === null ? null : await payload.findByID({
        collection: 'carts', id: guestCartId, depth: 0, disableErrors: true, req,
      });
      if (!source || source.customer || source.purchasedAt || isRetiredCart(source)) {
        if (destination || !initialize) return destination;
      }
      const guest = source && !source.customer && !source.purchasedAt && !isRetiredCart(source) ? source : null;

      if (!destination) {
        destination = await payload.create({
          collection: 'carts', data: { customer: customerId, currency: 'EGP', items: [], subtotal: 0 }, depth: 0, req,
        });
      }
      if (guest) {
        const { items, movedLineIds } = mergeLines(destination, guest);
        const summary = calculateCartSummary(await hydrateCartLines(items, payload, undefined, req));
        destination = await payload.update({
          collection: 'carts',
          id: destination.id,
          data: { items, subtotal: summary.subtotal, appliedOperations: mergedOperations(destination, guest) },
          depth: 0,
          req,
        });
        await transferArtwork(payload, req, customerId, guest.id, destination.id, movedLineIds);
        await payload.update({
          collection: 'carts', id: guest.id,
          data: { appliedOperations: retireCartOperations(guest, destination.id), secret: null },
          depth: 0,
          req,
        });
      }
      await db.commitTransaction(transactionID);

      // The installed adapter handles commit failures internally. Confirm the durable write
      // before telling the caller it can remove its signed guest context.
      const confirmed = await payload.findByID({
        collection: 'carts', id: guest?.id ?? destination.id, depth: 0, disableErrors: true,
      });
      if (!confirmed || (guest ? !isRetiredCart(confirmed, destination.id) || confirmed.secret : cartRelationId(confirmed.customer) !== customerId)) {
        throw new Error('Cart reconciliation could not confirm its database commit.');
      }
      return destination;
    } finally {
      if (db.sessions?.[transactionID]) {
        await db.rollbackTransaction(transactionID);
        // Contended attempts release their connection before waiting to retry.
        await delay(15);
      }
    }
  }
  throw new APIError('CART_BUSY: Retry after the current cart update finishes.', 409, undefined, true);
}
