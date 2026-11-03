import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import configPromise from '../src/payload.config';
import {
  createOrderSnapshot,
  type CartLineItem,
  type ProductItem,
  type CustomerDetails,
  type FulfillmentOption,
} from '../src/logic/orderSnapshotEngine';
import {
  advanceCodFulfillment,
  approveCustomProof,
  recordCodCollection,
  recordDeliveryRefusal,
  reconcileCourierRemittanceBatch,
} from '../src/logic/codEngine';

describe('Track 1B: Cash on Delivery (COD) Engine & Settlement Suite', () => {
  let payload: any;
  let adminUser: any;
  let financeUser: any;
  let opsUser: any;
  let customerUser: any;

  const sampleProducts: Record<string, ProductItem> = {
    prod_thermal_mug: {
      id: 'prod_thermal_mug',
      title: 'Premium Thermal Mug',
      itemType: 'physical',
      basePrice: 250,
      customizationFee: 35,
      minOrderQuantity: 10,
    },
    prod_ceramic_mug: {
      id: 'prod_ceramic_mug',
      title: 'Ceramic Coffee Mug',
      itemType: 'physical',
      basePrice: 180,
      customizationFee: 0,
      minOrderQuantity: 10,
    },
    prod_branding_pkg: {
      id: 'prod_branding_pkg',
      title: 'Brand Identity Service Package',
      itemType: 'service',
      basePrice: 15000,
      customizationFee: 0,
      minOrderQuantity: 1,
    },
  };

  const sampleCustomer: CustomerDetails = {
    name: 'Tarek Zaki',
    email: 'tarek@acme-corp.com',
    phone: '+201001234567',
    companyName: 'Acme Corporation Egypt',
  };

  const sampleFulfillment: FulfillmentOption = {
    type: 'delivery',
    addressLine: '15 El Horreya Road, Alexandria, Egypt',
    shippingFee: 75,
  };

  let prodAId: number;
  let prodBId: number;
  let serviceProdId: number;

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    // Seed test users with different roles
    const adminEmail = `admin_cod_${Date.now()}@mwheba.com`;
    const financeEmail = `finance_cod_${Date.now()}@mwheba.com`;
    const opsEmail = `ops_cod_${Date.now()}@mwheba.com`;
    const custEmail = `cust_cod_${Date.now()}@mwheba.com`;

    adminUser = await payload.create({
      collection: 'users',
      data: { email: adminEmail, password: 'Password123!', roles: ['admin'] },
      overrideAccess: true,
      context: { isSystemSeed: true },
    });

    financeUser = await payload.create({
      collection: 'users',
      data: { email: financeEmail, password: 'Password123!', roles: ['finance'] },
      overrideAccess: true,
      context: { isSystemSeed: true },
    });

    opsUser = await payload.create({
      collection: 'users',
      data: { email: opsEmail, password: 'Password123!', roles: ['operations'] },
      overrideAccess: true,
      context: { isSystemSeed: true },
    });

    customerUser = await payload.create({
      collection: 'users',
      data: { email: custEmail, password: 'Password123!', roles: ['customer'] },
      overrideAccess: true,
      context: { isSystemSeed: true },
    });

    // Seed physical products
    const prodA = await payload.create({
      collection: 'products',
      data: {
        title: 'Premium Thermal Mug',
        slug: `thermal-mug-${Date.now()}`,
        _status: 'published',
        itemType: 'physical',
        minOrderQuantity: 10,
        basePrice: 250,
      },
      overrideAccess: true,
    });
    prodAId = prodA.id as number;

    const prodB = await payload.create({
      collection: 'products',
      data: {
        title: 'Ceramic Coffee Mug',
        slug: `ceramic-mug-${Date.now()}`,
        _status: 'published',
        itemType: 'physical',
        minOrderQuantity: 10,
        basePrice: 180,
      },
      overrideAccess: true,
    });
    prodBId = prodB.id as number;

    const prodService = await payload.create({
      collection: 'products',
      data: {
        title: 'Brand Identity Service Package',
        slug: `brand-identity-${Date.now()}`,
        _status: 'published',
        itemType: 'service',
        minOrderQuantity: 1,
        basePrice: 15000,
      },
      overrideAccess: true,
    });
    serviceProdId = prodService.id as number;
  });

  // Helper to create an Order document in Payload
  async function createDbOrder(snapshot: any) {
    return await payload.create({
      collection: 'orders' as any,
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        total: snapshot.financials.grandTotal,
        amount: snapshot.financials.grandTotal,
        orderStatus: snapshot.orderStatus || 'confirmed',
        paymentStatus: snapshot.paymentStatus,
        paymentMethod: snapshot.paymentMethod,
        fulfillmentStatus: snapshot.fulfillmentStatus,
        remittanceStatus: snapshot.remittanceStatus,
        proofStatus: snapshot.proofStatus,
        proofApprovedAt: snapshot.proofApprovedAt,
        codDetails: snapshot.codDetails,
        subtotal: snapshot.financials.itemsSubtotal,
        totalCustomizationFees: snapshot.financials.totalCustomizationFees,
        shippingFee: snapshot.financials.shippingFee,
        items: snapshot.items.map((it: any) => ({
          product: it.productId === 'prod_thermal_mug' ? prodAId : prodBId,
          title: it.productTitle,
          quantity: it.quantity,
          unitPrice: it.unitBasePrice,
          customizationFee: it.unitCustomizationFee,
          lineTotal: it.lineTotal,
          printingNotes: it.printingNotes,
          artworkAssetId: it.artworkAssetId,
          fulfillmentType: it.itemType,
        })),
      },
      overrideAccess: true,
    });
  }

  // --- 1. COD Scope & Validation Rules ---
  it('COD-TC-01: Permits COD for 100% physical merchandise and initializes unpaid status', () => {
    const cart: CartLineItem[] = [
      { id: 'c1', productId: 'prod_thermal_mug', variantId: 'blk', variantName: 'Black', quantity: 10 },
    ];

    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');

    expect(snapshot.paymentMethod).toBe('cod');
    expect(snapshot.orderStatus).toBe('confirmed');
    expect(snapshot.paymentStatus).toBe('unpaid');
    expect(snapshot.fulfillmentStatus).toBe('unfulfilled');
    expect(snapshot.remittanceStatus).toBe('pending_collection');
    expect(snapshot.financials.grandTotal).toBe(250 * 10 + 75); // 2575 EGP
  });

  it('COD-TC-02: Strictly rejects COD when cart contains a digital service package', () => {
    const serviceCart: CartLineItem[] = [
      { id: 'c2', productId: 'prod_branding_pkg', variantId: 'std', variantName: 'Standard', quantity: 1 },
    ];

    expect(() => {
      createOrderSnapshot(serviceCart, sampleProducts, sampleCustomer, { type: 'office_pickup', shippingFee: 0 }, 'cod');
    }).toThrowError(/COD_PROHIBITED_FOR_DIGITAL/);
  });

  it('COD-TC-03: Strictly rejects COD for mixed cart (physical + digital service)', () => {
    const mixedCart: CartLineItem[] = [
      { id: 'c3_a', productId: 'prod_thermal_mug', variantId: 'blk', variantName: 'Black', quantity: 10 },
      { id: 'c3_b', productId: 'prod_branding_pkg', variantId: 'std', variantName: 'Standard', quantity: 1 },
    ];

    expect(() => {
      createOrderSnapshot(mixedCart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    }).toThrowError(/COD_PROHIBITED_FOR_MIXED_CART/);
  });

  // --- 2. Decoupled Fulfillment Lifecycle ---
  it('COD-TC-04: Advancing fulfillment to shipped and delivered strictly keeps paymentStatus unpaid', async () => {
    const cart: CartLineItem[] = [
      { id: 'c4', productId: 'prod_ceramic_mug', variantId: 'blue', variantName: 'Blue', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);

    // 1. Advance to Shipped
    const shippedRes = await advanceCodFulfillment(payload, {
      orderId: order.id,
      targetStatus: 'shipped',
      actor: opsUser,
    });
    expect(shippedRes.fulfillmentStatus).toBe('shipped');
    expect(shippedRes.paymentStatus).toBe('unpaid'); // Invariant preserved!

    // Verify in database
    const dbOrderShipped = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(dbOrderShipped.paymentStatus).toBe('unpaid');

    // 2. Advance to Delivered
    const deliveredRes = await advanceCodFulfillment(payload, {
      orderId: order.id,
      targetStatus: 'delivered',
      actor: opsUser,
    });
    expect(deliveredRes.fulfillmentStatus).toBe('delivered');
    expect(deliveredRes.paymentStatus).toBe('unpaid'); // Critical Invariant: delivery NEVER marks paid automatically!

    const dbOrderDelivered = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(dbOrderDelivered.paymentStatus).toBe('unpaid');
  });

  // --- 3. Pre-Production Proof Approval Gate ---
  it('COD-TC-05: Blocks in_production until proof is approved for customized items', async () => {
    // 1. Create artwork asset in database
    const asset = await payload.create({
      collection: 'artwork-assets',
      data: {
        customer: customerUser.id,
        originalFilename: 'corporate-logo.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        storageKey: `proofs/${Date.now()}-logo.pdf`,
      },
      overrideAccess: true,
    });

    const customCart: CartLineItem[] = [
      {
        id: 'c5',
        productId: 'prod_thermal_mug',
        variantId: 'wht',
        variantName: 'White',
        quantity: 10,
        artworkAssetId: String(asset.id),
        printingNotes: 'Engrave Acme Logo on front',
      },
    ];
    const snapshot = createOrderSnapshot(customCart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    expect(snapshot.proofStatus).toBe('proof_pending');

    const order = await createDbOrder(snapshot);

    // Attempt to start production without proof approval
    await expect(
      advanceCodFulfillment(payload, {
        orderId: order.id,
        targetStatus: 'in_production',
        actor: opsUser,
      })
    ).rejects.toThrowError(/PROOF_NOT_APPROVED/);

    // Approve proof
    const approveRes = await approveCustomProof(payload, order.id, opsUser);
    expect(approveRes.proofStatus).toBe('proof_approved');

    // Now advance to in_production succeeds
    const prodRes = await advanceCodFulfillment(payload, {
      orderId: order.id,
      targetStatus: 'in_production',
      actor: opsUser,
    });
    expect(prodRes.fulfillmentStatus).toBe('in_production');
    expect(prodRes.paymentStatus).toBe('unpaid');
  });

  // --- 4. Explicit Cash Collection & Role Authorization ---
  it('COD-TC-06: Rejects unauthorized user and records valid collection with role authorization and exact amount', async () => {
    const cart: CartLineItem[] = [
      { id: 'c6', productId: 'prod_ceramic_mug', variantId: 'red', variantName: 'Red', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    const orderTotal = snapshot.financials.grandTotal;

    // 1. Unauthorized customer attempt
    await expect(
      recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: orderTotal,
        collectorType: 'courier',
        collectorName: 'Bosta Driver Amr',
        receiptReference: `BST-${Date.now()}-1`,
        actor: customerUser,
      })
    ).rejects.toThrowError(/FORBIDDEN/);

    // 2. Amount Mismatch attempt
    await expect(
      recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: orderTotal - 100, // Short by 100 EGP
        collectorType: 'courier',
        collectorName: 'Bosta Driver Amr',
        receiptReference: `BST-${Date.now()}-2`,
        actor: opsUser,
      })
    ).rejects.toThrowError(/AMOUNT_MISMATCH/);

    // 3. Authorized operations collection recording
    const validReceipt = `BST-AWB-${Date.now()}`;
    const collectRes = await recordCodCollection(payload, {
      orderId: order.id,
      collectedAmount: orderTotal,
      collectorType: 'courier',
      collectorName: 'Bosta Driver Amr',
      receiptReference: validReceipt,
      actor: opsUser,
    });

    expect(collectRes.status).toBe('COLLECTION_RECORDED');
    expect(collectRes.paymentStatus).toBe('paid');
    expect(collectRes.remittanceStatus).toBe('collected_by_courier');

    // Verify DB
    const dbOrder = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(dbOrder.paymentStatus).toBe('paid');
    expect(dbOrder.remittanceStatus).toBe('collected_by_courier');
    expect(dbOrder.codDetails.collectionReference).toBe(validReceipt);
  });

  // --- 5. Collection Idempotency ---
  it('COD-TC-07: Idempotently rejects duplicate collection submissions with zero duplicate records', async () => {
    const cart: CartLineItem[] = [
      { id: 'c7', productId: 'prod_thermal_mug', variantId: 'blk', variantName: 'Black', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    const receiptRef = `REC-IDEMP-${Date.now()}`;

    // First call
    const firstRes = await recordCodCollection(payload, {
      orderId: order.id,
      collectedAmount: snapshot.financials.grandTotal,
      collectorType: 'courier',
      collectorName: 'Aramex Agent',
      receiptReference: receiptRef,
      actor: opsUser,
    });
    expect(firstRes.status).toBe('COLLECTION_RECORDED');

    // Second call with same receipt reference
    const secondRes = await recordCodCollection(payload, {
      orderId: order.id,
      collectedAmount: snapshot.financials.grandTotal,
      collectorType: 'courier',
      collectorName: 'Aramex Agent',
      receiptReference: receiptRef,
      actor: opsUser,
    });
    expect(secondRes.status).toBe('ALREADY_COLLECTED');

    // Assert only 1 collection doc exists
    const collections = await payload.find({
      collection: 'payment-collections' as any,
      where: { receiptReference: { equals: receiptRef } },
      overrideAccess: true,
    });
    expect(collections.docs.length).toBe(1);
  });

  // --- 6. Delivery Refusal / Cancellation Handling ---
  it('COD-TC-08: Delivery refusal updates order to cancelled and returned_to_origin while strictly retaining unpaid', async () => {
    const cart: CartLineItem[] = [
      { id: 'c8', productId: 'prod_ceramic_mug', variantId: 'blue', variantName: 'Blue', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);

    // Record delivery refusal
    const refusalRes = await recordDeliveryRefusal(payload, {
      orderId: order.id,
      refusalReason: 'Customer company branch was closed and refused rescheduled delivery',
      actor: opsUser,
    });

    expect(refusalRes.status).toBe('DELIVERY_REFUSED_RECORDED');
    expect(refusalRes.orderStatus).toBe('cancelled');
    expect(refusalRes.fulfillmentStatus).toBe('returned_to_origin');
    expect(refusalRes.paymentStatus).toBe('unpaid'); // Zero false payments or refunds!

    const dbOrder = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(dbOrder.orderStatus).toBe('cancelled');
    expect(dbOrder.fulfillmentStatus).toBe('returned_to_origin');
    expect(dbOrder.paymentStatus).toBe('unpaid');
    expect(dbOrder.codDetails.refusalReason).toContain('closed');
  });

  // --- 7. Courier Remittance Reconciliation & Double-Remittance Prevention ---
  it('COD-TC-09: Reconciles courier remittance batch with mathematical matching and prevents double remittance', async () => {
    // Create 2 collected orders
    const cart1: CartLineItem[] = [
      { id: 'c9_1', productId: 'prod_thermal_mug', variantId: 'blk', variantName: 'Black', quantity: 10 },
    ];
    const snapshot1 = createOrderSnapshot(cart1, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order1 = await createDbOrder(snapshot1);
    await recordCodCollection(payload, {
      orderId: order1.id,
      collectedAmount: snapshot1.financials.grandTotal,
      collectorType: 'courier',
      collectorName: 'Bosta Alexandria',
      receiptReference: `BST-COL-A-${Date.now()}`,
      actor: opsUser,
    });

    const cart2: CartLineItem[] = [
      { id: 'c9_2', productId: 'prod_ceramic_mug', variantId: 'red', variantName: 'Red', quantity: 10 },
    ];
    const snapshot2 = createOrderSnapshot(cart2, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order2 = await createDbOrder(snapshot2);
    await recordCodCollection(payload, {
      orderId: order2.id,
      collectedAmount: snapshot2.financials.grandTotal,
      collectorType: 'courier',
      collectorName: 'Bosta Alexandria',
      receiptReference: `BST-COL-B-${Date.now()}`,
      actor: opsUser,
    });

    const totalGross = snapshot1.financials.grandTotal + snapshot2.financials.grandTotal;
    const courierFee = 150; // 75 per order
    const expectedNet = totalGross - courierFee;
    const batchId = `REM-BOSTA-${Date.now()}`;

    // 1. Discrepancy without variance approval is rejected
    await expect(
      reconcileCourierRemittanceBatch(payload, {
        batchId,
        courierCompany: 'Bosta Egypt',
        orderIds: [order1.id, order2.id],
        grossCollectedAmount: totalGross,
        courierFeeDeductions: courierFee,
        netDepositAmount: expectedNet - 200, // Deposited 200 less without note
        depositSlipReference: 'CIB-DEP-99901',
        depositDate: new Date().toISOString(),
        actor: financeUser,
        varianceApproved: false,
      })
    ).rejects.toThrowError(/REMITTANCE_VARIANCE_MISMATCH/);

    // 2. Successful reconciliation with matching net deposit
    const remRes = await reconcileCourierRemittanceBatch(payload, {
      batchId,
      courierCompany: 'Bosta Egypt',
      orderIds: [order1.id, order2.id],
      grossCollectedAmount: totalGross,
      courierFeeDeductions: courierFee,
      netDepositAmount: expectedNet,
      depositSlipReference: 'CIB-DEP-99902',
      depositDate: new Date().toISOString(),
      actor: financeUser,
      varianceApproved: false,
    });

    expect(remRes.status).toBe('REMITTANCE_SUCCESSFUL');
    expect(remRes.orderCount).toBe(2);

    // Verify orders updated to 'remitted_to_company'
    const dbOrder1 = await payload.findByID({ collection: 'orders' as any, id: order1.id, overrideAccess: true }) as any;
    expect(dbOrder1.remittanceStatus).toBe('remitted_to_company');
    expect(dbOrder1.codDetails.courierRemittanceBatchId).toBe(batchId);

    // 3. Double-Remittance Prevention: Attempt to remit order1 again in a second batch
    const batchId2 = `REM-BOSTA-DUPLICATE-${Date.now()}`;
    await expect(
      reconcileCourierRemittanceBatch(payload, {
        batchId: batchId2,
        courierCompany: 'Bosta Egypt',
        orderIds: [order1.id], // Order1 is already remitted!
        grossCollectedAmount: snapshot1.financials.grandTotal,
        courierFeeDeductions: 75,
        netDepositAmount: snapshot1.financials.grandTotal - 75,
        depositSlipReference: 'CIB-DEP-99903',
        depositDate: new Date().toISOString(),
        actor: financeUser,
      })
    ).rejects.toThrowError(/DOUBLE_REMITTANCE_ERROR/);
  });

  // --- 8. Paymob Deactivation Test ---
  it('COD-TC-10: Paymob endpoint is deactivated and unavailable by default', async () => {
    // In payload.config.ts, paymob endpoint is configured to return 404 with PAYMOB_DISABLED
    // when ENABLE_PAYMOB_GATEWAY is not true.
    const endpoint = (payload.config.endpoints || []).find((ep: any) => ep.path === '/paymob/webhook');
    expect(endpoint).toBeDefined();

    // Call the handler directly to verify it returns 404 PAYMOB_DISABLED
    const response = await endpoint.handler({} as any);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('PAYMOB_DISABLED');
    expect(body.message).toContain('Paymob gateway is formally deferred');
  });

  // --- 9. Direct Payload Hook Enforcement for Services (Issue 1) ---
  it('COD-TC-11: Direct Payload order creation strictly rejects COD for service products and mixed carts', async () => {
    // 1. Direct creation of pure digital service with paymentMethod: 'cod'
    await expect(
      payload.create({
        collection: 'orders' as any,
        data: {
          customer: customerUser.id,
          customerEmail: customerUser.email,
          paymentMethod: 'cod',
          items: [{ product: serviceProdId, quantity: 1 }],
        },
        overrideAccess: true,
      })
    ).rejects.toThrowError(/COD_PROHIBITED_FOR_DIGITAL/);

    // 2. Direct creation of mixed cart (service + physical) with paymentMethod: 'cod'
    await expect(
      payload.create({
        collection: 'orders' as any,
        data: {
          customer: customerUser.id,
          customerEmail: customerUser.email,
          paymentMethod: 'cod',
          items: [
            { product: prodAId, quantity: 10 },
            { product: serviceProdId, quantity: 1 },
          ],
        },
        overrideAccess: true,
      })
    ).rejects.toThrowError(/COD_PROHIBITED_FOR_MIXED_CART/);
  });

  // --- 10. Remittance Batch Duplicate Order ID Protection (Issue 2) ---
  it('COD-TC-12: Reconcile remittance batch strictly rejects duplicate order references in batch array', async () => {
    // Create and collect 1 valid order
    const cart: CartLineItem[] = [
      { id: 'c12', productId: 'prod_thermal_mug', variantId: 'blk', variantName: 'Black', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    await recordCodCollection(payload, {
      orderId: order.id,
      collectedAmount: snapshot.financials.grandTotal,
      collectorType: 'courier',
      collectorName: 'Bosta Driver',
      receiptReference: `BST-COL-DUP-${Date.now()}`,
      actor: opsUser,
    });

    const duplicateOrderIds = [order.id, order.id]; // Attempt to count same order twice!

    await expect(
      reconcileCourierRemittanceBatch(payload, {
        batchId: `REM-DUP-${Date.now()}`,
        courierCompany: 'Bosta',
        orderIds: duplicateOrderIds,
        grossCollectedAmount: snapshot.financials.grandTotal * 2, // Doubled amount
        netDepositAmount: snapshot.financials.grandTotal * 2,
        depositSlipReference: 'CIB-DEP-DUP',
        depositDate: new Date().toISOString(),
        actor: financeUser,
      })
    ).rejects.toThrowError(/DUPLICATE_ORDER_IN_BATCH/);
  });

  // --- 11. Transaction Rollback & Clean Retry on Update Failure (Issue 3) ---
  it('COD-TC-13: Database transaction rolls back collection record if order update fails, leaving order unpaid', async () => {
    const cart: CartLineItem[] = [
      { id: 'c13', productId: 'prod_ceramic_mug', variantId: 'blue', variantName: 'Blue', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    const testReceipt = `TEST-ROLLBACK-${Date.now()}`;

    // 1. Simulate failure during order update inside transaction
    await expect(
      recordCodCollection(
        payload,
        {
          orderId: order.id,
          collectedAmount: snapshot.financials.grandTotal,
          collectorType: 'courier',
          collectorName: 'Bosta Courier',
          receiptReference: testReceipt,
          actor: opsUser,
        },
        { failOrderUpdateForTest: true }
      )
    ).rejects.toThrowError(/SIMULATED_ORDER_UPDATE_FAILURE/);

    // 2. Assert transaction rolled back: collection record does NOT exist
    const collections = await payload.find({
      collection: 'payment-collections' as any,
      where: { receiptReference: { equals: testReceipt } },
      overrideAccess: true,
    });
    expect(collections.docs.length).toBe(0);

    // 3. Assert order paymentStatus is still 'unpaid'
    const dbOrder = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(dbOrder.paymentStatus).toBe('unpaid');
  });

  it('COD-TC-14: Clean retry succeeds after failed collection attempt and updates order to paid', async () => {
    const cart: CartLineItem[] = [
      { id: 'c14', productId: 'prod_ceramic_mug', variantId: 'blue', variantName: 'Blue', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    const retryReceipt = `TEST-RETRY-${Date.now()}`;

    // First attempt fails
    await expect(
      recordCodCollection(
        payload,
        {
          orderId: order.id,
          collectedAmount: snapshot.financials.grandTotal,
          collectorType: 'courier',
          collectorName: 'Bosta Courier',
          receiptReference: retryReceipt,
          actor: opsUser,
        },
        { failOrderUpdateForTest: true }
      )
    ).rejects.toThrowError(/SIMULATED_ORDER_UPDATE_FAILURE/);

    // Retry succeeds without failure
    const retryRes = await recordCodCollection(payload, {
      orderId: order.id,
      collectedAmount: snapshot.financials.grandTotal,
      collectorType: 'courier',
      collectorName: 'Bosta Courier',
      receiptReference: retryReceipt,
      actor: opsUser,
    });

    expect(retryRes.status).toBe('COLLECTION_RECORDED');
    expect(retryRes.paymentStatus).toBe('paid');

    // DB confirms paid
    const updatedDbOrder = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(updatedDbOrder.paymentStatus).toBe('paid');
  });

  // --- 12. Courier Remittance Transaction Rollback & Concurrency Lock ---
  it('COD-TC-15: Remittance batch rolls back completely if mid-way update fails, leaving batch unsaved', async () => {
    const cart: CartLineItem[] = [
      { id: 'c15', productId: 'prod_thermal_mug', variantId: 'blk', variantName: 'Black', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    await recordCodCollection(payload, {
      orderId: order.id,
      collectedAmount: snapshot.financials.grandTotal,
      collectorType: 'courier',
      collectorName: 'Bosta Driver',
      receiptReference: `BST-COL-RB-${Date.now()}`,
      actor: opsUser,
    });

    const failedBatchId = `REM-FAIL-${Date.now()}`;

    // Simulate failure mid-way through updating orders/collections inside the transaction
    await expect(
      reconcileCourierRemittanceBatch(
        payload,
        {
          batchId: failedBatchId,
          courierCompany: 'Bosta Egypt',
          orderIds: [order.id],
          grossCollectedAmount: snapshot.financials.grandTotal,
          netDepositAmount: snapshot.financials.grandTotal,
          depositSlipReference: 'DEP-FAIL-01',
          depositDate: new Date().toISOString(),
          actor: financeUser,
        },
        { failDuringBatchUpdateForTest: true }
      )
    ).rejects.toThrowError(/SIMULATED_REMITTANCE_UPDATE_FAILURE/);

    // Verify atomic rollback: CourierRemittances doc was NOT committed
    const remittances = await payload.find({
      collection: 'courier-remittances' as any,
      where: { batchId: { equals: failedBatchId } },
      overrideAccess: true,
    });
    expect(remittances.docs.length).toBe(0);

    // Verify order remains 'collected_by_courier' and NOT marked remitted
    const checkOrder = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(checkOrder.remittanceStatus).toBe('collected_by_courier');
    expect(checkOrder.codDetails?.courierRemittanceBatchId).toBeFalsy();
  });

  it('COD-TC-16: Concurrent remittance batches are serialized by locks; second batch is rejected cleanly', async () => {
    const cart: CartLineItem[] = [
      { id: 'c16', productId: 'prod_ceramic_mug', variantId: 'blue', variantName: 'Blue', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    await recordCodCollection(payload, {
      orderId: order.id,
      collectedAmount: snapshot.financials.grandTotal,
      collectorType: 'courier',
      collectorName: 'Aramex Agent',
      receiptReference: `ARX-COL-PAR-${Date.now()}`,
      actor: opsUser,
    });

    const batchA = `REM-PAR-A-${Date.now()}`;
    const batchB = `REM-PAR-B-${Date.now()}`;

    // Launch two concurrent remittance attempts for the SAME order in parallel
    const [resA, resB] = await Promise.allSettled([
      reconcileCourierRemittanceBatch(payload, {
        batchId: batchA,
        courierCompany: 'Aramex Egypt',
        orderIds: [order.id],
        grossCollectedAmount: snapshot.financials.grandTotal,
        netDepositAmount: snapshot.financials.grandTotal,
        depositSlipReference: 'DEP-PAR-A',
        depositDate: new Date().toISOString(),
        actor: financeUser,
      }),
      reconcileCourierRemittanceBatch(payload, {
        batchId: batchB,
        courierCompany: 'Aramex Egypt',
        orderIds: [order.id],
        grossCollectedAmount: snapshot.financials.grandTotal,
        netDepositAmount: snapshot.financials.grandTotal,
        depositSlipReference: 'DEP-PAR-B',
        depositDate: new Date().toISOString(),
        actor: financeUser,
      }),
    ]);

    // Exactly one must succeed and one must fail with DOUBLE_REMITTANCE_ERROR
    const succeeded = [resA, resB].filter((r) => r.status === 'fulfilled');
    const rejected = [resA, resB].filter((r) => r.status === 'rejected');

    expect(succeeded.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('DOUBLE_REMITTANCE_ERROR');
  });

  it('COD-TC-17: Strictly blocks all downstream fulfillment states (in_production, ready_for_pickup, shipped, delivered) when proofStatus is proof_pending', async () => {
    const asset = await payload.create({
      collection: 'artwork-assets',
      data: {
        customer: customerUser.id,
        originalFilename: 'corporate-logo-vector.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 4096,
        storageKey: 'cust_art/corporate-logo-vector.pdf',
      },
      overrideAccess: true,
    });

    const cart: CartLineItem[] = [
      {
        id: 'c17',
        productId: 'prod_thermal_mug',
        variantId: 'blk',
        variantName: 'Black',
        quantity: 10,
        artworkAssetId: asset.id,
        printingNotes: 'Laser engrave corporate logo on back',
      },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    expect(order.proofStatus).toBe('proof_pending');

    // 1. Direct jump to shipped must fail
    await expect(
      advanceCodFulfillment(payload, {
        orderId: order.id,
        targetStatus: 'shipped',
        actor: opsUser,
      })
    ).rejects.toThrowError(/PROOF_NOT_APPROVED/);

    // 2. Direct jump to ready_for_pickup must fail
    await expect(
      advanceCodFulfillment(payload, {
        orderId: order.id,
        targetStatus: 'ready_for_pickup',
        actor: opsUser,
      })
    ).rejects.toThrowError(/PROOF_NOT_APPROVED/);

    // 3. Direct jump to delivered must fail
    await expect(
      advanceCodFulfillment(payload, {
        orderId: order.id,
        targetStatus: 'delivered',
        actor: opsUser,
      })
    ).rejects.toThrowError(/PROOF_NOT_APPROVED/);

    // 4. Transition to in_production must fail
    await expect(
      advanceCodFulfillment(payload, {
        orderId: order.id,
        targetStatus: 'in_production',
        actor: opsUser,
      })
    ).rejects.toThrowError(/PROOF_NOT_APPROVED/);

    // 5. Approve proof -> Now transition to in_production and shipped succeeds
    await approveCustomProof(payload, order.id, opsUser);
    const approvedOrder = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(approvedOrder.proofStatus).toBe('proof_approved');

    const inProdRes = await advanceCodFulfillment(payload, {
      orderId: order.id,
      targetStatus: 'in_production',
      actor: opsUser,
    });
    expect(inProdRes.fulfillmentStatus).toBe('in_production');

    const shippedRes = await advanceCodFulfillment(payload, {
      orderId: order.id,
      targetStatus: 'shipped',
      actor: opsUser,
    });
    expect(shippedRes.fulfillmentStatus).toBe('shipped');
    expect(shippedRes.paymentStatus).toBe('unpaid');
  });

  it('COD-TC-18: Rejects standard collection on cancelled or delivery-refused orders', async () => {
    const cart: CartLineItem[] = [
      { id: 'c18', productId: 'prod_ceramic_mug', variantId: 'white', variantName: 'White', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);

    // Customer refuses delivery upon arrival
    await recordDeliveryRefusal(payload, {
      orderId: order.id,
      refusalReason: 'Customer rejected package: damaged during transit',
      actor: opsUser,
    });

    const refusedOrder = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(refusedOrder.orderStatus).toBe('cancelled');
    expect(refusedOrder.fulfillmentStatus).toBe('returned_to_origin');
    expect(refusedOrder.paymentStatus).toBe('unpaid');

    // Attempting standard collection on this refused order must be strictly rejected
    await expect(
      recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: snapshot.financials.grandTotal,
        collectorType: 'courier',
        collectorName: 'Speedaf Courier',
        receiptReference: `REF-COL-${Date.now()}`,
        actor: opsUser,
      })
    ).rejects.toThrowError(/CANNOT_COLLECT_CANCELLED_OR_REFUSED_ORDER/);

    // Ensure order remains unpaid and no collection doc exists
    const checkOrder = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(checkOrder.paymentStatus).toBe('unpaid');

    const collections = await payload.find({
      collection: 'payment-collections' as any,
      where: { order: { equals: order.id } },
      overrideAccess: true,
    });
    expect(collections.docs.length).toBe(0);
  });

  it('COD-TC-19: Multi-order batch remittance lock handles multiple orders without PostgreSQL pool exhaustion', async () => {
    // Create 4 orders and collect them
    const orders: any[] = [];
    let totalGross = 0;
    for (let i = 0; i < 4; i++) {
      const cart: CartLineItem[] = [
        { id: `c19_${i}`, productId: 'prod_ceramic_mug', variantId: `var_${i}`, variantName: `Color ${i}`, quantity: 10 },
      ];
      const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
      const o = await createDbOrder(snapshot);
      await recordCodCollection(payload, {
        orderId: o.id,
        collectedAmount: snapshot.financials.grandTotal,
        collectorType: 'courier',
        collectorName: 'Mashaweer Agent',
        receiptReference: `MSH-REC-${Date.now()}-${i}`,
        actor: opsUser,
      });
      orders.push(o);
      totalGross += snapshot.financials.grandTotal;
    }

    const batchId = `REM-BATCH-MULTI-${Date.now()}`;
    const result = await reconcileCourierRemittanceBatch(payload, {
      batchId,
      courierCompany: 'Mashaweer Egypt',
      orderIds: orders.map((o) => o.id),
      grossCollectedAmount: totalGross,
      netDepositAmount: totalGross - 100, // 100 EGP courier commission
      courierFeeDeductions: 100,
      depositSlipReference: 'DEP-SLIP-999',
      depositDate: new Date().toISOString(),
      actor: financeUser,
    });

    expect(result.status).toBe('REMITTANCE_SUCCESSFUL');
    expect(result.orderCount).toBe(4);
    expect(result.grossCollectedAmount).toBe(totalGross);

    // Verify all 4 orders are marked remitted
    for (const o of orders) {
      const verified = await payload.findByID({ collection: 'orders' as any, id: o.id, overrideAccess: true }) as any;
      expect(verified.remittanceStatus).toBe('remitted_to_company');
      expect(verified.codDetails?.courierRemittanceBatchId).toBe(batchId);
    }
  });

  it('COD-TC-20: Direct manual update of paymentStatus to paid on active COD order is strictly forbidden', async () => {
    const cart: CartLineItem[] = [
      { id: 'c20', productId: 'prod_ceramic_mug', variantId: 'blue', variantName: 'Blue', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    expect(order.paymentStatus).toBe('unpaid');
    expect(order.remittanceStatus).toBe('pending_collection');

    // Admin attempts to bypass collection pipeline by calling payload.update directly
    await expect(
      payload.update({
        collection: 'orders' as any,
        id: order.id,
        data: { paymentStatus: 'paid' },
        user: adminUser,
      })
    ).rejects.toThrowError(/DIRECT_COD_PAYMENT_STATUS_MUTATION_FORBIDDEN/);

    // Verify order remains unpaid and remittance status untouched
    const checkOrder = await payload.findByID({
      collection: 'orders' as any,
      id: order.id,
      overrideAccess: true,
    }) as any;
    expect(checkOrder.paymentStatus).toBe('unpaid');
    expect(checkOrder.paidAt).toBeFalsy();
    expect(checkOrder.remittanceStatus).toBe('pending_collection');

    // Legitimately collect using engine -> succeeds
    const legitReceipt = `LEGIT-REC-${Date.now()}`;
    const collectionResult = await recordCodCollection(payload, {
      orderId: order.id,
      collectedAmount: snapshot.financials.grandTotal,
      collectorType: 'courier',
      collectorName: 'Authorized Driver',
      receiptReference: legitReceipt,
      actor: opsUser,
    });
    expect(collectionResult.status).toBe('COLLECTION_RECORDED');

    const paidOrder = await payload.findByID({
      collection: 'orders' as any,
      id: order.id,
      overrideAccess: true,
    }) as any;
    expect(paidOrder.paymentStatus).toBe('paid');
    expect(paidOrder.paidAt).toBeDefined();
    expect(paidOrder.remittanceStatus).toBe('collected_by_courier');
  });
});
