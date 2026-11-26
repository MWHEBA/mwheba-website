import { sql } from '@payloadcms/db-postgres';
import type { Payload } from 'payload';
import { getInventoryTransaction } from '@/modules/inventory/services/inventoryService';
import { hasRole } from '@/modules/identity/access/roles';
import { toIntegerPiastres } from '@/modules/orders/logic/orderSnapshotEngine';
import { isCourierRemittanceEnabled } from '@/modules/orders/services/checkoutFulfillment';
import { getCommerceSettings } from '@/modules/orders/services/deliveryTariff';
import { isClosedOrder, recordCodOrderRefusal } from '@/modules/orders/services/orderLifecycle';
import { withOrderTransaction, type OrderTransaction } from '@/modules/orders/services/orderTransaction';
import type { CourierRemittance, Order, PaymentCollection } from '@/payload-types';
import { codAuditEntries, codAuditEntry, readCodAudit } from './codAudit';

type Actor = { id: string | number; roles?: string[] | null };
type Collector = PaymentCollection['collectorType'];

export interface RecordCodCollectionParams {
  orderId: unknown;
  collectedAmount: unknown;
  currency?: unknown;
  collectorType: unknown;
  collectorName: unknown;
  receiptReference: unknown;
  collectedAt?: unknown;
  actor: Actor;
}

export interface RecordDeliveryRefusalParams {
  orderId: unknown;
  refusalReason: unknown;
  actor: Actor;
}

export interface ReconcileCourierRemittanceParams {
  batchId: unknown;
  courierCompany: unknown;
  orderIds: unknown;
  grossCollectedAmount: unknown;
  courierFeeDeductions?: unknown;
  otherDeductions?: unknown;
  netDepositAmount: unknown;
  depositSlipReference: unknown;
  depositDate: unknown;
  actor: Actor;
  varianceApproved?: unknown;
  varianceNotes?: unknown;
}

export class CodSettlementError extends Error {
  constructor(readonly code: string, message: string, readonly statusCode: number) {
    super(`${code}: ${message}`);
  }
}

function fail(code: string, message: string, statusCode = 422): never {
  throw new CodSettlementError(code, message, statusCode);
}

function numericId(raw: unknown, code: string) {
  const value = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2147483647) {
    fail(code, 'Provide a valid numeric reference.', 400);
  }
  return value;
}

function text(value: unknown, code: string, name: string, limit = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) {
    fail(code, `${name} is required and must contain at most ${limit} characters.`, 400);
  }
  return value.trim();
}

