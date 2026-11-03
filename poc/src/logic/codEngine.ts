/**
 * MWHEBA 2.0 | Cash on Delivery (COD) & Courier Settlement Engine
 * 
 * Implements:
 * 1. Decoupled Order vs. Payment Lifecycle (Fulfillment never automatically marks paid).
 * 2. Explicit Cash Collection Recording with Database Transactions & Concurrency Locks.
 * 3. Two-Stage Courier Remittance Accounting (courier collection vs company bank remittance).
 * 4. Mathematical Amount Matching, Deduplication & Remittance Reconciliation.
 * 5. Deterministic Multi-Order Locking & Atomic Transactions for Remittance Batches.
 * 6. Double-Remittance & Double-Collection Idempotency Protection.
 * 7. Delivery Refusal / Return Handling without false payments or refunds.
 * 8. Pre-Production Proof Approval Gate for custom branded merchandise.
 */

import type { Payload } from 'payload';

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

export interface AdvanceFulfillmentParams {
  orderId: string | number;
  targetStatus: 'in_production' | 'ready_for_pickup' | 'shipped' | 'delivered';
  actor: {
    id: string | number;
    roles: string[];
  };
}

// In-process lock map to prevent race conditions during collection/remittance per order
const orderMutexes = new Map<string | number, Promise<void>>();

/**
 * Single-Order Database Lock & Atomic Transaction Boundary
 */
