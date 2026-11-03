import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import cp from 'child_process';
import { getPayload, Payload } from 'payload';
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

describe('Track 1B: COD PostgreSQL Concurrency, Large Batches & Admin Protection Suite', () => {
  let payload: Payload;
  let adminUser: any;
  let opsUser: any;
  let customerUser: any;

  let prodPhysicalId: number;
  let prodServiceId: number;

  const sampleProducts: Record<string, ProductItem> = {
    prod_physical: {
      id: 'prod_physical',
      title: 'Corporate Stainless Steel Tumbler',
      itemType: 'physical',
      basePrice: 200,
      customizationFee: 25,
      minOrderQuantity: 10,
    },
    prod_service: {
      id: 'prod_service',
      title: 'Enterprise Brand Identity Service',
      itemType: 'service',
      basePrice: 25000,
      customizationFee: 0,
      minOrderQuantity: 1,
    },
  };

  const sampleCustomer: CustomerDetails = {
    name: 'Hesham Mostafa',
    email: 'hesham@nile-holdings.com',
    phone: '+201099887766',
    companyName: 'Nile Holdings SAE',
  };

  const sampleFulfillment: FulfillmentOption = {
    type: 'delivery',
    addressLine: 'Smart Village, Building B12, Giza, Egypt',
    shippingFee: 100,
  };

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    // Strictly enforce that this PostgreSQL stress suite is running against an actual PostgreSQL pool
    const pool = (payload.db as any)?.pool;
    if (!pool) {
      throw new Error(
        'INVALID_TEST_DATABASE: Track 1B COD PostgreSQL suite must run against a live PostgreSQL database instance. (payload.db.pool is undefined, likely running on SQLite).'
      );
    }

    const timestamp = Date.now();

    // 1. Seed Admin
    adminUser = await payload.create({
      collection: 'users',
      data: {
        email: `admin-cod-stress-${timestamp}@mwheba.com`,
        password: 'Password123!',
        roles: ['admin', 'finance'],
      },
      context: { isSystemSeed: true },
    });

    // 2. Seed Operations User
    opsUser = await payload.create({
      collection: 'users',
      data: {
        email: `ops-cod-stress-${timestamp}@mwheba.com`,
        password: 'Password123!',
        roles: ['admin'],
      },
      context: { isSystemSeed: true },
    });

    // 3. Seed Customer User
    customerUser = await payload.create({
      collection: 'users',
      data: {
        email: `customer-cod-stress-${timestamp}@nile-holdings.com`,
        password: 'Password123!',
        roles: ['customer'],
      },
      context: { isSystemSeed: true },
    });

    // 4. Seed Products
    const prodPhys = await payload.create({
      collection: 'products',
      data: {
        title: 'Corporate Stainless Steel Tumbler',
        slug: `tumbler-${timestamp}`,
        _status: 'published',
        itemType: 'physical',
        minOrderQuantity: 10,
        basePrice: 200,
      },
      overrideAccess: true,
    });
    prodPhysicalId = prodPhys.id as number;

    const prodServ = await payload.create({
      collection: 'products',
      data: {
        title: 'Enterprise Brand Identity Service',
        slug: `brand-identity-${timestamp}`,
        _status: 'published',
        itemType: 'service',
        minOrderQuantity: 1,
        basePrice: 25000,
      },
      overrideAccess: true,
    });
    prodServiceId = prodServ.id as number;
  }, 45000);

  // Helper to spawn standalone worker in an isolated Node OS process
  const runChildWorker = (args: string[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      const tsxCli = path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');
      const scriptPath = path.resolve(__dirname, 'fixtures/standaloneCodWorker.ts');
      const child = cp.spawn(process.execPath, [tsxCli, scriptPath, ...args], {
        env: { ...process.env },
        shell: false,
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d; });
      child.stderr.on('data', (d) => { stderr += d; });

      child.on('close', (code) => {
        const jsonLines = stdout.split('\n').filter((l) => l.trim().startsWith('{'));
        if (jsonLines.length > 0) {
          try {
            const lastLine = jsonLines[jsonLines.length - 1];
            resolve(JSON.parse(lastLine.trim()));
            return;
          } catch {}
        }
        if (code === 0) {
          resolve({ rawStdout: stdout });
        } else {
          reject(new Error(`Child worker failed with code ${code}: ${stderr || stdout}`));
        }
      });
    });
  };

  // Helper to create an Order document in Payload
  async function createDbOrder(snapshot: any, overrides: Record<string, any> = {}) {
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
          product: it.productId === 'prod_service' ? prodServiceId : prodPhysicalId,
          title: it.productTitle,
          quantity: it.quantity,
          unitPrice: it.unitBasePrice,
          customizationFee: it.unitCustomizationFee,
          lineTotal: it.lineTotal,
          printingNotes: it.printingNotes,
          artworkAssetId: it.artworkAssetId,
          fulfillmentType: it.itemType,
        })),
        ...overrides,
      },
      overrideAccess: true,
    });
  }

  // =========================================================================
  // PART 1: Multi-Worker Cross-Process Concurrency & Large Batches
  // =========================================================================

  it('COD-PG-01: Two independent OS worker processes competing on the same COD order are serialized safely', async () => {
    const cart: CartLineItem[] = [
      { id: 'c_pg_01', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    const orderId = order.id as number;

    const receiptA = `REC-WORKER-A-${Date.now()}`;
    const receiptB = `REC-WORKER-B-${Date.now()}`;

    // Worker A runs in current Node process; Worker B runs in a separate child OS process
    const [resA, resB] = await Promise.all([
      recordCodCollection(payload, {
        orderId,
        collectedAmount: snapshot.financials.grandTotal,
        collectorType: 'courier',
        collectorName: 'Bosta Driver A',
        receiptReference: receiptA,
        actor: opsUser,
      }).catch((err) => ({ error: err.message, status: 'REJECTED' })),
      runChildWorker([
        'record_collection',
        String(orderId),
        String(snapshot.financials.grandTotal),
        'courier',
        'Bosta Driver B',
        receiptB,
        String(opsUser.id),
        'operations',
      ]),
    ]);

    // Evaluation: Exactly one worker must successfully record the collection
    const statuses = [resA.status, resB.status];
    expect(statuses).toContain('COLLECTION_RECORDED');

    // The other worker must either get ALREADY_PAID or a clean lock serialization message
    const nonRecorded = [resA, resB].find((r) => r.status !== 'COLLECTION_RECORDED');
    expect(nonRecorded).toBeDefined();
    if (nonRecorded.status) {
      expect(['ALREADY_PAID', 'ALREADY_COLLECTED', 'REJECTED']).toContain(nonRecorded.status);
    }

    // Verify DB integrity: exactly ONE PaymentCollection record exists for this order
    const collections = await payload.find({
      collection: 'payment-collections' as any,
      where: { order: { equals: orderId } },
      overrideAccess: true,
    });
    expect(collections.docs.length).toBe(1);

    // Verify Order state in DB
    const finalOrder = await payload.findByID({ collection: 'orders' as any, id: orderId, overrideAccess: true }) as any;
    expect(finalOrder.paymentStatus).toBe('paid');
    expect(finalOrder.remittanceStatus).toBe('collected_by_courier');
  }, 30000);

  it('COD-PG-02: Large multi-order batch remittance (20 orders) succeeds in one transaction without pool exhaustion', async () => {
    // Create and collect 20 distinct COD orders (greater than default pool size of 10)
    const BATCH_SIZE = 20;
    const orders: any[] = [];
    let grossTotal = 0;

    for (let i = 0; i < BATCH_SIZE; i++) {
      const cart: CartLineItem[] = [
        { id: `c_batch_${i}`, productId: 'prod_physical', variantId: `v_${i}`, variantName: `Edition ${i}`, quantity: 10 },
      ];
      const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
      const o = await createDbOrder(snapshot);
      await recordCodCollection(payload, {
        orderId: o.id,
        collectedAmount: snapshot.financials.grandTotal,
        collectorType: 'courier',
        collectorName: 'Aramex Batch Courier',
        receiptReference: `ARX-RCPT-LARGE-${Date.now()}-${i}`,
        actor: opsUser,
      });
      orders.push(o);
      grossTotal += snapshot.financials.grandTotal;
    }

    expect(orders.length).toBe(20);

    const batchId = `REM-BATCH-LARGE-20-${Date.now()}`;
    const deduction = 500; // 500 EGP courier fees
    const netDeposit = grossTotal - deduction;

    const result = await reconcileCourierRemittanceBatch(payload, {
      batchId,
      courierCompany: 'Aramex Egypt',
      orderIds: orders.map((o) => o.id),
      grossCollectedAmount: grossTotal,
      courierFeeDeductions: deduction,
      netDepositAmount: netDeposit,
      depositSlipReference: `DEP-SLIP-LARGE-20-${Date.now()}`,
      depositDate: new Date().toISOString(),
      actor: adminUser,
    });

    expect(result.status).toBe('REMITTANCE_SUCCESSFUL');
    expect(result.orderCount).toBe(20);
    expect(result.grossCollectedAmount).toBe(grossTotal);
    expect(result.netDepositAmount).toBe(netDeposit);

    // Verify all 20 orders in database are atomically marked remitted
    for (const o of orders) {
      const verified = await payload.findByID({ collection: 'orders' as any, id: o.id, overrideAccess: true }) as any;
      expect(verified.remittanceStatus).toBe('remitted_to_company');
      expect(verified.codDetails?.courierRemittanceBatchId).toBe(batchId);
    }

    // Verify CourierRemittances record in DB
    const remittanceDoc = await payload.findByID({
      collection: 'courier-remittances' as any,
      id: result.remittanceId,
      overrideAccess: true,
    }) as any;
    expect(remittanceDoc.batchId).toBe(batchId);
    expect(remittanceDoc.orders?.length).toBe(20);
    expect(remittanceDoc.status).toBe('reconciled');
  }, 30000);

  it('COD-PG-03: Two independent OS workers submitting overlapping remittance batches prevent double remittance', async () => {
    // Create 4 orders and collect them
    const orders: any[] = [];
    let perOrderTotal = 0;
    for (let i = 0; i < 4; i++) {
      const cart: CartLineItem[] = [
        { id: `c_over_${i}`, productId: 'prod_physical', variantId: `v_${i}`, variantName: `Var ${i}`, quantity: 10 },
      ];
      const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
      const o = await createDbOrder(snapshot);
      await recordCodCollection(payload, {
        orderId: o.id,
        collectedAmount: snapshot.financials.grandTotal,
        collectorType: 'courier',
        collectorName: 'Mashaweer Agent',
        receiptReference: `MSH-OVER-${Date.now()}-${i}`,
        actor: opsUser,
      });
      orders.push(o);
      perOrderTotal = snapshot.financials.grandTotal;
    }

    const [o0, o1, o2, o3] = orders;

    // Batch A: orders [o0, o1, o2]
    // Batch B: orders [o1, o2, o3]  <-- o1 and o2 are shared!
    const batchIdA = `REM-OVERLAP-A-${Date.now()}`;
    const batchIdB = `REM-OVERLAP-B-${Date.now()}`;

    const batchAOrderIds = [o0.id, o1.id, o2.id];
    const batchBOrderIds = [o1.id, o2.id, o3.id];

    // Worker A runs in current process; Worker B runs in child process
    const [resA, resB] = await Promise.all([
      reconcileCourierRemittanceBatch(payload, {
        batchId: batchIdA,
        courierCompany: 'Mashaweer Egypt',
        orderIds: batchAOrderIds,
        grossCollectedAmount: perOrderTotal * 3,
        netDepositAmount: perOrderTotal * 3,
        depositSlipReference: `DEP-OVERLAP-A-${Date.now()}`,
        depositDate: new Date().toISOString(),
        actor: adminUser,
      }).catch((err) => ({ error: err.message, status: 'REJECTED' })),
      runChildWorker([
        'reconcile_remittance',
        batchIdB,
        'Mashaweer Egypt',
        batchBOrderIds.join(','),
        String(perOrderTotal * 3),
        String(perOrderTotal * 3),
        `DEP-OVERLAP-B-${Date.now()}`,
        String(adminUser.id),
        'admin,finance',
      ]).catch((err) => ({ error: err.message, status: 'REJECTED' })),
    ]);

    // Exactly one batch must succeed and one must fail (either with DOUBLE_REMITTANCE_ERROR on Postgres or lock busy on SQLite)
    const succeeded = [resA, resB].filter((r) => r?.status === 'REMITTANCE_SUCCESSFUL');
    const failed = [resA, resB].filter(
      (r) =>
        r &&
        (r.status === 'REJECTED' ||
          Boolean(r.error) ||
          (typeof r.statusCode === 'number' && r.statusCode >= 400))
    );

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);
  }, 30000);

  // =========================================================================
  // PART 2: Admin Experience & Protection Verification (إجراءات الإدارة)
  // =========================================================================

  it('ADMIN-TC-01: Direct Payload update by Admin attempting to jump to shipped or delivered when proof_pending is strictly rejected', async () => {
    // Create artwork asset
    const asset = await payload.create({
      collection: 'artwork-assets',
      data: {
        uploader: customerUser.id,
        originalFilename: 'corporate-logo-admin-test.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        storageKey: 'cust_art/corporate-logo-admin-test.pdf',
      },
      overrideAccess: true,
    });

    const cart: CartLineItem[] = [
      {
        id: 'c_admin_01',
        productId: 'prod_physical',
        variantId: 'blk',
        variantName: 'Black',
        quantity: 10,
        artworkAssetId: String(asset.id),
        printingNotes: 'Admin test proof approval',
      },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    expect(order.proofStatus).toBe('proof_pending');

    // Admin attempts direct payload.update to 'shipped'
    await expect(
      payload.update({
        collection: 'orders' as any,
        id: order.id,
        data: { fulfillmentStatus: 'shipped' },
        user: adminUser,
      })
    ).rejects.toThrowError(/PROOF_NOT_APPROVED/);

    // Admin attempts direct payload.update to 'in_production'
    await expect(
      payload.update({
        collection: 'orders' as any,
        id: order.id,
        data: { fulfillmentStatus: 'in_production' },
        user: adminUser,
      })
    ).rejects.toThrowError(/PROOF_NOT_APPROVED/);

    // Now properly approve proof using engine
    await approveCustomProof(payload, order.id, opsUser);

    // Now direct payload.update to in_production succeeds
    const updated = await payload.update({
      collection: 'orders' as any,
      id: order.id,
      data: { fulfillmentStatus: 'in_production' },
      user: adminUser,
    }) as any;
    expect(updated.fulfillmentStatus).toBe('in_production');
  });

  it('ADMIN-TC-02: Direct Payload update by Admin attempting to set paymentStatus: paid on cancelled/refused order is strictly rejected', async () => {
    const cart: CartLineItem[] = [
      { id: 'c_admin_02', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);

    // Order refused upon delivery
    await recordDeliveryRefusal(payload, {
      orderId: order.id,
      refusalReason: 'Admin test: package returned by customer',
      actor: opsUser,
    });

    const refusedOrder = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(refusedOrder.orderStatus).toBe('cancelled');
    expect(refusedOrder.fulfillmentStatus).toBe('returned_to_origin');

    // Admin attempts direct payload.update to force paymentStatus to 'paid'
    await expect(
      payload.update({
        collection: 'orders' as any,
        id: order.id,
        data: { paymentStatus: 'paid' },
        user: adminUser,
      })
    ).rejects.toThrowError(/CANNOT_COLLECT_CANCELLED_OR_REFUSED_ORDER/);

    // Verify order remains unpaid
    const checkOrder = await payload.findByID({ collection: 'orders' as any, id: order.id, overrideAccess: true }) as any;
    expect(checkOrder.paymentStatus).toBe('unpaid');
  });

  it('ADMIN-TC-03: Direct Payload update by Admin attempting to modify items, quantities, or line totals on existing order is strictly blocked', async () => {
    const cart: CartLineItem[] = [
      { id: 'c_admin_03', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);

    // Admin attempts to tamper with items (changing quantity from 10 to 5)
    await expect(
      payload.update({
        collection: 'orders' as any,
        id: order.id,
        data: {
          items: [
            { product: prodPhysicalId, quantity: 5, unitPrice: 200, lineTotal: 1000 },
          ],
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/Order Immutability Error/);
  });

  it('ADMIN-TC-04: Direct Payload create by Admin or API attempting COD with digital service product is strictly blocked', async () => {
    // Attempt to create COD order containing digital service
    await expect(
      payload.create({
        collection: 'orders' as any,
        data: {
          customer: customerUser.id,
          customerEmail: customerUser.email,
          paymentMethod: 'cod',
          items: [
            { product: prodServiceId, quantity: 1 },
          ],
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/COD_PROHIBITED_FOR_DIGITAL/);
  });

  it('ADMIN-TC-05: RBAC boundary verification: Customer role attempting privileged COD actions is strictly forbidden (HTTP 403)', async () => {
    const cart: CartLineItem[] = [
      { id: 'c_admin_05', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);

    // 1. Advance fulfillment
    await expect(
      advanceCodFulfillment(payload, {
        orderId: order.id,
        targetStatus: 'shipped',
        actor: customerUser,
      })
    ).rejects.toThrowError(/FORBIDDEN/);

    // 2. Approve custom proof
    await expect(
      approveCustomProof(payload, order.id, customerUser)
    ).rejects.toThrowError(/FORBIDDEN/);

    // 3. Record cash collection
    await expect(
      recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: snapshot.financials.grandTotal,
        collectorType: 'office_staff',
        collectorName: 'Office Receptionist',
        receiptReference: 'CUST-FORBIDDEN-01',
        actor: customerUser,
      })
    ).rejects.toThrowError(/FORBIDDEN/);

    // 4. Record delivery refusal
    await expect(
      recordDeliveryRefusal(payload, {
        orderId: order.id,
        refusalReason: 'Customer self refusal',
        actor: customerUser,
      })
    ).rejects.toThrowError(/FORBIDDEN/);

    // 5. Reconcile courier remittance batch
    await expect(
      reconcileCourierRemittanceBatch(payload, {
        batchId: `REM-FORBIDDEN-${Date.now()}`,
        courierCompany: 'Unauthorized Courier',
        orderIds: [order.id],
        grossCollectedAmount: snapshot.financials.grandTotal,
        netDepositAmount: snapshot.financials.grandTotal,
        depositSlipReference: 'SLIP-FORBIDDEN',
        depositDate: new Date().toISOString(),
        actor: customerUser,
      })
    ).rejects.toThrowError(/FORBIDDEN/);
  });

  it('ADMIN-TC-06: Direct Payload update by Admin attempting to mark a normal active COD order as paid without collection pipeline is strictly blocked', async () => {
    const cart: CartLineItem[] = [
      { id: 'c_admin_06', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    expect(order.paymentStatus).toBe('unpaid');
    expect(order.remittanceStatus).toBe('pending_collection');

    // Admin attempts to directly update paymentStatus to 'paid' via Payload update
    await expect(
      payload.update({
        collection: 'orders' as any,
        id: order.id,
        data: { paymentStatus: 'paid' },
        user: adminUser,
      })
    ).rejects.toThrowError(/DIRECT_COD_PAYMENT_STATUS_MUTATION_FORBIDDEN/);

    // Verify order remains unpaid, paidAt is null, and remittanceStatus remains pending_collection
    const unchangedOrder = await payload.findByID({
      collection: 'orders' as any,
      id: order.id,
      overrideAccess: true,
    }) as any;
    expect(unchangedOrder.paymentStatus).toBe('unpaid');
    expect(unchangedOrder.paidAt).toBeFalsy();
    expect(unchangedOrder.remittanceStatus).toBe('pending_collection');

    // Verify no fake payment collection record exists
    const collections = await payload.find({
      collection: 'payment-collections' as any,
      where: { order: { equals: order.id } },
      overrideAccess: true,
    });
    expect(collections.docs.length).toBe(0);

    // Now test that the official recordCodCollection pipeline successfully and legitimately marks it paid
    const validReceipt = `REC-VALID-ADMIN-${Date.now()}`;
    const collectionResult = await recordCodCollection(payload, {
      orderId: order.id,
      collectedAmount: snapshot.financials.grandTotal,
      collectorType: 'office_staff',
      collectorName: 'Authorized Cashier',
      receiptReference: validReceipt,
      actor: opsUser,
    });

    expect(collectionResult.status).toBe('COLLECTION_RECORDED');

    // Verify order is now legitimately paid with paidAt and collection document
    const paidOrder = await payload.findByID({
      collection: 'orders' as any,
      id: order.id,
      overrideAccess: true,
    }) as any;
    expect(paidOrder.paymentStatus).toBe('paid');
    expect(paidOrder.paidAt).toBeDefined();
    expect(paidOrder.remittanceStatus).toBe('remitted_to_company');
    expect(paidOrder.codDetails?.collectionReference).toBe(validReceipt);
  });

  it('ADMIN-TC-07: Step 1 Attack: Direct update by Admin attempting to mutate paymentMethod on existing order is strictly blocked (PAYMENT_METHOD_IMMUTABLE)', async () => {
    const cart: CartLineItem[] = [
      { id: 'c_admin_07', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    expect(order.paymentMethod).toBe('cod');

    // Admin attempts to change paymentMethod from 'cod' to 'bank_transfer'
    await expect(
      payload.update({
        collection: 'orders' as any,
        id: order.id,
        data: { paymentMethod: 'bank_transfer' },
        user: adminUser,
      })
    ).rejects.toThrowError(/PAYMENT_METHOD_IMMUTABLE/);

    // Verify paymentMethod remains strictly 'cod'
    const unchangedOrder = await payload.findByID({
      collection: 'orders' as any,
      id: order.id,
      overrideAccess: true,
    }) as any;
    expect(unchangedOrder.paymentMethod).toBe('cod');
  });

  it('ADMIN-TC-08: Step 2 Attack: Direct update by Admin attempting to set paymentStatus: paid on bank_transfer order without verified transfer is strictly blocked', async () => {
    // Create an order legitimately created with paymentMethod: 'bank_transfer'
    const createdBankOrder = await payload.create({
      collection: 'orders' as any,
      data: {
        customer: customerUser.id,
        customerEmail: customerUser.email,
        paymentMethod: 'bank_transfer',
        items: [
          { product: prodPhysicalId, quantity: 10 },
        ],
      },
      user: adminUser,
    });
    expect(createdBankOrder.paymentMethod).toBe('bank_transfer');
    expect(createdBankOrder.paymentStatus).toBe('pending_verification');

    // Admin attempts to directly set paymentStatus: 'paid' without an approved bank transfer record
    await expect(
      payload.update({
        collection: 'orders' as any,
        id: createdBankOrder.id,
        data: { paymentStatus: 'paid' },
        user: adminUser,
      })
    ).rejects.toThrowError(/DIRECT_BANK_TRANSFER_PAYMENT_STATUS_MUTATION_FORBIDDEN/);

    // Verify order remains pending_verification
    const checkOrder = await payload.findByID({
      collection: 'orders' as any,
      id: createdBankOrder.id,
      overrideAccess: true,
    }) as any;
    expect(checkOrder.paymentStatus).toBe('pending_verification');
  });

  it('ADMIN-TC-09: Combined Attack: Admin attempting simultaneous { paymentMethod: bank_transfer, paymentStatus: paid } on COD order is strictly blocked', async () => {
    const cart: CartLineItem[] = [
      { id: 'c_admin_09', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'cod');
    const order = await createDbOrder(snapshot);
    expect(order.paymentMethod).toBe('cod');
    expect(order.paymentStatus).toBe('unpaid');

    // Combined attack: change paymentMethod and mark paid simultaneously
    await expect(
      payload.update({
        collection: 'orders' as any,
        id: order.id,
        data: {
          paymentMethod: 'bank_transfer',
          paymentStatus: 'paid',
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/PAYMENT_METHOD_IMMUTABLE/);

    // Verify order remains strictly untouched
    const checkOrder = await payload.findByID({
      collection: 'orders' as any,
      id: order.id,
      overrideAccess: true,
    }) as any;
    expect(checkOrder.paymentMethod).toBe('cod');
    expect(checkOrder.paymentStatus).toBe('unpaid');
    expect(checkOrder.paidAt).toBeFalsy();
  });

  it('ADMIN-TC-10: Bank Transfer Approval strictly rejects underpayment/partial payment and keeps order pending_verification', async () => {
    // 1. Create a 2,100 EGP bank transfer order (10 units * 200 + 100 shipping)
    const cart: CartLineItem[] = [
      { id: 'c_admin_10', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'bank_transfer');
    const order = await createDbOrder(snapshot, { paymentMethod: 'bank_transfer', paymentStatus: 'pending_verification' });
    expect(order.amount).toBe(2100);
    expect(order.paymentStatus).toBe('pending_verification');

    // 2. Customer submits bank transfer claiming 1 EGP (underpayment attack)
    const underpaidTransfer = await payload.create({
      collection: 'bank-transfers' as any,
      data: {
        order: order.id,
        claimedAmount: 1, // 1 EGP instead of 2,100 EGP!
        bankReferenceCode: 'CIB-TXN-UNDERPAID-01',
      },
      user: customerUser,
    });
    expect(underpaidTransfer.status).toBe('pending_verification');

    // 3. Finance officer attempts to approve this transfer
    // A: Fails when finance forgets or omits confirmedAmount (CONFIRMED_AMOUNT_REQUIRED)
    await expect(
      payload.update({
        collection: 'bank-transfers' as any,
        id: underpaidTransfer.id,
        data: {
          status: 'approved',
          internalReconciliationCode: 'REC-CIB-2026-UNDER',
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/CONFIRMED_AMOUNT_REQUIRED/);

    // B: Fails when finance enters underpaid amount (e.g. 1 EGP instead of 2,100 EGP) (BANK_TRANSFER_AMOUNT_MISMATCH)
    await expect(
      payload.update({
        collection: 'bank-transfers' as any,
        id: underpaidTransfer.id,
        data: {
          status: 'approved',
          confirmedAmount: 1,
          internalReconciliationCode: 'REC-CIB-2026-UNDER-EXPLICIT',
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/BANK_TRANSFER_AMOUNT_MISMATCH/);

    // 4. Verify the transfer remains pending_verification
    const checkTransfer = await payload.findByID({
      collection: 'bank-transfers' as any,
      id: underpaidTransfer.id,
      user: adminUser,
    }) as any;
    expect(checkTransfer.status).toBe('pending_verification');
    expect(checkTransfer.verifiedBy).toBeFalsy();

    // 5. Verify the order strictly remains pending_verification and unpaid
    const checkOrder = await payload.findByID({
      collection: 'orders' as any,
      id: order.id,
      overrideAccess: true,
    }) as any;
    expect(checkOrder.paymentStatus).toBe('pending_verification');
    expect(checkOrder.paidAt).toBeFalsy();

    // 6. Legitimate approval: Finance confirms the true deposit of 2,100 EGP from the bank statement
    const legitRecCode = `REC-CIB-LEGIT-${Date.now()}`;
    const legitimateApproval = await payload.update({
      collection: 'bank-transfers' as any,
      id: underpaidTransfer.id,
      data: {
        status: 'approved',
        confirmedAmount: 2100, // Exact 2,100 EGP confirmed from statement
        internalReconciliationCode: legitRecCode,
      },
      user: adminUser,
    }) as any;
    expect(legitimateApproval.status).toBe('approved');
    expect(legitimateApproval.confirmedAmount).toBe(2100);

    // 7. Verify order is now legitimately marked paid with audit entry
    const finalOrder = await payload.findByID({
      collection: 'orders' as any,
      id: order.id,
      overrideAccess: true,
    }) as any;
    expect(finalOrder.paymentStatus).toBe('paid');
    expect(finalOrder.paidAt).toBeDefined();
    expect(finalOrder.auditLog?.some((l: any) => l.entry?.includes(legitRecCode))).toBe(true);
  });

  it('ADMIN-TC-11: Bank Transfer creation strictly verifies order ownership, payment method, unpaid status, and forces submittedBy', async () => {
    // 1. Create a bank transfer order belonging to customerUser
    const cart: CartLineItem[] = [
      { id: 'c_admin_11', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'bank_transfer');
    const order = await createDbOrder(snapshot, {
      customer: customerUser.id,
      customerEmail: customerUser.email,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending_verification',
    });

    // Create another customer user
    const victimCustomer = await payload.create({
      collection: 'users',
      data: {
        email: `victim-${Date.now()}@nile.com`,
        password: 'Password123!',
        roles: ['customer'],
      },
      context: { isSystemSeed: true },
    });

    // Attack 1: victimCustomer attempts to submit a bank transfer against customerUser's order
    await expect(
      payload.create({
        collection: 'bank-transfers' as any,
        data: {
          order: order.id,
          claimedAmount: 2100,
          bankReferenceCode: 'POACH-TXN-001',
        },
        user: victimCustomer,
      })
    ).rejects.toThrowError(/ORDER_OWNERSHIP_MISMATCH/);

    // Attack 2: Customer attempts to specify a fake submittedBy
    const legitimateTransfer = await payload.create({
      collection: 'bank-transfers' as any,
      data: {
        order: order.id,
        claimedAmount: 2100,
        bankReferenceCode: 'LEGIT-SUBMISSION-001',
        submittedBy: victimCustomer.id, // Malicious override attempt
      },
      user: customerUser,
    });
    // Server must strictly force submittedBy to customerUser.id
    const submittedById =
      typeof legitimateTransfer.submittedBy === 'object' && legitimateTransfer.submittedBy !== null
        ? legitimateTransfer.submittedBy.id
        : legitimateTransfer.submittedBy;
    expect(String(submittedById)).toBe(String(customerUser.id));

    // Attack 3: Attempting to submit a bank transfer against a COD order
    const codOrder = await createDbOrder(snapshot, {
      customer: customerUser.id,
      customerEmail: customerUser.email,
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
    });

    await expect(
      payload.create({
        collection: 'bank-transfers' as any,
        data: {
          order: codOrder.id,
          claimedAmount: 2100,
          bankReferenceCode: 'COD-TRANSFER-POACH',
        },
        user: customerUser,
      })
    ).rejects.toThrowError(/INVALID_ORDER_PAYMENT_METHOD/);

    // Attack 4: Attempting to submit a bank transfer against an already paid order
    // Legitimate first transfer approval makes order paid
    const initialTransfer = await payload.create({
      collection: 'bank-transfers' as any,
      data: {
        order: order.id,
        claimedAmount: 2100,
        bankReferenceCode: 'LEGIT-FIRST-TXN',
      },
      user: customerUser,
    });
    const firstLegitRecCode = `REC-FIRST-LEGIT-${Date.now()}`;
    await payload.update({
      collection: 'bank-transfers' as any,
      id: initialTransfer.id,
      data: {
        status: 'approved',
        confirmedAmount: 2100,
        internalReconciliationCode: firstLegitRecCode,
      },
      user: adminUser,
    });

    const paidOrder = await payload.findByID({
      collection: 'orders' as any,
      id: order.id,
      overrideAccess: true,
    }) as any;
    expect(paidOrder.paymentStatus).toBe('paid');

    // Customer attempts to submit another bank transfer against the already paid order -> Rejected
    await expect(
      payload.create({
        collection: 'bank-transfers' as any,
        data: {
          order: order.id,
          claimedAmount: 2100,
          bankReferenceCode: 'ALREADY-PAID-POACH',
        },
        user: customerUser,
      })
    ).rejects.toThrowError(/ORDER_ALREADY_PAID/);
  });

  it('ADMIN-TC-12: Strict integer piastre equality, fractional piastre rejection, and post-approval immutability/delete lock', async () => {
    // 1. Create order
    const cart: CartLineItem[] = [
      { id: 'c_admin_12', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'bank_transfer');
    const order = await createDbOrder(snapshot, {
      customer: customerUser.id,
      customerEmail: customerUser.email,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending_verification',
    });

    // 2. Submit transfer
    const transfer = await payload.create({
      collection: 'bank-transfers' as any,
      data: {
        order: order.id,
        claimedAmount: 2100,
        bankReferenceCode: 'CIB-EXACT-PIASTRE-01',
      },
      user: customerUser,
    });

    // Test 1: Reject fractional piastres (e.g. 2100.005 EGP)
    await expect(
      payload.update({
        collection: 'bank-transfers' as any,
        id: transfer.id,
        data: {
          status: 'approved',
          confirmedAmount: 2100.005, // fractional piastre
          internalReconciliationCode: 'REC-FRAC',
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/FRACTIONAL_PIASTRE_PROHIBITED/);

    // Test 2: Approving with 1 piastre mismatch (2100.01 vs 2100.00) strictly rejected
    await expect(
      payload.update({
        collection: 'bank-transfers' as any,
        id: transfer.id,
        data: {
          status: 'approved',
          confirmedAmount: 2100.01, // 1 piastre discrepancy
          internalReconciliationCode: 'REC-OFF-BY-1',
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/BANK_TRANSFER_AMOUNT_MISMATCH/);

    // Test 3: Exact piastre approval succeeds (2100.00 EGP = 210000 piastres)
    const exactPiastreRecCode = `REC-EXACT-PIASTRE-${Date.now()}`;
    const approved = await payload.update({
      collection: 'bank-transfers' as any,
      id: transfer.id,
      data: {
        status: 'approved',
        confirmedAmount: 2100,
        internalReconciliationCode: exactPiastreRecCode,
      },
      user: adminUser,
    }) as any;
    expect(approved.status).toBe('approved');
    expect(approved.confirmedAmount).toBe(2100);

    // Test 4: Immutability lock: Any subsequent update (even by Admin) is strictly blocked
    await expect(
      payload.update({
        collection: 'bank-transfers' as any,
        id: transfer.id,
        data: {
          bankReferenceCode: 'MUTATED-AFTER-APPROVAL',
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/BANK_TRANSFER_IMMUTABLE_AFTER_APPROVAL/);

    await expect(
      payload.update({
        collection: 'bank-transfers' as any,
        id: transfer.id,
        data: {
          status: 'approved',
          confirmedAmount: 5000,
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/BANK_TRANSFER_IMMUTABLE_AFTER_APPROVAL/);

    // Test 5: Deletion lock: Deleting an approved transfer (even by Admin) is strictly forbidden
    await expect(
      payload.delete({
        collection: 'bank-transfers' as any,
        id: transfer.id,
        user: adminUser,
      })
    ).rejects.toThrowError(/BANK_TRANSFER_DELETION_FORBIDDEN_AFTER_APPROVAL/);
  });

  it('ADMIN-TC-13: Bank Statement Reconciliation Code Uniqueness: Strictly prevents settling a single bank deposit across multiple transfers', async () => {
    // 1. Create two distinct orders of 2,100 EGP each
    const cart: CartLineItem[] = [
      { id: 'c_admin_13', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'bank_transfer');

    const order1 = await createDbOrder(snapshot, {
      customer: customerUser.id,
      customerEmail: customerUser.email,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending_verification',
    });

    const order2 = await createDbOrder(snapshot, {
      customer: customerUser.id,
      customerEmail: customerUser.email,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending_verification',
    });

    // 2. Submit two distinct bank transfers for the two orders
    const transfer1 = await payload.create({
      collection: 'bank-transfers' as any,
      data: {
        order: order1.id,
        claimedAmount: 2100,
        bankReferenceCode: 'REF-TXN-ORDER-1',
      },
      user: customerUser,
    });

    const transfer2 = await payload.create({
      collection: 'bank-transfers' as any,
      data: {
        order: order2.id,
        claimedAmount: 2100,
        bankReferenceCode: 'REF-TXN-ORDER-2',
      },
      user: customerUser,
    });

    const singleDepositRecCode = `REC-CIB-DEPOSIT-ROW-${Date.now()}`;

    // 3. Legitimate approval of Transfer 1 with the deposit row
    const approved1 = await payload.update({
      collection: 'bank-transfers' as any,
      id: transfer1.id,
      data: {
        status: 'approved',
        confirmedAmount: 2100,
        internalReconciliationCode: singleDepositRecCode,
      },
      user: adminUser,
    }) as any;
    expect(approved1.status).toBe('approved');
    expect(approved1.internalReconciliationCode).toBe(singleDepositRecCode);

    // Verify order 1 is paid
    const checkOrder1 = await payload.findByID({
      collection: 'orders' as any,
      id: order1.id,
      overrideAccess: true,
    }) as any;
    expect(checkOrder1.paymentStatus).toBe('paid');

    // 4. Attack: Attempting to approve Transfer 2 with the EXACT SAME reconciliation code (reusing single deposit)
    await expect(
      payload.update({
        collection: 'bank-transfers' as any,
        id: transfer2.id,
        data: {
          status: 'approved',
          confirmedAmount: 2100,
          internalReconciliationCode: singleDepositRecCode, // Duplicate reuse of same deposit row!
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/RECONCILIATION_CODE_ALREADY_USED/);

    // Verify transfer 2 and order 2 strictly remain pending_verification
    const checkTransfer2 = await payload.findByID({
      collection: 'bank-transfers' as any,
      id: transfer2.id,
      user: adminUser,
    }) as any;
    expect(checkTransfer2.status).toBe('pending_verification');

    const checkOrder2 = await payload.findByID({
      collection: 'orders' as any,
      id: order2.id,
      overrideAccess: true,
    }) as any;
    expect(checkOrder2.paymentStatus).toBe('pending_verification');
    expect(checkOrder2.paidAt).toBeFalsy();

    // 5. Legitimate approval of Transfer 2 with its own distinct bank statement deposit code
    const distinctDepositRecCode = `REC-CIB-DEPOSIT-ROW-${Date.now()}-DISTINCT`;
    const approved2 = await payload.update({
      collection: 'bank-transfers' as any,
      id: transfer2.id,
      data: {
        status: 'approved',
        confirmedAmount: 2100,
        internalReconciliationCode: distinctDepositRecCode,
      },
      user: adminUser,
    }) as any;
    expect(approved2.status).toBe('approved');
    expect(approved2.internalReconciliationCode).toBe(distinctDepositRecCode);

    // Verify order 2 is now paid with its own distinct audit entry
    const finalOrder2 = await payload.findByID({
      collection: 'orders' as any,
      id: order2.id,
      overrideAccess: true,
    }) as any;
    expect(finalOrder2.paymentStatus).toBe('paid');
    expect(finalOrder2.paidAt).toBeDefined();
    expect(finalOrder2.auditLog?.some((l: any) => l.entry?.includes(distinctDepositRecCode))).toBe(true);
  });

  it('ADMIN-TC-14: Concurrent Bank Transfer Approval Race Condition Guard on PostgreSQL: Strictly prevents two concurrent workers from claiming the same reconciliation code', async () => {
    // 1. Create two distinct orders of 2,100 EGP each
    const cart: CartLineItem[] = [
      { id: 'c_admin_14', productId: 'prod_physical', variantId: 'slv', variantName: 'Silver', quantity: 10 },
    ];
    const snapshot = createOrderSnapshot(cart, sampleProducts, sampleCustomer, sampleFulfillment, 'bank_transfer');

    const orderA = await createDbOrder(snapshot, {
      customer: customerUser.id,
      customerEmail: customerUser.email,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending_verification',
    });

    const orderB = await createDbOrder(snapshot, {
      customer: customerUser.id,
      customerEmail: customerUser.email,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending_verification',
    });

    // 2. Submit two distinct bank transfers
    const transferA = await payload.create({
      collection: 'bank-transfers' as any,
      data: {
        order: orderA.id,
        claimedAmount: 2100,
        bankReferenceCode: 'REF-RACE-A',
      },
      user: customerUser,
    });

    const transferB = await payload.create({
      collection: 'bank-transfers' as any,
      data: {
        order: orderB.id,
        claimedAmount: 2100,
        bankReferenceCode: 'REF-RACE-B',
      },
      user: customerUser,
    });

    const sharedDepositCode = `REC-RACE-CODE-${Date.now()}`;

    // 3. Launch concurrent approvals with identical reconciliation code across independent OS processes
    // Worker 1 runs in process, Worker 2 runs in standalone child OS process
    const [resA, resB] = await Promise.all([
      payload.update({
        collection: 'bank-transfers' as any,
        id: transferA.id,
        data: {
          status: 'approved',
          confirmedAmount: 2100,
          internalReconciliationCode: sharedDepositCode,
        },
        user: adminUser,
      }).then((d: any) => ({ status: d.status, id: d.id })).catch((err: any) => ({ error: err.message, status: 'REJECTED' })),
      runChildWorker([
        'approve_bank_transfer',
        String(transferB.id),
        '2100',
        sharedDepositCode,
        String(adminUser.id),
        'admin,finance',
      ]).catch((err: any) => ({ error: err.message, status: 'REJECTED' })),
    ]);

    // 4. Assert strict mutual exclusion: exactly one must succeed, and one must be rejected
    const succeeded = [resA, resB].filter((r) => r?.status === 'approved');
    const failed = [resA, resB].filter(
      (r) =>
        r &&
        (r.status === 'REJECTED' ||
          Boolean(r.error) ||
          (typeof r.statusCode === 'number' && r.statusCode >= 400))
    );

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);

    // Verify rejection error mentions uniqueness / already used
    const failedResult = failed[0];
    const errorText = failedResult.error || JSON.stringify(failedResult);
    expect(errorText).toMatch(/(RECONCILIATION_CODE_ALREADY_USED|duplicate key|unique constraint|23505)/);

    // 5. Verify the orders in the database: exactly ONE order is paid, and the other remains pending_verification
    const checkOrderA = await payload.findByID({ collection: 'orders' as any, id: orderA.id, overrideAccess: true }) as any;
    const checkOrderB = await payload.findByID({ collection: 'orders' as any, id: orderB.id, overrideAccess: true }) as any;

    const paidOrders = [checkOrderA, checkOrderB].filter((o) => o.paymentStatus === 'paid');
    const pendingOrders = [checkOrderA, checkOrderB].filter((o) => o.paymentStatus === 'pending_verification');

    expect(paidOrders.length).toBe(1);
    expect(pendingOrders.length).toBe(1);
  }, 30000);
});
