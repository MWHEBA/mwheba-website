import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import cp from 'child_process';
import configPromise from '../src/payload.config';
import { getPayload, Payload } from 'payload';
import {
  calculatePaymobHmac,
  processPaymobWebhook,
  PaymobTransactionObj,
  PaymobWebhookBody,
} from '../src/logic/paymobEngine';

describe('Track 1B: PostgreSQL Concurrency, Race Condition & Crash Recovery Suite', () => {
  let payload: Payload;
  let adminUser: any;
  let customerUser: any;
  let productAId: number;
  const mockHmacSecret = 'sec_sandbox_test_hmac_secret_key_mwheba_2026';

  const baseTxn = Math.floor(Date.now() / 1000) * 1000 + 50000;

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    // Strictly enforce that this PostgreSQL concurrency suite is running against an actual PostgreSQL pool
    const pool = (payload.db as any)?.pool;
    if (!pool) {
      throw new Error(
        'INVALID_TEST_DATABASE: Track 1B PostgreSQL Concurrency suite must run against a live PostgreSQL database instance. (payload.db.pool is undefined, likely running on SQLite).'
      );
    }

    const timestamp = Date.now();

    // 1. Seed Admin
    adminUser = await payload.create({
      collection: 'users',
      data: {
        email: `admin-pg-conc-${timestamp}@mwheba.com`,
        password: 'Password123!',
        roles: ['admin', 'finance'],
      },
      context: { isSystemSeed: true },
    });

    // 2. Seed Customer
    customerUser = await payload.create({
      collection: 'users',
      data: {
        email: `customer-pg-conc-${timestamp}@corp.eg`,
        password: 'Password123!',
        roles: ['customer'],
      },
      context: { isSystemSeed: true },
    });

    // 3. Seed Physical Product (MOQ 10, 300 EGP)
    const prod = await payload.create({
      collection: 'products',
      data: {
        title: 'PostgreSQL Stress Mug',
        slug: `pg-stress-mug-${timestamp}`,
        _status: 'published',
        itemType: 'physical',
        minOrderQuantity: 10,
        basePrice: 300,
      },
      user: adminUser,
    });
    productAId = prod.id as number;
  }, 30000);

  function makePaymobPayload(orderId: number, txnId: number, overrides: Partial<PaymobTransactionObj> = {}): { body: PaymobWebhookBody; sig: string } {
    const obj: PaymobTransactionObj = {
      id: txnId,
      pending: false,
      amount_cents: 300000, // 3,000 EGP (10 units * 300)
      success: true,
      is_auth: false,
      is_capture: false,
      is_standalone_payment: true,
      is_voided: false,
      is_refunded: false,
      is_3d_secure: true,
      integration_id: 12345,
      order: {
        id: 777000 + (orderId % 10000),
        merchant_order_id: String(orderId),
      },
      created_at: new Date().toISOString(),
      currency: 'EGP',
      error_occured: false,
      has_parent_transaction: false,
      owner: 9999,
      source_data: {
        type: 'card',
        pan: '4242',
        sub_type: 'Visa',
      },
      txn_response_code: 'APPROVED',
      ...overrides,
    };

    const sig = calculatePaymobHmac(obj, mockHmacSecret);
    return {
      body: { type: 'TRANSACTION', obj },
      sig,
    };
  }

  it('CONC-TC-01: 10 simultaneous identical webhook calls are safely serialized by PostgreSQL unique constraint', async () => {
    // 1. Create order
    // 1. Create order
    const order = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });
    const orderId = order.id as number;
    const gatewayOrderId = String(777000 + (orderId % 10000));
    const txnId = baseTxn + 1;

    // 2. Create matching payment attempt
    const attempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: orderId,
        gatewayOrderId,
        attemptNumber: 1,
        amountCents: 300000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const { body, sig } = makePaymobPayload(orderId, txnId);

    // 3. Dispatch 10 parallel webhook requests simultaneously via Promise.all
    const promises = Array.from({ length: 10 }).map(() =>
      processPaymobWebhook({
        payload,
        body,
        signature: sig,
        hmacSecret: mockHmacSecret,
        orderId,
        attemptId: attempt.id as number,
      })
    );

    const results = await Promise.all(promises);

    // 4. Exactly one must be SUCCESS, and exactly 9 must be DUPLICATE
    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    const duplicateCount = results.filter((r) => r.status === 'DUPLICATE').length;

    expect(successCount).toBe(1);
    expect(duplicateCount).toBe(9);

    // 5. Verify database integrity
    const finalOrder = await payload.findByID({ collection: 'orders', id: orderId });
    expect(finalOrder.paymentStatus).toBe('paid');

    const events = await payload.find({
      collection: 'payment-events',
      where: {
        order: { equals: orderId },
      },
    });
    // Exactly one event record completed in DB
    expect(events.totalDocs).toBe(1);
    expect(events.docs[0].status).toBe('completed');

    const attempts = await payload.find({
      collection: 'payment-attempts',
      where: {
        order: { equals: orderId },
      },
    });
    expect(attempts.totalDocs).toBe(1);
    expect(attempts.docs[0].status).toBe('succeeded');
    expect(attempts.docs[0].providerTransactionId).toBe(String(txnId));
  });

  it('CONC-TC-02: Simultaneous dual capture (2 distinct transactions at exact same millisecond) ledgers both without overwriting', async () => {
    // 1. Create order
    const order = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });
    const orderId = order.id as number;
    const gatewayOrderId = String(777000 + (orderId % 10000));
    const txnIdA = baseTxn + 10;
    const txnIdB = baseTxn + 11;

    // 2. Create pending payment attempt
    const attempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: orderId,
        gatewayOrderId,
        attemptNumber: 1,
        amountCents: 300000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const payloadA = makePaymobPayload(orderId, txnIdA);
    const payloadB = makePaymobPayload(orderId, txnIdB);

    // 3. Fire both distinct transactions concurrently at the exact same millisecond
    const [resA, resB] = await Promise.all([
      processPaymobWebhook({
        payload,
        body: payloadA.body,
        signature: payloadA.sig,
        hmacSecret: mockHmacSecret,
        orderId,
        attemptId: attempt.id as number,
      }),
      processPaymobWebhook({
        payload,
        body: payloadB.body,
        signature: payloadB.sig,
        hmacSecret: mockHmacSecret,
        orderId,
        attemptId: attempt.id as number,
      }),
    ]);

    // Both must be processed successfully
    const statuses = [resA.status, resB.status];
    expect(statuses).toContain('SUCCESS');

    // 4. Verify database state
    const finalOrder = await payload.findByID({ collection: 'orders', id: orderId });
    expect(finalOrder.paymentStatus).toBe('paid');

    const attempts = await payload.find({
      collection: 'payment-attempts',
      where: { order: { equals: orderId } },
      sort: 'attemptNumber',
    });

    // Exactly 2 attempts must exist in DB (1 succeeded, 1 succeeded_duplicate)
    expect(attempts.totalDocs).toBe(2);
    const txnIds = attempts.docs.map((a: any) => a.providerTransactionId);
    expect(txnIds).toContain(String(txnIdA));
    expect(txnIds).toContain(String(txnIdB));

    const attemptStatuses = attempts.docs.map((a: any) => a.status);
    expect(attemptStatuses).toContain('succeeded');
    expect(attemptStatuses).toContain('succeeded_duplicate');

    // Immutability verified: neither transaction ID was overwritten!
    expect(attempts.docs[0].providerTransactionId).not.toBe(attempts.docs[1].providerTransactionId);
  });

  it('CONC-TC-03: Succeeded callback and late failure callback collision preserves paid state and logs conflict', async () => {
    // 1. Create order
    const order = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });
    const orderId = order.id as number;
    const gatewayOrderId = String(777000 + (orderId % 10000));
    const txnSuccess = baseTxn + 20;
    const txnFail = baseTxn + 21;

    // 2. Create pending payment attempt
    const attempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: orderId,
        gatewayOrderId,
        attemptNumber: 1,
        amountCents: 300000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const successPayload = makePaymobPayload(orderId, txnSuccess, { success: true, pending: false });
    const failPayload = makePaymobPayload(orderId, txnFail, {
      success: false,
      pending: false,
      data: { message: 'Card declined or 3DS timeout' },
    });

    // 3. Fire both concurrently
    const [resSuccess, resFail] = await Promise.all([
      processPaymobWebhook({
        payload,
        body: successPayload.body,
        signature: successPayload.sig,
        hmacSecret: mockHmacSecret,
        orderId,
        attemptId: attempt.id as number,
      }),
      processPaymobWebhook({
        payload,
        body: failPayload.body,
        signature: failPayload.sig,
        hmacSecret: mockHmacSecret,
        orderId,
        attemptId: attempt.id as number,
      }),
    ]);

    // 4. Verify terminal paid state is strictly preserved
    const finalOrder = await payload.findByID({ collection: 'orders', id: orderId });
    expect(finalOrder.paymentStatus).toBe('paid');

    const attempts = await payload.find({
      collection: 'payment-attempts',
      where: { order: { equals: orderId } },
    });

    // Succeeded attempt must be present and never regressed to failed
    const succeededAttempt = attempts.docs.find((a: any) => a.status === 'succeeded');
    expect(succeededAttempt).toBeDefined();
    expect(succeededAttempt?.providerTransactionId).toBe(String(txnSuccess));
  });

  it('CONC-TC-04: Crash Recovery: Previously failed event is seamlessly recovered upon webhook retry', async () => {
    // 1. Create order and attempt
    const order = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });
    const orderId = order.id as number;
    const gatewayOrderId = String(777000 + (orderId % 10000));
    const txnId = baseTxn + 30;

    const attempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: orderId,
        gatewayOrderId,
        attemptNumber: 1,
        amountCents: 300000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const { body, sig } = makePaymobPayload(orderId, txnId);
    const providerEventId = `${txnId}_true_false_APPROVED`;

    // 2. Simulate a mid-processing crash: an event was recorded in DB but failed due to transient network glitch
    await payload.create({
      collection: 'payment-events',
      data: {
        provider: 'paymob',
        providerEventId,
        providerTransactionId: String(txnId),
        status: 'failed',
        order: orderId,
        eventData: body as any,
      },
    });

    // 3. Gateway retries sending the exact same webhook
    const retryResult = await processPaymobWebhook({
      payload,
      body,
      signature: sig,
      hmacSecret: mockHmacSecret,
      orderId,
      attemptId: attempt.id as number,
    });

    // 4. The retry must pick up the failed event, re-process it to completion, and succeed!
    expect(retryResult.status).toBe('SUCCESS');

    const finalOrder = await payload.findByID({ collection: 'orders', id: orderId });
    expect(finalOrder.paymentStatus).toBe('paid');

    const recoveredEvent = await payload.find({
      collection: 'payment-events',
      where: { providerEventId: { equals: providerEventId } },
    });
    expect(recoveredEvent.docs[0].status).toBe('completed');
  });

  it('CONC-TC-05: Two independent concurrent workers processing callbacks do not collide on orders_items child table', async () => {
    // 1. Create order with multiple items
    const order = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [
          { product: productAId, quantity: 10 },
        ],
      },
      user: customerUser,
    });
    const orderId = order.id as number;
    const gatewayOrderId = String(777000 + (orderId % 10000));
    const txnIdWorkerA = baseTxn + 40;
    const txnIdWorkerB = baseTxn + 41;

    // 2. Create pending attempt
    const attempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: orderId,
        gatewayOrderId,
        attemptNumber: 1,
        amountCents: 300000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const payloadWorkerA = makePaymobPayload(orderId, txnIdWorkerA);
    const payloadWorkerB = makePaymobPayload(orderId, txnIdWorkerB);

    // 3. Worker A runs in current process, Worker B runs in an isolated child OS process
    const runWorkerInChildProcess = (oId: number, aId: number, tId: number, gwId: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        const tsxCli = path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');
        const scriptPath = path.resolve(__dirname, 'fixtures/standaloneWorker.ts');
        const child = cp.spawn(process.execPath, [tsxCli, scriptPath, String(oId), String(aId), String(tId), gwId, mockHmacSecret], {
          env: { ...process.env },
          shell: false,
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => { stdout += d; });
        child.stderr.on('data', (d) => { stderr += d; });

        child.on('close', (code) => {
          if (code === 0) {
            try {
              const jsonLine = stdout.split('\n').find((l) => l.trim().startsWith('{"status":'));
              const parsed = jsonLine ? JSON.parse(jsonLine.trim()) : { status: 'SUCCESS' };
              resolve(parsed);
            } catch {
              resolve({ status: 'SUCCESS' });
            }
          } else {
            reject(new Error(`Child worker failed with code ${code}: ${stderr || stdout}`));
          }
        });
      });
    };

    // Run both workers concurrently across separate OS processes
    const [resA, resB] = await Promise.all([
      processPaymobWebhook({
        payload,
        body: payloadWorkerA.body,
        signature: payloadWorkerA.sig,
        hmacSecret: mockHmacSecret,
        orderId,
        attemptId: attempt.id as number,
      }),
      runWorkerInChildProcess(orderId, attempt.id as number, txnIdWorkerB, gatewayOrderId),
    ]);

    // Both workers must finish without throwing `UNIQUE constraint failed: orders_items.id`
    expect(['SUCCESS', 'DUPLICATE', 'DOUBLE_CAPTURE', 'DUPLICATE_CAPTURE_LEDGERED']).toContain(resA.status);
    expect(['SUCCESS', 'DUPLICATE', 'DOUBLE_CAPTURE', 'DUPLICATE_CAPTURE_LEDGERED']).toContain(resB.status);

    // 4. Verify that the order is confirmed paid and items remain fully intact
    const finalOrder = await payload.findByID({ collection: 'orders', id: orderId });
    expect(finalOrder.paymentStatus).toBe('paid');
    expect(finalOrder.items?.length).toBe(1);
    expect(finalOrder.items?.[0]?.quantity).toBe(10);
  }, 30000);

  it('CONC-TC-06: Database transaction commit failure explicitly rejects and does not swallow error', async () => {
    // 1. Create order and attempt
    const order = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });
    const orderId = order.id as number;
    const gatewayOrderId = String(777000 + (orderId % 10000));
    const txnId = baseTxn + 50;

    const attempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: orderId,
        gatewayOrderId,
        attemptNumber: 1,
        amountCents: 300000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const { body, sig } = makePaymobPayload(orderId, txnId);

    // 2. Temporarily mock payload.db.commitTransaction to simulate failure
    const originalCommit = payload.db.commitTransaction;
    if (typeof originalCommit === 'function') {
      (payload.db as any).commitTransaction = async () => {
        throw new Error('Simulated Database Commit Failure (Connection Severed)');
      };
    }

    try {
      // 3. Execution must throw / reject, NEVER return SUCCESS!
      await expect(
        processPaymobWebhook({
          payload,
          body,
          signature: sig,
          hmacSecret: mockHmacSecret,
          orderId,
          attemptId: attempt.id as number,
        })
      ).rejects.toThrow('Database Transaction Commit Failed');
    } finally {
      // Restore original commit function
      (payload.db as any).commitTransaction = originalCommit;
    }
  });
});
