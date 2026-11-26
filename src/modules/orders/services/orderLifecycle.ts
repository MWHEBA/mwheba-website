import { sql } from '@payloadcms/db-postgres';
import type { Payload } from 'payload';
import type { FulfillmentJob, Order } from '@/payload-types';
import { hasRole } from '@/modules/identity/access/roles';
import { allowedNext, isCustomerGatedTransition, type FulfillmentStatus } from '@/modules/fulfillment/logic/stateMachine';
import {
  applyInventoryMovement,
  getInventoryTransaction,
  inventoryQuantityLimit,
} from '@/modules/inventory/services/inventoryService';
import { withOrderTransaction, type OrderTransaction } from './orderTransaction';

type Actor = { id: number | string; roles?: string[] } | null | undefined;
type Action = 'cancel' | 'refuse' | 'receive_return';
type ReturnLine = { balanceId: number; receivedQuantity: number; sellableQuantity: number };
type LedgerAllocation = {
  balanceId: number;
  sku: string;
  targetType: 'product' | 'variant';
  targetId: number;
  allocatedQuantity: number;
  restoredQuantity: number;
};
type OrderAudit = NonNullable<Order['auditLog']>;
type LifecycleEvent = {
  action: Action;
  reason: string;
  actor: number;
  at: string;
  restoredQuantity: number;
  receiptReference?: string;
  lines?: ReturnLine[];
};

const AUDIT_PREFIX = 'Order lifecycle ';
const TERMINAL_FULFILLMENT = ['cancelled', 'returned_to_origin'];
const DISPATCH_ORDER = ['shipped', 'delivered', 'returned_to_origin'];
const DISPATCH_JOB = ['shipped', 'delivered'];
const IN_PRODUCTION = ['in_printing', 'quality_check', 'ready_for_pickup'];

class OrderLifecycleError extends Error {
  constructor(readonly code: string, message: string, readonly statusCode: number) {
    super(`${code}: ${message}`);
  }
}

function fail(code: string, message: string, status = 409): never {
  throw new OrderLifecycleError(code, message, status);
}

function boundedText(raw: unknown, max: number, code: string, label: string) {
  if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > max) {
    fail(code, `${label} is required and must contain at most ${max} characters.`, 400);
  }
  return raw.trim();
}

function numericId(raw: unknown, code: string) {
  const value = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 2147483647) {
    fail(code, 'Provide a valid numeric reference.', 400);
  }
  return value;
}

function requireStaff(actor: Actor) {
  if (!actor) fail('UNAUTHENTICATED', 'Sign in to process an order.', 401);
  if (!hasRole(actor, ['super_admin', 'operations'])) {
    fail('FORBIDDEN', 'An operations role is required for inventory restoration.', 403);
  }
  return numericId(actor.id, 'INVALID_ACTOR');
}

export function lifecycleAuditEntries(log?: OrderAudit | null) {
  return (Array.isArray(log) ? log : [])
    .map(({ entry }) => entry)
    .filter((entry): entry is string => Boolean(entry?.startsWith(AUDIT_PREFIX)));
}

function lifecycleEvents(order: Order): LifecycleEvent[] {
  return lifecycleAuditEntries(order.auditLog).map((entry) =>
    JSON.parse(entry.slice(AUDIT_PREFIX.length)) as LifecycleEvent,
  );
}

export function isClosedOrder(order: Pick<Order, 'status' | 'orderStatus' | 'fulfillmentStatus'>) {
  return order.orderStatus === 'cancelled' || order.status === 'cancelled'
    || TERMINAL_FULFILLMENT.includes(order.fulfillmentStatus ?? '');
}

export function hasDispatched(order: Pick<Order, 'fulfillmentStatus'>, jobs: FulfillmentJob[]) {
  return DISPATCH_ORDER.includes(order.fulfillmentStatus ?? '')
    || jobs.some((job) => job.track === 'physical' && DISPATCH_JOB.includes(job.status));
}

