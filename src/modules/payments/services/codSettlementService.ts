/**
 * MWHEBA 2.0 | Cash on Delivery (COD) Collection & Courier Remittance Service (PAY-02)
 *
 * Implements:
 * 1. Single-order and deterministic multi-order concurrency locking (pg_advisory_lock + in-process queue).
 * 2. Strict ACID database transactions with row-level integrity.
 * 3. Cash collection recording with exact integer piastre matching (toIntegerPiastres).
 * 4. Idempotency against duplicate receipt references and already-paid orders.
 * 5. Two-stage courier remittance reconciliation with strict gross and net mathematical amount matching.
 * 6. Double-remittance prevention (rejects already settled orders/collections with HTTP 409).
 * 7. Remittance variance handling (mandatory authorization and notes for any discrepancy).
 * 8. Customer delivery refusal / permanent failure handling without false payments or refunds.
 */

import type { Payload } from 'payload';
import { hasRole } from '@/modules/identity/access/roles';
import { toIntegerPiastres } from '@/modules/orders/logic/orderSnapshotEngine';

export interface RecordCodCollectionParams {
  orderId: string | number;
  collectedAmount: number;
  collectorType: 'courier' | 'office_staff';
  collectorName: string;
  receiptReference: string;
  collectedAt?: string;
  actor: {
    id: string | number;
    roles: string[];
  };
}

export interface RecordDeliveryRefusalParams {
  orderId: string | number;
  refusalReason: string;
  actor: {
    id: string | number;
    roles: string[];
  };
}

export interface ReconcileCourierRemittanceParams {
  batchId: string;
  courierCompany: string;
  orderIds: Array<string | number>;
  grossCollectedAmount: number;
  courierFeeDeductions?: number;
  otherDeductions?: number;
  netDepositAmount: number;
  depositSlipReference: string;
  depositDate: string;
  actor: {
    id: string | number;
    roles: string[];
  };
  varianceApproved?: boolean;
  varianceNotes?: string;
}

// In-process FIFO serialization queue per order to prevent runtime race conditions
const orderMutexes = new Map<string | number, Promise<void>>();

/**
 * Single-Order Concurrency Lock & Atomic Transaction Boundary
 */
export async function withCodDatabaseOrderLock<T>(
  payload: Payload,
  orderId: string | number,
  fn: (ctx: { req: any }) => Promise<T>
): Promise<T> {
  const numericOrderId = Number(orderId) || 0;

  // Layer 1: In-process FIFO serialization queue
  const previous = orderMutexes.get(orderId) || Promise.resolve();
  let resolveCurrent: () => void;
  const current = new Promise<void>((resolve) => {
    resolveCurrent = resolve;
  });

  orderMutexes.set(orderId, previous.then(() => current, () => current));

  try {
    await previous;

    const pool = (payload.db as any)?.pool;
    const isPostgres = pool && typeof pool.connect === 'function';

    const executeInTransaction = async (): Promise<T> => {
      if (typeof (payload.db as any)?.beginTransaction !== 'function') {
        throw new Error(
          'TRANSACTION_UNAVAILABLE: Financial settlement operation requires active database transaction support.'
        );
      }

      const transactionID = await (payload.db as any).beginTransaction();
      const req = { transactionID } as any;

      try {
        const result = await fn({ req });
        await (payload.db as any).commitTransaction(transactionID);
        return result;
      } catch (innerErr) {
        try {
          await (payload.db as any).rollbackTransaction(transactionID);
        } catch {
          // rollback attempted
        }
        throw innerErr;
      }
    };

    if (isPostgres && numericOrderId > 0) {
      // Layer 2: PostgreSQL server-level advisory lock across independent processes
      const client = await pool.connect();
      const lockKey = (8900000000000000000n + BigInt(numericOrderId % 1000000000)).toString();
      try {
        await client.query('SELECT pg_advisory_lock($1)', [lockKey]);
        return await executeInTransaction();
      } finally {
        try {
          await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
        } catch {
          // unlock attempted
        }
        client.release();
      }
    } else {
      return await executeInTransaction();
    }
  } finally {
    orderMutexes.delete(orderId);
    resolveCurrent!();
  }
}

/**
 * Deterministic Multi-Order Concurrency Lock & Atomic Transaction Boundary
 * Locks orders in sorted order to guarantee complete deadlock freedom across concurrent batch operations.
 */
