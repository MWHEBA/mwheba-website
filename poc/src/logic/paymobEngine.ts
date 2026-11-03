import crypto from 'crypto';
import type { Payload } from 'payload';

export interface PaymobTransactionObj {
  id: number;
  pending: boolean;
  amount_cents: number;
  success: boolean;
  is_auth: boolean;
  is_capture: boolean;
  is_standalone_payment: boolean;
  is_voided: boolean;
  is_refunded: boolean;
  is_3d_secure: boolean;
  integration_id: number;
  order: {
    id: number;
    merchant_order_id?: string;
  };
  created_at: string;
  currency: string;
  error_occured: boolean;
  has_parent_transaction: boolean;
  owner: number;
  source_data: {
    type: string;
    pan: string;
    sub_type: string;
  };
  txn_response_code?: string;
  data?: {
    message?: string;
  };
}

export interface PaymobWebhookBody {
  type: string;
  obj: PaymobTransactionObj;
}

/**
 * Calculates Paymob HMAC SHA-512 signature over the canonical sorted concatenated keys.
 */
export function calculatePaymobHmac(obj: PaymobTransactionObj, hmacSecret: string): string {
  const concatenatedValues = [
    String(obj.amount_cents),
    String(obj.created_at),
    String(obj.currency),
    String(obj.error_occured),
    String(obj.has_parent_transaction),
    String(obj.id),
    String(obj.integration_id),
    String(obj.is_3d_secure),
    String(obj.is_auth),
    String(obj.is_capture),
    String(obj.is_refunded),
    String(obj.is_standalone_payment),
    String(obj.is_voided),
    String(obj.order.id),
    String(obj.owner),
    String(obj.pending),
    String(obj.source_data.pan),
    String(obj.source_data.sub_type),
    String(obj.source_data.type),
    String(obj.success),
  ].join('');

  return crypto
    .createHmac('sha512', hmacSecret)
    .update(concatenatedValues)
    .digest('hex');
}

/**
 * Verifies Paymob HMAC signature securely using constant-time comparison.
 */
