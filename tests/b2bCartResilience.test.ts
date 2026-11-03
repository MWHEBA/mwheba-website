import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload, type Payload } from 'payload';
import configPromise from '../src/payload.config';
import {
  getOrCreateCart,
  addItemToCart,
  updateItemQuantity,
  removeItemFromCart,
  clearPersistentCart,
  getCartSummary,
} from '../src/modules/cart-checkout/services/cartStorage';
import {
  assertCartCanCheckout,
} from '../src/modules/cart-checkout/services/cartCalculator';
import { POST as validateCheckoutRoute } from '../src/app/api/cart/validate-checkout/route';
import { signCartId } from '../src/modules/cart-checkout/logic/cartSession';
import { withCartLock } from '../src/modules/cart-checkout/services/cartStorage';
import { NextRequest } from 'next/server';

describe('B2B-02: Cart Resilience, Product ID MOQ & Separate Printing Fees', () => {
  let payload: Payload;
  const createdCategoryIds: (string | number)[] = [];
  const createdProductIds: (string | number)[] = [];
  const createdVariantTypeIds: (string | number)[] = [];
  const createdVariantOptionIds: (string | number)[] = [];
  const createdCartIds: (string | number)[] = [];

  let physicalProductA: any;
  let physicalProductB: any;
  let serviceProduct: any;
  let variantA1: any; // Black
  let variantA2: any; // Blue

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    // 1. Create Category
    const category = await payload.create({
      collection: 'categories',
      data: {
        title: 'أدوات ومستلزمات مكتبية فاخرة',
        slug: `b2b-cart-cat-${Date.now()}`,
        description: 'تصنيف هدايا الشركات والمستلزمات المكتبية.',
      },
    });
    createdCategoryIds.push(category.id);

    // 2. Create Variant Type (Color) and Options
    const colorType = await payload.create({
      collection: 'variantTypes',
      data: {
        name: 'color',
        label: 'اللون',
      },
    });
    createdVariantTypeIds.push(colorType.id);

    const blackOption = await payload.create({
      collection: 'variantOptions',
      data: {
        variantType: colorType.id,
        label: 'أسود مطفي',
        value: `black-${Date.now()}`,
      },
    });
    createdVariantOptionIds.push(blackOption.id);

    const blueOption = await payload.create({
      collection: 'variantOptions',
      data: {
        variantType: colorType.id,
        label: 'أزرق بترولي',
        value: `blue-${Date.now()}`,
      },
    });
    createdVariantOptionIds.push(blueOption.id);

    // 3. Create Product A (Physical Thermal Flask, MOQ 10, customization fee 35 EGP)
    physicalProductA = await payload.create({
      collection: 'products',
      data: {
        title: 'كوب حراري ذكي فاخر (Product A)',
        slug: `prod-a-flask-${Date.now()}`,
        productType: 'physical',
        minOrderQuantity: 10,
        basePrice: 250,
        customizationFee: 35,
        enableVariants: true,
        variantTypes: [colorType.id],
        category: category.id,
        _status: 'published',
      },
    });
    createdProductIds.push(physicalProductA.id);

    // Create Variants for Product A
    variantA1 = await payload.create({
      collection: 'variants',
      data: {
        title: 'كوب حراري - أسود مطفي',
        product: physicalProductA.id,
        options: [blackOption.id],
        priceInEGP: 250,
        _status: 'published',
      },
    });
    createdVariantIds(variantA1.id);

    variantA2 = await payload.create({
      collection: 'variants',
      data: {
        title: 'كوب حراري - أزرق بترولي',
        product: physicalProductA.id,
        options: [blueOption.id],
        priceInEGP: 270,
        _status: 'published',
      },
    });
    createdVariantIds(variantA2.id);

    // 4. Create Product B (Physical Leather Notebook, MOQ 10, customization fee 20 EGP)
    physicalProductB = await payload.create({
      collection: 'products',
      data: {
        title: 'دفتر جلدي فاخر (Product B)',
        slug: `prod-b-notebook-${Date.now()}`,
        productType: 'physical',
        minOrderQuantity: 10,
        basePrice: 180,
        customizationFee: 20,
        category: category.id,
        _status: 'published',
      },
    });
    createdProductIds.push(physicalProductB.id);

    // 5. Create Service Product (Digital Package, MOQ 1)
    serviceProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'باقة استشارات الهوية التجارية',
        slug: `prod-service-${Date.now()}`,
        productType: 'fixed_service',
        basePrice: 8500,
        category: category.id,
        _status: 'published',
      },
    });
    createdProductIds.push(serviceProduct.id);
  }, 30000);

  function createdVariantIds(id: string | number) {
    // Helper to register variant for teardown
    // Variants are cleaned up through payload
  }

  afterAll(async () => {
    for (const cId of createdCartIds) {
      try {
        await payload.delete({ collection: 'carts', id: cId });
      } catch {}
    }
    for (const pId of createdProductIds) {
      try {
        await payload.delete({ collection: 'products', id: pId });
      } catch {}
    }
    for (const optId of createdVariantOptionIds) {
      try {
        await payload.delete({ collection: 'variantOptions', id: optId });
      } catch {}
    }
    for (const vtId of createdVariantTypeIds) {
      try {
        await payload.delete({ collection: 'variantTypes', id: vtId });
      } catch {}
    }
    for (const catId of createdCategoryIds) {
      try {
        await payload.delete({ collection: 'categories', id: catId });
      } catch {}
    }
  });

  describe('1. Permissive Cart Persistence in PostgreSQL', () => {
    it('persists incomplete quantity (5 units) in PostgreSQL without failing the mutation', async () => {
      const cart = await getOrCreateCart(payload);
      createdCartIds.push(cart.id);

      // Add 5 units of Product A Variant 1
      const summary = await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantA1.id,
        quantity: 5,
      });

      // Verify returned summary
      expect(summary.totalItemsCount).toBe(5);
      expect(summary.subtotal).toBe(1250); // 5 * 250
      expect(summary.canCheckout).toBe(false);
      expect(summary.productGroupings[physicalProductA.id].totalQuantity).toBe(5);
      expect(summary.productGroupings[physicalProductA.id].remainingNeeded).toBe(5);
      expect(summary.productGroupings[physicalProductA.id].isSatisfied).toBe(false);
      expect(summary.validationErrors.length).toBeGreaterThan(0);

      // Verify persistent storage in PostgreSQL
      const persistedCart = await payload.findByID({
        collection: 'carts',
        id: cart.id,
        depth: 1,
      });
      expect(persistedCart.items?.length).toBe(1);
      expect(persistedCart.items?.[0].quantity).toBe(5);
    });
  });

  describe('2. Variant Aggregation Scenario (5 + 5 of Same Product ID)', () => {
    it('aggregates 5 Black + 5 Blue of Product A to satisfy 10 MOQ and allows checkout', async () => {
      const cart = await getOrCreateCart(payload);
      createdCartIds.push(cart.id);

      // 1. Add 5 Black units of Product A
      await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantA1.id,
        quantity: 5,
      });

      // 2. Add 5 Blue units of the SAME Product A
      const summary = await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantA2.id,
        quantity: 5,
      });

      // Assertions
      expect(summary.totalItemsCount).toBe(10);
      const groupA = summary.productGroupings[physicalProductA.id];
      expect(groupA).toBeDefined();
      expect(groupA.totalQuantity).toBe(10); // 5 + 5 = 10
      expect(groupA.isSatisfied).toBe(true);
      expect(groupA.remainingNeeded).toBe(0);
      expect(groupA.variants.length).toBe(2);

      // Financials: (5 * 250) + (5 * 270) = 1250 + 1350 = 2600 EGP
      expect(summary.subtotal).toBe(2600);
      expect(summary.canCheckout).toBe(true);
      expect(summary.validationErrors).toEqual([]);

      // Verify assertCartCanCheckout passes without throwing
      expect(() => assertCartCanCheckout(summary)).not.toThrow();
    });
  });

  describe('3. Cross-Product Isolation Scenario (5 of Product A + 5 of Product B)', () => {
    it('strictly isolates products: 5 of A + 5 of B does NOT satisfy MOQ and blocks checkout', async () => {
      const cart = await getOrCreateCart(payload);
      createdCartIds.push(cart.id);

      // Add 5 of Product A
      await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantA1.id,
        quantity: 5,
      });

      // Add 5 of Product B
      const summary = await addItemToCart(payload, cart.id, {
        productId: physicalProductB.id,
        quantity: 5,
      });

      // Total items in cart is 10, BUT neither product satisfies 10 MOQ
      expect(summary.totalItemsCount).toBe(10);
      expect(summary.productGroupings[physicalProductA.id].totalQuantity).toBe(5);
      expect(summary.productGroupings[physicalProductA.id].isSatisfied).toBe(false);
      expect(summary.productGroupings[physicalProductA.id].remainingNeeded).toBe(5);

      expect(summary.productGroupings[physicalProductB.id].totalQuantity).toBe(5);
      expect(summary.productGroupings[physicalProductB.id].isSatisfied).toBe(false);
      expect(summary.productGroupings[physicalProductB.id].remainingNeeded).toBe(5);

      expect(summary.canCheckout).toBe(false);
      expect(summary.validationErrors.length).toBe(2);

      // Server Checkout Barrier: throws HTTP 422 error
      expect(() => assertCartCanCheckout(summary)).toThrow(/CHECKOUT_MOQ_VIOLATION/);
    });
  });

  describe('4. Separate Printing Fee Itemization (D-017)', () => {
    it('keeps customization fee as a separate, distinct financial line charge', async () => {
      const cart = await getOrCreateCart(payload);
      createdCartIds.push(cart.id);

      // Add 10 units of Product A with artwork attachment and printing notes
      const summary = await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        variantId: variantA1.id,
        quantity: 10,
        artworkAssetId: 'mock-vector-logo-asset-123',
        printingNotes: 'حفر ليزر بدقة عالية على الوجهين للشعار المؤسسي',
      });

      // Base: 10 * 250 = 2500 EGP
      // Customization fee: 10 * 35 = 350 EGP
      // Grand total: 2850 EGP
      expect(summary.subtotal).toBe(2500);
      expect(summary.totalCustomizationFees).toBe(350);
      expect(summary.grandTotal).toBe(2850);
      expect(summary.items[0].customizationFeePerUnit).toBe(35);
      expect(summary.items[0].lineCustomizationFee).toBe(350);
      expect(summary.items[0].lineSubtotal).toBe(2500);
      expect(summary.items[0].lineTotal).toBe(2850);
    });
  });

  describe('5. Direct HTTP API Checkout Gating & Cross-Session Protection', () => {
    it('blocks direct API requests with HTTP 422 when MOQ is violated with verified session cookie', async () => {
      const cart = await getOrCreateCart(payload);
      createdCartIds.push(cart.id);

      // Add only 5 units of Product A
      await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        quantity: 5,
      });

      // Construct a direct HTTP POST request with valid signed session cookie
      const signedCookie = signCartId(cart.id);
      const req = new NextRequest('http://localhost:3000/api/cart/validate-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `mwheba_cart=${signedCookie}`,
        },
      });

      const response = await validateCheckoutRoute(req);
      expect(response.status).toBe(422);

      const json = await response.json();
      expect(json.canCheckout).toBe(false);
      expect(json.error).toBe('CHECKOUT_MOQ_VIOLATION');
      expect(json.validationErrors.length).toBeGreaterThan(0);
      expect(json.productGroupings[physicalProductA.id].remainingNeeded).toBe(5);
    });

    it('approves direct API requests with HTTP 200 when MOQ is met with verified session cookie', async () => {
      const cart = await getOrCreateCart(payload);
      createdCartIds.push(cart.id);

      // Add 10 units of Product A
      await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        quantity: 10,
      });

      const signedCookie = signCartId(cart.id);
      const req = new NextRequest('http://localhost:3000/api/cart/validate-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `mwheba_cart=${signedCookie}`,
        },
      });

      const response = await validateCheckoutRoute(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.canCheckout).toBe(true);
      expect(json.summary.totalItemsCount).toBe(10);
    });

    it('rejects arbitrary or guessed cartId without valid signed cookie with HTTP 403', async () => {
      const targetCart = await getOrCreateCart(payload);
      createdCartIds.push(targetCart.id);

      // Attacker attempts to send cartId in body without session cookie
      const req = new NextRequest('http://localhost:3000/api/cart/validate-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId: targetCart.id }),
      });

      const response = await validateCheckoutRoute(req);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe('FORBIDDEN_CART_ACCESS');
    });

    it('rejects cross-session tampering when body cartId does not match verified session cookie with HTTP 403', async () => {
      const userCart = await getOrCreateCart(payload);
      const victimCart = await getOrCreateCart(payload);
      createdCartIds.push(userCart.id);
      createdCartIds.push(victimCart.id);

      // User holds signed cookie for userCart, but submits victimCart in request body
      const userCookie = signCartId(userCart.id);
      const req = new NextRequest('http://localhost:3000/api/cart/validate-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `mwheba_cart=${userCookie}`,
        },
        body: JSON.stringify({ cartId: victimCart.id }),
      });

      const response = await validateCheckoutRoute(req);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe('FORBIDDEN_CART_ACCESS');
    });
  });

  describe('6. Concurrent Cart Modifications & Concurrency Lock', () => {
    it('serializes 5 concurrent add-to-cart operations on the same cart without data loss', async () => {
      const cart = await getOrCreateCart(payload);
      createdCartIds.push(cart.id);

      // Fire 5 concurrent additions of 2 units each on the exact same cart
      const additions = Array.from({ length: 5 }).map(() =>
        addItemToCart(payload, cart.id, {
          productId: physicalProductA.id,
          variantId: variantA1.id,
          quantity: 2,
        })
      );

      await Promise.all(additions);

      // Verify the final state: 5 * 2 = 10 units in total!
      const finalSummary = await getCartSummary(payload, cart.id);
      expect(finalSummary.totalItemsCount).toBe(10);
      expect(finalSummary.canCheckout).toBe(true);
      expect(finalSummary.productGroupings[physicalProductA.id].totalQuantity).toBe(10);
      expect(finalSummary.subtotal).toBe(2500); // 10 * 250
    });

    it('aborts mutation safely (fail-closed) when database lock is unavailable without silent in-process downgrade', async () => {
      const mockPayloadWithoutPool: any = {
        db: {}, // pool is missing
      };
      await expect(
        withCartLock(mockPayloadWithoutPool, 1234, async () => {
          return 'should not execute';
        })
      ).rejects.toThrow(/DATABASE_LOCK_UNAVAILABLE/);
    });

    it('retries on retryable lock collision and succeeds on subsequent attempt', async () => {
      let attempts = 0;
      const cart = await getOrCreateCart(payload);
      createdCartIds.push(cart.id);

      const result = await withCartLock(payload, cart.id, async () => {
        attempts++;
        if (attempts === 1) {
          const retryableErr: any = new Error('could not serialize access due to concurrent update');
          retryableErr.code = '40001';
          throw retryableErr;
        }
        return 'success_after_retry';
      });

      expect(result).toBe('success_after_retry');
      expect(attempts).toBe(2);
    });
  });

  describe('7. Fixed-Price Service Package Single Unit Checkout', () => {
    it('allows checkout for digital service package with 1 unit', async () => {
      const cart = await getOrCreateCart(payload);
      createdCartIds.push(cart.id);

      const summary = await addItemToCart(payload, cart.id, {
        productId: serviceProduct.id,
        quantity: 1,
      });

      expect(summary.totalItemsCount).toBe(1);
      expect(summary.canCheckout).toBe(true);
      expect(summary.productGroupings[serviceProduct.id].isSatisfied).toBe(true);
      expect(summary.subtotal).toBe(8500);
      expect(() => assertCartCanCheckout(summary)).not.toThrow();
    });
  });

  describe('8. Cart Quantity Update, Removal and Clear', () => {
    it('updates quantity, removes item, and clears persistent cart cleanly', async () => {
      const cart = await getOrCreateCart(payload);
      createdCartIds.push(cart.id);

      // Add item
      await addItemToCart(payload, cart.id, {
        productId: physicalProductA.id,
        quantity: 10,
      });

      let summary = await getCartSummary(payload, cart.id);
      expect(summary.totalItemsCount).toBe(10);
      const lineItemId = summary.items[0].id;

      // Update quantity to 15
      summary = await updateItemQuantity(payload, cart.id, lineItemId, 15);
      expect(summary.totalItemsCount).toBe(15);
      expect(summary.subtotal).toBe(3750); // 15 * 250

      // Remove item
      summary = await removeItemFromCart(payload, cart.id, lineItemId);
      expect(summary.totalItemsCount).toBe(0);
      expect(summary.canCheckout).toBe(false);

      // Clear cart
      summary = await clearPersistentCart(payload, cart.id);
      expect(summary.items.length).toBe(0);
    });
  });
});