export async function withCodDatabaseMultiOrderLock<T>(
  payload: Payload,
  orderIds: Array<string | number>,
  fn: (ctx: { req: any }) => Promise<T>
): Promise<T> {
  const sortedIds = [...new Set(orderIds.map(String))].sort((a, b) => a.localeCompare(b));

  const acquireInProcessMutexes = async (index: number): Promise<T> => {
    if (index >= sortedIds.length) {
      // All in-process locks acquired. Now acquire PostgreSQL advisory locks and execute in transaction.
      const pool = (payload.db as any)?.pool;
      const isPostgres = pool && typeof pool.connect === 'function';

      const executeInTransaction = async (): Promise<T> => {
        if (typeof (payload.db as any)?.beginTransaction !== 'function') {
          throw new Error(
            'TRANSACTION_UNAVAILABLE: Financial remittance operation requires active database transaction support.'
          );
        }

        const transactionID = await (payload.db as any).beginTransaction();
        const req = { transactionID } as any;

        try {
          const result = await fn({ req });
          await (payload.db as any).commitTransaction(transactionID);
          return result;
        } catch (innerErr) {
          try {
            await (payload.db as any).rollbackTransaction(transactionID);
          } catch {
            // rollback attempted
          }
          throw innerErr;
        }
      };

      if (isPostgres) {
        // Use a single client connection to hold all advisory locks for the batch
        const lockClient = await pool.connect();
        const acquiredLockKeys: string[] = [];
        try {
          for (const idStr of sortedIds) {
            const numericId = Number(idStr) || 0;
            if (numericId > 0) {
              const lockKey = (8900000000000000000n + BigInt(numericId % 1000000000)).toString();
              await lockClient.query('SELECT pg_advisory_lock($1)', [lockKey]);
              acquiredLockKeys.push(lockKey);
            }
          }
          return await executeInTransaction();
        } finally {
          for (const lockKey of acquiredLockKeys.reverse()) {
            try {
              await lockClient.query('SELECT pg_advisory_unlock($1)', [lockKey]);
            } catch {
              // unlock attempted
            }
          }
          lockClient.release();
        }
      } else {
        return await executeInTransaction();
      }
    }

    const currentId = sortedIds[index];
    const previous = orderMutexes.get(currentId) || Promise.resolve();
    let resolveCurrent: () => void;
    const current = new Promise<void>((resolve) => {
      resolveCurrent = resolve;
    });

    orderMutexes.set(currentId, previous.then(() => current, () => current));

    try {
      await previous;
      return await acquireInProcessMutexes(index + 1);
    } finally {
      orderMutexes.delete(currentId);
      resolveCurrent!();
    }
  };

  return acquireInProcessMutexes(0);
}

/**
 * 1. Record Cash on Delivery (COD) Collection
 * Enforces:
 * - RBAC: authorized roles ('super_admin', 'finance', 'operations')
 * - ACID database transaction with order lock
 * - Exact integer piastre matching (toIntegerPiastres)
 * - Idempotency for repeated receipt references
 * - Order paymentStatus -> 'paid', remittanceStatus -> 'collected_by_courier' or 'remitted_to_company'
 * - Creation of immutable PaymentCollection record
 */