export function verifyPaymobSignature(
  obj: PaymobTransactionObj,
  signature: string,
  hmacSecret: string
): boolean {
  if (!signature || !hmacSecret) return false;
  try {
    const calculated = calculatePaymobHmac(obj, hmacSecret);
    const calculatedBuffer = Buffer.from(calculated, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (calculatedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(calculatedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

export interface WebhookProcessResult {
  status:
    | 'SUCCESS'
    | 'PENDING'
    | 'DUPLICATE'
    | 'TAMPERED'
    | 'FAILED'
    | 'REJECTED'
    | 'DOUBLE_CAPTURE'
    | 'TERMINAL_PAID_PRESERVED';
  message: string;
  orderId?: number;
  attemptId?: number;
}

// POSTGRESQL DATABASE-LEVEL ORDER LOCK & MULTI-WORKER CONCURRENCY GUARD
// Combines:
// 1. In-process serialization (prevents pool connection exhaustion within the same Node instance)
// 2. PostgreSQL server-level advisory lock (pg_advisory_lock) on a dedicated pg.Pool connection
//    guaranteeing strict cross-process serialization across independent Node workers / serverless instances
// 3. Payload database transaction (beginTransaction / commitTransaction / rollbackTransaction)
//    propagating req: { transactionID } to all operations and rejecting with explicit failure if commit fails.
const orderMutexes = new Map<string | number, Promise<void>>();

export async function withDatabaseOrderLock<T>(
  payload: Payload,
  orderId: string | number,
  fn: (ctx: { req?: any }) => Promise<T>
): Promise<T> {
  const numericOrderId = Number(orderId);

  // Layer 1: In-process serialization queue
  const previous = orderMutexes.get(numericOrderId) || Promise.resolve();
  let resolveCurrent: () => void;
  const current = new Promise<void>((resolve) => {
    resolveCurrent = resolve;
  });

  orderMutexes.set(numericOrderId, previous.then(() => current, () => current));

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

      const req = transactionID ? ({ transactionID } as any) : undefined;

      try {
        const result = await fn({ req });
        if (transactionID) {
          try {
            await payload.db.commitTransaction(transactionID);
          } catch (commitErr: any) {
            throw new Error(`Database Transaction Commit Failed: ${commitErr?.message || commitErr}`);
          }
        }
        return result;
      } catch (innerErr) {
        if (transactionID) {
          try {
            await payload.db.rollbackTransaction(transactionID);
          } catch {
            // rollback failure logged, rethrow original error
          }
        }
        throw innerErr;
      }
    };

    if (isPostgres) {
      // 64-bit integer lock key derived deterministically from orderId
      // 0x4D57 = 'MW' (MWHEBA prefix)
      const lockKey = String(BigInt(0x4D5700000000) + BigInt(numericOrderId));
      const client = await pool.connect();

      try {
        await client.query('SELECT pg_advisory_lock($1::bigint)', [lockKey]);
        return await executeInTransaction();
      } finally {
        try {
          await client.query('SELECT pg_advisory_unlock($1::bigint)', [lockKey]);
        } catch {
          // ignore
        }
        client.release();
      }
    }

    // For non-PostgreSQL (SQLite), execute within transaction
    return await executeInTransaction();
  } finally {
    resolveCurrent!();
    if (orderMutexes.get(numericOrderId) === current) {
      orderMutexes.delete(numericOrderId);
    }
  }
}

/**
 * Processes Paymob transaction webhook with multi-assertion pipeline,
 * strict order & attempt correlation, attempt scoping, crash recovery, and double-capture handling.
 */
export async function processPaymobWebhook(options: {
  payload: Payload;
  body: PaymobWebhookBody;
  signature: string;
  hmacSecret: string;
  orderId?: number;
  attemptId?: number;
  staleThresholdMs?: number; // Configurable for testing stale crash reclamation
}): Promise<WebhookProcessResult> {
  const { payload, body, signature, hmacSecret, orderId: expectedOrderId, attemptId: expectedAttemptId, staleThresholdMs } = options;
  const obj = body.obj;

  // 1. ASSERTION 1: Cryptographic HMAC Signature Verification
  const isSignatureValid = verifyPaymobSignature(obj, signature, hmacSecret);
  if (!isSignatureValid) {
    return {
      status: 'REJECTED',
      message: 'Invalid HMAC signature. Webhook rejected with HTTP 401.',
    };
  }

  // 2. STRICT CORRELATION: Extract and validate merchant_order_id from payload (Issue 1)
  const merchantOrderIdStr = obj.order?.merchant_order_id;
  if (!merchantOrderIdStr) {
    return {
      status: 'REJECTED',
      message: 'Missing merchant_order_id in gateway payload. Uncorrelated callback rejected.',
    };
  }

  const merchantOrderId = Number(merchantOrderIdStr);
  if (isNaN(merchantOrderId)) {
    return {
      status: 'REJECTED',
      message: `Invalid merchant_order_id format ("${merchantOrderIdStr}"). Callback rejected.`,
    };
  }

  if (expectedOrderId !== undefined && expectedOrderId !== merchantOrderId) {
    return {
      status: 'REJECTED',
      message: `Order Correlation Error: Payload merchant_order_id (${merchantOrderId}) does not match expected order (${expectedOrderId}).`,
      orderId: merchantOrderId,
    };
  }

  return await withDatabaseOrderLock(payload, merchantOrderId, async ({ req }) => {
  // 3. IDEMPOTENCY KEY: Decouples transaction ID from specific delivery event
  const providerEventId = `${obj.id}_${obj.success}_${obj.pending}_${obj.txn_response_code || ''}`;

  // 4. CRASH RECOVERY & LEASE RECLAMATION (Issue 4)
  const existingEvents = await payload.find({
        req,
    collection: 'payment-events',
    where: {
      providerEventId: { equals: providerEventId },
    },
    limit: 1,
  });

  let eventDoc: any = null;

  if (existingEvents.totalDocs > 0) {
    const existing = existingEvents.docs[0];

    // Already completed: pure duplicate
    if (existing.status === 'completed') {
      return {
        status: 'DUPLICATE',
        message: 'Event already processed idempotently. Zero duplicate state changes applied.',
        orderId: merchantOrderId,
      };
    }

    // In-flight processing: check if stale lease from crashed process
    if (existing.status === 'processing') {
      const lockAgeMs = Date.now() - new Date(existing.lockedAt || existing.createdAt).getTime();
      const STALE_THRESHOLD = staleThresholdMs ?? 60 * 1000; // Default 60 seconds

      if (lockAgeMs < STALE_THRESHOLD) {
        return {
          status: 'DUPLICATE',
          message: 'Event is currently being processed by another active worker.',
          orderId: merchantOrderId,
        };
      }

      // Reclaim stale lease from interrupted worker
      const updateResult = await payload.update({
        req,
        collection: 'payment-events',
        where: {
          id: { equals: existing.id },
          status: { equals: 'processing' },
        },
        data: {
          lockedAt: new Date().toISOString(),
        },
      });

      if (!updateResult.docs || updateResult.docs.length === 0) {
        return {
          status: 'DUPLICATE',
          message: 'Event is currently being processed by another active worker.',
          orderId: merchantOrderId,
        };
      }

      eventDoc = updateResult.docs[0];
    }

    // RETRYABLE FAILED EVENT: Re-process existing failed record atomically! (Issue 2)
    if (existing.status === 'failed') {
      const updateResult = await payload.update({
        req,
        collection: 'payment-events',
        where: {
          id: { equals: existing.id },
          status: { equals: 'failed' },
        },
        data: {
          status: 'processing',
          lockedAt: new Date().toISOString(),
          eventData: body as any,
        },
      });

      if (!updateResult.docs || updateResult.docs.length === 0) {
        return {
          status: 'DUPLICATE',
          message: 'Event retry is currently being processed by another active worker.',
          orderId: merchantOrderId,
        };
      }

      eventDoc = updateResult.docs[0];
    }
  }

  // Atomic event registration with strict error differentiation (Issue 4)
  if (!eventDoc) {
    try {
      eventDoc = await payload.create({
        req,
        collection: 'payment-events',
        data: {
          provider: 'paymob',
          providerEventId,
          providerTransactionId: String(obj.id),
          status: 'processing',
          lockedAt: new Date().toISOString(),
          order: merchantOrderId,
          eventData: body as any,
        },
      });
    } catch (err: any) {
      // Differentiate actual UNIQUE constraint collision from authentic database errors
      const isUniqueCollision =
        err?.code === 'SQLITE_CONSTRAINT' ||
        err?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        err?.message?.includes('UNIQUE constraint failed') ||
        err?.message?.includes('unique constraint') ||
        err?.message?.includes('providerEventId') ||
        err?.code === '23505';

      if (isUniqueCollision) {
        return {
          status: 'DUPLICATE',
          message: 'Concurrent webhook delivery handled idempotently via database unique constraint.',
          orderId: merchantOrderId,
        };
      }

      // Re-throw genuine errors (not duplicates!)
      throw err;
    }
  }

  try {
    // 5. FETCH & VALIDATE REFERENCED ORDER
    const order = await payload.findByID({
        req,
      collection: 'orders',
      id: merchantOrderId,
    });

    if (!order) {
      await payload.update({
        req,
        collection: 'payment-events',
        id: eventDoc.id,
        data: { status: 'failed' },
      });
      return {
        status: 'REJECTED',
        message: `Order #${merchantOrderId} not found in database.`,
        orderId: merchantOrderId,
      };
    }

    // 6. FETCH & VALIDATE PAYMENT ATTEMPT (Issue 1)
    const attemptsQuery = await payload.find({
        req,
      collection: 'payment-attempts',
      where: {
        order: { equals: merchantOrderId },
      },
      sort: '-createdAt',
    });

    if (attemptsQuery.totalDocs === 0) {
      await payload.update({
        req,
        collection: 'payment-events',
        id: eventDoc.id,
        data: { status: 'failed' },
      });
      return {
        status: 'REJECTED',
        message: `No payment attempt found for Order #${merchantOrderId}. Payment confirmation rejected.`,
        orderId: merchantOrderId,
      };
    }

    // Resolve matching attempt strictly using authenticated gateway identifiers:
    // obj.order.id and obj.id are cryptographically signed by HMAC.
    // merchant_order_id is UNVERIFIED by HMAC, so we MUST NEVER blindly fallback to arbitrary active attempts.
    let activeAttempt: any = null;

    if (expectedAttemptId) {
      const candidate = attemptsQuery.docs.find((a: any) => a.id === expectedAttemptId);
      if (!candidate) {
        await payload.update({
        req,
          collection: 'payment-events',
          id: eventDoc.id,
          data: { status: 'failed' },
        });
        return {
          status: 'REJECTED',
          message: `Attempt #${expectedAttemptId} not found for Order #${merchantOrderId}.`,
          orderId: merchantOrderId,
          attemptId: expectedAttemptId,
        };
      }

      // MANDATORY GATEWAY CORRELATION: Every attempt MUST match authenticated gateway identifier
      // attemptId alone is NEVER sufficient; it must match authenticated gatewayOrderId or providerTransactionId
      const matchesGatewayOrder = candidate.gatewayOrderId && String(candidate.gatewayOrderId) === String(obj.order?.id);
      const matchesProviderTxn = candidate.providerTransactionId && String(candidate.providerTransactionId) === String(obj.id);

      if (!matchesGatewayOrder && !matchesProviderTxn) {
        await payload.update({
        req,
          collection: 'payment-events',
          id: eventDoc.id,
          data: { status: 'failed' },
        });
        return {
          status: 'REJECTED',
          message: `Gateway Correlation Error: Attempt #${expectedAttemptId} does not match authenticated gateway order ID "${obj.order?.id}" or transaction ID "${obj.id}". Callback rejected.`,
          orderId: merchantOrderId,
          attemptId: expectedAttemptId,
        };
      }

      activeAttempt = candidate;
    }

    if (!activeAttempt) {
      // Find attempt matching authenticated gatewayOrderId or providerTransactionId
      activeAttempt = attemptsQuery.docs.find((a: any) => {
        const matchesGatewayOrder = a.gatewayOrderId && String(a.gatewayOrderId) === String(obj.order?.id);
        const matchesProviderTxn = a.providerTransactionId && String(a.providerTransactionId) === String(obj.id);
        return matchesGatewayOrder || matchesProviderTxn;
      });
    }

    if (!activeAttempt) {
      // STRICT SECURITY: Reject callbacks where no attempt matches the authenticated gateway identifier!
      // This prevents spoofed callbacks with modified merchant_order_id from paying arbitrary orders.
      await payload.update({
        req,
        collection: 'payment-events',
        id: eventDoc.id,
        data: { status: 'failed' },
      });
      return {
        status: 'REJECTED',
        message: `Gateway Correlation Error: No payment attempt found for Order #${merchantOrderId} matching authenticated gateway order ID "${obj.order?.id}" or transaction ID "${obj.id}". Callback rejected.`,
        orderId: merchantOrderId,
      };
    }

    // 7. TERMINAL PAID STATE PROTECTION (Issue 3)
    // Once order is paid in full, it can NEVER regress to failed or pending
    if (order.paymentStatus === 'paid') {
      if (obj.success && !obj.pending) {
        // Double-capture: Record subsequent success in ledger as succeeded_duplicate
        // 1. Check if this exact gateway transaction ID has ALREADY been recorded in an attempt
        const existingTxnAttempt = attemptsQuery.docs.find(
          (a: any) => a.provider === 'paymob' && a.providerTransactionId === String(obj.id)
        );

        if (existingTxnAttempt) {
          // Exactly the same transaction already processed and ledgered!
          await payload.update({
        req,
            collection: 'payment-events',
            id: eventDoc.id,
            data: {
              status: 'completed',
              completedAt: new Date().toISOString(),
            },
          });

          return {
            status: 'DUPLICATE',
            message: `Transaction ${obj.id} already recorded in ledger as ${existingTxnAttempt.status}. Handled idempotently.`,
            orderId: merchantOrderId,
            attemptId: existingTxnAttempt.id,
          };
        }

        // 2. Distinct new transaction on an already paid order:
        // IMMUTABILITY DEFENSE: Protect both 'succeeded' and 'succeeded_duplicate' from having their providerTransactionId overwritten!
        const isAttemptAlreadyCollected =
          activeAttempt &&
          (activeAttempt.status === 'succeeded' || activeAttempt.status === 'succeeded_duplicate');

        let ledgerAttemptId: number;

        if (isAttemptAlreadyCollected || !activeAttempt) {
          // Both activeAttempt and all previous collections must remain intact!
          // Create an independent PaymentAttempt document for this new collection
          try {
            const newDuplicateAttempt = await payload.create({
        req,
              collection: 'payment-attempts',
              data: {
                order: merchantOrderId,
                attemptNumber: (attemptsQuery.totalDocs || 1) + 1,
                amountCents: obj.amount_cents,
                currency: obj.currency,
                provider: 'paymob',
                gatewayOrderId: String(obj.order?.id),
                providerTransactionId: String(obj.id),
                status: 'succeeded_duplicate',
                isActiveAttempt: false,
                failureReason: 'Overpayment / Duplicate Capture: Order was already paid in full.',
              },
            });
            ledgerAttemptId = newDuplicateAttempt.id as number;
          } catch (createErr: any) {
            const isTxnCollision =
              createErr?.code === '23505' ||
              createErr?.code === 'SQLITE_CONSTRAINT' ||
              createErr?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
              createErr?.message?.includes('providerTxnKey') ||
              createErr?.message?.includes('unique constraint');

            if (isTxnCollision) {
              return {
                status: 'DUPLICATE',
                message: `Transaction ${obj.id} already recorded concurrently in ledger.`,
                orderId: merchantOrderId,
              };
            }
            throw createErr;
          }
        } else {
          // Active attempt was initiated / pending / failed (not collected yet); update it to succeeded_duplicate
          const updated = await payload.update({
        req,
            collection: 'payment-attempts',
            id: activeAttempt.id,
            data: {
              status: 'succeeded_duplicate',
              providerTransactionId: String(obj.id),
              failureReason: 'Overpayment / Duplicate Capture: Order was already paid in full.',
            },
          });
          ledgerAttemptId = updated.id as number;
        }

        await payload.update({
        req,
          collection: 'payment-events',
          id: eventDoc.id,
          data: {
            status: 'completed',
            completedAt: new Date().toISOString(),
          },
        });

        return {
          status: 'DOUBLE_CAPTURE',
          message: 'Order already paid. Duplicate capture recorded in ledger with reconciliation alert.',
          orderId: merchantOrderId,
          attemptId: ledgerAttemptId,
        };
      }

      // Late failure arrives on already paid order (Issue 3 Resolved)
      if (activeAttempt) {
        if (activeAttempt.status === 'succeeded' || activeAttempt.status === 'succeeded_duplicate') {
          // CRITICAL: Successful collection record is immutable! DO NOT OVERWRITE TO FAILED!
          // Protects both initial collections (succeeded) and subsequent duplicate/overpayments (succeeded_duplicate)
          const prevConflicts = (activeAttempt.metadata?.conflictingEvents as any[]) || [];
          await payload.update({
        req,
            collection: 'payment-attempts',
            id: activeAttempt.id,
            data: {
              metadata: {
                ...(activeAttempt.metadata || {}),
                conflictingEvents: [
                  ...prevConflicts,
                  {
                    type: 'LATE_FAILURE_IGNORED',
                    providerTransactionId: String(obj.id),
                    receivedAt: new Date().toISOString(),
                    reason: obj.data?.message || 'Late failure callback received after payment was already collected.',
                  },
                ],
              },
            },
          });

          const prevLogs = Array.isArray(order.auditLog) ? order.auditLog : [];
          await payload.update({
        req,
            collection: 'orders',
            id: merchantOrderId,
            data: {
              auditLog: [
                ...prevLogs,
                {
                  entry: `[RECONCILIATION CONFLICT] Late failure callback received for already collected attempt #${activeAttempt.id} (Status: ${activeAttempt.status}, Txn: ${obj.id}). Attempt status strictly preserved; flagged for finance audit.`,
                },
              ],
            },
          });
        } else {
          // Attempt was indeed uncompleted / alternate attempt; mark it failed
          await payload.update({
        req,
            collection: 'payment-attempts',
            id: activeAttempt.id,
            data: {
              status: 'failed',
              providerTransactionId: String(obj.id),
              failureReason: obj.data?.message || 'Late failure callback received after order was already paid in full.',
            },
          });
        }
      }

      await payload.update({
        req,
        collection: 'payment-events',
        id: eventDoc.id,
        data: {
          status: 'completed',
          completedAt: new Date().toISOString(),
        },
      });

      return {
        status: 'TERMINAL_PAID_PRESERVED',
        message: 'Late failure callback scoped. Succeeded attempt and paid order strictly preserved; conflict logged for reconciliation.',
        orderId: merchantOrderId,
        attemptId: activeAttempt?.id,
      };
    }

    // 8. ASSERTION 2: Currency Matching (Issue 1)
    const expectedCurrency = order.currency || 'EGP';
    if (obj.currency !== expectedCurrency || activeAttempt.currency !== obj.currency) {
      await payload.update({
        req,
        collection: 'payment-attempts',
        id: activeAttempt.id,
        data: {
          status: 'currency_mismatch',
          failureReason: `Currency Mismatch: Gateway sent ${obj.currency}, order/attempt expects ${expectedCurrency}`,
        },
      });

      await payload.update({
        req,
        collection: 'payment-events',
        id: eventDoc.id,
        data: { status: 'failed' },
      });

      return {
        status: 'REJECTED',
        message: `Currency Mismatch: Expected ${expectedCurrency}, received ${obj.currency}`,
        orderId: merchantOrderId,
        attemptId: activeAttempt.id,
      };
    }

    // 9. ASSERTION 3: Penny-Perfect Amount Matching (Issue 1)
    const orderAmountCents = Math.round((order.amount || 0) * 100);
    if (obj.amount_cents !== orderAmountCents || obj.amount_cents !== activeAttempt.amountCents) {
      // SECURITY DEFENSE: Amount Tampering detected
      await payload.update({
        req,
        collection: 'payment-attempts',
        id: activeAttempt.id,
        data: {
          status: 'amount_mismatch',
          failureReason: `FRAUD ALERT: Amount mismatch. Expected ${orderAmountCents} cents, received ${obj.amount_cents} cents.`,
        },
      });

      const prevLogs = Array.isArray(order.auditLog) ? order.auditLog : [];
      await payload.update({
        req,
        collection: 'orders',
        id: merchantOrderId,
        data: {
          paymentStatus: 'failed',
          auditLog: [
            ...prevLogs,
            {
              entry: `FRAUD ALERT: Gateway amount ${obj.amount_cents} cents does not match expected ${orderAmountCents} cents. Transaction frozen.`,
            },
          ],
        },
      });

      await payload.update({
        req,
        collection: 'payment-events',
        id: eventDoc.id,
        data: { status: 'failed' },
      });

      return {
        status: 'TAMPERED',
        message: `Amount mismatch: Expected ${orderAmountCents} cents, got ${obj.amount_cents} cents. Order frozen.`,
        orderId: merchantOrderId,
        attemptId: activeAttempt.id,
      };
    }

    // 10. PENDING STATE DISCRIMINATION (Issue 2)
    // Pending callbacks (3DS redirect, kiosk issuance) MUST NOT be treated as failure!
    if (obj.pending === true) {
      await payload.update({
        req,
        collection: 'payment-attempts',
        id: activeAttempt.id,
        data: {
          status: 'pending',
          providerTransactionId: String(obj.id),
        },
      });

      await payload.update({
        req,
        collection: 'payment-events',
        id: eventDoc.id,
        data: {
          status: 'completed',
          completedAt: new Date().toISOString(),
        },
      });

      return {
        status: 'PENDING',
        message: 'Transaction is pending user completion or 3DS verification.',
        orderId: merchantOrderId,
        attemptId: activeAttempt.id,
      };
    }

    // 11. GATEWAY SUCCESS CONFIRMATION
    const isGatewaySuccess =
      obj.success === true &&
      obj.pending === false &&
      !obj.is_voided &&
      !obj.is_refunded;

    if (isGatewaySuccess) {
      let finalAttemptId = activeAttempt.id;

      // ATOMIC CONDITIONAL CLAIM (Concurrency Defense):
      // Only transition activeAttempt to succeeded if it is still pending/initiated.
      // If a concurrent worker already transitioned it, this update will match 0 rows.
      const claimResult = await payload.update({
        req,
        collection: 'payment-attempts',
        where: {
          id: { equals: activeAttempt.id },
          status: { in: ['pending', 'initiated'] },
        },
        data: {
          status: 'succeeded',
          providerTransactionId: String(obj.id),
        },
      });

      if (claimResult.docs && claimResult.docs.length > 0) {
        // Winner of race: claimed activeAttempt as the primary collection
        finalAttemptId = claimResult.docs[0].id as number;
      } else {
        // Lost race: A concurrent worker already transitioned this attempt to succeeded/succeeded_duplicate
        const freshAttempt = await payload.findByID({
        req,
          collection: 'payment-attempts',
          id: activeAttempt.id,
        });

        if (freshAttempt.providerTransactionId === String(obj.id)) {
          // Exactly the same transaction already processed concurrently
          await payload.update({
        req,
            collection: 'payment-events',
            id: eventDoc.id,
            data: { status: 'completed', completedAt: new Date().toISOString() },
          });
          return {
            status: 'DUPLICATE',
            message: `Transaction ${obj.id} already recorded. Handled idempotently.`,
            orderId: merchantOrderId,
            attemptId: freshAttempt.id,
          };
        }

        // Distinct concurrent transaction: ledger as independent succeeded_duplicate
        try {
          const newDuplicateAttempt = await payload.create({
        req,
            collection: 'payment-attempts',
            data: {
              order: merchantOrderId,
              attemptNumber: (attemptsQuery.totalDocs || 1) + 1,
              amountCents: obj.amount_cents,
              currency: obj.currency,
              provider: 'paymob',
              gatewayOrderId: String(obj.order?.id),
              providerTransactionId: String(obj.id),
              status: 'succeeded_duplicate',
              isActiveAttempt: false,
              failureReason: 'Concurrent Double Capture: Another transaction succeeded simultaneously.',
            },
          });
          finalAttemptId = newDuplicateAttempt.id as number;
        } catch (createErr: any) {
          const isTxnCollision =
            createErr?.code === '23505' ||
            createErr?.code === 'SQLITE_CONSTRAINT' ||
            createErr?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
            createErr?.message?.includes('providerTxnKey') ||
            createErr?.message?.includes('unique constraint');

          if (isTxnCollision) {
            return {
              status: 'DUPLICATE',
              message: `Transaction ${obj.id} already recorded concurrently in ledger.`,
              orderId: merchantOrderId,
            };
          }
          throw createErr;
        }
      }

      // Mark order paid and append audit log
      const freshOrder = await payload.findByID({
        req,
        collection: 'orders',
        id: merchantOrderId,
      });
      const prevLogs = Array.isArray(freshOrder.auditLog) ? freshOrder.auditLog : [];

      if (req) {
        req.context = {
          ...(req.context || {}),
          isPaymentWebhook: true,
        };
      }

      await payload.update({
        req,
        collection: 'orders',
        id: merchantOrderId,
        data: {
          paymentStatus: 'paid',
          paidAt: freshOrder.paidAt || new Date().toISOString(),
          auditLog: [
            ...prevLogs,
            {
              entry: `Payment confirmed via Paymob (Txn ID: ${obj.id}, Amount: ${obj.amount_cents / 100} EGP, Card: ${obj.source_data?.sub_type} ...${obj.source_data?.pan}).`,
            },
          ],
        },
        context: {
          isPaymentWebhook: true,
        },
      });

      await payload.update({
        req,
        collection: 'payment-events',
        id: eventDoc.id,
        data: {
          status: 'completed',
          completedAt: new Date().toISOString(),
        },
      });

      return {
        status: 'SUCCESS',
        message: 'Payment confirmed and verified penny-perfect via Paymob gateway.',
        orderId: merchantOrderId,
        attemptId: finalAttemptId,
      };
    }

    // 12. TERMINAL GATEWAY FAILURE & ATTEMPT SCOPING
    if (activeAttempt.status === 'succeeded' || activeAttempt.status === 'succeeded_duplicate') {
      // Preservation defense: attempt was already succeeded or duplicate-collected, do not regress to failed!
      const prevConflicts = (activeAttempt.metadata?.conflictingEvents as any[]) || [];
      await payload.update({
        req,
        collection: 'payment-attempts',
        id: activeAttempt.id,
        data: {
          metadata: {
            ...(activeAttempt.metadata || {}),
            conflictingEvents: [
              ...prevConflicts,
              {
                type: 'LATE_FAILURE_IGNORED',
                providerTransactionId: String(obj.id),
                receivedAt: new Date().toISOString(),
                reason: obj.data?.message || 'Failure callback received after attempt was already collected.',
              },
            ],
          },
        },
      });
    } else {
      await payload.update({
        req,
        collection: 'payment-attempts',
        id: activeAttempt.id,
        data: {
          status: 'failed',
          providerTransactionId: String(obj.id),
          failureReason: obj.data?.message || 'Payment declined by issuer or cancelled.',
        },
      });
    }

    // ONLY regress order to failed if the active attempt actually failed and was not already collected
    if (activeAttempt.isActiveAttempt && activeAttempt.status !== 'succeeded' && activeAttempt.status !== 'succeeded_duplicate') {
      const prevLogs = Array.isArray(order.auditLog) ? order.auditLog : [];
      await payload.update({
        req,
        collection: 'orders',
        id: merchantOrderId,
        data: {
          paymentStatus: 'failed',
          auditLog: [
            ...prevLogs,
            {
              entry: `Paymob payment attempt #${activeAttempt.attemptNumber} failed: ${obj.data?.message || 'Declined'}.`,
            },
          ],
        },
      });
    }

    await payload.update({
        req,
      collection: 'payment-events',
      id: eventDoc.id,
      data: {
        status: 'completed',
        completedAt: new Date().toISOString(),
      },
    });

    if (activeAttempt.status === 'succeeded' || activeAttempt.status === 'succeeded_duplicate') {
      return {
        status: 'TERMINAL_PAID_PRESERVED',
        message: 'Late failure callback scoped. Succeeded attempt strictly preserved; conflict logged for reconciliation.',
        orderId: merchantOrderId,
        attemptId: activeAttempt.id,
      };
    }

    return {
      status: 'FAILED',
      message: 'Payment failure recorded and scoped to attempt.',
      orderId: merchantOrderId,
      attemptId: activeAttempt.id,
    };
  } catch (err) {
    if (eventDoc?.id) {
      await payload.update({
        req,
        collection: 'payment-events',
        id: eventDoc.id,
        data: { status: 'failed' },
      });
    }
    throw err;
  }
  });
}