function canCancel(order: Order, jobs: FulfillmentJob[]) {
  return !isClosedOrder(order)
    && order.orderStatus !== 'completed' && order.status !== 'completed'
    && !['paid', 'refunded'].includes(order.paymentStatus ?? '')
    && !hasDispatched(order, jobs)
    && !jobs.some((job) => (job.track === 'physical' && job.customized && IN_PRODUCTION.includes(job.status))
      || (job.track === 'service' && ['in_progress', 'review', 'completed'].includes(job.status)));
}

function canRefuse(order: Order, jobs: FulfillmentJob[]) {
  return order.paymentMethod === 'cod' && order.paymentStatus === 'unpaid' && order.deliveryMethod !== 'pickup'
    && !isClosedOrder(order) && (order.fulfillmentStatus === 'shipped'
      || jobs.some((job) => job.track === 'physical' && job.status === 'shipped'));
}

async function getOrder(payload: Payload, orderId: number, req: OrderTransaction) {
  const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, req, disableErrors: true });
  if (!order) fail('ORDER_NOT_FOUND', 'The order could not be found.', 404);
  return order;
}

async function getJobs(payload: Payload, orderId: number, req: OrderTransaction) {
  return (await payload.find({
    collection: 'fulfillment-jobs',
    where: { order: { equals: orderId } },
    sort: 'lineIndex',
    depth: 0,
    pagination: false,
    limit: 0,
    req,
  })).docs;
}

async function getAllocations(payload: Payload, orderId: number, req: OrderTransaction) {
  const tx = await getInventoryTransaction(payload, req);
  const result = await tx.execute(sql`
    SELECT b.id AS "balanceId", b.target_type AS "targetType", b.target_id AS "targetId",
      max(m.sku) FILTER (WHERE m.kind = 'allocation') AS sku,
      (-sum(m.quantity) FILTER (WHERE m.kind = 'allocation'))::integer AS "allocatedQuantity",
      coalesce(sum(m.quantity) FILTER (WHERE m.kind IN ('cancellation', 'return')), 0)::integer AS "restoredQuantity"
    FROM inventory_movements m JOIN inventory_balances b ON b.id = m.balance_id
    WHERE m.order_id = ${orderId}
    GROUP BY b.id, b.target_type, b.target_id
    HAVING count(*) FILTER (WHERE m.kind = 'allocation') > 0
    ORDER BY b.target_type, b.target_id
  `);
  return result.rows as LedgerAllocation[];
}

function dispatchedQuantities(order: Order, jobs: FulfillmentJob[]): Map<string, number> {
  const shipped = new Set(jobs.filter((job) => job.track === 'physical' && DISPATCH_JOB.includes(job.status))
    .map((job) => job.lineIndex));
  const physicalItems = (order.items ?? []).flatMap((item, index) =>
    item.fulfillmentType === 'service' ? [] : [{ item, index }]);
  // A legacy order-level dispatch is unambiguous only when there is one physical line.
  if (physicalItems.length === 1 && DISPATCH_ORDER.includes(order.fulfillmentStatus ?? '')) {
    shipped.add(physicalItems[0].index);
  }
  const quantities = new Map<string, number>();
  for (const { item, index } of physicalItems) {
    if (!shipped.has(index)) continue;
    const target = item.variant ?? item.product;
    const id = typeof target === 'object' ? target?.id : target;
    if (id == null) continue;
    const key = `${item.variant == null ? 'product' : 'variant'}:${id}`;
    quantities.set(key, (quantities.get(key) ?? 0) + item.quantity);
  }
  return quantities;
}

function returnCapacity(
  row: LedgerAllocation,
  shipped: Map<string, number>,
  received: Map<number, number>,
) {
  const dispatched = shipped.get(`${row.targetType}:${row.targetId}`) ?? 0;
  return Math.max(0, Math.min(row.allocatedQuantity, dispatched)
    - Math.max(row.restoredQuantity, received.get(row.balanceId) ?? 0));
}