function isoDate(value: unknown, code: string, name: string) {
  const raw = text(value, code, name);
  const date = new Date(raw);
  const day = raw.slice(0, 10);
  const calendarDate = new Date(`${day}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(raw)
    || !Number.isFinite(date.getTime()) || !Number.isFinite(calendarDate.getTime())
    || calendarDate.toISOString().slice(0, 10) !== day) {
    fail(code, `${name} must be a valid ISO date or timestamp.`, 400);
  }
  return date.toISOString();
}

function money(value: unknown, name: string, allowZero = false) {
  if (typeof value !== 'number') fail('INVALID_MONETARY_AMOUNT', `${name} must be a number.`);
  if (allowZero && value === 0) return 0;
  let amount: number;
  try {
    amount = toIntegerPiastres(value, name);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INVALID_MONETARY_AMOUNT: Invalid amount.';
    const [code, ...details] = message.split(': ');
    fail(code, details.join(': '), 422);
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    fail('INVALID_MONETARY_AMOUNT', `${name} must fit in whole piastres.`);
  }
  return amount;
}

function orderPiastres(order: Order) {
  const amount = order.grandTotalPiastres ?? money(Number(order.amount), 'Legacy order total');
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    fail('INVALID_ORDER_TOTAL', 'The order has no valid frozen total.');
  }
  return amount;
}

const settlementRoles = ['super_admin', 'finance', 'operations'] as const;

function requireActor(actor: Actor | null | undefined, financeOnly = false) {
  if (!actor) fail('AUTHENTICATION_REQUIRED', 'Sign in to process COD payments.', 401);
  if (!hasRole(actor, financeOnly ? ['super_admin', 'finance'] : [...settlementRoles])) {
    fail('FORBIDDEN', 'Your role cannot perform this cash settlement action.', 403);
  }
  return numericId(actor.id, 'INVALID_ACTOR');
}

const idOf = (value: number | { id: number }) => typeof value === 'number' ? value : value.id;

async function findOrder(payload: Payload, id: number, req?: OrderTransaction) {
  const order = await payload.findByID({ collection: 'orders', id, depth: 0, req, disableErrors: true });
  if (!order) fail('ORDER_NOT_FOUND', 'Order not found.', 404);
  return order;
}

function requireCod(order: Order) {
  if (order.paymentMethod !== 'cod') {
    fail('INVALID_PAYMENT_METHOD', 'Cash collection requires a cash-on-delivery order.');
  }
}

function requiredCollector(order: Order): Collector | null {
  if (order.deliveryMethod === 'pickup') return 'office_staff';
  if (order.deliveryMethod === 'shipping' || order.deliveryMethod == null) return 'courier';
  return null;
}

async function readyToCollect(payload: Payload, order: Order, req?: OrderTransaction) {
  const collector = requiredCollector(order);
  const eligible: string[] = collector === 'office_staff' ? ['ready_for_pickup', 'delivered'] : ['delivered'];
  if (!collector || order.proofStatus === 'proof_pending' || !eligible.includes(order.fulfillmentStatus ?? '')
    || order.items?.some((item) => item.fulfillmentType === 'service')) {
    return false;
  }
  const jobs = await payload.find({
    collection: 'fulfillment-jobs',
    where: { order: { equals: order.id } },
    depth: 0,
    pagination: false,
    limit: 0,
    req,
  });
  const tariff = order.appliedTariff;
  const currentCheckout = tariff && typeof tariff === 'object' && !Array.isArray(tariff)
    && typeof tariff.configurationReference === 'string';
  if (currentCheckout && jobs.docs.length !== order.items?.length) return false;
  return jobs.docs.every((job) => job.track === 'physical' && eligible.includes(job.status));
}

async function findCollection(payload: Payload, reference: string, req?: OrderTransaction) {
  const result = await payload.find({
    collection: 'payment-collections',
    where: { receiptReference: { equals: reference } },
    limit: 1,
    depth: 0,
    req,
  });
  return result.docs[0];
}

async function findBatch(payload: Payload, batchId: string, req?: OrderTransaction) {
  const result = await payload.find({
    collection: 'courier-remittances',
    where: { batchId: { equals: batchId } },
    limit: 1,
    depth: 0,
    req,
  });
  return result.docs[0];
}

async function lockReference(payload: Payload, req: OrderTransaction, namespace: 'receipt' | 'batch', value: string) {
  const tx = await getInventoryTransaction(payload, req);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${namespace + ':' + value}, 410819))`);
}

type CodWrite<T> = { result: T; verify?: () => Promise<boolean> };

async function writeAndVerify<T>(
  payload: Payload,
  orderIds: number | number[],
  write: (req: OrderTransaction) => Promise<CodWrite<T>>,
): Promise<T> {
  let completed: CodWrite<T> | undefined;
  try {
    completed = await withOrderTransaction(payload, orderIds, async (req) => {
      completed = await write(req);
      return completed;
    });
  } catch (error) {
    if (!completed?.verify || !(await completed.verify())) throw error;
    return completed.result;
  }
  // The pinned adapter can swallow a failed commit, so require a durable read before acknowledging a new write.
  if (completed.verify && !(await completed.verify())) {
    fail('COD_WRITE_UNCONFIRMED', 'The cash settlement could not be confirmed. Retry using the same reference.', 503);
  }
  return completed.result;
}

function appendAudit(order: Order, entry: string) {
  return [...(order.auditLog ?? []), { entry }];
}

async function verifyAudit(payload: Payload, orderId: number, entry: string) {
  const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, disableErrors: true });
  return Boolean(order && codAuditEntries(order.auditLog).includes(entry));
}

