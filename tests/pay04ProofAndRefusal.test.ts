import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import { NextRequest } from 'next/server';
import configPromise from '@/payload.config';
import { getOrCreateCart } from '@/modules/cart-checkout/services/cartStorage';
import { buildCheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import { createOrderFromCart } from '@/modules/orders/services/orderService';
import { approveProof, transitionJob } from '@/modules/fulfillment/services/fulfillmentService';
import { recordDeliveryRefusal, recordCodCollection } from '@/modules/payments/services/codSettlementService';
import { POST as approveProofRoute } from '@/app/api/orders/[id]/proof/approve/route';
import { POST as refuseRoute } from '@/app/api/payments/cod/refuse/route';

describe('PAY-04: Pre-Production Proof Approval & Delivery Refusal Handling', () => {
  let payload: any;
  let customerUser: any;
  let customerToken: string;
  let competitorCustomer: any;
  let competitorToken: string;
  let opsUser: any;
  let opsToken: string;
  let financeUser: any;
  let customProduct: any;
  let standardProduct: any;
  let artworkAsset: any;

  const cleanup = {
    users: [] as any[],
    orders: [] as any[],
    carts: [] as any[],
    products: [] as any[],
    assets: [] as any[],
    jobs: [] as any[],
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

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });
    const password = 'Password2026!';

    // 1. Create primary customer
    customerUser = await payload.create({
      collection: 'users',
      data: { email: `cust_pay04_${unique()}@mwheba.test`, password, roles: ['customer'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(customerUser.id);
    customerToken = await loginToken(customerUser.email, password);

    // 2. Create competitor customer
    competitorCustomer = await payload.create({
      collection: 'users',
      data: { email: `comp_pay04_${unique()}@mwheba.test`, password, roles: ['customer'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(competitorCustomer.id);
    competitorToken = await loginToken(competitorCustomer.email, password);

    // 3. Create operations officer
    opsUser = await payload.create({
      collection: 'users',
      data: { email: `ops_pay04_${unique()}@mwheba.test`, password, roles: ['operations'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(opsUser.id);
    opsToken = await loginToken(opsUser.email, password);

    // 4. Create finance officer
    financeUser = await payload.create({
      collection: 'users',
      data: { email: `fin_pay04_${unique()}@mwheba.test`, password, roles: ['finance'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(financeUser.id);

    // 5. Create artwork asset for customer
    artworkAsset = await payload.create({
      collection: 'artwork-assets',
      data: {
        storageKey: `artwork/pay04_${unique()}.pdf`,
        originalFilename: 'corporate_logo_gold.pdf',
        uploader: customerUser.id,
      },
      context: { isTrustedUpload: true },
    });
    cleanup.assets.push(artworkAsset.id);

    // 6. Create custom merchandise product
    customProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'PAY-04 Custom Thermal Tumbler',
        slug: `pay04-custom-tumbler-${unique()}`,
        itemType: 'physical',
        basePrice: 250,
        minOrderQuantity: 10,
        allowArtworkUpload: true,
        customizationFee: 40,
        _status: 'published',
      },
    });
    cleanup.products.push(customProduct.id);

    // 7. Create standard non-custom product
    standardProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'PAY-04 Ready-Made Notebook',
        slug: `pay04-ready-notebook-${unique()}`,
        itemType: 'physical',
        basePrice: 150,
        minOrderQuantity: 10,
        allowArtworkUpload: false,
        _status: 'published',
      },
    });
    cleanup.products.push(standardProduct.id);
  });

  afterAll(async () => {
    const del = async (collection: string, id: any, context?: any) => {
      try {
        await payload.delete({ collection, id, context });
      } catch {}
    };

    for (const id of cleanup.jobs) await del('fulfillment-jobs', id, { fulfillmentEngine: true });
    for (const orderId of cleanup.orders) {
      const jobs = await payload
        .find({ collection: 'fulfillment-jobs', where: { order: { equals: orderId } }, limit: 50, depth: 0 })
        .catch(() => ({ docs: [] }));
      for (const j of jobs.docs as any[]) await del('fulfillment-jobs', j.id, { fulfillmentEngine: true });
      await del('orders', orderId);
    }
    for (const id of cleanup.assets) await del('artwork-assets', id, { isTrustedUpload: true });
    for (const id of cleanup.products) await del('products', id);
    for (const id of cleanup.carts) await del('carts', id);
    for (const id of cleanup.users) await del('users', id);
  });

  // Helper to place orders with customized physical lines
  const createCustomizedOrder = async (paymentMethod: 'cod' | 'bank_transfer' = 'cod') => {
    const cart = await getOrCreateCart(payload);
    cleanup.carts.push(cart.id);

    await payload.update({
      collection: 'carts',
      id: cart.id,
      data: {
        items: [
          {
            product: customProduct.id,
            quantity: 10,
            artworkAssetId: String(artworkAsset.id),
            printingNotes: 'Laser engraving gold corporate crest on front',
          },
        ],
      },
    });

    const quote = await buildCheckoutQuote(payload, cart.id, { method: 'shipping', governorate: 'Cairo' });

    const result = await createOrderFromCart(payload, {
      cartId: cart.id,
      guestSecret: cart.secret,
      user: customerUser,
      customer: {
        email: customerUser.email,
        companyName: 'Elite Corp Ltd',
        contactPerson: 'Procurement Director',
        phone: '+201011223344',
      },
      delivery: {
        method: 'shipping',
        shippingAddress: { governorate: 'Cairo', city: 'New Cairo', streetAddress: '5th Settlement Plaza' },
        expectedShippingFee: quote.shippingFee,
      },
      paymentMethod,
      expectedGrandTotal: quote.grandTotal,
      idempotencyKey: `idemp_pay04_${unique()}`,
    });

    const order = await payload.findByID({ collection: 'orders', id: result.order.id });
    order.total = Number(order.amount ?? order.total);
    cleanup.orders.push(order.id);
    return order;
  };

  // ===========================================================================
  // 1. Pre-Production Proof Approval Workflow Gate
  // ===========================================================================
  describe('1. Pre-Production Proof Approval Workflow Gate', () => {
    it('sets proofStatus = proof_pending on orders with customized physical merchandise', async () => {
      const order = await createCustomizedOrder('cod');
      expect(order.proofStatus).toBe('proof_pending');

      // Verify line jobs are held in pending_artwork_approval
      const jobs = await payload.find({
        collection: 'fulfillment-jobs',
        where: { order: { equals: order.id } },
      });
      expect(jobs.docs.length).toBeGreaterThan(0);
      for (const job of jobs.docs) {
        expect(job.status).toBe('pending_artwork_approval');
        cleanup.jobs.push(job.id);
      }
    });

    it('blocks transitioning order to production or ready before proof approval (PROOF_NOT_APPROVED)', async () => {
      const order = await createCustomizedOrder('cod');

      // Attempting to advance order fulfillment status to in_production while proof_pending is strictly blocked
      await expect(
        payload.update({
          collection: 'orders',
          id: order.id,
          data: {
            fulfillmentStatus: 'in_production',
          },
          context: { fulfillmentEngine: true },
        })
      ).rejects.toThrow('PROOF_NOT_APPROVED');
    });

    it('blocks operations from transitioning line job to in_printing while in pending_artwork_approval', async () => {
      const order = await createCustomizedOrder('cod');
      const jobs = await payload.find({
        collection: 'fulfillment-jobs',
        where: { order: { equals: order.id } },
      });
      const customJob = jobs.docs[0];
      cleanup.jobs.push(customJob.id);

      // Attempting to jump directly from pending_artwork_approval to in_printing must fail
      await expect(
        transitionJob(payload, {
          jobId: customJob.id,
          to: 'in_printing',
          user: { id: opsUser.id, roles: opsUser.roles },
        })
      ).rejects.toThrow('INVALID_TRANSITION');
    });

    it('rejects another customer attempting to approve proof for an order they do not own (404/ORDER_NOT_FOUND)', async () => {
      const order = await createCustomizedOrder('cod');

      await expect(
        approveProof(payload, {
          orderId: order.id,
          user: { id: competitorCustomer.id, roles: competitorCustomer.roles },
        })
      ).rejects.toThrow('ORDER_NOT_FOUND');
    });

    it('approves proof by order owner, transitions order to proof_approved, releases jobs to queued, and permits production', async () => {
      const order = await createCustomizedOrder('cod');

      // Approve proof by the customer
      const res = await approveProof(payload, {
        orderId: order.id,
        user: { id: customerUser.id, roles: customerUser.roles },
      });

      expect(res.releasedJobs).toBeGreaterThan(0);

      // Verify order doc
      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.proofStatus).toBe('proof_approved');
      expect(freshOrder.proofApprovedAt).toBeDefined();

      // Verify jobs are now queued
      const jobs = await payload.find({
        collection: 'fulfillment-jobs',
        where: { order: { equals: order.id } },
      });
      const customJob = jobs.docs[0];
      expect(customJob.status).toBe('queued');

      // Now operations can advance the queued job to in_printing
      const transitionResult = await transitionJob(payload, {
        jobId: customJob.id,
        to: 'in_printing',
        user: { id: opsUser.id, roles: opsUser.roles },
      });

      expect(transitionResult.status).toBe('in_printing');
    });

    it('supports proof approval via HTTP route POST /api/orders/[id]/proof/approve with customer auth', async () => {
      const order = await createCustomizedOrder('cod');

      const req = asReq(`http://localhost:3000/api/orders/${order.id}/proof/approve`, customerToken);
      const res = await approveProofRoute(req, { params: Promise.resolve({ id: String(order.id) }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.releasedJobs).toBeGreaterThan(0);

      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.proofStatus).toBe('proof_approved');
    });
  });

  // ===========================================================================
  // 2. Delivery Refusal & Cancellation Handling
  // ===========================================================================
  describe('2. Delivery Refusal & Cancellation Handling', () => {
    it('rejects recording delivery refusal by unauthorized roles (customer) with 403 FORBIDDEN', async () => {
      const order = await createCustomizedOrder('cod');

      await expect(
        recordDeliveryRefusal(payload, {
          orderId: order.id,
          refusalReason: 'Customer claims package was damaged',
          actor: { id: customerUser.id, roles: customerUser.roles },
        })
      ).rejects.toThrow('FORBIDDEN');
    });

    it('rejects recording delivery refusal without a documented refusalReason (400 INVALID_REFUSAL_REASON)', async () => {
      const order = await createCustomizedOrder('cod');

      await expect(
        recordDeliveryRefusal(payload, {
          orderId: order.id,
          refusalReason: '',
          actor: { id: opsUser.id, roles: opsUser.roles },
        })
      ).rejects.toThrow('INVALID_REFUSAL_REASON');
    });

    it('records refusal at delivery: cancels order, returns fulfillment to origin, and preserves paymentStatus: unpaid', async () => {
      const order = await createCustomizedOrder('cod');
      const reason = 'Recipient refused delivery upon courier arrival due to budget freeze.';

      const refusalResult = await recordDeliveryRefusal(payload, {
        orderId: order.id,
        refusalReason: reason,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });

      expect(refusalResult.status).toBe('DELIVERY_REFUSED_RECORDED');
      expect(refusalResult.orderStatus).toBe('cancelled');
      expect(refusalResult.fulfillmentStatus).toBe('returned_to_origin');
      expect(refusalResult.paymentStatus).toBe('unpaid');

      // Verify order in database
      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.status).toBe('cancelled');
      expect(freshOrder.orderStatus).toBe('cancelled');
      expect(freshOrder.fulfillmentStatus).toBe('returned_to_origin');
      expect(freshOrder.paymentStatus).toBe('unpaid');
      expect(freshOrder.codDetails?.refusalReason).toBe(reason);
      expect(freshOrder.codDetails?.refusalRecordedAt).toBeDefined();

      // Zero false payments or collections must be registered
      const collections = await payload.find({
        collection: 'payment-collections',
        where: { order: { equals: order.id } },
      });
      expect(collections.docs.length).toBe(0);
    });

    it('strictly blocks recording cash collection on a refused / cancelled order (CANNOT_COLLECT_CANCELLED_OR_REFUSED_ORDER)', async () => {
      const order = await createCustomizedOrder('cod');
      await recordDeliveryRefusal(payload, {
        orderId: order.id,
        refusalReason: 'Package rejected by recipient office security.',
        actor: { id: opsUser.id, roles: opsUser.roles },
      });

      // Attempting to collect payment on the refused order must fail
      await expect(
        recordCodCollection(payload, {
          orderId: order.id,
          collectedAmount: order.total,
          collectorType: 'courier',
          collectorName: 'Bosta Courier 42',
          receiptReference: `REF_COLLECT_${unique()}`,
          actor: { id: opsUser.id, roles: opsUser.roles },
        })
      ).rejects.toThrow('CANNOT_COLLECT_CANCELLED_OR_REFUSED_ORDER');
    });

    it('strictly forbids recording delivery refusal on an already paid order (CANNOT_REFUSE_PAID_ORDER)', async () => {
      const order = await createCustomizedOrder('cod');

      // Collect payment first
      await recordCodCollection(payload, {
        orderId: order.id,
        collectedAmount: order.total,
        collectorType: 'courier',
        collectorName: 'Bosta Courier 42',
        receiptReference: `PAID_COLLECT_${unique()}`,
        actor: { id: opsUser.id, roles: opsUser.roles },
      });

      // Attempting to mark delivery refusal on paid order must be rejected
      await expect(
        recordDeliveryRefusal(payload, {
          orderId: order.id,
          refusalReason: 'Attempting to refuse an already paid order',
          actor: { id: opsUser.id, roles: opsUser.roles },
        })
      ).rejects.toThrow('CANNOT_REFUSE_PAID_ORDER');
    });

    it('supports recording delivery refusal via HTTP route POST /api/payments/cod/refuse with operations auth', async () => {
      const order = await createCustomizedOrder('cod');
      const reason = 'Delivery refused: client company relocated.';

      // Customer attempt -> 403
      const custReq = asReq('http://localhost:3000/api/payments/cod/refuse', customerToken, {
        orderId: order.id,
        refusalReason: reason,
      });
      const custRes = await refuseRoute(custReq);
      expect(custRes.status).toBe(403);

      // Operations attempt -> 200
      const opsReq = asReq('http://localhost:3000/api/payments/cod/refuse', opsToken, {
        orderId: order.id,
        refusalReason: reason,
      });
      const opsRes = await refuseRoute(opsReq);
      expect(opsRes.status).toBe(200);

      const body = await opsRes.json();
      expect(body.success).toBe(true);
      expect(body.status).toBe('DELIVERY_REFUSED_RECORDED');
      expect(body.orderStatus).toBe('cancelled');
      expect(body.fulfillmentStatus).toBe('returned_to_origin');
      expect(body.paymentStatus).toBe('unpaid');
    });
  });
});