function priorReceiptQuantities(order: Order): Map<number, number> {
  const received = new Map<number, number>();
  for (const event of lifecycleEvents(order)) {
    for (const line of event.lines ?? []) {
      received.set(line.balanceId, (received.get(line.balanceId) ?? 0) + line.receivedQuantity);
    }
  }
  return received;
}

function cancellationAudit(audit: OrderAudit | null | undefined, event: LifecycleEvent): OrderAudit {
  return [...(audit ?? []), { entry: `${AUDIT_PREFIX}${JSON.stringify(event)}` }];
}

async function saveLifecycleEvent(
  payload: Payload,
  req: OrderTransaction,
  order: Order,
  event: LifecycleEvent,
  data: Partial<Order> = {},
) {
  return payload.update({
    collection: 'orders',
    id: order.id,
    data: { ...data, auditLog: cancellationAudit(order.auditLog, event) },
    context: { orderLifecycleEngine: true },
    req,
  });
}

async function verifyCommittedEvent(payload: Payload, orderId: number, event: LifecycleEvent) {
  const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, disableErrors: true });
  if (!order || !lifecycleEvents(order).some((saved) => saved.action === event.action
    && saved.receiptReference === event.receiptReference && saved.at === event.at)) {
    fail('ORDER_COMMIT_NOT_CONFIRMED', 'The order change could not be confirmed. Retry the same request.', 503);
  }
}

export async function getOrderLifecycle(payload: Payload, rawOrderId: unknown, user: Actor) {
  requireStaff(user);
  const orderId = numericId(rawOrderId, 'INVALID_ORDER_ID');
  return withOrderTransaction(payload, orderId, async (req) => {
    const order = await getOrder(payload, orderId, req);
    const jobs = await getJobs(payload, orderId, req);
    const received = priorReceiptQuantities(order);
    const shipped = dispatchedQuantities(order, jobs);
    const balances = (await getAllocations(payload, orderId, req))
      .map((row) => ({ ...row, remainingQuantity: returnCapacity(row, shipped, received) }));
    return {
      orderStatus: order.orderStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      canCancel: canCancel(order, jobs),
      canRefuse: canRefuse(order, jobs),
      canReceive: order.fulfillmentStatus !== 'cancelled' && hasDispatched(order, jobs)
        && balances.some((row) => row.remainingQuantity > 0),
      jobs: jobs.filter((job) => job.track === 'physical').map(({ id, status, productTitle }) => {
        const nextStatus = isClosedOrder(order) ? undefined : allowedNext({
          track: 'physical', from: status as FulfillmentStatus, deliveryMethod: order.deliveryMethod ?? 'shipping',
        }).find((target) => !isCustomerGatedTransition(status as FulfillmentStatus, target));
        return { id, status, productTitle, nextStatus };
      }),
      balances,
    };
  });
}

export async function cancelOrderBeforeDispatch(
  payload: Payload,
  params: { orderId: unknown; reason: unknown; actor: Actor },
) {
  const actor = requireStaff(params.actor);
  const orderId = numericId(params.orderId, 'INVALID_ORDER_ID');
  const reason = boundedText(params.reason, 500, 'INVALID_CANCELLATION_REASON', 'Cancellation reason');
  const result = await withOrderTransaction(payload, orderId, async (req) => {
    const order = await getOrder(payload, orderId, req);
    const prior = lifecycleEvents(order).find((event) => event.action === 'cancel');
    if (prior) {
      if (prior.reason !== reason) fail('CANCELLATION_CONFLICT', 'A cancellation is already recorded with a different reason.');
      return { event: prior, replayed: true };
    }
    if (!canCancel(order, await getJobs(payload, orderId, req))) {
      fail('ORDER_CANNOT_CANCEL_BEFORE_DISPATCH', 'The order is dispatched, closed, paid, or has already started custom production or service work.');
    }
    const allocations = await getAllocations(payload, orderId, req);
    const tx = await getInventoryTransaction(payload, req);
    let restoredQuantity = 0;
    for (const row of allocations) {
      const quantity = row.allocatedQuantity - row.restoredQuantity;
      if (quantity <= 0) continue;
      const movement = await applyInventoryMovement(tx, {
        balanceId: row.balanceId, sku: row.sku, operationKey: `order:${orderId}:cancel`,
        kind: 'cancellation', orderId, actorId: actor, quantity, reason,
      });
      if (!movement) fail('STOCK_RESTORE_FAILED', 'The stock balance could not accept the cancellation quantity.');
      restoredQuantity += quantity;
    }
    const event: LifecycleEvent = { action: 'cancel', actor, at: new Date().toISOString(), reason, restoredQuantity };
    await saveLifecycleEvent(payload, req, order, event, {
      status: 'cancelled', orderStatus: 'cancelled', fulfillmentStatus: 'cancelled',
    });
    return { event, replayed: false };
  });
  await verifyCommittedEvent(payload, orderId, result.event);
  return { orderId, status: 'ORDER_CANCELLED', ...result };
}

