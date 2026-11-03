import { describe, it, expect, beforeAll } from 'vitest';
import configPromise from '../src/payload.config';
import { getPayload, Payload } from 'payload';
import {
  calculatePaymobHmac,
  verifyPaymobSignature,
  processPaymobWebhook,
  PaymobTransactionObj,
  PaymobWebhookBody,
} from '../src/logic/paymobEngine';

describe('Track 1B: Paymob Multi-Assertion Pipeline & Concurrency Engine', () => {
  let payload: Payload;
  let adminUser: any;
  let customerUser: any;
  let productAId: number;
  let testOrderId: number;
  const mockHmacSecret = 'sec_sandbox_test_hmac_secret_key_mwheba_2026';

  const runBaseTxnId = Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000);
  const txnId1 = runBaseTxnId + 1;
  const txnId3 = runBaseTxnId + 3;
  const txnId4 = runBaseTxnId + 4;
  const txnId5 = runBaseTxnId + 5;
  const txnId6 = runBaseTxnId + 6;
  const txnId7 = runBaseTxnId + 7;
  const txnId8 = runBaseTxnId + 8;
  const txnId81 = runBaseTxnId + 81;
  const txnId82 = runBaseTxnId + 82;
  const txnId91 = runBaseTxnId + 91;
  const txnId101 = runBaseTxnId + 101;
  const txnId111 = runBaseTxnId + 111;
  const txnId12 = runBaseTxnId + 120;
  const txnId13 = runBaseTxnId + 130;
  const txnId14 = runBaseTxnId + 140;
  const txnId15 = runBaseTxnId + 150;
  const txnId16 = runBaseTxnId + 160;
  const txnId17a = runBaseTxnId + 171;
  const txnId17b = runBaseTxnId + 172;
  const txnId17c = runBaseTxnId + 173;

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });
    const timestamp = Date.now();

    // 1. Seed Admin
    adminUser = await payload.create({
      collection: 'users',
      data: {
        email: `admin-paymob-${timestamp}@mwheba.com`,
        password: 'Password123!',
        roles: ['admin', 'finance'],
      },
      context: { isSystemSeed: true },
    });

    // 2. Seed Customer
    customerUser = await payload.create({
      collection: 'users',
      data: {
        email: `customer-paymob-${timestamp}@corp.eg`,
        password: 'Password123!',
        roles: ['customer'],
      },
      context: { isSystemSeed: true },
    });

    // 3. Seed Product A (Physical Thermal Mug, MOQ 10, basePrice 250 EGP)
    const prodA = await payload.create({
      collection: 'products',
      data: {
        title: 'Paymob Test Thermal Mug',
        slug: `paymob-mug-${timestamp}`,
        _status: 'published',
        itemType: 'physical',
        minOrderQuantity: 10,
        customizationFee: 35,
        basePrice: 250,
      },
      user: adminUser,
    });
    productAId = prodA.id as number;

    // 4. Create Placed Order (10 units * 250 = 2,500 EGP = 250,000 cents)
    const order = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [
          {
            product: productAId,
            quantity: 10,
          },
        ],
      },
      user: customerUser,
    });
    testOrderId = order.id as number;
  }, 30000);

  function createMockPaymobPayload(overrides: Partial<PaymobTransactionObj> = {}): PaymobWebhookBody {
    const defaultObj: PaymobTransactionObj = {
      id: 987654321,
      pending: false,
      amount_cents: 250000, // 2,500 EGP
      success: true,
      is_auth: false,
      is_capture: false,
      is_standalone_payment: true,
      is_voided: false,
      is_refunded: false,
      is_3d_secure: true,
      integration_id: 12345,
      order: {
        id: 444444,
        merchant_order_id: String(testOrderId),
      },
      created_at: '2026-11-02T18:30:00.000000',
      currency: 'EGP',
      error_occured: false,
      has_parent_transaction: false,
      owner: 9999,
      source_data: {
        type: 'card',
        pan: '2346',
        sub_type: 'Mastercard',
      },
      txn_response_code: 'APPROVED',
      ...overrides,
    };

    return {
      type: 'TRANSACTION',
      obj: defaultObj,
    };
  }

  it('PAY-TC-01: verifies authentic HMAC SHA-512 and processes valid payment into paid status', async () => {
    // 1. Create Payment Attempt matching order
    const attempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: testOrderId,
        gatewayOrderId: '444444',
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const webhookBody = createMockPaymobPayload({ id: txnId1 });
    const signature = calculatePaymobHmac(webhookBody.obj, mockHmacSecret);

    // Verify signature calculation and timing-safe check
    expect(verifyPaymobSignature(webhookBody.obj, signature, mockHmacSecret)).toBe(true);
    expect(verifyPaymobSignature(webhookBody.obj, 'invalid_signature_hash', mockHmacSecret)).toBe(false);

    // Process webhook
    const result = await processPaymobWebhook({
      payload,
      body: webhookBody,
      signature,
      hmacSecret: mockHmacSecret,
      orderId: testOrderId,
      attemptId: attempt.id as number,
    });

    expect(result.status).toBe('SUCCESS');

    // Verify Order in Database
    const updatedOrder = await payload.findByID({
      collection: 'orders',
      id: testOrderId,
    });
    expect(updatedOrder.paymentStatus).toBe('paid');
    expect(updatedOrder.paidAt).toBeDefined();

    // Verify Attempt in Database
    const updatedAttempt = await payload.findByID({
      collection: 'payment-attempts',
      id: attempt.id,
    });
    expect(updatedAttempt.status).toBe('succeeded');
    expect(updatedAttempt.providerTransactionId).toBe(String(txnId1));
  });

  it('PAY-TC-02: deduplicates webhook replay and duplicate delivery idempotently', async () => {
    const webhookBody = createMockPaymobPayload({ id: txnId1 }); // Identical event as TC-01
    const signature = calculatePaymobHmac(webhookBody.obj, mockHmacSecret);

    // Second delivery of identical event
    const duplicateResult = await processPaymobWebhook({
      payload,
      body: webhookBody,
      signature,
      hmacSecret: mockHmacSecret,
      orderId: testOrderId,
    });

    expect(duplicateResult.status).toBe('DUPLICATE');
    expect(duplicateResult.message).toContain('idempotently');

    // Verify audit log on order is NOT duplicated
    const order = await payload.findByID({
      collection: 'orders',
      id: testOrderId,
    });
    const logs = (order.auditLog || []) as any[];
    const paymobLogs = logs.filter((l: any) => l.entry?.includes(`Txn ID: ${txnId1}`));
    expect(paymobLogs.length).toBe(1); // Exactly one entry
  });

  it('PAY-TC-03: detects amount tampering and freezes order with security alert', async () => {
    const tamperedOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    const attempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: tamperedOrder.id,
        gatewayOrderId: '555555',
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    // Malicious payload: Attacker pays 100.00 EGP (10,000 cents) instead of 2,500.00 EGP (250,000 cents)
    const tamperedBody = createMockPaymobPayload({
      id: txnId3,
      amount_cents: 10000, // FRAUD: 100 EGP!
      order: {
        id: 555555,
        merchant_order_id: String(tamperedOrder.id),
      },
    });
    const validHmacForTamperedAmount = calculatePaymobHmac(tamperedBody.obj, mockHmacSecret);

    const result = await processPaymobWebhook({
      payload,
      body: tamperedBody,
      signature: validHmacForTamperedAmount,
      hmacSecret: mockHmacSecret,
      orderId: tamperedOrder.id as number,
      attemptId: attempt.id as number,
    });

    expect(result.status).toBe('TAMPERED');

    // Verify order was frozen as failed with FRAUD ALERT
    const refreshedOrder = await payload.findByID({
      collection: 'orders',
      id: tamperedOrder.id,
    });
    expect(refreshedOrder.paymentStatus).toBe('failed');
    const logs = (refreshedOrder.auditLog || []) as any[];
    expect(logs.some((l: any) => l.entry?.includes('FRAUD ALERT'))).toBe(true);

    // Verify attempt marked as amount_mismatch
    const refreshedAttempt = await payload.findByID({
      collection: 'payment-attempts',
      id: attempt.id,
    });
    expect(refreshedAttempt.status).toBe('amount_mismatch');
  });

  it('PAY-TC-04: rejects currency mismatch (e.g. paying in USD for an EGP order)', async () => {
    const currencyOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    await payload.create({
      collection: 'payment-attempts',
      data: {
        order: currencyOrder.id,
        gatewayOrderId: '666666',
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const currencyBody = createMockPaymobPayload({
      id: txnId4,
      currency: 'USD', // Currency mismatch!
      order: {
        id: 666666,
        merchant_order_id: String(currencyOrder.id),
      },
    });
    const signature = calculatePaymobHmac(currencyBody.obj, mockHmacSecret);

    const result = await processPaymobWebhook({
      payload,
      body: currencyBody,
      signature,
      hmacSecret: mockHmacSecret,
      orderId: currencyOrder.id as number,
    });

    expect(result.status).toBe('REJECTED');
    expect(result.message).toContain('Currency Mismatch');
  });

  it('PAY-TC-05: scopes failure of older attempt without regressing newer active pending attempt', async () => {
    const reorderOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    // 1. Customer initiates Attempt 1
    const attempt1 = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: reorderOrder.id,
        gatewayOrderId: '777777',
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: false, // Inactive because customer retried with Attempt 2
      },
    });

    // 2. Customer initiates Attempt 2 (Active attempt)
    const attempt2 = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: reorderOrder.id,
        gatewayOrderId: '777777',
        attemptNumber: 2,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    // 3. Webhook for Attempt 1 arrives late with failure (3DS timeout)
    const failedAttempt1Body = createMockPaymobPayload({
      id: txnId5,
      success: false,
      pending: false,
      data: { message: '3DS Verification Timed Out' },
      order: {
        id: 777777,
        merchant_order_id: String(reorderOrder.id),
      },
    });
    const signature1 = calculatePaymobHmac(failedAttempt1Body.obj, mockHmacSecret);

    const failureResult = await processPaymobWebhook({
      payload,
      body: failedAttempt1Body,
      signature: signature1,
      hmacSecret: mockHmacSecret,
      orderId: reorderOrder.id as number,
      attemptId: attempt1.id as number,
    });

    expect(failureResult.status).toBe('FAILED');

    // CRITICAL PROOF: Attempt 1 is marked failed, but Order is STILL 'pending' because Attempt 2 is active!
    const orderMid = await payload.findByID({
      collection: 'orders',
      id: reorderOrder.id,
    });
    expect(orderMid.paymentStatus).toBe('pending'); // NOT regressed to failed!

    const refreshedAttempt1 = await payload.findByID({
      collection: 'payment-attempts',
      id: attempt1.id,
    });
    expect(refreshedAttempt1.status).toBe('failed');

    // 4. Webhook for Attempt 2 arrives with success!
    const successAttempt2Body = createMockPaymobPayload({
      id: txnId6,
      success: true,
      pending: false,
      order: {
        id: 777777,
        merchant_order_id: String(reorderOrder.id),
      },
    });
    const signature2 = calculatePaymobHmac(successAttempt2Body.obj, mockHmacSecret);

    const successResult = await processPaymobWebhook({
      payload,
      body: successAttempt2Body,
      signature: signature2,
      hmacSecret: mockHmacSecret,
      orderId: reorderOrder.id as number,
      attemptId: attempt2.id as number,
    });

    expect(successResult.status).toBe('SUCCESS');

    // Order is now successfully 'paid'
    const orderFinal = await payload.findByID({
      collection: 'orders',
      id: reorderOrder.id,
    });
    expect(orderFinal.paymentStatus).toBe('paid');
  });

  it('PAY-TC-06: handles concurrent duplicate webhooks arriving in parallel without race conditions', async () => {
    const concurrentOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    await payload.create({
      collection: 'payment-attempts',
      data: {
        order: concurrentOrder.id,
        gatewayOrderId: '888888',
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const concurrentBody = createMockPaymobPayload({
      id: txnId7,
      order: {
        id: 888888,
        merchant_order_id: String(concurrentOrder.id),
      },
    });
    const signature = calculatePaymobHmac(concurrentBody.obj, mockHmacSecret);

    // Simulate parallel arrival of two duplicate webhooks at the exact same moment
    const [res1, res2] = await Promise.all([
      processPaymobWebhook({
        payload,
        body: concurrentBody,
        signature,
        hmacSecret: mockHmacSecret,
        orderId: concurrentOrder.id as number,
      }),
      processPaymobWebhook({
        payload,
        body: concurrentBody,
        signature,
        hmacSecret: mockHmacSecret,
        orderId: concurrentOrder.id as number,
      }),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain('SUCCESS');
    expect(statuses).toContain('DUPLICATE');

    // Verify order was marked paid once
    const finalOrder = await payload.findByID({
      collection: 'orders',
      id: concurrentOrder.id,
    });
    expect(finalOrder.paymentStatus).toBe('paid');
  });

  it('PAY-TC-07: handles double capture / multi-success by recording duplicate in ledger without double fulfillment', async () => {
    // Order testOrderId was already paid in TC-01
    // Customer pays again via another tab / asynchronous bank delay
    const doubleCaptureAttempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: testOrderId,
        gatewayOrderId: '444444',
        attemptNumber: 2,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const doubleCaptureBody = createMockPaymobPayload({
      id: txnId8, // Different Paymob transaction ID!
      success: true,
      pending: false,
      order: {
        id: 444444,
        merchant_order_id: String(testOrderId),
      },
    });
    const signature = calculatePaymobHmac(doubleCaptureBody.obj, mockHmacSecret);

    const result = await processPaymobWebhook({
      payload,
      body: doubleCaptureBody,
      signature,
      hmacSecret: mockHmacSecret,
      orderId: testOrderId,
      attemptId: doubleCaptureAttempt.id as number,
    });

    expect(result.status).toBe('DOUBLE_CAPTURE');
    expect(result.message).toContain('Duplicate capture recorded in ledger');

    // Verify attempt was recorded as succeeded_duplicate in financial ledger
    const refreshedAttempt = await payload.findByID({
      collection: 'payment-attempts',
      id: doubleCaptureAttempt.id,
    });
    expect(refreshedAttempt.status).toBe('succeeded_duplicate');
    expect(refreshedAttempt.providerTransactionId).toBe(String(txnId8));

    // Verify order remains paid (not duplicated or corrupted)
    const order = await payload.findByID({
      collection: 'orders',
      id: testOrderId,
    });
    expect(order.paymentStatus).toBe('paid');
  });

  it('PAY-TC-08: rejects uncorrelated order and callbacks without valid payment attempts (Issue 1 Resolved)', async () => {
    // 1. Mismatched merchant_order_id: Callback claims order #999999 while handler was passed testOrderId
    const mismatchBody = createMockPaymobPayload({
      id: txnId81,
      order: {
        id: 999111,
        merchant_order_id: '999999', // Mismatched!
      },
    });
    const sig1 = calculatePaymobHmac(mismatchBody.obj, mockHmacSecret);

    const mismatchResult = await processPaymobWebhook({
      payload,
      body: mismatchBody,
      signature: sig1,
      hmacSecret: mockHmacSecret,
      orderId: testOrderId, // Expected testOrderId != 999999
    });
    expect(mismatchResult.status).toBe('REJECTED');
    expect(mismatchResult.message).toContain('Order Correlation Error');

    // 2. Callback for an order that has zero payment attempts in the database
    const phantomOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    const phantomBody = createMockPaymobPayload({
      id: txnId82,
      order: {
        id: 999222,
        merchant_order_id: String(phantomOrder.id),
      },
    });
    const sig2 = calculatePaymobHmac(phantomBody.obj, mockHmacSecret);

    const phantomResult = await processPaymobWebhook({
      payload,
      body: phantomBody,
      signature: sig2,
      hmacSecret: mockHmacSecret,
      orderId: phantomOrder.id as number,
    });
    expect(phantomResult.status).toBe('REJECTED');
    expect(phantomResult.message).toContain('No payment attempt found');

    // Verify phantom order was NOT marked paid!
    const verifiedPhantomOrder = await payload.findByID({
      collection: 'orders',
      id: phantomOrder.id,
    });
    expect(verifiedPhantomOrder.paymentStatus).toBe('pending');
  });

  it('PAY-TC-09: properly handles asynchronous pending callbacks without treating them as failures (Issue 2 Resolved)', async () => {
    const pendingOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    const pendingAttempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: pendingOrder.id,
        gatewayOrderId: '999333',
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'initiated',
        isActiveAttempt: true,
      },
    });

    // Callback with pending: true and success: false (e.g. 3DS in progress / Kiosk reference generated)
    const pendingBody = createMockPaymobPayload({
      id: txnId91,
      pending: true,
      success: false,
      order: {
        id: 999333,
        merchant_order_id: String(pendingOrder.id),
      },
    });
    const sig = calculatePaymobHmac(pendingBody.obj, mockHmacSecret);

    const result = await processPaymobWebhook({
      payload,
      body: pendingBody,
      signature: sig,
      hmacSecret: mockHmacSecret,
      orderId: pendingOrder.id as number,
      attemptId: pendingAttempt.id as number,
    });

    // PROOF: Status is PENDING, NOT FAILED!
    expect(result.status).toBe('PENDING');

    const refreshedOrder = await payload.findByID({
      collection: 'orders',
      id: pendingOrder.id,
    });
    expect(refreshedOrder.paymentStatus).toBe('pending'); // Still pending!

    const refreshedAttempt = await payload.findByID({
      collection: 'payment-attempts',
      id: pendingAttempt.id,
    });
    expect(refreshedAttempt.status).toBe('pending'); // Updated to pending, NOT failed!
  });

  it('PAY-TC-10: late failure callback on already paid order preserves paid status (Issue 3 Resolved)', async () => {
    // testOrderId was marked 'paid' in TC-01
    const orderBefore = await payload.findByID({
      collection: 'orders',
      id: testOrderId,
    });
    expect(orderBefore.paymentStatus).toBe('paid');

    // Late failure callback arrives for an older attempt or delayed response
    const lateFailureBody = createMockPaymobPayload({
      id: txnId101,
      success: false,
      pending: false,
      data: { message: 'Issuer Declined' },
      order: {
        id: 444444,
        merchant_order_id: String(testOrderId),
      },
    });
    const sig = calculatePaymobHmac(lateFailureBody.obj, mockHmacSecret);

    const result = await processPaymobWebhook({
      payload,
      body: lateFailureBody,
      signature: sig,
      hmacSecret: mockHmacSecret,
      orderId: testOrderId,
    });

    // CRITICAL PROOF: Late failure is recognized and terminal paid state is preserved!
    expect(result.status).toBe('TERMINAL_PAID_PRESERVED');

    const orderAfter = await payload.findByID({
      collection: 'orders',
      id: testOrderId,
    });
    expect(orderAfter.paymentStatus).toBe('paid'); // STRICTLY PAID! NEVER REGRESSED TO FAILED!
  });

  it('PAY-TC-11: reclaims stale processing lease from crashed workers and re-processes event (Issue 4 Resolved)', async () => {
    const crashOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    await payload.create({
      collection: 'payment-attempts',
      data: {
        order: crashOrder.id,
        gatewayOrderId: '999444',
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const crashBody = createMockPaymobPayload({
      id: txnId111,
      order: {
        id: 999444,
        merchant_order_id: String(crashOrder.id),
      },
    });
    const sig = calculatePaymobHmac(crashBody.obj, mockHmacSecret);
    const providerEventId = `${crashBody.obj.id}_${crashBody.obj.success}_${crashBody.obj.pending}_APPROVED`;

    // Simulate an orphaned event stuck in 'processing' from an interrupted/crashed process
    // lockedAt set to 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await payload.create({
      collection: 'payment-events',
      data: {
        provider: 'paymob',
        providerEventId,
        providerTransactionId: String(crashBody.obj.id),
        status: 'processing',
        lockedAt: twoHoursAgo,
        order: crashOrder.id as number,
        eventData: crashBody as any,
      },
    });

    // Re-delivery arrives from gateway retry
    const result = await processPaymobWebhook({
      payload,
      body: crashBody,
      signature: sig,
      hmacSecret: mockHmacSecret,
      orderId: crashOrder.id as number,
      staleThresholdMs: 5000, // 5 seconds threshold
    });

    // Stale lease was reclaimed and event completed successfully!
    expect(result.status).toBe('SUCCESS');

    const completedEvent = await payload.find({
      collection: 'payment-events',
      where: {
        providerEventId: { equals: providerEventId },
      },
    });
    expect(completedEvent.docs[0].status).toBe('completed');

    const finalizedOrder = await payload.findByID({
      collection: 'orders',
      id: crashOrder.id,
    });
    expect(finalizedOrder.paymentStatus).toBe('paid');
  });

  it('PAY-TC-12: rejects redirected callback to different order even with identical amount and valid HMAC (Issue 1 Resolved)', async () => {
    // 1. Order B is an unrelated customer order with same amount (2,500 EGP) and an active attempt (gateway order 888123)
    const orderB = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    await payload.create({
      collection: 'payment-attempts',
      data: {
        order: orderB.id,
        gatewayOrderId: '888123', // Order B's distinct gateway session reference
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    // 2. Attacker intercepts genuine callback for Order A (Paymob order id 444444)
    // Attacker modifies ONLY merchant_order_id to point to Order B
    // Because Paymob HMAC DOES NOT hash merchant_order_id, the HMAC signature is authentic for obj!
    const redirectedBody = createMockPaymobPayload({
      id: txnId12,
      order: {
        id: 444444, // Authenticated in HMAC! Bound to Order A!
        merchant_order_id: String(orderB.id), // Spoofed by attacker to Order B!
      },
    });
    const validHmac = calculatePaymobHmac(redirectedBody.obj, mockHmacSecret);

    // 3. Send the spoofed callback to the engine without expectedAttemptId
    const result = await processPaymobWebhook({
      payload,
      body: redirectedBody,
      signature: validHmac,
      hmacSecret: mockHmacSecret,
    });

    // PROOF: Rejected! Cannot redirect payment to Order B without matching authenticated gateway order ID!
    expect(result.status).toBe('REJECTED');
    expect(result.message).toContain('Gateway Correlation Error');

    // Order B remains pending and UNTOUCHED
    const refreshedOrderB = await payload.findByID({
      collection: 'orders',
      id: orderB.id,
    });
    expect(refreshedOrderB.paymentStatus).toBe('pending');
  });

  it('PAY-TC-13: atomically re-processes previously failed event on retry without DUPLICATE error (Issue 2 Resolved)', async () => {
    // 1. Create a test order and attempt
    const retryOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    await payload.create({
      collection: 'payment-attempts',
      data: {
        order: retryOrder.id,
        gatewayOrderId: '999555',
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    const retryBody = createMockPaymobPayload({
      id: txnId13,
      order: {
        id: 999555,
        merchant_order_id: String(retryOrder.id),
      },
    });
    const sig = calculatePaymobHmac(retryBody.obj, mockHmacSecret);
    const providerEventId = `${retryBody.obj.id}_${retryBody.obj.success}_${retryBody.obj.pending}_APPROVED`;

    // 2. Simulate a previously failed delivery record in payment-events
    await payload.create({
      collection: 'payment-events',
      data: {
        provider: 'paymob',
        providerEventId,
        providerTransactionId: String(retryBody.obj.id),
        status: 'failed', // Event previously failed (e.g. transient network or DB timeout)
        order: retryOrder.id as number,
        eventData: retryBody as any,
      },
    });

    // 3. Gateway retries delivery of the failed event
    const retryResult = await processPaymobWebhook({
      payload,
      body: retryBody,
      signature: sig,
      hmacSecret: mockHmacSecret,
    });

    // PROOF: Result is SUCCESS, NOT DUPLICATE!
    expect(retryResult.status).toBe('SUCCESS');

    // Event is transitioned from 'failed' to 'completed'
    const eventQuery = await payload.find({
      collection: 'payment-events',
      where: {
        providerEventId: { equals: providerEventId },
      },
    });
    expect(eventQuery.docs[0].status).toBe('completed');

    // Order is marked paid
    const finalizedOrder = await payload.findByID({
      collection: 'orders',
      id: retryOrder.id,
    });
    expect(finalizedOrder.paymentStatus).toBe('paid');
  });

  it('PAY-TC-14: strictly preserves succeeded attempt status when late failure callback arrives (Issue 3 Resolved)', async () => {
    // 1. Create order and attempt
    const auditOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    const successfulAttempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: auditOrder.id,
        gatewayOrderId: '999777',
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    // 2. Successful payment callback arrives first
    const successBody = createMockPaymobPayload({
      id: txnId14,
      success: true,
      pending: false,
      order: {
        id: 999777,
        merchant_order_id: String(auditOrder.id),
      },
    });
    const successSig = calculatePaymobHmac(successBody.obj, mockHmacSecret);

    const successResult = await processPaymobWebhook({
      payload,
      body: successBody,
      signature: successSig,
      hmacSecret: mockHmacSecret,
    });
    expect(successResult.status).toBe('SUCCESS');

    // Verify attempt is succeeded and order is paid
    const attemptAfterSuccess = await payload.findByID({
      collection: 'payment-attempts',
      id: successfulAttempt.id,
    });
    expect(attemptAfterSuccess.status).toBe('succeeded');

    // 3. Late failure callback arrives for the same operation
    const lateFailureBody = createMockPaymobPayload({
      id: txnId14,
      success: false,
      pending: false,
      data: { message: 'Late issuer reversal or card error' },
      order: {
        id: 999777,
        merchant_order_id: String(auditOrder.id),
      },
    });
    const failSig = calculatePaymobHmac(lateFailureBody.obj, mockHmacSecret);

    const lateResult = await processPaymobWebhook({
      payload,
      body: lateFailureBody,
      signature: failSig,
      hmacSecret: mockHmacSecret,
    });

    expect(lateResult.status).toBe('TERMINAL_PAID_PRESERVED');

    // CRITICAL PROOFS:
    // A. Order remains strictly paid
    const finalOrder = await payload.findByID({
      collection: 'orders',
      id: auditOrder.id,
    });
    expect(finalOrder.paymentStatus).toBe('paid');

    // B. Attempt status is STILL succeeded! NEVER OVERWRITTEN TO FAILED!
    const attemptAfterLateFailure = await payload.findByID({
      collection: 'payment-attempts',
      id: successfulAttempt.id,
    });
    expect(attemptAfterLateFailure.status).toBe('succeeded');

    // C. Conflicting event is recorded separately for reconciliation
    const conflicts = ((attemptAfterLateFailure.metadata as any)?.conflictingEvents as any[]) || [];
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].type).toBe('LATE_FAILURE_IGNORED');

    // D. Order audit log includes reconciliation conflict entry
    const orderLogs = (finalOrder.auditLog || []) as any[];
    expect(orderLogs.some((l: any) => l.entry?.includes('[RECONCILIATION CONFLICT]'))).toBe(true);
  });

  it('PAY-TC-15: rejects callback even when explicit attemptId is passed if attempt has no matching gatewayOrderId (Issue 1 Resolved)', async () => {
    // 1. Create Order C with an attempt that has NO gatewayOrderId (or different gatewayOrderId)
    const orderC = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    const unlinkedAttempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: orderC.id,
        // Intentionally no gatewayOrderId set!
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'pending',
        isActiveAttempt: true,
      },
    });

    // 2. Attacker redirects valid signed callback from another transaction/order to Order C
    const spoofedBody = createMockPaymobPayload({
      id: txnId15,
      order: {
        id: 444444, // Authenticated in HMAC from another order
        merchant_order_id: String(orderC.id),
      },
    });
    const validHmac = calculatePaymobHmac(spoofedBody.obj, mockHmacSecret);

    // 3. Attacker passes explicit attemptId to try to bypass correlation
    const result = await processPaymobWebhook({
      payload,
      body: spoofedBody,
      signature: validHmac,
      hmacSecret: mockHmacSecret,
      orderId: orderC.id as number,
      attemptId: unlinkedAttempt.id as number,
    });

    // PROOF: Explicit attemptId CANNOT bypass gateway order correlation!
    expect(result.status).toBe('REJECTED');
    expect(result.message).toContain('Gateway Correlation Error');

    // Order C remains pending and unpaid
    const verifiedOrderC = await payload.findByID({
      collection: 'orders',
      id: orderC.id,
    });
    expect(verifiedOrderC.paymentStatus).toBe('pending');

    // Attempt remains pending
    const verifiedAttempt = await payload.findByID({
      collection: 'payment-attempts',
      id: unlinkedAttempt.id,
    });
    expect(verifiedAttempt.status).toBe('pending');
  });

  it('PAY-TC-16: strictly preserves succeeded_duplicate attempt status when late failure callback arrives (Issue 2 Resolved)', async () => {
    // 1. Create order and attempt with succeeded_duplicate status
    const duplicateOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        paymentStatus: 'paid', // Order was already paid in full!
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    // Customer paid twice, second attempt is recorded as succeeded_duplicate
    const duplicateAttempt = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: duplicateOrder.id,
        gatewayOrderId: '999888',
        providerTransactionId: String(txnId16),
        attemptNumber: 2,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'succeeded_duplicate',
        isActiveAttempt: false,
      },
    });

    // 2. Late failure callback arrives for this exact second transaction
    const lateFailureBody = createMockPaymobPayload({
      id: txnId16,
      success: false,
      pending: false,
      data: { message: 'Late failure or reversal on duplicate transaction' },
      order: {
        id: 999888,
        merchant_order_id: String(duplicateOrder.id),
      },
    });
    const failSig = calculatePaymobHmac(lateFailureBody.obj, mockHmacSecret);

    const result = await processPaymobWebhook({
      payload,
      body: lateFailureBody,
      signature: failSig,
      hmacSecret: mockHmacSecret,
      orderId: duplicateOrder.id as number,
      attemptId: duplicateAttempt.id as number,
    });

    // PROOF:
    // A. Terminal state preserved
    expect(result.status).toBe('TERMINAL_PAID_PRESERVED');

    // B. CRITICAL: Attempt status is STILL succeeded_duplicate! NEVER OVERWRITTEN TO FAILED!
    const refreshedDuplicateAttempt = await payload.findByID({
      collection: 'payment-attempts',
      id: duplicateAttempt.id,
    });
    expect(refreshedDuplicateAttempt.status).toBe('succeeded_duplicate');

    // C. Conflicting late event recorded in metadata
    const conflicts = ((refreshedDuplicateAttempt.metadata as any)?.conflictingEvents as any[]) || [];
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].type).toBe('LATE_FAILURE_IGNORED');

    // D. Order remains paid
    const refreshedOrder = await payload.findByID({
      collection: 'orders',
      id: duplicateOrder.id,
    });
    expect(refreshedOrder.paymentStatus).toBe('paid');
  });

  it('PAY-TC-17: records new distinct duplicate capture in independent attempt without overwriting previous duplicate capture (P1 Defect Resolved)', async () => {
    // 1. Create order and set it to paid (as an order paid in full)
    const multiCaptureOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        paymentStatus: 'paid',
        items: [{ product: productAId, quantity: 10 }],
      },
      user: customerUser,
    });

    // 2. Initial payment was already collected (Attempt 1)
    await payload.create({
      collection: 'payment-attempts',
      data: {
        order: multiCaptureOrder.id,
        gatewayOrderId: '9000888',
        providerTransactionId: String(txnId17a),
        attemptNumber: 1,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'succeeded',
        isActiveAttempt: false,
      },
    });

    // 3. Customer accidentally paid second time -> Recorded as duplicate capture (Attempt 2, Txn: txnId17b)
    const duplicateAttempt1 = await payload.create({
      collection: 'payment-attempts',
      data: {
        order: multiCaptureOrder.id,
        gatewayOrderId: '9000888',
        providerTransactionId: String(txnId17b),
        attemptNumber: 2,
        amountCents: 250000,
        currency: 'EGP',
        provider: 'paymob',
        status: 'succeeded_duplicate',
        isActiveAttempt: false,
      },
    });

    // 4. A THIRD successful payment arrives for the same gateway session with a NEW transaction ID (txnId17c)
    const thirdSuccessBody = createMockPaymobPayload({
      id: txnId17c,
      success: true,
      pending: false,
      order: {
        id: 9000888,
        merchant_order_id: String(multiCaptureOrder.id),
      },
    });
    const sig = calculatePaymobHmac(thirdSuccessBody.obj, mockHmacSecret);

    const result = await processPaymobWebhook({
      payload,
      body: thirdSuccessBody,
      signature: sig,
      hmacSecret: mockHmacSecret,
      orderId: multiCaptureOrder.id as number,
    });

    expect(result.status).toBe('DOUBLE_CAPTURE');

    // 5. CRITICAL PROOFS:
    // A. Attempt 2 (Txn txnId17b) was NOT overwritten! Its providerTransactionId is STILL txnId17b!
    const refreshedAttempt2 = await payload.findByID({
      collection: 'payment-attempts',
      id: duplicateAttempt1.id,
    });
    expect(refreshedAttempt2.providerTransactionId).toBe(String(txnId17b));
    expect(refreshedAttempt2.status).toBe('succeeded_duplicate');

    // B. Attempt 3 was created as a NEW independent attempt document!
    const attempts = await payload.find({
      collection: 'payment-attempts',
      where: {
        order: { equals: multiCaptureOrder.id },
      },
      sort: 'attemptNumber',
    });
    expect(attempts.totalDocs).toBe(3);

    const attempt3 = attempts.docs.find((a: any) => a.providerTransactionId === String(txnId17c));
    expect(attempt3).toBeDefined();
    expect(attempt3?.status).toBe('succeeded_duplicate');

    // C. Replaying the exact same third transaction returns DUPLICATE without creating a fourth attempt
    const replayResult = await processPaymobWebhook({
      payload,
      body: thirdSuccessBody,
      signature: sig,
      hmacSecret: mockHmacSecret,
      orderId: multiCaptureOrder.id as number,
    });
    expect(replayResult.status).toBe('DUPLICATE');

    const attemptsAfterReplay = await payload.find({
      collection: 'payment-attempts',
      where: {
        order: { equals: multiCaptureOrder.id },
      },
    });
    expect(attemptsAfterReplay.totalDocs).toBe(3); // Still exactly 3!
  });
});