export async function recordCodCollection(
  payload: Payload,
  params: RecordCodCollectionParams,
  options?: { failOrderUpdateForTest?: boolean }
) {
  const { orderId, collectedAmount, collectorType, collectorName, receiptReference, collectedAt, actor } = params;

  // 1. RBAC authorization check
  if (!actor || !hasRole(actor, ['super_admin', 'finance', 'operations'])) {
    const err = new Error('FORBIDDEN: Unauthorized user attempted to record cash collection.');
    (err as any).statusCode = 403;
    throw err;
  }

  if (!receiptReference || !receiptReference.trim()) {
    const err = new Error('INVALID_RECEIPT_REFERENCE: A valid collection receipt reference is required.');
    (err as any).statusCode = 400;
    throw err;
  }

  return withCodDatabaseOrderLock(payload, orderId, async ({ req }) => {
    // 2. Fetch order within the transaction
    const order = (await payload.findByID({
      collection: 'orders' as any,
      id: orderId,
      overrideAccess: true,
      req,
    })) as any;

    if (!order) {
      const err = new Error(`ORDER_NOT_FOUND: Order with ID ${orderId} does not exist.`);
      (err as any).statusCode = 404;
      throw err;
    }

    // 2b. Validate payment method
    if (order.paymentMethod && order.paymentMethod !== 'cod') {
      const err = new Error(
        `INVALID_PAYMENT_METHOD: Order ${orderId} has paymentMethod '${order.paymentMethod}', not 'cod'. Cash on delivery collection can only be recorded for COD orders.`
      );
      (err as any).statusCode = 422;
      throw err;
    }

    // 2c. Reject collection on cancelled or returned/refused orders
    if (
      order.orderStatus === 'cancelled' ||
      order.status === 'cancelled' ||
      order.fulfillmentStatus === 'returned_to_origin'
    ) {
      const err = new Error(
        `CANNOT_COLLECT_CANCELLED_OR_REFUSED_ORDER: Cannot record cash collection for order in status '${order.orderStatus || order.status}' with fulfillment '${order.fulfillmentStatus}'. Refused or cancelled orders require specialized return handling.`
      );
      (err as any).statusCode = 422;
      throw err;
    }

    // 3. Idempotency Check:
    // Check if receiptReference already exists
    const existingByRef = await payload.find({
      collection: 'payment-collections' as any,
      where: {
        receiptReference: { equals: receiptReference },
      },
      overrideAccess: true,
      req,
      limit: 1,
    });

    if (existingByRef.docs.length > 0) {
      const existingDoc = existingByRef.docs[0] as any;
      const existingOrderId =
        typeof existingDoc.order === 'object' && existingDoc.order !== null
          ? existingDoc.order.id
          : existingDoc.order;

      if (String(existingOrderId) === String(order.id) && order.paymentStatus === 'paid') {
        return {
          status: 'ALREADY_COLLECTED',
          message: 'This collection receipt has already been registered in the system.',
          collectionId: existingDoc.id,
          orderId: order.id,
          paymentStatus: order.paymentStatus,
          remittanceStatus: order.remittanceStatus,
          collectedAmount: existingDoc.amount,
        };
      } else {
        const err = new Error(
          `RECEIPT_ALREADY_USED: Receipt reference '${receiptReference}' has already been registered for order ${existingOrderId}. Each collection receipt must be unique.`
        );
        (err as any).statusCode = 409;
        throw err;
      }
    }

    // Check if order is already marked paid
    if (order.paymentStatus === 'paid') {
      const existingForOrder = await payload.find({
        collection: 'payment-collections' as any,
        where: { order: { equals: order.id } },
        overrideAccess: true,
        req,
        limit: 1,
      });

      return {
        status: 'ALREADY_PAID',
        message: 'Order is already marked as paid.',
        collectionId: existingForOrder.docs[0]?.id,
        orderId: order.id,
        paymentStatus: order.paymentStatus,
        remittanceStatus: order.remittanceStatus,
        collectedAmount: order.codDetails?.collectedAmount || order.total,
      };
    }

    // 4. Exact Penny-Perfect Amount Matching using Integer Piastres
    const expectedTotal = Number(order.amount ?? order.total ?? 0);
    const expectedPiastres = toIntegerPiastres(expectedTotal, 'Order grand total');
    const collectedPiastres = toIntegerPiastres(collectedAmount, 'Collected cash amount');

    if (collectedPiastres !== expectedPiastres) {
      const err = new Error(
        `AMOUNT_MISMATCH: Collected amount (${collectedAmount} EGP / ${collectedPiastres} piastres) does not match order grand total (${expectedTotal} EGP / ${expectedPiastres} piastres). Exact integer piastre matching is strictly required.`
      );
      (err as any).statusCode = 422;
      throw err;
    }

    // 5. Determine remittance status
    const newRemittanceStatus = collectorType === 'courier' ? 'collected_by_courier' : 'remitted_to_company';
    const colRemittanceStatus = collectorType === 'courier' ? 'pending_remittance' : 'remitted_to_company';

    // 6. Create immutable PaymentCollection record inside the transaction
    if (req) {
      req.context = {
        ...(req.context || {}),
        isCodCollectionEngine: true,
      };
    }

    const collectionRecord = await payload.create({
      collection: 'payment-collections' as any,
      data: {
        receiptReference,
        order: order.id,
        amount: collectedAmount,
        collectorType,
        collectorName,
        collectedAt: collectedAt || new Date().toISOString(),
        remittanceStatus: colRemittanceStatus,
        recordedBy: actor.id,
      },
      overrideAccess: true,
      req,
      context: {
        isCodCollectionEngine: true,
      },
    });

    // Test hook for simulating crash / update failure
    if (options?.failOrderUpdateForTest) {
      throw new Error('SIMULATED_ORDER_UPDATE_FAILURE: Simulated failure during order status update.');
    }

    // 7. Update order inside the same transaction
    const updateContext = {
      isCodCollectionEngine: true,
      collectionId: collectionRecord.id,
    };

    if (req) {
      req.context = {
        ...(req.context || {}),
        ...updateContext,
      };
    }

    const updatedOrder = (await payload.update({
      collection: 'orders' as any,
      id: orderId,
      data: {
        paymentStatus: 'paid',
        paidAt: new Date().toISOString(),
        remittanceStatus: newRemittanceStatus,
        codDetails: {
          requiredAmount: expectedTotal,
          collectedAmount,
          collectorType,
          collectorName,
          collectedAt: collectedAt || new Date().toISOString(),
          collectionReference: receiptReference,
        },
      },
      overrideAccess: true,
      req,
      context: updateContext,
    })) as any;

    return {
      status: 'COLLECTION_RECORDED',
      collectionId: collectionRecord.id,
      orderId: updatedOrder.id,
      paymentStatus: updatedOrder.paymentStatus,
      remittanceStatus: updatedOrder.remittanceStatus,
      collectedAmount,
    };
  });
}