export async function recordCodOrderRefusal(
  payload: Payload,
  params: { orderId: unknown; refusalReason: unknown; actor: Actor },
) {
  if (!params.actor || !hasRole(params.actor, ['super_admin', 'operations', 'finance'])) {
    fail('FORBIDDEN', 'Insufficient privileges to record delivery refusal.', 403);
  }
  const actor = numericId(params.actor.id, 'INVALID_ACTOR');
  const orderId = numericId(params.orderId, 'INVALID_ORDER_ID');
  const reason = boundedText(params.refusalReason, 500, 'INVALID_REFUSAL_REASON', 'Refusal reason');
  const result = await withOrderTransaction(payload, orderId, async (req) => {
    const order = await getOrder(payload, orderId, req);
    const prior = lifecycleEvents(order).find((event) => event.action === 'refuse');
    if (prior) {
      if (prior.reason !== reason) fail('REFUSAL_CONFLICT', 'A refusal is already recorded with a different reason.');
      return { order, event: prior };
    }
    if (order.paymentStatus === 'paid') {
      fail('CANNOT_REFUSE_PAID_ORDER', 'Order has been paid. Use the formal return and finance workflow.', 422);
    }
    if (!canRefuse(order, await getJobs(payload, orderId, req))) {
      fail('ORDER_CANNOT_RECORD_REFUSAL', 'Delivery refusal requires an unpaid COD shipment still awaiting delivery.');
    }
    const event: LifecycleEvent = { action: 'refuse', actor, at: new Date().toISOString(), reason, restoredQuantity: 0 };
    const updated = await saveLifecycleEvent(payload, req, order, event, {
      status: 'cancelled',
      orderStatus: 'cancelled',
      fulfillmentStatus: 'returned_to_origin',
      codDetails: { ...order.codDetails, refusalReason: reason, refusalRecordedAt: event.at },
    });
    return { order: updated, event };
  });
  await verifyCommittedEvent(payload, orderId, result.event);
  return {
    status: 'DELIVERY_REFUSED_RECORDED',
    orderId,
    orderStatus: result.order.orderStatus,
    fulfillmentStatus: result.order.fulfillmentStatus,
    paymentStatus: result.order.paymentStatus,
    refusalReason: reason,
  };
}

function parseReturnLines(raw: unknown): ReturnLine[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 250) {
    fail('INVALID_RETURN_LINES', 'Specify at least one received item and at most 250.', 400);
  }
  const lines = raw.map((item: unknown) => {
    if (!item || typeof item !== 'object' || !('balanceId' in item) || !('receivedQuantity' in item) || !('sellableQuantity' in item)) {
      fail('INVALID_RETURN_LINES', 'Each item requires a stock reference, received quantity and sellable quantity.', 400);
    }
    const { receivedQuantity, sellableQuantity } = item;
    if (typeof receivedQuantity !== 'number' || !Number.isSafeInteger(receivedQuantity) || receivedQuantity < 1
      || receivedQuantity > inventoryQuantityLimit || typeof sellableQuantity !== 'number'
      || !Number.isSafeInteger(sellableQuantity) || sellableQuantity < 0 || sellableQuantity > receivedQuantity) {
      fail('INVALID_RETURN_QUANTITY', 'Sellable quantity must be a whole number within the physically received quantity.', 400);
    }
    return { balanceId: numericId(item.balanceId, 'INVALID_STOCK_REFERENCE'), receivedQuantity, sellableQuantity };
  }).sort((a, b) => a.balanceId - b.balanceId);
  if (new Set(lines.map(({ balanceId }) => balanceId)).size !== lines.length) {
    fail('INVALID_RETURN_LINES', 'Each stock reference may appear only once per receipt.', 400);
  }
  return lines;
}