export async function getCodOrderSettlement(payload: Payload, rawId: unknown, actor?: Actor | null) {
  requireActor(actor);
  const order = await findOrder(payload, numericId(rawId, 'INVALID_ORDER_ID'));
  requireCod(order);
  const collectionReference = order.codDetails?.collectionReference ?? null;
  const remittanceBatchId = order.codDetails?.courierRemittanceBatchId ?? null;
  const finance = hasRole(actor, ['super_admin', 'finance']);
  const [collection, batch, canCollect] = await Promise.all([
    collectionReference ? findCollection(payload, collectionReference) : undefined,
    remittanceBatchId && finance ? findBatch(payload, remittanceBatchId) : undefined,
    order.paymentStatus === 'unpaid' && !isClosedOrder(order) && readyToCollect(payload, order),
  ]);
  return {
    orderId: order.id,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    remittanceStatus: order.remittanceStatus,
    currency: order.currency ?? 'EGP',
    requiredAmount: orderPiastres(order) / 100,
    collectorType: requiredCollector(order),
    canCollect,
    collectionReference,
    collectionId: collection && idOf(collection.order) === order.id ? collection.id : null,
    refusalReason: order.codDetails?.refusalReason ?? null,
    remittanceBatchId,
    remittanceId: batch?.orders?.some((entry) => idOf(entry) === order.id) ? batch.id : null,
    review: finance ? readCodAudit(order.auditLog).flatMap((entry) => entry.action === 'collection_rejected' ? [{
      code: entry.code,
      at: entry.at,
      reference: entry.reference,
      actor: entry.actor,
      expectedAmount: entry.expectedAmountPiastres / 100,
      submittedAmount: entry.submittedAmountPiastres / 100,
      expectedCurrency: entry.expectedCurrency,
      submittedCurrency: entry.submittedCurrency,
    }] : []) : [],
  };
}

type CollectionResult = {
  status: 'COLLECTION_RECORDED' | 'ALREADY_COLLECTED';
  collectionId: number;
  orderId: number;
  paymentStatus: Order['paymentStatus'];
  remittanceStatus: Order['remittanceStatus'];
  collectedAmount: number;
};

