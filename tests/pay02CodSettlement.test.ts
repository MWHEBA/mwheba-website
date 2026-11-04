import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import { NextRequest } from 'next/server';
import configPromise from '@/payload.config';
import { getOrCreateCart } from '@/modules/cart-checkout/services/cartStorage';
import { buildCheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import { createOrderFromCart } from '@/modules/orders/services/orderService';
import {
  recordCodCollection,
  recordDeliveryRefusal,
  reconcileCourierRemittanceBatch,
} from '@/modules/payments/services/codSettlementService';
import { POST as collectRoute } from '@/app/api/payments/cod/collect/route';
import { POST as remitRoute } from '@/app/api/payments/cod/remit/route';
import { POST as refuseRoute } from '@/app/api/payments/cod/refuse/route';

describe('PAY-02: COD Collection Settlement, Idempotency & Courier Remittance', () => {
  let payload: any;
  let opsUser: any;
  let opsToken: string;
  let financeUser: any;
  let financeToken: string;
  let superAdminUser: any;
  let superAdminToken: string;
  let customerUser: any;
  let customerToken: string;
  let physicalProduct: any;

  const cleanup = {
    users: [] as any[],
    orders: [] as any[],
    carts: [] as any[],
    products: [] as any[],
    collections: [] as any[],
    remittances: [] as any[],
  };

  const unique = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  const loginToken = async (email: string, password: string) => {
    const res = await payload.login({ collection: 'users', data: { email, password } });
    return res.token as string;
  };

  const asReq = (url: string, token: string | null, body?: any) =>
    new NextRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `JWT ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  // Helper to place a real COD order
  const createTestCodOrder = async (companyName = 'Test Company', city = 'Cairo') => {
    const cart = await getOrCreateCart(payload);
    cleanup.carts.push(cart.id);
    await payload.update({
      collection: 'carts',
      id: cart.id,
      data: { items: [{ product: physicalProduct.id, quantity: 10 }] },
    });

    const quote = await buildCheckoutQuote(payload, cart.id, { method: 'shipping', governorate: city });
    const email = `cod_buyer_${unique()}@mwheba.test`;

    const result = await createOrderFromCart(payload, {
      cartId: cart.id,
      guestSecret: cart.secret,
      customer: {
        email,
        password: 'Password2026!',
        companyName,
        contactPerson: 'Purchasing Manager',
        phone: '+201011223344',
      },
      delivery: {
        method: 'shipping',
        shippingAddress: { governorate: city, city, streetAddress: '100 Nile St' },
        expectedShippingFee: quote.shippingFee,
      },
      paymentMethod: 'cod',
      expectedGrandTotal: quote.grandTotal,
      idempotencyKey: `idemp_${unique()}`,
    });

    const order = await payload.findByID({
      collection: 'orders',
      id: result.order.id,
    });
    order.total = Number(order.amount ?? order.total);
    cleanup.orders.push(order.id);
    return order;
  };

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    // 1. Create Staff Users
    const password = 'Password2026!';

    opsUser = await payload.create({
      collection: 'users',
      data: { email: `ops_pay02_${unique()}@mwheba.test`, password, roles: ['operations'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(opsUser.id);
    opsToken = await loginToken(opsUser.email, password);

    financeUser = await payload.create({
      collection: 'users',
      data: { email: `fin_pay02_${unique()}@mwheba.test`, password, roles: ['finance'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(financeUser.id);
    financeToken = await loginToken(financeUser.email, password);

    superAdminUser = await payload.create({
      collection: 'users',
      data: { email: `admin_pay02_${unique()}@mwheba.test`, password, roles: ['super_admin'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(superAdminUser.id);
    superAdminToken = await loginToken(superAdminUser.email, password);

    customerUser = await payload.create({
      collection: 'users',
      data: { email: `cust_pay02_${unique()}@mwheba.test`, password, roles: ['customer'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(customerUser.id);
    customerToken = await loginToken(customerUser.email, password);

    // 2. Create physical merchandise product (10 MOQ, base price 150 EGP)
    physicalProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'PAY-02 Stainless Steel Thermal Mug',
        slug: `pay02-mug-${unique()}`,
        itemType: 'physical',
        basePrice: 150,
        minOrderQuantity: 10,
        allowArtworkUpload: false,
        _status: 'published',
      },
    });
    cleanup.products.push(physicalProduct.id);
  });

  afterAll(async () => {
    const del = async (collection: string, id: any, context?: any) => {
      try {
        await payload.delete({ collection, id, context });
      } catch {
        // best effort cleanup
      }
    };

    for (const rId of cleanup.remittances) await del('courier-remittances', rId);
    for (const cId of cleanup.collections) await del('payment-collections', cId);

    for (const orderId of cleanup.orders) {
      const jobs = await payload
        .find({ collection: 'fulfillment-jobs', where: { order: { equals: orderId } }, limit: 50, depth: 0 })
        .catch(() => ({ docs: [] }));
      for (const j of jobs.docs as any[]) await del('fulfillment-jobs', j.id);
      await del('orders', orderId);
    }

    for (const id of cleanup.users) await del('users', id);
    for (const id of cleanup.products) await del('products', id);
    for (const id of cleanup.carts) await del('carts', id);
  });

  // ===========================================================================
  // 1. Cash on Delivery Collection Registration
  // ===========================================================================
  describe('1. Cash on Delivery (COD) Collection Registration', () => {
    it('rejects cash collection recording by unauthorized roles (customer) with 403', async () => {
      const order = await createTestCodOrder();
      const receipt = `REC_${unique()}`;

      await expect(
        recordCodCollection(payload, {
          orderId: order.id,
          collectedAmount: order.total,
          collectorType: 'courier',
          collectorName: 'Bosta Driver',
          receiptReference: receipt,
          actor: { id: customerUser.id, roles: customerUser.roles },
        })
      ).rejects.toThrow('FORBIDDEN');
    });

    it('rejects collection if collected amount does not match order grand total with exact integer piastres (422 AMOUNT_MISMATCH)', async () => {
      const order = await createTestCodOrder();
      const receipt = `REC_${unique()}`;

      // Underpay by 1 EGP
      await expect(
        recordCodCollection(payload, {
          orderId: order.id,
          collectedAmount: Number(order.total) - 1,
          collectorType: 'courier',
          collectorName: 'Bosta Driver',
          receiptReference: receipt,
          actor: { id: opsUser.id, roles: opsUser.roles },
        })
      ).rejects.toThrow('AMOUNT_MISMATCH');

      // Overpay by 50 piastres
      await expect(
        recordCodCollection(payload, {
          orderId: order.id,
          collectedAmount: Number(order.total) + 0.5,
          collectorType: 'courier',
          collectorName: 'Bosta Driver',
          receiptReference: receipt,
          actor: { id: opsUser.id, roles: opsUser.roles },
        })
      ).rejects.toThrow('AMOUNT_MISMATCH');
    });

    it('successfully records cash collection by courier: sets paymentStatus = paid and remittanceStatus = collected_by_courier', async () => {
      const order = await createTestCodOrder();
      const receipt = `REC_${unique()}`;

      const res = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'Mahmoud (Bosta Express)',
        receiptReference: receipt,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });

      expect(res.status).toBe('COLLECTION_RECORDED');
      expect(res.paymentStatus).toBe('paid');
      expect(res.remittanceStatus).toBe('collected_by_courier');
      cleanup.collections.push(res.collectionId);

      // Verify order doc in database
      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.paymentStatus).toBe('paid');
      expect(freshOrder.remittanceStatus).toBe('collected_by_courier');
      expect(freshOrder.codDetails?.collectionReference).toBe(receipt);
      expect(freshOrder.codDetails?.collectorName).toBe('Mahmoud (Bosta Express)');

      // Verify PaymentCollection doc in database
      const colDoc = await payload.findByID({ collection: 'payment-collections', id: res.collectionId });
      expect(colDoc.receiptReference).toBe(receipt);
      expect(colDoc.amount).toBe(order.total);
      expect(colDoc.remittanceStatus).toBe('pending_remittance');
      expect(colDoc.collectorType).toBe('courier');
    });

    it('records cash collection by office staff: sets remittanceStatus = remitted_to_company', async () => {
      const order = await createTestCodOrder();
      const receipt = `REC_OFFICE_${unique()}`;

      const res = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'office_staff',
        collectorName: 'MWHEBA Counter Cashier',
        receiptReference: receipt,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });

      expect(res.status).toBe('COLLECTION_RECORDED');
      expect(res.remittanceStatus).toBe('remitted_to_company');
      cleanup.collections.push(res.collectionId);

      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.remittanceStatus).toBe('remitted_to_company');

      const colDoc = await payload.findByID({ collection: 'payment-collections', id: res.collectionId });
      expect(colDoc.remittanceStatus).toBe('remitted_to_company');
    });

    it('idempotency: repeated submission of the exact same receipt reference returns ALREADY_COLLECTED with zero duplicate ledger records', async () => {
      const order = await createTestCodOrder();
      const receipt = `REC_IDEMP_${unique()}`;

      // First call
      const firstRes = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'Aramex Courier',
        receiptReference: receipt,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      expect(firstRes.status).toBe('COLLECTION_RECORDED');
      cleanup.collections.push(firstRes.collectionId);

      // Repeated duplicate call
      const secondRes = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'Aramex Courier',
        receiptReference: receipt,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });

      expect(secondRes.status).toBe('ALREADY_COLLECTED');
      expect(secondRes.collectionId).toBe(firstRes.collectionId);

      // Verify that strictly 1 collection record exists for this receipt
      const totalCollections = await payload.find({
        collection: 'payment-collections',
        where: { receiptReference: { equals: receipt } },
      });
      expect(totalCollections.totalDocs).toBe(1);
    });

    it('rejects using an already registered receipt reference for a different order (409 RECEIPT_ALREADY_USED)', async () => {
      const order1 = await createTestCodOrder();
      const order2 = await createTestCodOrder();
      const sharedReceipt = `REC_COLLIDE_${unique()}`;

      const res1 = await recordCodCollection(payload, {
        orderId: order1.id,
        collectedAmount: order1.total,
        collectorType: 'courier',
        collectorName: 'Courier A',
        receiptReference: sharedReceipt,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(res1.collectionId);

      // Attempt to register same receipt for order2
      await expect(
        recordCodCollection(payload, {
          orderId: order2.id,
          collectedAmount: order2.total,
          collectorType: 'courier',
          collectorName: 'Courier B',
          receiptReference: sharedReceipt,
          actor: { id: opsUser.id, roles: opsUser.roles },
        })
      ).rejects.toThrow('RECEIPT_ALREADY_USED');
    });

    it('atomic transaction rollback: if order update fails, collection record is rolled back cleanly with zero orphaned rows', async () => {
      const order = await createTestCodOrder();
      const receipt = `REC_ROLLBACK_${unique()}`;

      await expect(
        recordCodCollection(
          payload,
          {
            orderId: order.id,
            collectedAmount: order.total,
            collectorType: 'courier',
            collectorName: 'Test Driver',
            receiptReference: receipt,
            actor: { id: opsUser.id, roles: opsUser.roles },
          },
          { failOrderUpdateForTest: true }
        )
      ).rejects.toThrow('SIMULATED_ORDER_UPDATE_FAILURE');

      // Verify that PaymentCollection was NOT created in database
      const cols = await payload.find({
        collection: 'payment-collections',
        where: { receiptReference: { equals: receipt } },
      });
      expect(cols.totalDocs).toBe(0);

      // Verify order paymentStatus remained unpaid
      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.paymentStatus).toBe('unpaid');
    });
  });

  // ===========================================================================
  // 2. Concurrency & Race Condition Defense
  // ===========================================================================
  describe('2. Concurrency & Race Condition Defense', () => {
    it('serializes 5 concurrent simultaneous collection submissions for the same order: exactly 1 records collection, 4 return ALREADY_COLLECTED/ALREADY_PAID', async () => {
      const order = await createTestCodOrder();
      const receipt = `REC_CONCURRENT_${unique()}`;

      // Launch 5 parallel collection requests with the same receipt reference
      const promises = Array.from({ length: 5 }, () =>
        recordCodCollection(payload, {
          orderId: order.id,
          collectedAmount: order.total,
          collectorType: 'courier',
          collectorName: 'Concurrent Courier Call',
          receiptReference: receipt,
          actor: { id: opsUser.id, roles: opsUser.roles },
        })
      );

      const results = await Promise.all(promises);

      // Exactly 1 must have COLLECTION_RECORDED, and the other 4 must have ALREADY_COLLECTED (or ALREADY_PAID)
      const recordedCount = results.filter((r) => r.status === 'COLLECTION_RECORDED').length;
      const alreadyCollectedCount = results.filter((r) => r.status === 'ALREADY_COLLECTED' || r.status === 'ALREADY_PAID').length;

      expect(recordedCount).toBe(1);
      expect(alreadyCollectedCount).toBe(4);

      const recorded = results.find((r) => r.status === 'COLLECTION_RECORDED');
      if (recorded?.collectionId) cleanup.collections.push(recorded.collectionId);

      // Check database: exactly 1 PaymentCollection row exists
      const dbCols = await payload.find({
        collection: 'payment-collections',
        where: { order: { equals: order.id } },
      });
      expect(dbCols.totalDocs).toBe(1);

      // Order is paid
      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.paymentStatus).toBe('paid');
    });
  });

  // ===========================================================================
  // 3. Customer Delivery Refusal Handling
  // ===========================================================================
  describe('3. Customer Delivery Refusal Handling', () => {
    it('records customer delivery refusal: sets orderStatus = cancelled, fulfillmentStatus = returned_to_origin, and paymentStatus strictly unpaid', async () => {
      const order = await createTestCodOrder();

      const res = await recordDeliveryRefusal(payload, {
        orderId: order.id,
        refusalReason: 'Customer refused delivery: company branch relocated to New Cairo',
        actor: { id: opsUser.id, roles: opsUser.roles },
      });

      expect(res.status).toBe('DELIVERY_REFUSED_RECORDED');
      expect(res.orderStatus).toBe('cancelled');
      expect(res.fulfillmentStatus).toBe('returned_to_origin');
      expect(res.paymentStatus).toBe('unpaid');

      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.orderStatus).toBe('cancelled');
      expect(freshOrder.fulfillmentStatus).toBe('returned_to_origin');
      expect(freshOrder.paymentStatus).toBe('unpaid');
      expect(freshOrder.codDetails?.refusalReason).toContain('company branch relocated');
    });

    it('blocks recording collection on a cancelled or returned/refused order (422 CANNOT_COLLECT_CANCELLED_OR_REFUSED_ORDER)', async () => {
      const order = await createTestCodOrder();

      await recordDeliveryRefusal(payload, {
        orderId: order.id,
        refusalReason: 'Package damaged in transit, rejected by customer',
        actor: { id: opsUser.id, roles: opsUser.roles },
      });

      await expect(
        recordCodCollection(payload, {
          orderId: order.id,
          collectedAmount: order.total,
          collectorType: 'courier',
          collectorName: 'Courier',
          receiptReference: `REC_AFTER_REFUSAL_${unique()}`,
          actor: { id: opsUser.id, roles: opsUser.roles },
        })
      ).rejects.toThrow('CANNOT_COLLECT_CANCELLED_OR_REFUSED_ORDER');
    });

    it('blocks delivery refusal on an already paid order (422 CANNOT_REFUSE_PAID_ORDER)', async () => {
      const order = await createTestCodOrder();
      const receipt = `REC_PAID_${unique()}`;

      const collectRes = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'Courier',
        receiptReference: receipt,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(collectRes.collectionId);

      await expect(
        recordDeliveryRefusal(payload, {
          orderId: order.id,
          refusalReason: 'Late delivery complaint',
          actor: { id: opsUser.id, roles: opsUser.roles },
        })
      ).rejects.toThrow('CANNOT_REFUSE_PAID_ORDER');
    });
  });

  // ===========================================================================
  // 4. Courier Remittance Reconciliation & Net Deposit Formula
  // ===========================================================================
  describe('4. Courier Remittance Reconciliation & Net Deposit Formula', () => {
    it('rejects non-finance users (operations) from reconciling remittance batches with 403', async () => {
      const order = await createTestCodOrder();
      const receipt = `REC_REMIT_UNAUTH_${unique()}`;
      const col = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'Bosta Driver',
        receiptReference: receipt,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(col.collectionId);

      await expect(
        reconcileCourierRemittanceBatch(payload, {
          batchId: `BATCH_${unique()}`,
          courierCompany: 'Bosta',
          orderIds: [order.id],
          grossCollectedAmount: order.total,
          netDepositAmount: order.total,
          depositSlipReference: 'DEP-12345',
          depositDate: new Date().toISOString(),
          actor: { id: opsUser.id, roles: opsUser.roles }, // ops is unauthorized
        })
      ).rejects.toThrow('FORBIDDEN');
    });

    it('rejects duplicate order IDs within the remittance batch with 422 DUPLICATE_ORDER_IN_BATCH', async () => {
      const order = await createTestCodOrder();

      await expect(
        reconcileCourierRemittanceBatch(payload, {
          batchId: `BATCH_${unique()}`,
          courierCompany: 'Bosta',
          orderIds: [order.id, order.id], // duplicate
          grossCollectedAmount: Number(order.total) * 2,
          netDepositAmount: Number(order.total) * 2,
          depositSlipReference: 'DEP-123',
          depositDate: new Date().toISOString(),
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('DUPLICATE_ORDER_IN_BATCH');
    });

    it('rejects batch if an order has not been recorded as collected by courier (422 ORDER_NOT_COLLECTED)', async () => {
      const unpaidOrder = await createTestCodOrder();

      await expect(
        reconcileCourierRemittanceBatch(payload, {
          batchId: `BATCH_${unique()}`,
          courierCompany: 'Bosta',
          orderIds: [unpaidOrder.id],
          grossCollectedAmount: unpaidOrder.total,
          netDepositAmount: unpaidOrder.total,
          depositSlipReference: 'DEP-456',
          depositDate: new Date().toISOString(),
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('ORDER_NOT_COLLECTED');
    });

    it('rejects batch if stated grossCollectedAmount does not match exact sum of order totals (422 GROSS_AMOUNT_MISMATCH)', async () => {
      const order1 = await createTestCodOrder();
      const order2 = await createTestCodOrder();

      const col1 = await recordCodCollection(payload, {
        orderId: order1.id,
        collectedAmount: order1.total,
        collectorType: 'courier',
        collectorName: 'Bosta',
        receiptReference: `REC_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      const col2 = await recordCodCollection(payload, {
        orderId: order2.id,
        collectedAmount: order2.total,
        collectorType: 'courier',
        collectorName: 'Bosta',
        receiptReference: `REC_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(col1.collectionId, col2.collectionId);

      const actualSum = Number(order1.total) + Number(order2.total);

      // Submit with mismatched gross (under by 10 EGP)
      await expect(
        reconcileCourierRemittanceBatch(payload, {
          batchId: `BATCH_${unique()}`,
          courierCompany: 'Bosta',
          orderIds: [order1.id, order2.id],
          grossCollectedAmount: actualSum - 10,
          netDepositAmount: actualSum - 10,
          depositSlipReference: 'DEP-GROSS-FAIL',
          depositDate: new Date().toISOString(),
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('GROSS_AMOUNT_MISMATCH');
    });

    it('rejects batch if actual net deposit does not match expected net (gross - deductions) without variance approval (422 REMITTANCE_VARIANCE_MISMATCH)', async () => {
      const order = await createTestCodOrder();
      const col = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'Bosta',
        receiptReference: `REC_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(col.collectionId);

      const gross = Number(order.total);
      const courierFees = 60; // courier deduction
      const otherDeductions = 10; // bank transfer fee
      const expectedNet = gross - courierFees - otherDeductions;
      const actualDeposit = expectedNet - 25; // short by 25 EGP without authorization

      await expect(
        reconcileCourierRemittanceBatch(payload, {
          batchId: `BATCH_${unique()}`,
          courierCompany: 'Bosta',
          orderIds: [order.id],
          grossCollectedAmount: gross,
          courierFeeDeductions: courierFees,
          otherDeductions: otherDeductions,
          netDepositAmount: actualDeposit,
          depositSlipReference: 'DEP-VAR-FAIL',
          depositDate: new Date().toISOString(),
          actor: { id: financeUser.id, roles: financeUser.roles },
          varianceApproved: false,
        })
      ).rejects.toThrow('REMITTANCE_VARIANCE_MISMATCH');
    });

    it('accepts deposit discrepancy when varianceApproved = true and varianceNotes is documented, setting status = discrepancy', async () => {
      const order = await createTestCodOrder();
      const col = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'Aramex',
        receiptReference: `REC_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(col.collectionId);

      const gross = Number(order.total);
      const courierFees = 50;
      const expectedNet = gross - courierFees;
      const actualDeposit = expectedNet - 15; // 15 EGP discrepancy approved by finance director

      const batchId = `BATCH_VAR_${unique()}`;
      const res = await reconcileCourierRemittanceBatch(payload, {
        batchId,
        courierCompany: 'Aramex',
        orderIds: [order.id],
        grossCollectedAmount: gross,
        courierFeeDeductions: courierFees,
        netDepositAmount: actualDeposit,
        depositSlipReference: 'DEP-VAR-APPROVED',
        depositDate: new Date().toISOString(),
        actor: { id: financeUser.id, roles: financeUser.roles },
        varianceApproved: true,
        varianceNotes: 'Approved variance: 15 EGP packaging difference authorized by Finance Director.',
      });

      expect(res.status).toBe('REMITTANCE_SUCCESSFUL');
      expect(res.reconciledStatus).toBe('discrepancy');
      cleanup.remittances.push(res.remittanceId);

      const remDoc = await payload.findByID({ collection: 'courier-remittances', id: res.remittanceId });
      expect(remDoc.status).toBe('discrepancy');
      expect(remDoc.varianceApproved).toBe(true);
      expect(remDoc.varianceNotes).toContain('packaging difference');
    });

    it('successfully reconciles remittance batch with matching net deposit: marks batch reconciled, updates all orders and payment-collections to remitted_to_company', async () => {
      const order1 = await createTestCodOrder();
      const order2 = await createTestCodOrder();

      const col1 = await recordCodCollection(payload, {
        orderId: order1.id,
        collectedAmount: order1.total,
        collectorType: 'courier',
        collectorName: 'Bosta Partner',
        receiptReference: `REC_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      const col2 = await recordCodCollection(payload, {
        orderId: order2.id,
        collectedAmount: order2.total,
        collectorType: 'courier',
        collectorName: 'Bosta Partner',
        receiptReference: `REC_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(col1.collectionId, col2.collectionId);

      const gross = Number(order1.total) + Number(order2.total);
      const courierFees = 140; // 70 EGP per order
      const otherDeductions = 20; // wire fee
      const expectedNet = gross - courierFees - otherDeductions;

      const batchId = `BATCH_OK_${unique()}`;
      const res = await reconcileCourierRemittanceBatch(payload, {
        batchId,
        courierCompany: 'Bosta',
        orderIds: [order1.id, order2.id],
        grossCollectedAmount: gross,
        courierFeeDeductions: courierFees,
        otherDeductions: otherDeductions,
        netDepositAmount: expectedNet,
        depositSlipReference: 'CIB-DEP-998877',
        depositDate: new Date().toISOString(),
        actor: { id: financeUser.id, roles: financeUser.roles },
      });

      expect(res.status).toBe('REMITTANCE_SUCCESSFUL');
      expect(res.reconciledStatus).toBe('reconciled');
      expect(res.orderCount).toBe(2);
      cleanup.remittances.push(res.remittanceId);

      // Verify both orders in DB have remittanceStatus = remitted_to_company and courierRemittanceBatchId
      const o1 = await payload.findByID({ collection: 'orders', id: order1.id });
      const o2 = await payload.findByID({ collection: 'orders', id: order2.id });
      expect(o1.remittanceStatus).toBe('remitted_to_company');
      expect(o1.codDetails?.courierRemittanceBatchId).toBe(batchId);
      expect(o2.remittanceStatus).toBe('remitted_to_company');
      expect(o2.codDetails?.courierRemittanceBatchId).toBe(batchId);

      // Verify both PaymentCollection docs in DB have remittanceStatus = remitted_to_company and remittanceBatchId
      const c1 = await payload.findByID({ collection: 'payment-collections', id: col1.collectionId });
      const c2 = await payload.findByID({ collection: 'payment-collections', id: col2.collectionId });
      expect(c1.remittanceStatus).toBe('remitted_to_company');
      expect(c1.remittanceBatchId).toBe(batchId);
      expect(c2.remittanceStatus).toBe('remitted_to_company');
      expect(c2.remittanceBatchId).toBe(batchId);

      // Double-remittance defense: attempting to re-remit order1 in another batch must fail with 409
      await expect(
        reconcileCourierRemittanceBatch(payload, {
          batchId: `BATCH_SECOND_${unique()}`,
          courierCompany: 'Bosta',
          orderIds: [order1.id],
          grossCollectedAmount: order1.total,
          netDepositAmount: order1.total,
          depositSlipReference: 'DEP-DOUBLE',
          depositDate: new Date().toISOString(),
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('DOUBLE_REMITTANCE_ERROR');
    });

    it('rejects batch ID collisions with 409 BATCH_ALREADY_EXISTS', async () => {
      const order = await createTestCodOrder();
      const col = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'Bosta',
        receiptReference: `REC_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(col.collectionId);

      const batchId = `BATCH_COLLIDE_${unique()}`;

      const res = await reconcileCourierRemittanceBatch(payload, {
        batchId,
        courierCompany: 'Bosta',
        orderIds: [order.id],
        grossCollectedAmount: order.total,
        netDepositAmount: order.total,
        depositSlipReference: 'DEP-COL-1',
        depositDate: new Date().toISOString(),
        actor: { id: financeUser.id, roles: financeUser.roles },
      });
      cleanup.remittances.push(res.remittanceId);

      // Create another order to test with the same batchId
      const order2 = await createTestCodOrder();
      const col2 = await recordCodCollection(payload, {
        orderId: order2.id,
        collectedAmount: order2.total,
        collectorType: 'courier',
        collectorName: 'Bosta',
        receiptReference: `REC_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(col2.collectionId);

      await expect(
        reconcileCourierRemittanceBatch(payload, {
          batchId, // colliding ID
          courierCompany: 'Bosta',
          orderIds: [order2.id],
          grossCollectedAmount: order2.total,
          netDepositAmount: order2.total,
          depositSlipReference: 'DEP-COL-2',
          depositDate: new Date().toISOString(),
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('BATCH_ALREADY_EXISTS');
    });
  });

  // ===========================================================================
  // 5. HTTP Endpoints Integration (/api/payments/cod/*)
  // ===========================================================================
  describe('5. HTTP Endpoints Integration (/api/payments/cod/*)', () => {
    it('records collection via POST /api/payments/cod/collect with JWT auth and rejects unauthenticated calls', async () => {
      const order = await createTestCodOrder();
      const receipt = `REC_HTTP_${unique()}`;

      // 1. Unauthenticated -> 401
      const unauthReq = asReq('http://localhost:3000/api/payments/cod/collect', null, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'HTTP Courier',
        receiptReference: receipt,
      });
      const unauthRes = await collectRoute(unauthReq);
      expect(unauthRes.status).toBe(401);

      // 2. Authenticated ops -> 200
      const authReq = asReq('http://localhost:3000/api/payments/cod/collect', opsToken, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'HTTP Courier',
        receiptReference: receipt,
      });
      const authRes = await collectRoute(authReq);
      expect(authRes.status).toBe(200);
      const body = await authRes.json();
      expect(body.success).toBe(true);
      expect(body.status).toBe('COLLECTION_RECORDED');
      expect(body.paymentStatus).toBe('paid');
      cleanup.collections.push(body.collectionId);
    });

    it('records delivery refusal via POST /api/payments/cod/refuse with JWT auth', async () => {
      const order = await createTestCodOrder();

      const refuseReq = asReq('http://localhost:3000/api/payments/cod/refuse', opsToken, {
        orderId: order.id,
        refusalReason: 'Customer refused: purchase order cancelled by finance department.',
      });
      const refuseRes = await refuseRoute(refuseReq);
      expect(refuseRes.status).toBe(200);
      const body = await refuseRes.json();
      expect(body.success).toBe(true);
      expect(body.status).toBe('DELIVERY_REFUSED_RECORDED');
      expect(body.orderStatus).toBe('cancelled');
      expect(body.paymentStatus).toBe('unpaid');
    });

    it('reconciles remittance batch via POST /api/payments/cod/remit with finance JWT auth', async () => {
      const order = await createTestCodOrder();
      const col = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'HTTP Courier',
        receiptReference: `REC_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(col.collectionId);

      const batchId = `BATCH_HTTP_${unique()}`;
      const remitReq = asReq('http://localhost:3000/api/payments/cod/remit', financeToken, {
        batchId,
        courierCompany: 'Bosta',
        orderIds: [order.id],
        grossCollectedAmount: order.total,
        courierFeeDeductions: 50,
        netDepositAmount: Number(order.total) - 50,
        depositSlipReference: 'HTTP-DEP-12345',
        depositDate: new Date().toISOString(),
      });
      const remitRes = await remitRoute(remitReq);
      expect(remitRes.status).toBe(200);
      const body = await remitRes.json();
      expect(body.success).toBe(true);
      expect(body.status).toBe('REMITTANCE_SUCCESSFUL');
      expect(body.reconciledStatus).toBe('reconciled');
      cleanup.remittances.push(body.remittanceId);
    });
  });

  // ===========================================================================
  // 6. Direct Admin/API Financial Record Mutation Protection (Security Lockdown)
  // ===========================================================================
  describe('6. Direct Admin/API Financial Record Mutation Protection (Security Lockdown)', () => {
    it('blocks direct manual creation of PaymentCollection via Admin/API without isCodCollectionEngine (DIRECT_COLLECTION_CREATION_FORBIDDEN)', async () => {
      const order = await createTestCodOrder();
      const receipt = `REC_DIRECT_FAIL_${unique()}`;

      await expect(
        payload.create({
          collection: 'payment-collections',
          data: {
            receiptReference: receipt,
            order: order.id,
            amount: order.total,
            collectorType: 'courier',
            collectorName: 'Malicious Manual Input',
            collectedAt: new Date().toISOString(),
          },
          overrideAccess: true,
          // no context flag provided!
        })
      ).rejects.toThrow('DIRECT_COLLECTION_CREATION_FORBIDDEN');
    });

    it('blocks direct manual mutation of amount or remittanceStatus on an existing PaymentCollection (DIRECT_COLLECTION_MUTATION_FORBIDDEN)', async () => {
      const order = await createTestCodOrder();
      const col = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'Legitimate Courier',
        receiptReference: `REC_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(col.collectionId);

      // Attempt manual update of amount without remittance engine context
      await expect(
        payload.update({
          collection: 'payment-collections',
          id: col.collectionId,
          data: {
            amount: 999999, // tampered amount
          },
          overrideAccess: true,
          // no context flag provided!
        })
      ).rejects.toThrow('DIRECT_COLLECTION_MUTATION_FORBIDDEN');

      // Attempt manual update of remittanceStatus without remittance engine context
      await expect(
        payload.update({
          collection: 'payment-collections',
          id: col.collectionId,
          data: {
            remittanceStatus: 'remitted_to_company',
          },
          overrideAccess: true,
        })
      ).rejects.toThrow('DIRECT_COLLECTION_MUTATION_FORBIDDEN');
    });

    it('blocks direct manual creation of CourierRemittance via Admin/API without isCourierRemittanceEngine (DIRECT_REMITTANCE_CREATION_FORBIDDEN)', async () => {
      const order = await createTestCodOrder();

      await expect(
        payload.create({
          collection: 'courier-remittances',
          data: {
            batchId: `BATCH_DIRECT_${unique()}`,
            courierCompany: 'Manual Rogue Batch',
            grossCollectedAmount: order.total,
            netDepositAmount: order.total,
            depositSlipReference: 'DEP-ROGUE',
            depositDate: new Date().toISOString(),
            orders: [order.id],
          },
          overrideAccess: true,
          // no context flag provided!
        })
      ).rejects.toThrow('DIRECT_REMITTANCE_CREATION_FORBIDDEN');
    });

    it('blocks mutation of an existing CourierRemittance record after reconciliation (REMITTANCE_RECORD_IMMUTABLE)', async () => {
      const order = await createTestCodOrder();
      const col = await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'Bosta',
        receiptReference: `REC_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });
      cleanup.collections.push(col.collectionId);

      const batchId = `BATCH_IMMUT_${unique()}`;
      const remRes = await reconcileCourierRemittanceBatch(payload, {
        batchId,
        courierCompany: 'Bosta',
        orderIds: [order.id],
        grossCollectedAmount: order.total,
        netDepositAmount: order.total,
        depositSlipReference: 'DEP-IMMUT',
        depositDate: new Date().toISOString(),
        actor: { id: financeUser.id, roles: financeUser.roles },
      });
      cleanup.remittances.push(remRes.remittanceId);

      // Attempt to modify the reconciled batch
      await expect(
        payload.update({
          collection: 'courier-remittances',
          id: remRes.remittanceId,
          data: {
            netDepositAmount: 500000,
          },
          overrideAccess: true,
        })
      ).rejects.toThrow('REMITTANCE_RECORD_IMMUTABLE');
    });
  });
});
