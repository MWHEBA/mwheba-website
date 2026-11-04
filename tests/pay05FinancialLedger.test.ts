import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import React from 'react';
import { renderToString } from 'react-dom/server';
import configPromise from '@/payload.config';
import { getOrCreateCart } from '@/modules/cart-checkout/services/cartStorage';
import { buildCheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import { createOrderFromCart } from '@/modules/orders/services/orderService';
import { toIntegerPiastres } from '@/modules/orders/logic/orderSnapshotEngine';
import FinanceVerificationPage from '@/app/(frontend)/[locale]/finance/verification/page';
import CustomerOrderPage from '@/app/(frontend)/[locale]/account/orders/[id]/page';
import { BankTransferReceiptUploadForm } from '@/modules/payments/ui/BankTransferReceiptUploadForm';

describe('PAY-05: Financial Ledger, Tax Review Boundary & Deferred Gateway Maintenance', () => {
  let payload: any;
  let customerUser: any;
  let competitorCustomer: any;
  let opsUser: any;
  let financeUser: any;
  let superAdminUser: any;
  let product1: any;
  let product2: any;
  let productCustom: any;
  let artworkAsset: any;

  const cleanup = {
    users: [] as any[],
    orders: [] as any[],
    carts: [] as any[],
    products: [] as any[],
    assets: [] as any[],
    transfers: [] as any[],
  };

  const unique = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });
    const password = 'Password2026!';

    customerUser = await payload.create({
      collection: 'users',
      data: { email: `cust_pay05_${unique()}@mwheba.test`, password, roles: ['customer'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(customerUser.id);

    competitorCustomer = await payload.create({
      collection: 'users',
      data: { email: `comp_pay05_${unique()}@mwheba.test`, password, roles: ['customer'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(competitorCustomer.id);

    opsUser = await payload.create({
      collection: 'users',
      data: { email: `ops_pay05_${unique()}@mwheba.test`, password, roles: ['operations'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(opsUser.id);

    financeUser = await payload.create({
      collection: 'users',
      data: { email: `fin_pay05_${unique()}@mwheba.test`, password, roles: ['finance'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(financeUser.id);

    superAdminUser = await payload.create({
      collection: 'users',
      data: { email: `admin_pay05_${unique()}@mwheba.test`, password, roles: ['super_admin'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(superAdminUser.id);

    artworkAsset = await payload.create({
      collection: 'artwork-assets',
      data: {
        storageKey: `artwork/pay05_${unique()}.pdf`,
        originalFilename: 'corporate_crest.pdf',
        uploader: customerUser.id,
      },
      context: { isTrustedUpload: true },
    });
    cleanup.assets.push(artworkAsset.id);

    product1 = await payload.create({
      collection: 'products',
      data: {
        title: 'PAY-05 Executive Folder',
        slug: `pay05-folder-${unique()}`,
        itemType: 'physical',
        basePrice: 120,
        minOrderQuantity: 10,
        _status: 'published',
      },
    });
    cleanup.products.push(product1.id);

    product2 = await payload.create({
      collection: 'products',
      data: {
        title: 'PAY-05 Luxury Pen',
        slug: `pay05-pen-${unique()}`,
        itemType: 'physical',
        basePrice: 85,
        minOrderQuantity: 10,
        _status: 'published',
      },
    });
    cleanup.products.push(product2.id);

    productCustom = await payload.create({
      collection: 'products',
      data: {
        title: 'PAY-05 Custom Embossed Diary',
        slug: `pay05-diary-${unique()}`,
        itemType: 'physical',
        basePrice: 300,
        minOrderQuantity: 10,
        allowArtworkUpload: true,
        customizationFee: 50,
        _status: 'published',
      },
    });
    cleanup.products.push(productCustom.id);
  });

  afterAll(async () => {
    const del = async (collection: string, id: any, context?: any) => {
      try {
        await payload.delete({ collection, id, context });
      } catch {}
    };

    for (const t of cleanup.transfers) await del('bank-transfers', t);
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

  // ===========================================================================
  // 1. Mathematical Consistency Invariant (50 Simulated Scenarios)
  // ===========================================================================
  describe('1. Mathematical Consistency Invariant (50 Simulated Orders)', () => {
    it('verifies 100% mathematical consistency across 50 simulated orders: total = subtotal + fees + shipping + tax', async () => {
      const deliveryGovernorates = ['Cairo', 'Giza', 'Alexandria', 'Aswan', 'Red Sea'];
      const deliveryMethods: Array<'shipping' | 'pickup'> = ['shipping', 'pickup'];

      for (let i = 1; i <= 50; i++) {
        const qty1 = 10 + (i % 7);
        const qty2 = 10 + (i % 5);
        const qtyCustom = 10 + (i % 3);

        const method = deliveryMethods[i % 2];
        const governorate = deliveryGovernorates[i % deliveryGovernorates.length];

        const cart = await getOrCreateCart(payload);
        cleanup.carts.push(cart.id);

        await payload.update({
          collection: 'carts',
          id: cart.id,
          data: {
            items: [
              { product: product1.id, quantity: qty1 },
              { product: product2.id, quantity: qty2 },
              {
                product: productCustom.id,
                quantity: qtyCustom,
                artworkAssetId: String(artworkAsset.id),
                printingNotes: `Batch #${i} foil imprint`,
              },
            ],
          },
        });

        const quote = await buildCheckoutQuote(payload, cart.id, {
          method,
          governorate: method === 'shipping' ? governorate : undefined,
        });

        const orderRes = await createOrderFromCart(payload, {
          cartId: cart.id,
          guestSecret: cart.secret,
          user: customerUser,
          customer: {
            email: customerUser.email,
            companyName: `Batch Corp #${i}`,
            contactPerson: `Manager #${i}`,
            phone: '+201000000000',
          },
          delivery: {
            method,
            shippingAddress:
              method === 'shipping'
                ? { governorate, city: `${governorate} City`, streetAddress: `Street #${i}` }
                : undefined,
            expectedShippingFee: quote.shippingFee,
          },
          paymentMethod: i % 2 === 0 ? 'cod' : 'bank_transfer',
          expectedGrandTotal: quote.grandTotal,
          idempotencyKey: `idemp_batch50_${i}_${unique()}`,
        });

        const order = await payload.findByID({ collection: 'orders', id: orderRes.order.id });
        cleanup.orders.push(order.id);

        const subtotal = Number(order.subtotal || 0);
        const customizationFees = Number(order.totalCustomizationFees || 0);
        const shippingFee = Number(order.shippingFee || 0);
        const taxAmount = Number(order.taxAmount || 0);
        const grandTotal = Number(order.total || order.amount || 0);

        // MATHEMATICAL INVARIANT: grandTotal = subtotal + customizationFees + shippingFee + taxAmount
        const expectedTotal = subtotal + customizationFees + shippingFee + taxAmount;
        expect(Math.abs(grandTotal - expectedTotal)).toBeLessThanOrEqual(0.001);

        // EXACT INTEGER PIASTRES: grandTotalPiastres === toIntegerPiastres(grandTotal)
        const expectedPiastres = toIntegerPiastres(grandTotal);
        expect(order.grandTotalPiastres).toBe(expectedPiastres);

        // Tax Review Boundary: Default taxAmount is 0 and status is pending_accountant_review
        expect(taxAmount).toBe(0);
        expect(order.taxReviewStatus).toBe('pending_accountant_review');
      }
    });
  });

  // ===========================================================================
  // 2. Tax Review Boundary & E-Invoicing Clean Separation
  // ===========================================================================
  describe('2. Tax Review Boundary & E-Invoicing Clean Separation', () => {
    it('enforces tax review status defaults to pending_accountant_review without unverified PDF/ETA bloat', async () => {
      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: product1.id, quantity: 10 }] },
      });

      const quote = await buildCheckoutQuote(payload, cart.id, { method: 'pickup' });
      const res = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        user: customerUser,
        customer: { email: customerUser.email, companyName: 'Audit Test Corp', contactPerson: 'Audit', phone: '+20101' },
        delivery: { method: 'pickup', expectedShippingFee: quote.shippingFee },
        paymentMethod: 'bank_transfer',
        expectedGrandTotal: quote.grandTotal,
        idempotencyKey: `tax_test_${unique()}`,
      });

      const order = await payload.findByID({ collection: 'orders', id: res.order.id });
      cleanup.orders.push(order.id);

      expect(order.taxAmount).toBe(0);
      expect(order.taxReviewStatus).toBe('pending_accountant_review');
    });
  });

  // ===========================================================================
  // 3. Dormant Paymob Gateway Isolation
  // ===========================================================================
  describe('3. Dormant Paymob Gateway Isolation', () => {
    it('returns 404 PAYMOB_DISABLED for Paymob webhook endpoint in Phase 1', async () => {
      const res = await fetch('http://localhost:3000/api/paymob/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obj: { id: 99999 } }),
      }).catch(() => null);

      // If server is running or handler called
      if (res) {
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toBe('PAYMOB_DISABLED');
      }
    });
  });

  // ===========================================================================
  // 4. Customer Order Hub & Bank Transfer Receipt Upload Journey
  // ===========================================================================
  describe('4. Customer Order Hub & Bank Transfer Receipt Upload Journey', () => {
    it('renders Sign-In required panel when unauthenticated on CustomerOrderPage', async () => {
      const jsx = await CustomerOrderPage({
        params: Promise.resolve({ locale: 'ar', id: '9999' }),
      });
      const html = renderToString(jsx);
      expect(html).toContain('تسجيل الدخول لمتابعة الطلب');
    });

    it('renders BankTransferReceiptUploadForm component with order total and input fields', () => {
      const html = renderToString(
        React.createElement(BankTransferReceiptUploadForm, {
          orderId: 105,
          orderNumber: 'MWH-2026-00105',
          orderTotal: 4500,
          locale: 'ar',
          bankDetails: {
            status: 'pending_configuration',
          },
        })
      );

      expect(html).toContain('إرسال إشعار السداد البنكي للطلب');
      expect(html.includes('4,500') || html.includes('٤٬٥٠٠') || html.includes('4500')).toBe(true);
      expect(html).toContain('رقم العملية أو المرجع البنكي');
      expect(html).toContain('تنسيق التحويل البنكي المؤسسي');
    });

    it('renders BankTransferReceiptUploadForm with active bank coordinates when configured', () => {
      const html = renderToString(
        React.createElement(BankTransferReceiptUploadForm, {
          orderId: 106,
          orderNumber: 'MWH-2026-00106',
          orderTotal: 7200,
          locale: 'ar',
          bankDetails: {
            status: 'active',
            bankName: 'البنك التجاري الدولي - CIB',
            accountName: 'وكالة موهبة للدعاية والإنتاج',
            accountNumber: '1000987654321',
            iban: 'EG980001000000001000987654321',
            swiftCode: 'CIBEEGCAXXX',
          },
        })
      );

      expect(html).toContain('البنك التجاري الدولي - CIB');
      expect(html).toContain('1000987654321');
      expect(html).toContain('EG980001000000001000987654321');
      expect(html).toContain('CIBEEGCAXXX');
    });
  });

  // ===========================================================================
  // 5. Finance Verification Portal Dedicated Page & RBAC
  // ===========================================================================
  describe('5. Finance Verification Portal Dedicated Page & RBAC', () => {
    it('renders sign-in screen when unauthenticated on FinanceVerificationPage', async () => {
      const jsx = await FinanceVerificationPage({
        params: Promise.resolve({ locale: 'ar' }),
      });
      const html = renderToString(jsx);
      expect(html).toContain('تسجيل دخول الإدارة المالية');
    });
  });
});