export async function recordCodCollection(
  payload: Payload,
  params: RecordCodCollectionParams,
  options?: { failOrderUpdateForTest?: boolean },
) {
  const actor = requireActor(params.actor);
  const orderId = numericId(params.orderId, 'INVALID_ORDER_ID');
  const receiptReference = text(params.receiptReference, 'INVALID_RECEIPT_REFERENCE', 'Collection receipt reference');
  const collectorName = text(params.collectorName, 'INVALID_COLLECTOR_NAME', 'Collector name');
  const { collectorType } = params;
  if (collectorType !== 'courier' && collectorType !== 'office_staff') {
    fail('INVALID_COLLECTION_CHANNEL', 'Choose a valid collection channel.');
  }
  const collectedAt = params.collectedAt === undefined
    ? undefined : isoDate(params.collectedAt, 'INVALID_COLLECTED_AT', 'Collection timestamp');
  const submittedAmountPiastres = money(params.collectedAmount, 'Collected cash amount', true);
  const result = await writeAndVerify<CollectionResult | CodSettlementError>(payload, orderId, async (req) => {
    await lockReference(payload, req, 'receipt', receiptReference);
    const order = await findOrder(payload, orderId, req);
    requireCod(order);
    if (isClosedOrder(order)) {
      fail('CANNOT_COLLECT_CANCELLED_OR_REFUSED_ORDER', 'Collection is unavailable for a cancelled or refused order.');
    }
    const expectedCurrency = order.currency ?? 'EGP';
    const submittedCurrency = params.currency === undefined ? expectedCurrency
      : text(params.currency, 'CURRENCY_MISMATCH', 'Collection currency', 12);
    const expectedAmountPiastres = orderPiastres(order);
    const existing = await findCollection(payload, receiptReference, req);
    if (existing) {
      if (idOf(existing.order) !== orderId || order.paymentStatus !== 'paid'
        || existing.collectorType !== collectorType || existing.collectorName !== collectorName
        || money(existing.amount, 'Recorded cash amount') !== submittedAmountPiastres
        || submittedCurrency !== expectedCurrency || (collectedAt && existing.collectedAt !== collectedAt)) {
        fail('RECEIPT_ALREADY_USED', 'This receipt reference is already linked to a different collection.', 409);
      }
      return { result: {
        status: 'ALREADY_COLLECTED',
        collectionId: existing.id,
        orderId,
        paymentStatus: order.paymentStatus,
        remittanceStatus: order.remittanceStatus,
        collectedAmount: existing.amount,
      } };
    }
    if (order.paymentStatus !== 'unpaid') {
      fail('ORDER_ALREADY_PAID', 'The order already has a settlement or cannot accept another collection.', 409);
    }
    if (requiredCollector(order) !== collectorType) {
      fail('INVALID_COLLECTION_CHANNEL', 'The collection channel must match the order fulfillment method.');
    }
    if (!(await readyToCollect(payload, order, req))) {
      fail('COD_COLLECTION_NOT_READY', 'Complete delivery or make all items ready for pickup before recording cash.');
    }

    const evidence = { actor, reference: receiptReference, expectedAmountPiastres, submittedAmountPiastres,
      expectedCurrency, submittedCurrency };
    const mismatch = expectedCurrency !== 'EGP' || submittedCurrency !== expectedCurrency ? 'CURRENCY_MISMATCH'
      : submittedAmountPiastres !== expectedAmountPiastres ? 'AMOUNT_MISMATCH' : null;
    if (mismatch) {
      const error = new CodSettlementError(
        mismatch, 'The submitted cash must match the frozen checkout amount and currency. Finance can review this attempt.', 422,
      );
      const alreadyReported = readCodAudit(order.auditLog).some((entry) => entry.action === 'collection_rejected'
        && entry.actor === actor && entry.reference === receiptReference && entry.code === mismatch
        && entry.submittedAmountPiastres === submittedAmountPiastres && entry.submittedCurrency === submittedCurrency);
      if (alreadyReported) return { result: error };
      const entry = codAuditEntry({ action: 'collection_rejected', code: mismatch, at: new Date().toISOString(), ...evidence });
      await payload.update({
        collection: 'orders', id: orderId, data: { auditLog: appendAudit(order, entry) }, req,
        context: { isCodCollectionEngine: true },
      });
      return { result: error, verify: () => verifyAudit(payload, orderId, entry) };
    }

    const now = new Date().toISOString();
    const actualCollectedAt = collectedAt ?? now;
    const amount = submittedAmountPiastres / 100;
    const courier = collectorType === 'courier';
    const collection = await payload.create({
      collection: 'payment-collections',
      data: {
        receiptReference, order: orderId, amount, collectorType, collectorName, collectedAt: actualCollectedAt,
        remittanceStatus: courier ? 'pending_remittance' : 'remitted_to_company', recordedBy: actor,
      },
      depth: 0,
      req,
      context: { isCodCollectionEngine: true },
    });

    if (options?.failOrderUpdateForTest) {
      throw new Error('SIMULATED_ORDER_UPDATE_FAILURE: Simulated failure during order status update.');
    }

    const entry = codAuditEntry({ action: 'collected', at: now, ...evidence });
    const updated = await payload.update({
      collection: 'orders', id: orderId,
      data: {
        paymentStatus: 'paid', paidAt: actualCollectedAt, reconciliationReference: receiptReference,
        remittanceStatus: courier ? 'collected_by_courier' : 'remitted_to_company',
        codDetails: {
          ...order.codDetails,
          requiredAmount: expectedAmountPiastres / 100, collectedAmount: amount,
          collectorType, collectorName, collectedAt: actualCollectedAt, collectionReference: receiptReference,
        },
        auditLog: appendAudit(order, entry),
      },
      depth: 0,
      req,
      context: { isCodCollectionEngine: true },
    });
    return { result: {
      status: 'COLLECTION_RECORDED', collectionId: collection.id, orderId, paymentStatus: updated.paymentStatus,
      remittanceStatus: updated.remittanceStatus, collectedAmount: amount,
    }, verify: async () => {
      const committed = await findCollection(payload, receiptReference);
      return committed?.id === collection.id && await verifyAudit(payload, orderId, entry);
    } };
  });
  if (result instanceof CodSettlementError) throw result;
  return result;
}

export async function recordDeliveryRefusal(payload: Payload, params: RecordDeliveryRefusalParams) {
  return recordCodOrderRefusal(payload, {
    ...params, actor: params.actor && { id: params.actor.id, roles: params.actor.roles ?? undefined },
  });
}

export async function getCourierRemittanceStatus(payload: Payload, actor?: Actor | null) {
  requireActor(actor, true);
  const settings = await getCommerceSettings(payload);
  return { enabled: isCourierRemittanceEnabled(settings.pilotFulfillment) };
}

