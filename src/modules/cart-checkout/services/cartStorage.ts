import { APIError, type Payload } from 'payload';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Cart } from '@/payload-types';
import { defaultLocale, type Locale } from '@/shared/lib/i18n';
import { catalogLocale, catalogSelectionError } from '@/modules/catalog/services/catalogProduct';
import {
  calculateCartSummary,
  hydrateCartLines,
  type CartCalculationSummary,
} from './cartCalculator';

export const CART_COOKIE_NAME = 'mwheba_cart';
const RETIRED_CART_OPERATION_PREFIX = '__mwheba_cart_merged__:';
export const CART_OPERATION_WINDOW = 50;

export type CartItem = NonNullable<Cart['items']>[number];

export function cartRelationId(relation: number | { id: number } | null | undefined) {
  return typeof relation === 'object' && relation !== null ? relation.id : relation;
}

export function sameCartLine(left: CartItem, right: Omit<CartItem, 'quantity'>) {
  const productId = cartRelationId(left.product);
  return productId != null && productId === cartRelationId(right.product) &&
    (cartRelationId(left.variant) ?? null) === (cartRelationId(right.variant) ?? null) &&
    (left.artworkAssetId ?? '') === (right.artworkAssetId ?? '') &&
    (left.printingNotes ?? '') === (right.printingNotes ?? '');
}

export function retireCartOperations(cart: Pick<Cart, 'appliedOperations'>, destinationId: number) {
  return [`${RETIRED_CART_OPERATION_PREFIX}${destinationId}`, ...parseAppliedOperations(cart.appliedOperations)];
}

export function isRetiredCart(cart: Pick<Cart, 'appliedOperations'>, destinationId?: number) {
  const operations = parseAppliedOperations(cart.appliedOperations);
  return destinationId === undefined
    ? operations.some((operation) => operation.startsWith(RETIRED_CART_OPERATION_PREFIX))
    : operations.includes(`${RETIRED_CART_OPERATION_PREFIX}${destinationId}`);
}

function assertCartIsEditable(cart: Cart) {
  if (cart.purchasedAt || isRetiredCart(cart)) {
    throw new APIError('CART_NOT_ACTIVE: This cart can no longer be edited.', 409, undefined, true);
  }
}

function mutationKey(operationKey: string) {
  if (typeof operationKey !== 'string' || !operationKey.trim()) {
    throw new APIError('MISSING_OPERATION_KEY: A valid operationKey is required for idempotent cart mutation.', 400, undefined, true);
  }
  const key = operationKey.trim();
  if (key.startsWith(RETIRED_CART_OPERATION_PREFIX)) throw new APIError('INVALID_OPERATION_KEY', 400, undefined, true);
  return key;
}

export async function assertCartArtworkOwnership(payload: Payload, cart: Cart, assetId: string) {
  const numericId = Number(assetId);
  const asset = Number.isSafeInteger(numericId) && numericId > 0 ? await payload.findByID({
    collection: 'artwork-assets', id: numericId, depth: 0, disableErrors: true,
  }) : null;
  if (!asset) throw new APIError('ARTWORK_NOT_FOUND', 422, undefined, true);
  const uploader = cartRelationId(asset.uploader);
  if (cartRelationId(asset.cart) === cart.id || asset.ownerSession === String(cart.id) ||
    (uploader != null && uploader === cartRelationId(cart.customer))) return;
  throw new APIError('FORBIDDEN_ARTWORK_ACCESS', 403, undefined, true);
}

export interface CartMutationItem {
  productId: number | string;
  variantId?: number | string;
  quantity: number;
  artworkAssetId?: string;
  printingNotes?: string;
  operationKey: string;
}

export interface CartLockContext {
  readonly hasSaved: boolean;
  markSaved: () => void;
}

export function parseAppliedOperations(field: unknown): string[] {
  if (Array.isArray(field)) {
    return field.filter((k): k is string => typeof k === 'string' && Boolean(k.trim()));
  }
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed)
        ? parsed.filter((k): k is string => typeof k === 'string' && Boolean(k.trim()))
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function appendAppliedOperation(newOpKey: string, existingOpsField: unknown): string[] {
  const existing = parseAppliedOperations(existingOpsField);
  return [newOpKey, ...existing.filter((k) => k !== newOpKey)].slice(0, CART_OPERATION_WINDOW);
}

export function matchesCartItem(it: any, idx: number, itemId: string): boolean {
  if (it.id && String(it.id) === String(itemId)) return true;
  if (String(idx) === String(itemId)) return true;
  const itProdId = typeof it.product === 'object' && it.product !== null ? it.product.id : it.product;
  const itVarId = typeof it.variant === 'object' && it.variant !== null ? it.variant.id : it.variant;
  if (String(itProdId) === String(itemId)) return true;
  if (`line-${itProdId}-${itVarId || 0}` === String(itemId) || `line_${itProdId}_${itVarId || 0}` === String(itemId)) return true;
  if (typeof itemId === 'string' && itemId.startsWith(`line-${itProdId}-${itVarId || 0}`)) return true;
  return false;
}