export async function receiveOrderReturn(
  payload: Payload,
  params: { orderId: unknown; receiptReference: unknown; reason: unknown; lines: unknown; actor: Actor },
) {
  const actor = requireStaff(params.actor);
  const orderId = numericId(params.orderId, 'INVALID_ORDER_ID');
  const reason = boundedText(params.reason, 500, 'INVALID_RETURN_REASON', 'Inspection reason');
  const receiptReference = boundedText(params.receiptReference, 100, 'INVALID_RETURN_REFERENCE', 'Return receipt reference');
  const lines = parseReturnLines(params.lines);
  const result = await withOrderTransaction(payload, orderId, async (req) => {
    const order = await getOrder(payload, orderId, req);
    const prior = lifecycleEvents(order).find((event) => event.receiptReference === receiptReference);
    if (prior) {
      if (prior.reason !== reason || JSON.stringify(prior.lines) !== JSON.stringify(lines)) {
        fail('RETURN_RECEIPT_CONFLICT', 'This receipt already exists with different inspection details.');
      }
      return { event: prior, replayed: true };
    }
    const jobs = await getJobs(payload, orderId, req);
    if (order.fulfillmentStatus === 'cancelled' || !hasDispatched(order, jobs)) {
      fail('ORDER_NOT_ELIGIBLE_FOR_RETURN', 'Return inspection requires a dispatched or delivered order.');
    }
    const allocations = await getAllocations(payload, orderId, req);
    const byBalance = new Map(lines.map((line) => [line.balanceId, line]));
    const alreadyReceived = priorReceiptQuantities(order);
    const shipped = dispatchedQuantities(order, jobs);
    if (lines.some((line) => !allocations.some((row) => row.balanceId === line.balanceId))) {
      fail('RETURN_WITHOUT_ALLOCATION', 'Only stock with a recorded allocation for this order can be returned.');
    }
    const tx = await getInventoryTransaction(payload, req);
    let restoredQuantity = 0;
    for (const row of allocations) {
      const line = byBalance.get(row.balanceId);
      if (!line) continue;
      if (line.receivedQuantity > returnCapacity(row, shipped, alreadyReceived)) {
        fail('RETURN_QUANTITY_EXCEEDS_ALLOCATION', 'Received units exceed the remaining dispatched quantity for this SKU.');
      }
      if (line.sellableQuantity === 0) continue;
      const movement = await applyInventoryMovement(tx, {
        balanceId: row.balanceId, sku: row.sku, operationKey: `order:${orderId}:return:${receiptReference}`,
        kind: 'return', orderId, actorId: actor, quantity: line.sellableQuantity, reason,
      });
      if (!movement) fail('STOCK_RESTORE_FAILED', 'The stock balance could not accept the approved sellable units.');
      restoredQuantity += line.sellableQuantity;
    }
    const event: LifecycleEvent = {
      action: 'receive_return', actor, at: new Date().toISOString(), reason, restoredQuantity, receiptReference, lines,
    };
    await saveLifecycleEvent(payload, req, order, event);
    return { event, replayed: false };
  });
  await verifyCommittedEvent(payload, orderId, result.event);
  return { orderId, status: 'ORDER_RETURN_INSPECTED', ...result };
}

export { OrderLifecycleError };
