import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import { NextRequest } from 'next/server';
import configPromise from '@/payload.config';
import { getOrCreateCart } from '@/modules/cart-checkout/services/cartStorage';
import { buildCheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import { createOrderFromCart } from '@/modules/orders/services/orderService';
import { resolveDeliveryTariff, getCommerceSettings } from '@/modules/orders/services/deliveryTariff';
import { transitionJob, approveProof } from '@/modules/fulfillment/services/fulfillmentService';
import { POST as transitionRoute } from '@/app/api/fulfillment/jobs/[id]/transition/route';

describe('B2B-06: Custom Pricing, Quotations & Operational Settings Engine', () => {
  let payload: any;
  let superAdminUser: any;
  let superAdminToken: string;
  let opsUser: any;
  let opsToken: string;
  let financeUser: any;
  let financeToken: string;
  let customerUser: any;
  let customerToken: string;

  let physicalProduct: any;
  let serviceProduct: any;

  const cleanup = {
    users: [] as any[],
    orders: [] as any[],
    carts: [] as any[],
    products: [] as any[],
  };

  const unique = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  const loginToken = async (email: string, password: string) => {
    const res = await payload.login({ collection: 'users', data: { email, password } });
    return res.token as string;
  };

  const createStaff = async (role: 'super_admin' | 'operations' | 'finance' | 'customer') => {
    const password = 'StaffPassword2026!';
    const user = await payload.create({
      collection: 'users',
      data: { email: `${role}_${unique()}@mwheba.test`, password, roles: [role] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(user.id);
    return { user, token: await loginToken(user.email, password) };
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

  const params = (id: any) => ({ params: Promise.resolve({ id: String(id) }) });

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    const admin = await createStaff('super_admin');
    superAdminUser = admin.user;
    superAdminToken = admin.token;

    const ops = await createStaff('operations');
    opsUser = ops.user;
    opsToken = ops.token;

    const fin = await createStaff('finance');
    financeUser = fin.user;
    financeToken = fin.token;

    const cust = await createStaff('customer');
    customerUser = cust.user;
    customerToken = cust.token;

    physicalProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'B2B-06 Corporate Pen',
        slug: `b06-pen-${unique()}`,
        itemType: 'physical',
        basePrice: 50,
        minOrderQuantity: 10,
        allowArtworkUpload: false,
        _status: 'published',
      },
    });

    serviceProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'B2B-06 SEO Audit Package',
        slug: `b06-seo-${unique()}`,
        itemType: 'service',
        basePrice: 5000,
        minOrderQuantity: 1,
        allowArtworkUpload: false,
        _status: 'published',
      },
    });

    cleanup.products.push(physicalProduct.id, serviceProduct.id);

    // Reset CommerceSettings to known initial defaults for the test run
    await payload.updateGlobal({
      slug: 'commerce-settings',
      data: {
        tariffStatus: 'provisional',
        cairoAndGizaFee: 80,
        alexandriaFee: 90,
        otherGovernoratesFee: 120,
        officePickupFee: 0,
        standardFallbackFee: 150,
        productionPolicy: 'allow_immediate_production',
        emailDispatchMode: 'deferred_review',
        changeLog: [],
      },
      overrideAccess: true,
    });
  });

  afterAll(async () => {
    // Restore permissive review defaults so other test suites are never hindered
    try {
      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: {
          tariffStatus: 'provisional',
          cairoAndGizaFee: 80,
          alexandriaFee: 90,
          otherGovernoratesFee: 120,
          officePickupFee: 0,
          standardFallbackFee: 150,
          productionPolicy: 'allow_immediate_production',
          emailDispatchMode: 'deferred_review',
        },
        overrideAccess: true,
      });
    } catch {}

    const del = async (collection: string, id: any, context?: any) => {
      try {
        await payload.delete({ collection, id, context });
      } catch {
        // best effort
      }
    };
    for (const orderId of cleanup.orders) {
      const briefs = await payload.find({ collection: 'service-briefs', where: { order: { equals: orderId } }, limit: 50, depth: 0 }).catch(() => ({ docs: [] }));
      for (const b of briefs.docs as any[]) await del('service-briefs', b.id);
      const jobs = await payload.find({ collection: 'fulfillment-jobs', where: { order: { equals: orderId } }, limit: 50, depth: 0 }).catch(() => ({ docs: [] }));
      for (const j of jobs.docs as any[]) await del('fulfillment-jobs', j.id);
      await del('orders', orderId);
    }
    for (const id of cleanup.users) await del('users', id);
    for (const id of cleanup.products) await del('products', id);
    for (const id of cleanup.carts) await del('carts', id);
  });

  // ===========================================================================
  // 1. CommerceSettings Global & Role Access Control
  // ===========================================================================
  describe('1. CommerceSettings Global & RBAC Governance', () => {
    it('allows super_admin, finance, and operations to read settings, but restricts updates strictly to super_admin', async () => {
      // 1. Read access
      const readAdmin = await payload.findGlobal({ slug: 'commerce-settings', user: superAdminUser, overrideAccess: false });
      expect(readAdmin).toBeTruthy();
      expect(readAdmin.cairoAndGizaFee).toBe(80);

      const readFinance = await payload.findGlobal({ slug: 'commerce-settings', user: financeUser, overrideAccess: false });
      expect(readFinance).toBeTruthy();

      const readOps = await payload.findGlobal({ slug: 'commerce-settings', user: opsUser, overrideAccess: false });
      expect(readOps).toBeTruthy();

      // Customer read is forbidden
      await expect(
        payload.findGlobal({ slug: 'commerce-settings', user: customerUser, overrideAccess: false })
      ).rejects.toThrow();

      // Anonymous read is forbidden
      await expect(
        payload.findGlobal({ slug: 'commerce-settings', user: null, overrideAccess: false })
      ).rejects.toThrow();

      // 2. Update access: finance and operations cannot modify operational settings
      await expect(
        payload.updateGlobal({
          slug: 'commerce-settings',
          data: { cairoAndGizaFee: 120 },
          user: financeUser,
          overrideAccess: false,
        })
      ).rejects.toThrow();

      await expect(
        payload.updateGlobal({
          slug: 'commerce-settings',
          data: { cairoAndGizaFee: 120 },
          user: opsUser,
          overrideAccess: false,
        })
      ).rejects.toThrow();

      // super_admin update succeeds
      const updated = await payload.updateGlobal({
        slug: 'commerce-settings',
        data: { cairoAndGizaFee: 85 },
        user: superAdminUser,
        overrideAccess: false,
      });
      expect(updated.cairoAndGizaFee).toBe(85);

      // Revert to 80
      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: { cairoAndGizaFee: 80 },
        user: superAdminUser,
        overrideAccess: false,
      });
    });

    it('records an automatic, append-only changeLog entry whenever operational settings are modified', async () => {
      const before: any = await payload.findGlobal({ slug: 'commerce-settings', overrideAccess: true });
      const initialLogCount = Array.isArray(before.changeLog) ? before.changeLog.length : 0;

      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: {
          alexandriaFee: 95,
          productionPolicy: 'require_payment_clearance',
        },
        user: superAdminUser,
        overrideAccess: false,
      });

      const after: any = await payload.findGlobal({ slug: 'commerce-settings', overrideAccess: true });
      expect(after.alexandriaFee).toBe(95);
      expect(after.productionPolicy).toBe('require_payment_clearance');
      expect(after.changeLog.length).toBe(initialLogCount + 1);

      const latestLog = after.changeLog[after.changeLog.length - 1];
      expect(latestLog.changedBy).toBe(`user:#${superAdminUser.id}`);
      expect(latestLog.changesSummary).toContain('alexandriaFee: 90 -> 95');
      expect(latestLog.changesSummary).toContain('productionPolicy: allow_immediate_production -> require_payment_clearance');

      // Reset
      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: {
          alexandriaFee: 90,
          productionPolicy: 'allow_immediate_production',
        },
        user: superAdminUser,
        overrideAccess: false,
      });
    });
  });

  // ===========================================================================
  // 2. Dynamic Tariff & Quote Calculations (D-015 Parameterization)
  // ===========================================================================
  describe('2. Dynamic Tariff & Quote Calculations (D-015)', () => {
    it('calculates checkout quotes using runtime settings and marks provisional status until owner approval', async () => {
      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: physicalProduct.id, quantity: 10 }] },
      });

      // While tariffStatus is provisional
      const quoteProvisional = await buildCheckoutQuote(payload, cart.id, {
        method: 'shipping',
        governorate: 'Cairo',
      });
      expect(quoteProvisional.shippingFee).toBe(80);
      expect(quoteProvisional.isProvisional).toBe(true);
      expect(quoteProvisional.tariffScheduleStatus).toBe('pending_owner_tariff_approval');
      expect(quoteProvisional.grandTotal).toBe(50 * 10 + 80);

      // Super admin updates the Cairo fee to 110 at runtime
      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: { cairoAndGizaFee: 110 },
        user: superAdminUser,
        overrideAccess: false,
      });

      const quoteUpdated = await buildCheckoutQuote(payload, cart.id, {
        method: 'shipping',
        governorate: 'Cairo',
      });
      expect(quoteUpdated.shippingFee).toBe(110);
      expect(quoteUpdated.grandTotal).toBe(50 * 10 + 110);

      // Super admin marks tariff schedule as owner approved
      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: { tariffStatus: 'owner_approved' },
        user: superAdminUser,
        overrideAccess: false,
      });

      const quoteApproved = await buildCheckoutQuote(payload, cart.id, {
        method: 'shipping',
        governorate: 'Cairo',
      });
      expect(quoteApproved.isProvisional).toBe(false);
      expect(quoteApproved.tariffScheduleStatus).toBe('owner_approved');

      // Reset to provisional 80 for remaining tests
      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: {
          tariffStatus: 'provisional',
          cairoAndGizaFee: 80,
        },
        user: superAdminUser,
        overrideAccess: false,
      });
    });
  });

  // ===========================================================================
  // 3. Order Snapshot Immutability (Historical Orders Never Change)
  // ===========================================================================
  describe('3. Order-Level Applied Settings Freeze', () => {
    it('freezes applied tariff and applied production policy into the order record so future settings changes never mutate past orders', async () => {
      // 1. Create order under Cairo fee = 80 and policy = require_payment_clearance
      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: physicalProduct.id, quantity: 10 }] },
      });

      const quote = await buildCheckoutQuote(payload, cart.id, { method: 'shipping', governorate: 'Cairo' });
      expect(quote.shippingFee).toBe(80);

      const email = `frozen_order_${unique()}@mwheba.test`;
      const created = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: { email, password: 'Password2026!', companyName: 'Snapshot Corp', contactPerson: 'CFO', phone: '+201011112222' },
        delivery: {
          method: 'shipping',
          shippingAddress: { governorate: 'Cairo', city: 'Nasr City', streetAddress: 'Abbas El Akkad' },
          expectedShippingFee: 80,
        },
        paymentMethod: 'bank_transfer',
        expectedGrandTotal: quote.grandTotal,
      });
      cleanup.orders.push(created.order.id);
      cleanup.users.push(created.customerId);

      const orderBefore: any = await payload.findByID({ collection: 'orders', id: created.order.id, depth: 0 });
      expect(orderBefore.shippingFee).toBe(80);
      expect(orderBefore.appliedTariff?.amount).toBe(80);
      expect(orderBefore.appliedTariff?.status).toBe('provisional');
      expect(orderBefore.appliedProductionPolicy).toBe('allow_immediate_production');

      // 2. Modify CommerceSettings globally: increase Cairo fee to 250, change pickup fee to 50, and switch policy to require_payment_clearance
      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: {
          cairoAndGizaFee: 250,
          officePickupFee: 50,
          productionPolicy: 'require_payment_clearance',
          tariffStatus: 'owner_approved',
        },
        user: superAdminUser,
        overrideAccess: false,
      });

      // 3. Re-read the historical order: it must remain 100% frozen!
      const orderAfter: any = await payload.findByID({ collection: 'orders', id: created.order.id, depth: 0 });
      expect(orderAfter.shippingFee).toBe(80);
      expect(orderAfter.appliedTariff?.amount).toBe(80);
      expect(orderAfter.appliedTariff?.status).toBe('provisional');
      expect(orderAfter.appliedProductionPolicy).toBe('allow_immediate_production');

      // Reset
      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: {
          cairoAndGizaFee: 80,
          officePickupFee: 0,
          productionPolicy: 'allow_immediate_production',
          tariffStatus: 'provisional',
        },
        user: superAdminUser,
        overrideAccess: false,
      });
    });
  });

  // ===========================================================================
  // 4. Production Policy Gate Enforcement
  // ===========================================================================
  describe('4. Pre-Production Payment Clearance Policy Gate', () => {
    it('blocks physical production (in_printing) for unpaid bank transfers when policy is require_payment_clearance, and releases upon finance clearance', async () => {
      // 1. Set policy to require_payment_clearance
      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: { productionPolicy: 'require_payment_clearance' },
        user: superAdminUser,
        overrideAccess: false,
      });

      // Create a bank transfer order under require_payment_clearance
      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: physicalProduct.id, quantity: 10 }] },
      });

      const quote = await buildCheckoutQuote(payload, cart.id, { method: 'pickup' });
      const email = `policy_strict_${unique()}@mwheba.test`;
      const created = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: { email, password: 'Password2026!', companyName: 'Clearance Test Corp', contactPerson: 'Manager', phone: '+201022223333' },
        delivery: { method: 'pickup' },
        paymentMethod: 'bank_transfer',
        expectedGrandTotal: quote.grandTotal,
      });
      cleanup.orders.push(created.order.id);
      cleanup.users.push(created.customerId);

      const jobs = await payload.find({
        collection: 'fulfillment-jobs',
        where: { order: { equals: created.order.id } },
        depth: 0,
      });
      expect(jobs.totalDocs).toBe(1);
      const jobId = jobs.docs[0].id;
      expect((jobs.docs[0] as any).status).toBe('queued');

      // 2. Production operator attempts to move queued -> in_printing while payment is unpaid
      const attemptRes = await transitionRoute(
        asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to: 'in_printing' }),
        params(jobId)
      );
      expect(attemptRes.status).toBe(403);
      const attemptData = await attemptRes.json();
      expect(attemptData.error).toContain('PAYMENT_CLEARANCE_REQUIRED');

      // Job is still queued in database
      const jobStillQueued: any = await payload.findByID({ collection: 'fulfillment-jobs', id: jobId, depth: 0 });
      expect(jobStillQueued.status).toBe('queued');

      // 3. Customer submits a bank transfer receipt for the exact total
      const transfer = await payload.create({
        collection: 'bank-transfers',
        data: {
          order: created.order.id,
          claimedAmount: quote.grandTotal,
          bankReferenceCode: `WIRE-${unique()}`,
        },
        user: { id: created.customerId, roles: ['customer'] },
      });

      // Finance officer approves and reconciles the transfer with exact piastre matching
      await payload.update({
        collection: 'bank-transfers',
        id: transfer.id,
        data: {
          status: 'approved',
          internalReconciliationCode: `REC-${unique()}`,
          confirmedAmount: quote.grandTotal,
        },
        user: financeUser,
      });

      // 4. Now operator moves queued -> in_printing: succeeds!
      const successRes = await transitionRoute(
        asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to: 'in_printing' }),
        params(jobId)
      );
      expect(successRes.status).toBe(200);

      const jobUpdated: any = await payload.findByID({ collection: 'fulfillment-jobs', id: jobId, depth: 0 });
      expect(jobUpdated.status).toBe('in_printing');
    });

    it('permits immediate physical production for unpaid orders when applied policy is allow_immediate_production', async () => {
      // 1. Set global policy to allow_immediate_production
      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: { productionPolicy: 'allow_immediate_production' },
        user: superAdminUser,
        overrideAccess: false,
      });

      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: physicalProduct.id, quantity: 10 }] },
      });

      const quote = await buildCheckoutQuote(payload, cart.id, { method: 'pickup' });
      const email = `policy_permissive_${unique()}@mwheba.test`;
      const created = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: { email, password: 'Password2026!', companyName: 'Fast Production Corp', contactPerson: 'Director', phone: '+201033334444' },
        delivery: { method: 'pickup' },
        paymentMethod: 'bank_transfer',
        expectedGrandTotal: quote.grandTotal,
      });
      cleanup.orders.push(created.order.id);
      cleanup.users.push(created.customerId);

      const order: any = await payload.findByID({ collection: 'orders', id: created.order.id, depth: 0 });
      expect(order.appliedProductionPolicy).toBe('allow_immediate_production');
      expect(order.paymentStatus).toBe('unpaid');

      const jobs = await payload.find({
        collection: 'fulfillment-jobs',
        where: { order: { equals: created.order.id } },
        depth: 0,
      });
      const jobId = jobs.docs[0].id;

      // 2. Operator advances to in_printing while unpaid: succeeds under permissive policy
      const res = await transitionRoute(
        asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to: 'in_printing' }),
        params(jobId)
      );
      expect(res.status).toBe(200);

      const job: any = await payload.findByID({ collection: 'fulfillment-jobs', id: jobId, depth: 0 });
      expect(job.status).toBe('in_printing');

      // Reset to default permissive review mode
      await payload.updateGlobal({
        slug: 'commerce-settings',
        data: { productionPolicy: 'allow_immediate_production' },
        user: superAdminUser,
        overrideAccess: false,
      });
    });

    it('allows Cash on Delivery (COD) physical orders to advance without upfront payment (fulfillment decoupled from collection)', async () => {
      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: physicalProduct.id, quantity: 10 }] },
      });

      const quote = await buildCheckoutQuote(payload, cart.id, { method: 'shipping', governorate: 'Cairo' });
      const email = `cod_policy_${unique()}@mwheba.test`;
      const created = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: { email, password: 'Password2026!', companyName: 'COD Corp', contactPerson: 'Buyer', phone: '+201044445555' },
        delivery: {
          method: 'shipping',
          shippingAddress: { governorate: 'Cairo', city: 'Zamalek', streetAddress: '26th of July' },
        },
        paymentMethod: 'cod',
        expectedGrandTotal: quote.grandTotal,
      });
      cleanup.orders.push(created.order.id);
      cleanup.users.push(created.customerId);

      const jobs = await payload.find({
        collection: 'fulfillment-jobs',
        where: { order: { equals: created.order.id } },
        depth: 0,
      });
      const jobId = jobs.docs[0].id;

      // COD order paymentStatus is unpaid, but COD is intentionally decoupled:
      // It can move to in_printing, quality_check, shipped, and delivered while remaining unpaid!
      const res = await transitionRoute(
        asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to: 'in_printing' }),
        params(jobId)
      );
      expect(res.status).toBe(200);

      const job: any = await payload.findByID({ collection: 'fulfillment-jobs', id: jobId, depth: 0 });
      expect(job.status).toBe('in_printing');
    });
  });
});