/**
 * 2. Record Customer Delivery Refusal or Permanent Delivery Failure
 * Ensures:
 * - orderStatus -> 'cancelled'
 * - fulfillmentStatus -> 'returned_to_origin'
 * - paymentStatus strictly remains 'unpaid'
 * - Zero false payments or refunds logged.
 */
export async function recordDeliveryRefusal(
  payload: Payload,
  params: RecordDeliveryRefusalParams
) {
  const { orderId, refusalReason, actor } = params;

  if (!actor || !hasRole(actor, ['super_admin', 'operations', 'finance'])) {
    const err = new Error('FORBIDDEN: Insufficient privileges to record delivery refusal.');
    (err as any).statusCode = 403;
    throw err;
  }

  if (!refusalReason || !refusalReason.trim()) {
    const err = new Error('INVALID_REFUSAL_REASON: Documentation of refusal reason is mandatory.');
    (err as any).statusCode = 400;
    throw err;
  }

  return withCodDatabaseOrderLock(payload, orderId, async ({ req }) => {
    const order = (await payload.findByID({
      collection: 'orders' as any,
      id: orderId,
      overrideAccess: true,
      req,
    })) as any;

    if (!order) {
      const err = new Error(`ORDER_NOT_FOUND: Order ${orderId} not found.`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (order.paymentStatus === 'paid') {
      const err = new Error(
        'CANNOT_REFUSE_PAID_ORDER: Order has already been paid in full. Initiate formal refund process instead.'
      );
      (err as any).statusCode = 422;
      throw err;
    }

    const updated = (await payload.update({
      collection: 'orders' as any,
      id: orderId,
      data: {
        status: 'cancelled',
        orderStatus: 'cancelled',
        fulfillmentStatus: 'returned_to_origin',
        // paymentStatus is strictly kept unpaid
        paymentStatus: 'unpaid',
        codDetails: {
          ...(order.codDetails || {}),
          refusalReason,
          refusalRecordedAt: new Date().toISOString(),
        },
      },
      overrideAccess: true,
      req,
    })) as any;

    return {
      status: 'DELIVERY_REFUSED_RECORDED',
      orderId: updated.id,
      orderStatus: updated.orderStatus || 'cancelled',
      fulfillmentStatus: updated.fulfillmentStatus,
      paymentStatus: updated.paymentStatus, // 'unpaid'
      refusalReason,
    };
  });
}

/**
 * 3. Reconcile Courier Cash Remittance Batch (PAY-02)
 * Enforces:
 * - Deterministic Multi-Order Locking: locks all orders in sorted order (deadlock-free).
 * - Single ACID Database Transaction across batch creation, order status, and collection records.
 * - Deduplication: Rejects duplicate order IDs in batch (prevents double counting).
 * - Verified Collection Correlation: Matches against actual PaymentCollection docs.
 * - Double-Remittance Prevention: Rejects orders or collections already remitted with HTTP 409.
 * - Exact Amount Matching: grossCollectedAmount === sum(order.total) in exact integer piastres.
 * - Net Calculation: expectedNet = grossCollectedAmount - courierFees - otherDeductions.
 * - Variance Enforcement: actual deposit must match expectedNet unless varianceApproved is true with mandatory notes.
 * - Updates orders and collection records to 'remitted_to_company'.
 */
export async function reconcileCourierRemittanceBatch(
  payload: Payload,
  params: ReconcileCourierRemittanceParams,
  options?: { failDuringBatchUpdateForTest?: boolean }
) {
  const {
    batchId,
    courierCompany,
    orderIds,
    grossCollectedAmount,
    courierFeeDeductions = 0,
    otherDeductions = 0,
    netDepositAmount,
    depositSlipReference,
    depositDate,
    actor,
    varianceApproved = false,
    varianceNotes = '',
  } = params;

  // 1. RBAC Check: Finance or Super Admin only
  if (!actor || !hasRole(actor, ['super_admin', 'finance'])) {
    const err = new Error('FORBIDDEN: Only finance or super-admin can reconcile courier remittance batches.');
    (err as any).statusCode = 403;
    throw err;
  }

  if (!batchId || !batchId.trim()) {
    const err = new Error('INVALID_BATCH_ID: A unique batch identifier is required.');
    (err as any).statusCode = 400;
    throw err;
  }

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    const err = new Error('INVALID_BATCH: At least one order must be included in remittance batch.');
    (err as any).statusCode = 422;
    throw err;
  }

  // 2. DEFENSE AGAINST DUPLICATE ORDER IDS IN BATCH
  const uniqueOrderIds = new Set(orderIds.map(String));
  if (uniqueOrderIds.size !== orderIds.length) {
    const err = new Error(
      'DUPLICATE_ORDER_IN_BATCH: Remittance batch contains duplicate order references. Each order must appear only once.'
    );
    (err as any).statusCode = 422;
    throw err;
  }

  // 3. Acquire Deterministic Locks & Single Database Transaction across all orders in batch
  return withCodDatabaseMultiOrderLock(payload, orderIds, async ({ req }) => {
    // 3a. Check if batchId already exists
    const existingBatch = await payload.find({
      collection: 'courier-remittances' as any,
      where: { batchId: { equals: batchId } },
      overrideAccess: true,
      req,
      limit: 1,
    });

    if (existingBatch.docs.length > 0) {
      const err = new Error(`BATCH_ALREADY_EXISTS: Courier remittance batch '${batchId}' has already been registered.`);
      (err as any).statusCode = 409;
      throw err;
    }

    let calculatedGrossPiastres = 0;
    const verifiedOrders: any[] = [];
    const verifiedCollections: any[] = [];

    for (const oid of orderIds) {
      const order = (await payload.findByID({
        collection: 'orders' as any,
        id: oid,
        overrideAccess: true,
        req,
      })) as any;

      if (!order) {
        const err = new Error(`ORDER_NOT_FOUND: Order ${oid} included in remittance batch was not found.`);
        (err as any).statusCode = 404;
        throw err;
      }

      // Double-remittance prevention: check if order is already remitted
      if (order.remittanceStatus === 'remitted_to_company') {
        const prevBatch = order.codDetails?.courierRemittanceBatchId || 'UNKNOWN';
        const err = new Error(
          `DOUBLE_REMITTANCE_ERROR: Order ${oid} has already been remitted to company in batch '${prevBatch}'. Double remittance is strictly forbidden.`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      // Must be paid and collected by courier
      if (order.paymentStatus !== 'paid' || order.remittanceStatus !== 'collected_by_courier') {
        const err = new Error(
          `ORDER_NOT_COLLECTED: Order ${oid} cannot be remitted because its current status (paymentStatus: '${order.paymentStatus}', remittanceStatus: '${order.remittanceStatus}') is not collected_by_courier.`
        );
        (err as any).statusCode = 422;
        throw err;
      }

      // Check for actual payment-collection record
      const colRes = await payload.find({
        collection: 'payment-collections' as any,
        where: {
          order: { equals: oid },
        },
        overrideAccess: true,
        req,
        limit: 1,
      });

      if (colRes.docs.length === 0) {
        const err = new Error(
          `ORDER_COLLECTION_RECORD_MISSING: Order ${oid} has no verified PaymentCollection record in the system.`
        );
        (err as any).statusCode = 422;
        throw err;
      }

      const colDoc = colRes.docs[0] as any;
      if (colDoc.remittanceStatus === 'remitted_to_company') {
        const err = new Error(
          `DOUBLE_REMITTANCE_ERROR: PaymentCollection for order ${oid} is already marked as remitted_to_company.`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      const orderAmount = Number(order.amount ?? order.total ?? 0);
      const orderPiastres = toIntegerPiastres(orderAmount, `Order ${oid} total`);
      calculatedGrossPiastres += orderPiastres;

      verifiedOrders.push(order);
      verifiedCollections.push(colDoc);
    }

    // 4. Mathematical Gross Matching
    const grossPiastres = toIntegerPiastres(grossCollectedAmount, 'grossCollectedAmount');
    if (calculatedGrossPiastres !== grossPiastres) {
      const err = new Error(
        `GROSS_AMOUNT_MISMATCH: Stated grossCollectedAmount (${grossCollectedAmount} EGP / ${grossPiastres} piastres) does not match sum of selected orders (${calculatedGrossPiastres / 100} EGP / ${calculatedGrossPiastres} piastres).`
      );
      (err as any).statusCode = 422;
      throw err;
    }

    // 5. Net Deposit Calculation & Variance Verification
    const courierFeePiastres =
      courierFeeDeductions && courierFeeDeductions > 0
        ? toIntegerPiastres(courierFeeDeductions, 'courierFeeDeductions')
        : 0;
    const otherDeductionsPiastres =
      otherDeductions && otherDeductions > 0
        ? toIntegerPiastres(otherDeductions, 'otherDeductions')
        : 0;

    const expectedNetPiastres = grossPiastres - courierFeePiastres - otherDeductionsPiastres;
    if (expectedNetPiastres < 0) {
      const err = new Error('INVALID_DEDUCTIONS: Total deductions exceed gross collected amount.');
      (err as any).statusCode = 422;
      throw err;
    }

    const actualDepositPiastres = toIntegerPiastres(netDepositAmount, 'netDepositAmount');
    const discrepancyPiastres = Math.abs(actualDepositPiastres - expectedNetPiastres);

    if (discrepancyPiastres !== 0) {
      if (!varianceApproved || !varianceNotes?.trim()) {
        const diffEgp = (discrepancyPiastres / 100).toFixed(2);
        const expectedNetEgp = (expectedNetPiastres / 100).toFixed(2);
        const err = new Error(
          `REMITTANCE_VARIANCE_MISMATCH: Actual deposit (${netDepositAmount} EGP) does not match expected net (${expectedNetEgp} EGP). Discrepancy of ${diffEgp} EGP requires explicit variance approval (varianceApproved: true) and explanatory notes.`
        );
        (err as any).statusCode = 422;
        throw err;
      }
    }

    // 6. Create immutable CourierRemittance record inside the transaction
    if (req) {
      req.context = {
        ...(req.context || {}),
        isCourierRemittanceEngine: true,
      };
    }

    const remittanceDoc = (await payload.create({
      collection: 'courier-remittances' as any,
      data: {
        batchId,
        courierCompany,
        grossCollectedAmount,
        courierFeeDeductions,
        otherDeductions,
        netDepositAmount,
        depositSlipReference,
        depositDate,
        orders: verifiedOrders.map((o) => o.id),
        status: discrepancyPiastres > 0 ? 'discrepancy' : 'reconciled',
        varianceApproved: Boolean(varianceApproved),
        varianceNotes: varianceNotes || '',
        reconciledBy: actor.id,
      },
      overrideAccess: true,
      req,
      context: {
        isCourierRemittanceEngine: true,
      },
    })) as any;

    // Test hook for simulating crash / update failure midway through batch updates
    if (options?.failDuringBatchUpdateForTest) {
      throw new Error('SIMULATED_REMITTANCE_UPDATE_FAILURE: Simulated crash during batch status update.');
    }

    // 7. Mark each order and associated payment collection as 'remitted_to_company' inside transaction
    for (const order of verifiedOrders) {
      await payload.update({
        collection: 'orders' as any,
        id: order.id,
        data: {
          remittanceStatus: 'remitted_to_company',
          codDetails: {
            ...(order.codDetails || {}),
            courierRemittanceBatchId: batchId,
          },
        },
        overrideAccess: true,
        req,
      });
    }

    for (const col of verifiedCollections) {
      await payload.update({
        collection: 'payment-collections' as any,
        id: col.id,
        data: {
          remittanceStatus: 'remitted_to_company',
          remittanceBatchId: batchId,
        },
        overrideAccess: true,
        req,
        context: {
          isCourierRemittanceEngine: true,
        },
      });
    }

    return {
      status: 'REMITTANCE_SUCCESSFUL',
      batchId,
      remittanceId: remittanceDoc.id,
      orderCount: verifiedOrders.length,
      grossCollectedAmount,
      courierFeeDeductions,
      otherDeductions,
      netDepositAmount,
      expectedNetDeposit: expectedNetPiastres / 100,
      discrepancy: discrepancyPiastres / 100,
      reconciledStatus: remittanceDoc.status,
    };
  });
}