const inProcessLocks = new Map<number, Promise<void>>();
const asyncLockStorage = new AsyncLocalStorage<Set<number>>();

/**
 * Execute a mutation on a cart with a PostgreSQL advisory lock (cross-process)
 * and in-process queue serialization per cartId, with safe idempotency-aware retry.
 * Supports reentrancy across nested calls in the same async execution context.
 *
 * CRITICAL IDEMPOTENCY INVARIANT:
 * Retries are STRICTLY PERMITTED only when we can prove that the mutation has NOT been saved (hasSaved === false).
 * If the database update succeeded and an interruption/error occurs afterwards,
 * we never re-execute the mutation to prevent duplicate increments or double-charges.
 */
export async function withCartLock<T>(
  payload: Payload,
  cartId: number,
  mutator: (context: CartLockContext) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  const activeLocks = asyncLockStorage.getStore();

  // Reentrancy check: If the current async call-chain already holds this cart's lock, execute directly
  if (activeLocks && activeLocks.has(cartId)) {
    const dummyContext: CartLockContext = {
      hasSaved: false,
      markSaved() {},
    };
    return mutator(dummyContext);
  }

  // 1. In-process serialization per cartId across distinct callers within this process
  while (inProcessLocks.has(cartId)) {
    try {
      await inProcessLocks.get(cartId);
    } catch {
      // Ignore previous errors
    }
  }

  let releaseInProcess!: () => void;
  const inProcessPromise = new Promise<void>((resolve) => {
    releaseInProcess = resolve;
  });
  inProcessLocks.set(cartId, inProcessPromise);

  try {
    const pool = (payload.db as any)?.pool;
    if (!pool) {
      throw new Error(
        'DATABASE_LOCK_UNAVAILABLE: PostgreSQL database pool is required for atomic cart mutations.'
      );
    }

    let lastError: any;
    let hasSaved = false;

    const lockContext: CartLockContext = {
      get hasSaved() {
        return hasSaved;
      },
      markSaved() {
        hasSaved = true;
      },
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let client: any = null;
      let lockAcquired = false;

      try {
        client = await pool.connect();
        // Acquire PostgreSQL 64-bit advisory lock for cross-process concurrency
        await client.query('SELECT pg_advisory_lock($1)', [cartId]);
        lockAcquired = true;

        const currentActive = activeLocks ? new Set(activeLocks) : new Set<number>();
        currentActive.add(cartId);

        const result = await asyncLockStorage.run(currentActive, () => mutator(lockContext));
        return result;
      } catch (err: any) {
        lastError = err;

        // RETRY SAFETY: If mutation was ALREADY SAVED to database, do NOT re-execute mutator!
        // Instead, safely recover and return the latest persisted state directly from DB.
        if (hasSaved) {
          try {
            const summary = await getCartSummary(payload, cartId);
            return summary as unknown as T;
          } catch {
            throw err;
          }
        }

        // Only retry if we can PROVE the mutation was NOT saved (hasSaved === false)
        const isRetryable =
          err.code === '40001' || // serialization_failure
          err.code === '40P01' || // deadlock_detected
          err.message?.includes('deadlock') ||
          err.message?.includes('could not serialize') ||
          err.message?.includes('connection');

        if (isRetryable && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 50));
          continue;
        }

        // Fail-closed: Never fall back to in-process locking if DB lock failed
        if (!lockAcquired) {
          throw new Error(
            `DATABASE_LOCK_FAILED: Failed to acquire atomic PostgreSQL cart lock for cart ${cartId}: ${err.message}`
          );
        }
        throw err;
      } finally {
        if (client) {
          if (lockAcquired) {
            try {
              await client.query('SELECT pg_advisory_unlock($1)', [cartId]);
            } catch {
              // Ignore unlock cleanup error
            }
          }
          try {
            client.release();
          } catch {}
        }
      }
    }
    throw lastError;
  } finally {
    inProcessLocks.delete(cartId);
    releaseInProcess();
  }
}

/**
 * Loads or creates a persistent Cart document in PostgreSQL.
 */
export async function getOrCreateCart(
  payload: Payload,
  cartId?: number | null,
  customerId?: number | null
): Promise<Cart & { secret?: string }> {
  if (cartId && Number.isSafeInteger(cartId) && cartId > 0) {
    try {
      const existing = await payload.findByID({
        collection: 'carts',
        id: cartId,
        depth: 0,
      });
      // Return existing cart if not yet completed / purchased
      if (existing && !existing.purchasedAt && !isRetiredCart(existing)) {
        return { ...existing, secret: existing.secret ?? undefined };
      }
    } catch {
      // Cart not found, create new
    }
  }

  // Create new cart in PostgreSQL
  const newCart = await payload.create({
    collection: 'carts',
    data: {
      customer: customerId || undefined,
      currency: 'EGP',
      items: [],
      subtotal: 0,
    },
    depth: 0,
  });

  return { ...newCart, secret: newCart.secret ?? undefined };
}

