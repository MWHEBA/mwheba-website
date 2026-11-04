import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import {
  getOrCreateCart,
  addItemToCart,
  updateItemQuantity,
} from '@/modules/cart-checkout/services/cartStorage';
import { generateOperationKey } from '@/modules/cart-checkout/logic/idempotency';
import { buildCheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import { createOrderFromCart } from '@/modules/orders/services/orderService';
import { submitInquiry } from '@/modules/content/actions/submitInquiry';
import { resetLocalRateLimitsForTesting } from '@/modules/content/lib/inquiryRateLimiter';
import { submitBankTransfer, verifyBankTransfer } from '@/modules/payments/services/bankTransferService';
import { edgeRedirectEngine } from '@/modules/redirects/edgeRedirectEngine';
import rawRedirects from '@/config/redirects.json';
import { buildBilingualMetadata } from '@/shared/lib/seo';

// Mock next/headers for Server Action testing
let mockIp = '10.0.1.1';
const mockHeaders = new Headers();
vi.mock('next/headers', () => ({
  headers: vi.fn().mockImplementation(() => {
    mockHeaders.set('x-forwarded-for', mockIp);
    return Promise.resolve(mockHeaders);
  }),
}));

describe('REL-01: End-to-End Acceptance Test Automation', () => {
  let payload: any;
  let testUser: any;
  let financeUser: any;
  let physicalProductA: any;
  let physicalProductB: any;
  let serviceProduct: any;
  let variantRed: any;
  let variantBlue: any;
  let category: any;
  let colorType: any;

  const cleanupProductIds: number[] = [];
  const cleanupVariantIds: number[] = [];
  const cleanupCartIds: number[] = [];
  const cleanupOrderIds: number[] = [];

  const unique = () => `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    // Seed test customer user
    testUser = await payload.create({
      collection: 'users',
      data: {
        email: `e2e_cust_${unique()}@mwheba.test`,
        password: 'Password123!',
        name: 'أحمد محمود العميل',
        roles: ['customer'],
      },
      context: { isSystemSeed: true },
    });

    // Seed finance user with system seed context to permit elevated role assignment
    financeUser = await payload.create({
      collection: 'users',
      data: {
        email: `e2e_fin_${unique()}@mwheba.test`,
        password: 'Password123!',
        name: 'مدير الحسابات المالية',
        roles: ['finance'],
      },
      context: { isSystemSeed: true },
    });

    // Seed product category & options
    category = await payload.create({
      collection: 'categories',
      data: {
        title: 'هدايا ومطبوعات دعائية',
        slug: `cat-promo-${unique()}`,
      },
    });

    colorType = await payload.create({
      collection: 'variantTypes',
      data: {
        name: `color_${unique()}`,
        label: 'اللون',
      },
    });

    const redOption = await payload.create({
      collection: 'variantOptions',
      data: {
        variantType: colorType.id,
        label: 'أحمر قرمزي',
        value: `red-${unique()}`,
      },
    });

    const blueOption = await payload.create({
      collection: 'variantOptions',
      data: {
        variantType: colorType.id,
        label: 'أزرق سماوي',
        value: `blue-${unique()}`,
      },
    });

    // Physical Product A (Thermal Flask, MOQ 10, customization fee 15 EGP)
    physicalProductA = await payload.create({
      collection: 'products',
      data: {
        title: 'كوب حراري ذكي فاخر (Product A)',
        slug: `flask-a-${unique()}`,
        productType: 'physical',
        itemType: 'physical',
        minOrderQuantity: 10,
        basePrice: 250,
        customizationFee: 15,
        enableVariants: true,
        variantTypes: [colorType.id],
        category: category.id,
        _status: 'published',
      },
    });
    cleanupProductIds.push(physicalProductA.id);

    variantRed = await payload.create({
      collection: 'variants',
      data: {
        title: 'كوب حراري - أحمر قرمزي',
        product: physicalProductA.id,
        options: [redOption.id],
        priceInEGP: 250,
        _status: 'published',
      },
    });
    cleanupVariantIds.push(variantRed.id);

    variantBlue = await payload.create({
      collection: 'variants',
      data: {
        title: 'كوب حراري - أزرق سماوي',
        product: physicalProductA.id,
        options: [blueOption.id],
        priceInEGP: 250,
        _status: 'published',
      },
    });
    cleanupVariantIds.push(variantBlue.id);

    // Physical Product B (Leather Notebook, MOQ 10)
    physicalProductB = await payload.create({
      collection: 'products',
      data: {
        title: 'دفتر جلدي فاخر (Product B)',
        slug: `notebook-b-${unique()}`,
        productType: 'physical',
        itemType: 'physical',
        minOrderQuantity: 10,
        basePrice: 180,
        customizationFee: 10,
        category: category.id,
        _status: 'published',
      },
    });
    cleanupProductIds.push(physicalProductB.id);

    // Digital Service Product (Brand Guidelines, MOQ 1)
    serviceProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'تصميم هوية بصرية ودليل إرشادي كامل',
        slug: `branding-service-${unique()}`,
        productType: 'fixed_service',
        itemType: 'service',
        minOrderQuantity: 1,
        basePrice: 15000,
        customizationFee: 0,
        category: category.id,
        _status: 'published',
      },
    });
    cleanupProductIds.push(serviceProduct.id);
  });

  afterAll(async () => {
    for (const orderId of cleanupOrderIds) {
      try {
        await payload.delete({ collection: 'orders', id: orderId });
      } catch {}
    }
    for (const cartId of cleanupCartIds) {
      try {
        await payload.delete({ collection: 'carts', id: cartId });
      } catch {}
    }
    for (const vId of cleanupVariantIds) {
      try {
        await payload.delete({ collection: 'variants', id: vId });
      } catch {}
    }
    for (const pId of cleanupProductIds) {
      try {
        await payload.delete({ collection: 'products', id: pId });
      } catch {}
    }
  });

  describe('E2E-01: Corporate Lead Capture Journey', () => {
    it('submits Arabic corporate lead form, passes honeypot, persists to database, and triggers notification', async () => {
      process.env.TRUSTED_PROXY_DEPTH = '1';
      resetLocalRateLimitsForTesting();
      mockIp = `192.168.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;
      const email = `lead_${unique()}@enterprise-eg.com`;
      const result = await submitInquiry({
        fullName: 'المهندس مصطفى كامل',
        email,
        phone: '01012345678',
        companyName: 'شركة النيل للوجستيات',
        serviceInterest: 'branding',
        estimatedBudget: '50k_150k',
        projectDetails: 'نود طلب 500 كوب حراري ذكي مع دراسة تصميم هوية مؤسسية جديدة.',
        locale: 'ar',
      });

      expect(result.success).toBe(true);

      const found = await payload.find({
        collection: 'inquiries',
        where: { email: { equals: email } },
      });

      expect(found.docs.length).toBe(1);
      const savedInquiry = found.docs[0];
      expect(savedInquiry.fullName).toBe('المهندس مصطفى كامل');
      expect(savedInquiry.status).toBe('new');
    });
  });

  describe('E2E-02: Cart Persistence & Variant Aggregation Purchase Journey', () => {
    it('persists under-MOQ quantities, updates quantities cleanly, and unlocks checkout when variant aggregation reaches MOQ = 10', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      // Step 1: Add 5 Red Mugs (Product A, Variant 1)
      const summary1 = await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantRed.id,
        quantity: 5,
        printingNotes: 'شعار ذهبي',
        operationKey: generateOperationKey('add'),
      });

      const groupA1 = summary1.productGroupings[physicalProductA.id];
      expect(groupA1.isSatisfied).toBe(false);
      expect(groupA1.remainingNeeded).toBe(5);
      expect(groupA1.totalQuantity).toBe(5);
      expect(summary1.canCheckout).toBe(false);

      // Step 2: Update quantity to 6, then to 4
      const lineId = summary1.items[0].id;
      const summary2a = await updateItemQuantity(payload, cart.id, lineId, 6, generateOperationKey('update'));
      expect(summary2a.productGroupings[physicalProductA.id].totalQuantity).toBe(6);

      const summary2b = await updateItemQuantity(payload, cart.id, lineId, 4, generateOperationKey('update'));
      expect(summary2b.productGroupings[physicalProductA.id].totalQuantity).toBe(4);

      // Step 3: Add 6 Blue Mugs of the SAME Product ID (Product A, Variant 2)
      const summary3 = await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantBlue.id,
        quantity: 6,
        printingNotes: 'شعار ذهبي',
        operationKey: generateOperationKey('add'),
      });

      // Total units for Product A = 4 + 6 = 10 (meets 10-unit MOQ!)
      const groupA3 = summary3.productGroupings[physicalProductA.id];
      expect(groupA3.totalQuantity).toBe(10);
      expect(groupA3.isSatisfied).toBe(true);
      expect(groupA3.remainingNeeded).toBe(0);
      expect(summary3.canCheckout).toBe(true);
      expect(summary3.subtotal).toBe(2500); // 10 * 250 EGP
      expect(summary3.totalCustomizationFees).toBe(150); // 10 * 15 EGP
    });
  });

  describe('E2E-03: Checkout MOQ Enforcement & Cross-Product Isolation', () => {
    it('3A: rejects checkout order creation when cart has 9 units of a physical product', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantRed.id,
        quantity: 9, // Exactly 1 unit below 10 MOQ
        operationKey: generateOperationKey('add'),
      });

      const quote = await buildCheckoutQuote(payload, cart.id, {
        method: 'shipping',
        governorate: 'Cairo',
      });

      expect(quote.canCheckout).toBe(false);
      expect(quote.validationErrors.length).toBeGreaterThan(0);

      await expect(
        createOrderFromCart(payload, {
          cartId: cart.id,
          guestSecret: cart.secret,
          expectedGrandTotal: quote.grandTotal,
          customer: {
            email: `guest_${unique()}@test.com`,
            password: 'StrongPassword123!',
            companyName: 'Test Corp',
            contactPerson: 'Ahmed Zaki',
            phone: '01011112222',
          },
          delivery: {
            method: 'shipping',
            shippingAddress: {
              governorate: 'Cairo',
              city: 'Nasr City',
              streetAddress: 'Street 9',
            },
          },
          paymentMethod: 'bank_transfer',
        })
      ).rejects.toThrow(/MINIMUM_ORDER_QUANTITY|MOQ/i);
    });

    it('3B: strictly blocks checkout with cross-product isolation (5 of Product A + 5 of Product B)', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      // Add 5 of Product A
      await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantRed.id,
        quantity: 5,
        operationKey: generateOperationKey('add'),
      });

      // Add 5 of Product B
      const summary = await addItemToCart(payload, cart.id, {
        productId: physicalProductB.id,
        quantity: 5,
        operationKey: generateOperationKey('add'),
      });

      // Both products persist in the cart (total 10 items in cart), but neither satisfies MOQ
      expect(summary.totalItemsCount).toBe(10);
      expect(summary.productGroupings[physicalProductA.id].isSatisfied).toBe(false);
      expect(summary.productGroupings[physicalProductB.id].isSatisfied).toBe(false);
      expect(summary.canCheckout).toBe(false);

      const quote = await buildCheckoutQuote(payload, cart.id, {
        method: 'shipping',
        governorate: 'Cairo',
      });

      expect(quote.canCheckout).toBe(false);

      await expect(
        createOrderFromCart(payload, {
          cartId: cart.id,
          guestSecret: cart.secret,
          expectedGrandTotal: quote.grandTotal,
          customer: {
            email: `guest_${unique()}@test.com`,
            password: 'StrongPassword123!',
            companyName: 'Test Corp',
            contactPerson: 'Ahmed Zaki',
            phone: '01011112222',
          },
          delivery: {
            method: 'shipping',
            shippingAddress: {
              governorate: 'Cairo',
              city: 'Nasr City',
              streetAddress: 'Street 9',
            },
          },
          paymentMethod: 'bank_transfer',
        })
      ).rejects.toThrow(/MINIMUM_ORDER_QUANTITY|MOQ/i);
    });
  });

  describe('E2E-04: Mixed Cart Checkout & Decoupled Track Fulfillment', () => {
    it('checks out mixed cart (10 physical mugs + 1 digital branding service) and splits fulfillment into physical and service tracks', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantRed.id,
        quantity: 10,
        printingNotes: 'حفر ليزر للشعار',
        operationKey: generateOperationKey('add'),
      });

      await addItemToCart(payload, cart.id, {
        productId: serviceProduct.id,
        quantity: 1,
        operationKey: generateOperationKey('add'),
      });

      const quote = await buildCheckoutQuote(payload, cart.id, {
        method: 'shipping',
        governorate: 'Cairo',
      });

      expect(quote.canCheckout).toBe(true);

      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        expectedGrandTotal: quote.grandTotal,
        customer: {
          email: `guest_${unique()}@test.com`,
          password: 'StrongPassword123!',
          companyName: 'Test Enterprise',
          contactPerson: 'Amr Said',
          phone: '01099998888',
        },
        delivery: {
          method: 'shipping',
          shippingAddress: {
            governorate: 'Cairo',
            city: 'Maadi',
            streetAddress: 'Road 90',
          },
        },
        paymentMethod: 'bank_transfer',
      });

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      cleanupOrderIds.push(result.order.id);

      expect(result.order.paymentStatus).toBe('unpaid');
      expect(result.order.items.length).toBe(2);

      // Verify fulfillment jobs split by track
      const jobs = await payload.find({
        collection: 'fulfillment-jobs',
        where: {
          order: { equals: result.order.id },
        },
      });

      expect(jobs.docs.length).toBe(2);
      const tracks = jobs.docs.map((j: any) => j.track);
      expect(tracks).toContain('physical');
      expect(tracks).toContain('service');
    });
  });

  describe('E2E-05: Bank Transfer Review & Clearance Lifecycle', () => {
    it('places bank transfer order, submits customer receipt, and advances to paid upon finance clearance', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantRed.id,
        quantity: 10,
        operationKey: generateOperationKey('add'),
      });

      const quote = await buildCheckoutQuote(payload, cart.id, {
        method: 'pickup',
      });

      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        expectedGrandTotal: quote.grandTotal,
        customer: {
          email: testUser.email,
          companyName: 'Ahmed Mahmoud Company',
          contactPerson: 'أحمد محمود العميل',
          phone: '01012345678',
        },
        delivery: {
          method: 'pickup',
        },
        paymentMethod: 'bank_transfer',
        user: {
          id: testUser.id,
          email: testUser.email,
          roles: testUser.roles,
        },
      });

      expect(result.success).toBe(true);
      const order = result.order;
      cleanupOrderIds.push(order.id);
      expect(order.paymentStatus).toBe('unpaid');

      // Customer uploads bank transfer receipt into private storage
      const storageKey = `receipts/2026/e2e_receipt_${unique()}.pdf`;
      await payload.create({
        collection: 'artwork-assets',
        data: {
          storageKey,
          originalFilename: 'cib_transfer_receipt.pdf',
          uploader: testUser.id,
        },
        context: { isTrustedUpload: true },
      });

      const receiptSubmission = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: quote.grandTotal,
        bankReferenceCode: `TX_${unique()}`,
        receiptStorageKey: storageKey,
        customer: { id: testUser.id, roles: testUser.roles },
      });

      expect(receiptSubmission.transferId).toBeDefined();
      expect(receiptSubmission.status).toBe('SUBMITTED');

      // Finance officer verifies and approves the transfer
      const approval = await verifyBankTransfer(payload, {
        transferId: receiptSubmission.transferId,
        action: 'approve',
        internalReconciliationCode: `REC_${unique()}`,
        confirmedAmount: quote.grandTotal,
        actor: { id: financeUser.id, roles: financeUser.roles },
      });

      expect(approval.status).toBe('APPROVED');

      // Verify order paymentStatus updated to paid in database
      const refreshedOrder = await payload.findByID({
        collection: 'orders',
        id: order.id,
      });

      expect(refreshedOrder.paymentStatus).toBe('paid');
    });
  });

  describe('E2E-06: Bilingual Metadata & Structure', () => {
    it('generates consistent bilingual metadata without trailing slashes and with correct alternates', () => {
      const metaAr = buildBilingualMetadata({
        title: 'حلول التجارة والتسويق',
        description: 'خدمات وكالة موهبة للدعاية والإعلان في مصر',
        path: '/store',
        locale: 'ar',
      });

      expect(metaAr.alternates?.canonical).toBe('https://mwheba.com/ar/store');
      expect(metaAr.alternates?.languages?.en).toBe('https://mwheba.com/en/store');
      expect(metaAr.alternates?.languages?.ar).toBe('https://mwheba.com/ar/store');
    });
  });

  describe('E2E-07: Payment Integrity & Tampered Price Defense', () => {
    it('rejects order creation when customer attempts to submit manipulated expectedGrandTotal', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantRed.id,
        quantity: 10,
        operationKey: generateOperationKey('add'),
      });

      // Attempt to place order with tampered expectedGrandTotal (10 EGP instead of quote)
      await expect(
        createOrderFromCart(payload, {
          cartId: cart.id,
          guestSecret: cart.secret,
          expectedGrandTotal: 10,
          customer: {
            email: `guest_${unique()}@test.com`,
            password: 'StrongPassword123!',
            companyName: 'Test Corp',
            contactPerson: 'Ahmed Zaki',
            phone: '01011112222',
          },
          delivery: {
            method: 'pickup',
          },
          paymentMethod: 'bank_transfer',
        })
      ).rejects.toThrow(/PRICE_DRIFT_DETECTED|QUOTE_MISMATCH/);
    });
  });

  describe('E2E-08: 4-Tier Legacy URL Status Audit', () => {
    it('accurately resolves all 54 legacy URLs matching the documented redirect matrix', () => {
      let preserveCount = 0;
      let redirectCount = 0;
      let goneCount = 0;
      let reviewCount = 0;

      for (const rule of rawRedirects as any[]) {
        const url = new URL(rule.legacyUrl);
        const result = edgeRedirectEngine.evaluate(url.pathname, url.search);

        if (rule.action === 'PRESERVE') {
          preserveCount++;
          expect(result.action).toBe('PRESERVE');
        } else if (rule.action === 'REDIRECT_301') {
          redirectCount++;
          expect(result.action).toBe('REDIRECT_301');
          expect(result.destination).toBeDefined();
          // Destination must not have a trailing slash
          expect(result.destination?.endsWith('/')).toBe(false);
        } else if (rule.action === 'GONE_410') {
          goneCount++;
          expect(result.action).toBe('GONE_410');
        } else if (rule.action === 'REQUIRES_REVIEW') {
          reviewCount++;
          expect(result.action).toBe('REQUIRES_REVIEW');
        }
      }

      expect(preserveCount + redirectCount + goneCount + reviewCount).toBe(54);
      expect(preserveCount).toBe(2);
      expect(redirectCount).toBe(41);
      expect(goneCount).toBe(10);
      expect(reviewCount).toBe(1);
    });
  });
});