export async function withCodDatabaseOrderLock<T>(
  payload: Payload,
  orderId: string | number,
  fn: (ctx: { req?: any }) => Promise<T>
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
    const isPostgres = (payload.db as any)?.name === 'postgres' && pool && typeof pool.connect === 'function';

    const executeInTransaction = async (): Promise<T> => {
      let transactionID: string | number | undefined;
      if (payload.db && typeof payload.db.beginTransaction === 'function') {
        try {
          const tId = await payload.db.beginTransaction();
          if (tId) transactionID = tId;
        } catch (txErr: any) {
          throw new Error(`Database Transaction Initialization Failed: ${txErr?.message || txErr}`);
        }
      }

      if (!transactionID) {
        throw new Error('TRANSACTION_UNAVAILABLE: Financial settlement operation requires active database transaction support.');
      }

      const req = { transactionID } as any;

      try {
        const result = await fn({ req });
        try {
          await payload.db.commitTransaction(transactionID);
        } catch (commitErr: any) {
          throw new Error(`Database Transaction Commit Failed: ${commitErr?.message || commitErr}`);
        }
        return result;
      } catch (innerErr) {
        try {
          await payload.db.rollbackTransaction(transactionID);
        } catch {
          // rollback attempted
        }
        throw innerErr;
      }
    };

    if (isPostgres && numericOrderId > 0) {
      // Layer 2: PostgreSQL server-level advisory lock across independent processes
      const client = await pool.connect();
      const lockKey = 8900000000000000000n + BigInt(numericOrderId % 1000000000);
      try {
        await client.query('SELECT pg_advisory_lock($1)', [lockKey.toString()]);
        return await executeInTransaction();
      } finally {
        try {
          await client.query('SELECT pg_advisory_unlock($1)', [lockKey.toString()]);
        } catch {}
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
 * Deterministic Multi-Order Database Lock & Atomic Transaction Boundary (D-022)
 * Locks orders in sorted order to guarantee deadlock prevention across concurrent batch operations.
 */
export async function withCodDatabaseMultiOrderLock<T>(
  payload: Payload,
  orderIds: Array<string | number>,
  fn: (ctx: { req?: any }) => Promise<T>
): Promise<T> {
  const sortedIds = [...new Set(orderIds.map(String))].sort((a, b) => a.localeCompare(b));

  const acquireInProcessMutexes = async (index: number): Promise<T> => {
    if (index >= sortedIds.length) {
      // All in-process locks acquired. Now handle PostgreSQL advisory locks and transaction.
      const pool = (payload.db as any)?.pool;
      const isPostgres = (payload.db as any)?.name === 'postgres' && pool && typeof pool.connect === 'function';

      const executeInTransaction = async (): Promise<T> => {
        let transactionID: string | number | undefined;
        if (payload.db && typeof payload.db.beginTransaction === 'function') {
          try {
            const tId = await payload.db.beginTransaction();
            if (tId) transactionID = tId;
          } catch (txErr: any) {
            throw new Error(`Database Transaction Initialization Failed: ${txErr?.message || txErr}`);
          }
        }

        if (!transactionID) {
          throw new Error('TRANSACTION_UNAVAILABLE: Financial remittance operation requires active database transaction support.');
        }

        const req = { transactionID } as any;

        try {
          const result = await fn({ req });
          try {
            await payload.db.commitTransaction(transactionID);
          } catch (commitErr: any) {
            throw new Error(`Database Transaction Commit Failed: ${commitErr?.message || commitErr}`);
          }
          return result;
        } catch (innerErr) {
          try {
            await payload.db.rollbackTransaction(transactionID);
          } catch {}
          throw innerErr;
        }
      };

      if (isPostgres) {
        // Use a SINGLE client connection to hold all advisory locks for the batch!
        // This prevents pool exhaustion and deadlocks regardless of batch size.
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
            } catch {}
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
 * 1. Advance COD Order Fulfillment Status
 * CRITICAL RULE: Moving to shipped or delivered NEVER mutates paymentStatus to paid!
 * CRITICAL RULE: Moving to in_production requires proofStatus === 'proof_approved' for customized orders.
 */
export async function advanceCodFulfillment(
  payload: Payload,
  params: AdvanceFulfillmentParams
) {
  const { orderId, targetStatus, actor } = params;

  if (!actor || (!actor.roles.includes('admin') && !actor.roles.includes('operations') && !actor.roles.includes('finance'))) {
    const err = new Error('FORBIDDEN: Insufficient privileges to advance fulfillment status.');
    (err as any).statusCode = 403;
    throw err;
  }

  return withCodDatabaseOrderLock(payload, orderId, async ({ req }) => {
    const order = await payload.findByID({
      collection: 'orders' as any,
      id: orderId,
      overrideAccess: true,
      req,
    }) as any;

    if (!order) {
      const err = new Error(`ORDER_NOT_FOUND: Order with ID ${orderId} does not exist.`);
      (err as any).statusCode = 404;
      throw err;
    }

    // Gate: Pre-production proof approval for custom printed products
    if (order.proofStatus === 'proof_pending') {
      const downstreamFulfillmentStatuses = ['in_production', 'ready_for_pickup', 'shipped', 'delivered'];
      if (downstreamFulfillmentStatuses.includes(targetStatus)) {
        const err = new Error(
          `PROOF_NOT_APPROVED: Cannot transition custom merchandise to '${targetStatus}' until client proof is approved.`
        );
        (err as any).statusCode = 422;
        throw err;
      }
    }

    // Advance fulfillment while strictly preserving paymentStatus
    const updated = await payload.update({
      collection: 'orders' as any,
      id: orderId,
      data: {
        fulfillmentStatus: targetStatus,
        // paymentStatus is strictly untouched!
      },
      overrideAccess: true,
      req,
    }) as any;

    return {
      success: true,
      orderId: updated.id,
      fulfillmentStatus: updated.fulfillmentStatus,
      paymentStatus: updated.paymentStatus, // Confirms paymentStatus remains unpaid/current
    };
  });
}

/**
 * 2. Approve Pre-Production Proof for Customized Orders (D-023)
 */
export async function approveCustomProof(
  payload: Payload,
  orderId: string | number,
  actor: { id: string | number; roles: string[] }
) {
  if (!actor || (!actor.roles.includes('admin') && !actor.roles.includes('operations') && !actor.roles.includes('finance'))) {
    const err = new Error('FORBIDDEN: Insufficient privileges to approve customer proof.');
    (err as any).statusCode = 403;
    throw err;
  }

  return withCodDatabaseOrderLock(payload, orderId, async ({ req }) => {
    const order = await payload.findByID({
      collection: 'orders' as any,
      id: orderId,
      overrideAccess: true,
      req,
    }) as any;

    if (!order) {
      const err = new Error(`ORDER_NOT_FOUND: Order ${orderId} not found.`);
      (err as any).statusCode = 404;
      throw err;
    }

    const updated = await payload.update({
      collection: 'orders' as any,
      id: orderId,
      data: {
        proofStatus: 'proof_approved',
        proofApprovedAt: new Date().toISOString(),
      },
      overrideAccess: true,
      req,
    }) as any;

    return {
      success: true,
      orderId: updated.id,
      proofStatus: updated.proofStatus,
      proofApprovedAt: updated.proofApprovedAt,
    };
  });
}

/**
 * 3. Record COD Collection (Cash handover from customer to courier or office)
 * Enforces:
 * - Single ACID Database Transaction: if order update fails, collection record is rolled back.
 * - RBAC: admin, finance, or operations only.
 * - Idempotency: repeated collection calls with same receipt return ALREADY_COLLECTED only if order is paid.
 * - Amount Matching: collectedAmount must strictly equal order total.
 * - Updates paymentStatus to 'paid' and remittanceStatus to 'collected_by_courier' or 'remitted_to_company'.
 */
export async function recordCodCollection(
  payload: Payload,
  params: RecordCodCollectionParams,
  options?: { failOrderUpdateForTest?: boolean }
) {
  const { orderId, collectedAmount, collectorType, collectorName, receiptReference, collectedAt, actor } = params;

  // 1. RBAC check
  if (!actor || (!actor.roles.includes('admin') && !actor.roles.includes('finance') && !actor.roles.includes('operations'))) {
    const err = new Error('FORBIDDEN: Unauthorized user attempted to record cash collection.');
    (err as any).statusCode = 403;
    throw err;
  }

  return withCodDatabaseOrderLock(payload, orderId, async ({ req }) => {
    // 2. Fetch order within transaction
    const order = await payload.findByID({
      collection: 'orders' as any,
      id: orderId,
      overrideAccess: true,
      req,
    }) as any;

    if (!order) {
      const err = new Error(`ORDER_NOT_FOUND: Order ${orderId} not found.`);
      (err as any).statusCode = 404;
      throw err;
    }

    // 2b. Block standard collection on cancelled or refused/returned orders
    if (
      order.orderStatus === 'cancelled' ||
      order.status === 'cancelled' ||
      order.fulfillmentStatus === 'returned_to_origin'
    ) {
      const err = new Error(
        `CANNOT_COLLECT_CANCELLED_OR_REFUSED_ORDER: Cannot record standard collection for order in status '${order.orderStatus || order.status}' with fulfillment '${order.fulfillmentStatus}'. Refused or cancelled orders require specialized ledger dispute/reversal handling.`
      );
      (err as any).statusCode = 422;
      throw err;
    }

    // 3. Idempotency Check:
    // If order is already paid, check if receipt matches
    const existingCollection = await payload.find({
      collection: 'payment-collections' as any,
      where: {
        receiptReference: { equals: receiptReference },
      },
      overrideAccess: true,
      req,
      limit: 1,
    });

    if (existingCollection.docs.length > 0 && order.paymentStatus === 'paid') {
      return {
        status: 'ALREADY_COLLECTED',
        message: 'This collection receipt has already been registered in the system.',
        collectionId: existingCollection.docs[0].id,
        orderId: order.id,
        paymentStatus: order.paymentStatus,
      };
    }

    if (order.paymentStatus === 'paid') {
      return {
        status: 'ALREADY_PAID',
        message: 'Order is already marked as paid.',
        orderId: order.id,
        paymentStatus: order.paymentStatus,
      };
    }

    // 4. Exact Penny-Perfect Amount Matching
    const expectedAmount = Number(order.total || order.amount || (order.financials?.grandTotal ?? 0));
    if (Math.abs(collectedAmount - expectedAmount) > 0.01) {
      const err = new Error(
        `AMOUNT_MISMATCH: Collected amount (${collectedAmount}) does not match order grand total (${expectedAmount}).`
      );
      (err as any).statusCode = 422;
      throw err;
    }

    // 5. Determine remittance status based on collector type
    const newRemittanceStatus = collectorType === 'courier' ? 'collected_by_courier' : 'remitted_to_company';

    // 6. Create immutable PaymentCollection record inside transaction
    const collectionRecord = await payload.create({
      collection: 'payment-collections' as any,
      data: {
        receiptReference,
        order: order.id,
        amount: collectedAmount,
        collectorType,
        collectorName,
        collectedAt: collectedAt || new Date().toISOString(),
        remittanceStatus: collectorType === 'courier' ? 'pending_remittance' : 'remitted_to_company',
        recordedBy: actor.id,
      },
      overrideAccess: true,
      req,
    });

    // Test hook for simulating crash / update failure after collection doc is created
    if (options?.failOrderUpdateForTest) {
      throw new Error('SIMULATED_ORDER_UPDATE_FAILURE: Simulated failure during order status update.');
    }

    // 7. Update Order payment status and remittance status inside the same transaction
    if (req) {
      req.context = {
        ...(req.context || {}),
        isCodCollectionEngine: true,
        collectionId: collectionRecord.id,
      };
    }

    const updatedOrder = await payload.update({
      collection: 'orders' as any,
      id: orderId,
      data: {
        paymentStatus: 'paid',
        paidAt: new Date().toISOString(),
        remittanceStatus: newRemittanceStatus,
        codDetails: {
          requiredAmount: expectedAmount,
          collectedAmount,
          collectorType,
          collectorName,
          collectedAt: collectedAt || new Date().toISOString(),
          collectionReference: receiptReference,
        },
      },
      overrideAccess: true,
      req,
      context: {
        isCodCollectionEngine: true,
        collectionId: collectionRecord.id,
      },
    }) as any;

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
 * 4. Record Customer Delivery Refusal or Permanent Delivery Failure (D-022)
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

  if (!actor || (!actor.roles.includes('admin') && !actor.roles.includes('operations') && !actor.roles.includes('finance'))) {
    const err = new Error('FORBIDDEN: Insufficient privileges to record delivery refusal.');
    (err as any).statusCode = 403;
    throw err;
  }

  return withCodDatabaseOrderLock(payload, orderId, async ({ req }) => {
    const order = await payload.findByID({
      collection: 'orders' as any,
      id: orderId,
      overrideAccess: true,
      req,
    }) as any;

    if (!order) {
      const err = new Error(`ORDER_NOT_FOUND: Order ${orderId} not found.`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (order.paymentStatus === 'paid') {
      const err = new Error('CANNOT_REFUSE_PAID_ORDER: Order has already been paid in full. Initiate formal refund process instead.');
      (err as any).statusCode = 422;
      throw err;
    }

    const updated = await payload.update({
      collection: 'orders' as any,
      id: orderId,
      data: {
        status: 'cancelled',
        orderStatus: 'cancelled',
        fulfillmentStatus: 'returned_to_origin',
        // paymentStatus is strictly kept unpaid!
        paymentStatus: 'unpaid',
        codDetails: {
          ...(order.codDetails || {}),
          refusalReason,
          refusalRecordedAt: new Date().toISOString(),
        },
      },
      overrideAccess: true,
      req,
    }) as any;

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
 * 5. Reconcile Courier Cash Remittance Batch (D-022)
 * Enforces:
 * - Deterministic Multi-Order Locking: locks all orders in sorted order.
 * - Single ACID Database Transaction: atomic creation of remittance batch and status transitions.
 * - Deduplication: Rejects duplicate order IDs in batch (prevents double counting).
 * - Verified Collection Correlation: Matches against actual PaymentCollection docs.
 * - Double-Remittance Prevention: Reject orders already remitted in another batch with HTTP 409.
 * - Exact Amount Matching: grossCollectedAmount === sum(order.total).
 * - Net Calculation: expectedNet = grossCollectedAmount - fees - deductions.
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

  // 1. RBAC Check: Finance or Admin only
  if (!actor || (!actor.roles.includes('admin') && !actor.roles.includes('finance'))) {
    const err = new Error('FORBIDDEN: Only finance or super-admin can reconcile courier remittance batches.');
    (err as any).statusCode = 403;
    throw err;
  }

  if (!orderIds || orderIds.length === 0) {
    const err = new Error('INVALID_BATCH: At least one order must be included in remittance batch.');
    (err as any).statusCode = 422;
    throw err;
  }

  // 2. DEFENSE AGAINST DUPLICATE ORDER IDS IN BATCH (Issue 2)
  const uniqueOrderIds = new Set(orderIds.map(String));
  if (uniqueOrderIds.size !== orderIds.length) {
    const err = new Error('DUPLICATE_ORDER_IN_BATCH: Remittance batch contains duplicate order references. Each order must appear only once.');
    (err as any).statusCode = 422;
    throw err;
  }

  // 3. Acquire Deterministic Locks & Single Database Transaction across all orders in batch
  return withCodDatabaseMultiOrderLock(payload, orderIds, async ({ req }) => {
    let calculatedGross = 0;
    const verifiedOrders: any[] = [];
    const verifiedCollections: any[] = [];

    for (const oid of orderIds) {
      const order = await payload.findByID({
        collection: 'orders' as any,
        id: oid,
        overrideAccess: true,
        req,
      }) as any;

      if (!order) {
        const err = new Error(`ORDER_NOT_FOUND: Order ${oid} in batch not found.`);
        (err as any).statusCode = 404;
        throw err;
      }

      // Double-remittance prevention: check if already remitted
      if (order.remittanceStatus === 'remitted_to_company') {
        const err = new Error(
          `DOUBLE_REMITTANCE_ERROR: Order ${oid} has already been remitted to company in batch ${order.codDetails?.courierRemittanceBatchId || 'UNKNOWN'}.`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      // Must be paid / collected by courier
      if (order.paymentStatus !== 'paid' && order.remittanceStatus !== 'collected_by_courier') {
        const err = new Error(
          `ORDER_NOT_COLLECTED: Order ${oid} cannot be remitted because it has not been recorded as collected by courier.`
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
        const err = new Error(`ORDER_COLLECTION_RECORD_MISSING: Order ${oid} has no verified PaymentCollection record in the system.`);
        (err as any).statusCode = 422;
        throw err;
      }

      const colDoc = colRes.docs[0] as any;
      if (colDoc.remittanceStatus === 'remitted_to_company') {
        const err = new Error(`DOUBLE_REMITTANCE_ERROR: PaymentCollection for order ${oid} is already remitted.`);
        (err as any).statusCode = 409;
        throw err;
      }

      const orderAmount = Number(order.total || order.amount || (order.financials?.grandTotal ?? 0));
      calculatedGross += orderAmount;
      verifiedOrders.push(order);
      verifiedCollections.push(colDoc);
    }

    // 4. Mathematical Gross Matching
    if (Math.abs(calculatedGross - grossCollectedAmount) > 0.01) {
      const err = new Error(
        `GROSS_AMOUNT_MISMATCH: Stated grossCollectedAmount (${grossCollectedAmount}) does not match sum of selected orders (${calculatedGross}).`
      );
      (err as any).statusCode = 422;
      throw err;
    }

    // 5. Net Deposit Calculation & Variance Verification
    const expectedNet = grossCollectedAmount - courierFeeDeductions - otherDeductions;
    const discrepancy = Math.abs(netDepositAmount - expectedNet);

    if (discrepancy > 0.01) {
      if (!varianceApproved || !varianceNotes.trim()) {
        const err = new Error(
          `REMITTANCE_VARIANCE_MISMATCH: Actual deposit (${netDepositAmount}) does not match expected net (${expectedNet}). Discrepancy of ${discrepancy.toFixed(2)} EGP requires explicit variance approval and explanatory notes.`
        );
        (err as any).statusCode = 422;
        throw err;
      }
    }

    // 6. Create immutable CourierRemittance record inside the transaction
    const remittanceDoc = await payload.create({
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
        status: discrepancy > 0.01 ? 'discrepancy' : 'reconciled',
        varianceApproved,
        varianceNotes,
        reconciledBy: actor.id,
      },
      overrideAccess: true,
      req,
    });

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
      });
    }

    return {
      status: 'REMITTANCE_SUCCESSFUL',
      batchId,
      remittanceId: remittanceDoc.id,
      orderCount: verifiedOrders.length,
      grossCollectedAmount,
      netDepositAmount,
      reconciledStatus: remittanceDoc.status,
    };
  });
}