/**
 * Permissively adds an item to the persistent cart in PostgreSQL.
 * If identical line (same product, variant, artwork, notes) exists, increments quantity.
 * Allows incomplete quantities (e.g. 5 units) while calculating remaining MOQ needed.
 * Strictly idempotent when provided an operationKey.
 */
export async function addItemToCart(
  payload: Payload,
  cartId: number,
  item: CartMutationItem,
  locale: Locale = defaultLocale,
): Promise<CartCalculationSummary> {
  const qty = Number(item.quantity);
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    throw new APIError('INVALID_QUANTITY: Quantity must be a positive whole integer.', 422, undefined, true);
  }

  const opKey = mutationKey(item.operationKey);

  return withCartLock(payload, cartId, async (lockContext) => {
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    assertCartIsEditable(cart);
    const appliedOps = parseAppliedOperations(cart.appliedOperations);
    // IDEMPOTENCY GUARD: If operationKey was already applied, do NOT add again!
    if (appliedOps.includes(opKey)) {
      lockContext.markSaved();
      const hydrated = await hydrateCartLines(cart.items || [], payload, locale);
      return calculateCartSummary(hydrated);
    }

    const requestedProductId = typeof item.productId === 'number' || typeof item.productId === 'string' ? Number(item.productId) : NaN;
    const catalogRead = { depth: 0, draft: false, ...catalogLocale(locale) } as const;
    let product = Number.isSafeInteger(requestedProductId) && requestedProductId > 0
      ? await payload.findByID({ collection: 'products', id: requestedProductId, ...catalogRead, joins: false, disableErrors: true })
      : null;
    if (!product && typeof item.productId === 'string' && item.productId.trim()) {
      const { docs } = await payload.find({
        collection: 'products',
        where: { slug: { equals: item.productId.trim() } },
        limit: 1,
        pagination: false,
        ...catalogRead,
        joins: false,
      });
      product = docs[0] ?? null;
    }

    const numericVariantId = item.variantId == null ? undefined : Number(item.variantId);
    if (numericVariantId !== undefined && (
      (typeof item.variantId !== 'number' && typeof item.variantId !== 'string') ||
      !Number.isSafeInteger(numericVariantId) || numericVariantId <= 0
    )) {
      throw new APIError('VARIANT_UNAVAILABLE: This variant is unavailable.', 422, undefined, true);
    }
    const variant = numericVariantId === undefined ? null : await payload.findByID({
      collection: 'variants', id: numericVariantId, ...catalogRead, disableErrors: true,
    });
    const selectionError = catalogSelectionError(product, numericVariantId, variant, Boolean(item.artworkAssetId));
    if (selectionError || !product) throw new APIError(selectionError ?? 'PRODUCT_UNAVAILABLE', 422, undefined, true);
    const numericProductId = product.id;

    const items = [...(cart.items || [])];

    // Find existing matching line item
    const existingIndex = items.findIndex((existing) => sameCartLine(existing, {
      product: numericProductId,
      variant: numericVariantId,
      artworkAssetId: item.artworkAssetId,
      printingNotes: item.printingNotes,
    }));

    if (existingIndex >= 0) {
      const quantity = items[existingIndex].quantity + qty;
      if (!Number.isSafeInteger(quantity)) throw new APIError('INVALID_QUANTITY', 422, undefined, true);
      items[existingIndex] = {
        ...items[existingIndex],
        quantity,
      };
    } else {
      const lineId = `line_${numericProductId}_${numericVariantId || 0}_${randomUUID()}`;
      items.push({
        id: lineId,
        product: numericProductId,
        variant: numericVariantId || undefined,
        quantity: qty,
        artworkAssetId: item.artworkAssetId || undefined,
        printingNotes: item.printingNotes || undefined,
      });
    }

    // Hydrate and calculate
    const hydrated = await hydrateCartLines(items, payload, locale);
    const addedLine = hydrated[existingIndex < 0 ? items.length - 1 : existingIndex];
    if (addedLine?.availabilityError) throw new APIError(addedLine.availabilityError, 422, undefined, true);
    const summary = calculateCartSummary(hydrated);

    const updatedOps = appendAppliedOperation(opKey, cart.appliedOperations);

    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items,
        subtotal: summary.subtotal,
        appliedOperations: updatedOps,
      },
      depth: 0,
      context: { preserveCartSubtotal: true },
    });

    // Mark as successfully saved in DB before completing
    lockContext.markSaved();

    return summary;
  });
}

