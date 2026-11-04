import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import { NextRequest } from 'next/server';
import configPromise from '@/payload.config';
import { getOrCreateCart } from '@/modules/cart-checkout/services/cartStorage';
import { buildCheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import { createOrderFromCart } from '@/modules/orders/services/orderService';
import { validateCodEligibility } from '@/modules/payments/services/codEngine';
import { POST as transitionRoute } from '@/app/api/fulfillment/jobs/[id]/transition/route';

describe('PAY-01: Cash on Delivery (COD) Checkout & Decoupled Fulfillment Engine', () => {
  let payload: any;
  let opsUser: any;
  let opsToken: string;
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

    // Create operations staff user
    const opsPassword = 'OpsPassword2026!';
    opsUser = await payload.create({
      collection: 'users',
      data: { email: `ops_${unique()}@mwheba.test`, password: opsPassword, roles: ['operations'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(opsUser.id);
    opsToken = await loginToken(opsUser.email, opsPassword);

    physicalProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'PAY-01 Premium Leather Notebook',
        slug: `pay01-notebook-${unique()}`,
        itemType: 'physical',
        basePrice: 120,
        minOrderQuantity: 10,
        allowArtworkUpload: false,
        _status: 'published',
      },
    });

    serviceProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'PAY-01 Branding Sprint Package',
        slug: `pay01-branding-${unique()}`,
        itemType: 'service',
        basePrice: 8500,
        minOrderQuantity: 1,
        allowArtworkUpload: false,
        _status: 'published',
      },
    });

    cleanup.products.push(physicalProduct.id, serviceProduct.id);
  });

  afterAll(async () => {
    const del = async (collection: string, id: any, context?: any) => {
      try {
        await payload.delete({ collection, id, context });
      } catch {
        // best effort
      }
    };
    for (const orderId of cleanup.orders) {
      const jobs = await payload.find({ collection: 'fulfillment-jobs', where: { order: { equals: orderId } }, limit: 50, depth: 0 }).catch(() => ({ docs: [] }));
      for (const j of jobs.docs as any[]) await del('fulfillment-jobs', j.id);
      await del('orders', orderId);
    }
    for (const id of cleanup.users) await del('users', id);
    for (const id of cleanup.products) await del('products', id);
    for (const id of cleanup.carts) await del('carts', id);
  });

  // ===========================================================================
  // 1. Pure Unit Validation: validateCodEligibility
  // ===========================================================================
  describe('1. Pure Logic: validateCodEligibility', () => {
    it('approves carts with 100% physical merchandise', () => {
      const verdict = validateCodEligibility([
        { itemType: 'physical' },
        { itemType: 'physical' },
      ]);
      expect(verdict.eligible).toBe(true);
      expect(verdict.code).toBeUndefined();
    });

    it('rejects carts containing only digital services (COD_PROHIBITED_FOR_DIGITAL)', () => {
      const verdict = validateCodEligibility([
        { itemType: 'service' },
      ]);
      expect(verdict.eligible).toBe(false);
      expect(verdict.code).toBe('COD_PROHIBITED_FOR_DIGITAL');
      expect(verdict.message).toContain('strictly prohibited for service packages');
    });

    it('rejects mixed carts containing both physical and digital items (COD_PROHIBITED_FOR_MIXED_CART)', () => {
      const verdict = validateCodEligibility([
        { itemType: 'physical' },
        { itemType: 'service' },
      ]);
      expect(verdict.eligible).toBe(false);
      expect(verdict.code).toBe('COD_PROHIBITED_FOR_MIXED_CART');
      expect(verdict.message).toContain('Mixed carts containing digital services cannot use Cash on Delivery');
    });
  });

  // ===========================================================================
  // 2. COD Order Placement & Snapshot States
  // ===========================================================================
  describe('2. COD Order Placement & Snapshot Lifecycle', () => {
    it('creates a COD order with confirmed status, unpaid paymentStatus, unfulfilled, and pending_collection remittance', async () => {
      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: physicalProduct.id, quantity: 10 }] },
      });

      const quote = await buildCheckoutQuote(payload, cart.id, { method: 'shipping', governorate: 'Cairo' });
      const email = `cod_order_${unique()}@mwheba.test`;

      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: { email, password: 'Password2026!', companyName: 'Al-Ahram Group', contactPerson: 'Procurement Officer', phone: '+201099998888' },
        delivery: {
          method: 'shipping',
          shippingAddress: { governorate: 'Cairo', city: 'Heliopolis', streetAddress: 'El Merghany' },
          expectedShippingFee: quote.shippingFee,
        },
        paymentMethod: 'cod',
        expectedGrandTotal: quote.grandTotal,
      });

      cleanup.orders.push(result.order.id);
      cleanup.users.push(result.customerId);

      const order: any = await payload.findByID({ collection: 'orders', id: result.order.id, depth: 0 });
      expect(order.paymentMethod).toBe('cod');
      expect(order.orderStatus).toBe('confirmed');
      expect(order.paymentStatus).toBe('unpaid');
      expect(order.fulfillmentStatus).toBe('unfulfilled');
      expect(order.remittanceStatus).toBe('pending_collection');
    });

    it('enforces Decision D-021: strictly rejects COD checkout attempts on digital service packages with 422', async () => {
      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: serviceProduct.id, quantity: 1 }] },
      });

      const quote = await buildCheckoutQuote(payload, cart.id, { method: 'pickup' });
      const email = `cod_digital_fail_${unique()}@mwheba.test`;

      await expect(
        createOrderFromCart(payload, {
          cartId: cart.id,
          guestSecret: cart.secret,
          customer: { email, password: 'Password2026!', companyName: 'Digital Buyer', contactPerson: 'Lead', phone: '+201088887777' },
          delivery: { method: 'pickup' },
          paymentMethod: 'cod',
          expectedGrandTotal: quote.grandTotal,
        })
      ).rejects.toThrow(/COD_PROHIBITED_FOR_DIGITAL/);
    });

    it('enforces Decision D-021: strictly rejects COD checkout attempts on mixed carts with 422', async () => {
      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [
            { product: physicalProduct.id, quantity: 10 },
            { product: serviceProduct.id, quantity: 1 },
          ],
        },
      });

      const quote = await buildCheckoutQuote(payload, cart.id, { method: 'pickup' });
      const email = `cod_mixed_fail_${unique()}@mwheba.test`;

      await expect(
        createOrderFromCart(payload, {
          cartId: cart.id,
          guestSecret: cart.secret,
          customer: { email, password: 'Password2026!', companyName: 'Mixed Buyer', contactPerson: 'Lead', phone: '+201077776666' },
          delivery: { method: 'pickup' },
          paymentMethod: 'cod',
          expectedGrandTotal: quote.grandTotal,
        })
      ).rejects.toThrow(/COD_PROHIBITED_FOR_MIXED_CART/);
    });
  });

  // ===========================================================================
  // 3. Fulfillment Decoupling & Payment Protection (PAY-01 Invariant)
  // ===========================================================================
  describe('3. Fulfillment Decoupling & Protection of Unpaid Payment Status', () => {
    it('preserves paymentStatus: unpaid when advancing order through shipped and delivered, and blocks direct manual paid mutation', async () => {
      // 1. Create a physical COD order
      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: physicalProduct.id, quantity: 10 }] },
      });

      const quote = await buildCheckoutQuote(payload, cart.id, { method: 'shipping', governorate: 'Cairo' });
      const email = `cod_fulfillment_${unique()}@mwheba.test`;

      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: { email, password: 'Password2026!', companyName: 'Decoupled Logistics Ltd', contactPerson: 'Dispatcher', phone: '+201066665555' },
        delivery: {
          method: 'shipping',
          shippingAddress: { governorate: 'Cairo', city: 'Maadi', streetAddress: 'Degla' },
          expectedShippingFee: quote.shippingFee,
        },
        paymentMethod: 'cod',
        expectedGrandTotal: quote.grandTotal,
      });

      const orderId = result.order.id;
      cleanup.orders.push(orderId);
      cleanup.users.push(result.customerId);

      const jobs = await payload.find({
        collection: 'fulfillment-jobs',
        where: { order: { equals: orderId } },
        depth: 0,
      });
      expect(jobs.totalDocs).toBe(1);
      const jobId = jobs.docs[0].id;

      // 2. Advance through printing -> quality_check -> shipped
      await transitionRoute(
        asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to: 'in_printing' }),
        params(jobId)
      );
      await transitionRoute(
        asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to: 'quality_check' }),
        params(jobId)
      );
      const shippedRes = await transitionRoute(
        asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to: 'shipped' }),
        params(jobId)
      );
      expect(shippedRes.status).toBe(200);

      // Verify order fulfillmentStatus is shipped and paymentStatus is strictly unpaid
      const orderShipped: any = await payload.findByID({ collection: 'orders', id: orderId, depth: 0 });
      expect(orderShipped.fulfillmentStatus).toBe('shipped');
      expect(orderShipped.paymentStatus).toBe('unpaid');
      expect(orderShipped.remittanceStatus).toBe('pending_collection');

      // 3. Advance to delivered
      const deliveredRes = await transitionRoute(
        asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to: 'delivered' }),
        params(jobId)
      );
      expect(deliveredRes.status).toBe(200);

      // Verify order fulfillmentStatus is delivered and paymentStatus is strictly unpaid
      const orderDelivered: any = await payload.findByID({ collection: 'orders', id: orderId, depth: 0 });
      expect(orderDelivered.fulfillmentStatus).toBe('delivered');
      expect(orderDelivered.paymentStatus).toBe('unpaid');
      expect(orderDelivered.remittanceStatus).toBe('pending_collection');

      // 4. Critical invariant: Direct attempt to manually mark COD order as paid is strictly blocked!
      await expect(
        payload.update({
          collection: 'orders',
          id: orderId,
          data: { paymentStatus: 'paid' },
        })
      ).rejects.toThrow(/DIRECT_COD_PAYMENT_STATUS_MUTATION_FORBIDDEN/);
    });
  });
});