function remittanceResult(batch: CourierRemittance, status: 'REMITTANCE_SUCCESSFUL' | 'ALREADY_RECONCILED') {
  const expectedNet = money(batch.grossCollectedAmount, 'Gross collections')
    - money(batch.courierFeeDeductions ?? 0, 'Courier fees', true)
    - money(batch.otherDeductions ?? 0, 'Other deductions', true);
  return {
    status, batchId: batch.batchId, remittanceId: batch.id, orderCount: batch.orders?.length ?? 0,
    grossCollectedAmount: batch.grossCollectedAmount, courierFeeDeductions: batch.courierFeeDeductions ?? 0,
    otherDeductions: batch.otherDeductions ?? 0, netDepositAmount: batch.netDepositAmount,
    expectedNetDeposit: expectedNet / 100,
    discrepancy: Math.abs(money(batch.netDepositAmount, 'Net deposit', true) - expectedNet) / 100,
    reconciledStatus: batch.status,
  };
}

export async function reconcileCourierRemittanceBatch(
  payload: Payload,
  params: ReconcileCourierRemittanceParams,
  options?: { failDuringBatchUpdateForTest?: boolean },
) {
  const actor = requireActor(params.actor, true);
  const batchId = text(params.batchId, 'INVALID_BATCH_ID', 'Batch identifier');
  const courierCompany = text(params.courierCompany, 'INVALID_COURIER_COMPANY', 'Courier company');
  const depositSlipReference = text(params.depositSlipReference, 'INVALID_DEPOSIT_REFERENCE', 'Deposit reference');
  const depositDate = isoDate(params.depositDate, 'INVALID_DEPOSIT_DATE', 'Deposit date');
  if (!Array.isArray(params.orderIds) || params.orderIds.length === 0 || params.orderIds.length > 200) {
    fail('INVALID_BATCH', 'Select between 1 and 200 orders for reconciliation.');
  }
  const orderIds = params.orderIds.map((id) => numericId(id, 'INVALID_ORDER_ID')).sort((a, b) => a - b);
  if (new Set(orderIds).size !== orderIds.length) {
    fail('DUPLICATE_ORDER_IN_BATCH', 'Each order may appear only once in a remittance batch.');
  }

  const grossPiastres = money(params.grossCollectedAmount, 'Gross collections');
  const depositedPiastres = money(params.netDepositAmount, 'Net deposit', true);
  const courierFeePiastres = money(params.courierFeeDeductions === undefined ? 0 : params.courierFeeDeductions, 'Courier fees', true);
  const otherDeductionPiastres = money(params.otherDeductions === undefined ? 0 : params.otherDeductions, 'Other deductions', true);
  const expectedNet = grossPiastres - courierFeePiastres - otherDeductionPiastres;
  const grossCollectedAmount = grossPiastres / 100;
  const netDepositAmount = depositedPiastres / 100;
  const courierFeeDeductions = courierFeePiastres / 100;
  const otherDeductions = otherDeductionPiastres / 100;
  if (expectedNet < 0) fail('INVALID_DEDUCTIONS', 'Total deductions exceed gross collections.');
  if (params.varianceApproved !== undefined && typeof params.varianceApproved !== 'boolean') {
    fail('INVALID_VARIANCE_APPROVAL', 'Variance approval must be an explicit checkbox value.', 400);
  }
  const varianceApproved = params.varianceApproved === true;
  const varianceNotes = params.varianceNotes === undefined || params.varianceNotes === ''
    ? '' : text(params.varianceNotes, 'INVALID_VARIANCE_NOTES', 'Variance notes', 1000);
  const discrepancy = depositedPiastres !== expectedNet;

  return writeAndVerify(payload, orderIds, async (req) => {
    await lockReference(payload, req, 'batch', batchId);
    const existing = await findBatch(payload, batchId, req);
    if (existing) {
      const existingOrders = (existing.orders ?? []).map(idOf).sort((a, b) => a - b);
      if (existingOrders.length !== orderIds.length || existingOrders.some((id, index) => id !== orderIds[index])
        || existing.courierCompany !== courierCompany || existing.depositSlipReference !== depositSlipReference
        || existing.depositDate !== depositDate || existing.grossCollectedAmount !== grossCollectedAmount
        || (existing.courierFeeDeductions ?? 0) !== courierFeeDeductions || (existing.otherDeductions ?? 0) !== otherDeductions
        || existing.netDepositAmount !== netDepositAmount || Boolean(existing.varianceApproved) !== varianceApproved
        || (existing.varianceNotes ?? '') !== varianceNotes) {
        fail('BATCH_ALREADY_EXISTS', 'This batch identifier is already used for different remittance details.', 409);
      }
      return { result: remittanceResult(existing, 'ALREADY_RECONCILED') };
    }
    const settings = await getCommerceSettings(payload, { req });
    if (!isCourierRemittanceEnabled(settings.pilotFulfillment)) {
      fail('COURIER_REMITTANCE_DISABLED', 'Courier remittance is disabled for this deployment.', 409);
    }

    let recordedGross = 0;
    const verified: Array<{ order: Order; collection: PaymentCollection }> = [];
    for (const orderId of orderIds) {
      const order = await findOrder(payload, orderId, req);
      if (order.remittanceStatus === 'remitted_to_company') {
        fail('DOUBLE_REMITTANCE_ERROR', `Order ${orderId} was already remitted.`, 409);
      }
      if (order.paymentMethod !== 'cod' || order.paymentStatus !== 'paid'
        || order.remittanceStatus !== 'collected_by_courier' || requiredCollector(order) !== 'courier') {
        fail('ORDER_NOT_COLLECTED', `Order ${orderId} has no pending courier collection.`);
      }
      const reference = order.codDetails?.collectionReference;
      const collection = reference ? await findCollection(payload, reference, req) : undefined;
      if (!collection) fail('ORDER_COLLECTION_RECORD_MISSING', `Order ${orderId} has no verified cash collection.`);
      if (collection.remittanceStatus === 'remitted_to_company' || collection.remittanceBatchId) {
        fail('DOUBLE_REMITTANCE_ERROR', `Collection for order ${orderId} was already remitted.`, 409);
      }
      const collectionAmount = money(collection.amount, 'Recorded courier cash');
      if (idOf(collection.order) !== orderId || collection.collectorType !== 'courier'
        || collection.remittanceStatus !== 'pending_remittance' || collectionAmount !== orderPiastres(order)
        || (order.currency ?? 'EGP') !== 'EGP') {
        fail('ORDER_COLLECTION_RECORD_MISMATCH', `The recorded courier cash does not match order ${orderId}.`);
      }
      recordedGross += collectionAmount;
      verified.push({ order, collection });
    }
    if (recordedGross !== grossPiastres) {
      fail('GROSS_AMOUNT_MISMATCH', 'The reported gross must equal the total of the verified cash collections.');
    }
    if (discrepancy && (!varianceApproved || !varianceNotes)) {
      fail('REMITTANCE_VARIANCE_MISMATCH', 'A deposit variance requires explicit finance approval and explanatory notes.');
    }

    const context = { isCourierRemittanceEngine: true };
    const batch = await payload.create({
      collection: 'courier-remittances',
      data: {
        batchId, courierCompany, orders: orderIds, grossCollectedAmount, courierFeeDeductions, otherDeductions,
        netDepositAmount, depositSlipReference, depositDate, status: discrepancy ? 'discrepancy' : 'reconciled',
        varianceApproved, varianceNotes, reconciledBy: actor,
      },
      depth: 0,
      req,
      context,
    });

    if (options?.failDuringBatchUpdateForTest) {
      throw new Error('SIMULATED_REMITTANCE_UPDATE_FAILURE: Simulated crash during batch status update.');
    }

    const entry = codAuditEntry({ action: 'remitted', actor, at: new Date().toISOString(), reference: batchId });
    for (const { order, collection } of verified) {
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: {
          remittanceStatus: 'remitted_to_company',
          codDetails: { ...order.codDetails, courierRemittanceBatchId: batchId },
          auditLog: appendAudit(order, entry),
        },
        depth: 0,
        req,
        context,
      });
      await payload.update({
        collection: 'payment-collections', id: collection.id,
        data: { remittanceStatus: 'remitted_to_company', remittanceBatchId: batchId },
        depth: 0,
        req,
        context,
      });
    }

    return {
      result: remittanceResult(batch, 'REMITTANCE_SUCCESSFUL'),
      verify: async () => (await findBatch(payload, batchId))?.id === batch.id,
    };
  });
}