/**
 * Updates quantity of a specific line item in the persistent PostgreSQL cart.
 */
export async function updateItemQuantity(
  payload: Payload,
  cartId: number,
  itemId: string,
  newQuantity: number,
  operationKey: string,
  locale: Locale = defaultLocale,
): Promise<CartCalculationSummary> {
  const qty = Number(newQuantity);
  if (!Number.isSafeInteger(qty) || qty < 0) {
    throw new APIError('INVALID_QUANTITY: Quantity must be a non-negative whole integer.', 422, undefined, true);
  }

  const opKey = mutationKey(operationKey);

  return withCartLock(payload, cartId, async (lockContext) => {
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    assertCartIsEditable(cart);
    const appliedOps = parseAppliedOperations(cart.appliedOperations);
    if (appliedOps.includes(opKey)) {
      lockContext.markSaved();
      const hydrated = await hydrateCartLines(cart.items || [], payload, locale);
      return calculateCartSummary(hydrated);
    }

    let items = [...(cart.items || [])];

    if (qty === 0) {
      items = items.filter((it: any, idx: number) => !matchesCartItem(it, idx, itemId));
    } else {
      const targetIndex = items.findIndex((it: any, idx: number) => matchesCartItem(it, idx, itemId));
      if (targetIndex === -1) {
        throw new APIError('CART_ITEM_NOT_FOUND', 404, undefined, true);
      }
      items[targetIndex] = {
        ...items[targetIndex],
        quantity: qty,
      };
    }

    const hydrated = await hydrateCartLines(items, payload, locale);
    const summary = calculateCartSummary(hydrated);

    const updatedOps = appendAppliedOperation(opKey, cart.appliedOperations);

    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items,
        subtotal: summary.subtotal,
        appliedOperations: updatedOps,
      },
      depth: 0,
      context: { preserveCartSubtotal: true },
    });

    lockContext.markSaved();

    return summary;
  });
}

/**
 * Removes a specific line item from the persistent cart in PostgreSQL.
 */
export async function removeItemFromCart(
  payload: Payload,
  cartId: number,
  itemId: string,
  operationKey: string,
  locale: Locale = defaultLocale,
): Promise<CartCalculationSummary> {
  const opKey = mutationKey(operationKey);

  return withCartLock(payload, cartId, async (lockContext) => {
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    assertCartIsEditable(cart);
    const appliedOps = parseAppliedOperations(cart.appliedOperations);
    if (appliedOps.includes(opKey)) {
      lockContext.markSaved();
      const hydrated = await hydrateCartLines(cart.items || [], payload, locale);
      return calculateCartSummary(hydrated);
    }

    const items = (cart.items || []).filter((it: any, idx: number) => !matchesCartItem(it, idx, itemId));
    const hydrated = await hydrateCartLines(items, payload, locale);
    const summary = calculateCartSummary(hydrated);

    const updatedOps = appendAppliedOperation(opKey, cart.appliedOperations);

    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items,
        subtotal: summary.subtotal,
        appliedOperations: updatedOps,
      },
      depth: 0,
      context: { preserveCartSubtotal: true },
    });

    lockContext.markSaved();

    return summary;
  });
}

/**
 * Clears all items from the persistent cart in PostgreSQL.
 */
export async function clearPersistentCart(
  payload: Payload,
  cartId: number,
  operationKey: string,
  locale: Locale = defaultLocale,
): Promise<CartCalculationSummary> {
  const opKey = mutationKey(operationKey);

  return withCartLock(payload, cartId, async (lockContext) => {
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    assertCartIsEditable(cart);
    const appliedOps = parseAppliedOperations(cart.appliedOperations);
    if (appliedOps.includes(opKey)) {
      lockContext.markSaved();
      const hydrated = await hydrateCartLines(cart.items || [], payload, locale);
      return calculateCartSummary(hydrated);
    }

    const updatedOps = appendAppliedOperation(opKey, cart.appliedOperations);

    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items: [],
        subtotal: 0,
        appliedOperations: updatedOps,
      },
      depth: 0,
      context: { preserveCartSubtotal: true },
    });

    lockContext.markSaved();

    return calculateCartSummary([]);
  });
}

/**
 * Retrieves and calculates the current cart state from PostgreSQL.
 */
export async function getCartSummary(
  payload: Payload,
  cartId: number,
  shippingFee: number = 0,
  locale: Locale = defaultLocale,
): Promise<CartCalculationSummary> {
  const cart = await payload.findByID({
    collection: 'carts',
    id: cartId,
    depth: 0,
  });

  if (isRetiredCart(cart)) throw new APIError('CART_NOT_ACTIVE', 409, undefined, true);

  const hydrated = await hydrateCartLines(cart.items || [], payload, locale);
  return calculateCartSummary(hydrated, shippingFee);
}
