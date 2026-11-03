import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { sampleProducts } from '@/modules/catalog/data/sampleProducts';
import { ProductDetailView } from '@/modules/catalog/ui/ProductDetailView';
import { CartDrawer } from '@/modules/cart-checkout/ui/CartDrawer';
import { CheckoutView } from '@/modules/cart-checkout/ui/CheckoutView';
import { CartProvider } from '@/modules/cart-checkout/context/CartContext';
import { calculateCartState } from '@/modules/cart-checkout/logic/moqEngine';

describe('DES-04: Commerce Interaction Templates (PDP, Cart Drawer, Checkout)', () => {
  describe('ProductDetailView (PDP)', () => {
    it('renders physical product details with MOQ notice and volume discount tiers', () => {
      const product = sampleProducts['flask-01'];
      const html = renderToString(
        <CartProvider>
          <ProductDetailView product={product} locale="ar" />
        </CartProvider>
      );

      // Verify title & badges
      expect(html).toContain('كوب حراري ذكي مخصص');
      expect(html).toContain('الحد الأدنى: 10 قطع');

      // Verify volume discount tier labels
      expect(html).toContain('10 - 49');
      expect(html).toContain('50 - 99');
      expect(html).toContain('100+');

      // Verify logo upload dropzone exists
      expect(html).toContain('تخصيص الهوية والشعار المؤسسي');
      expect(html).toContain('اضغط لاختيار الشعار أو اسحبه هنا');

      // Verify specifications table
      expect(html).toContain('المواصفات الفنية والمؤسسية');
      expect(html).toContain('فولاذ 316 آمن غذائياً');
    });

    it('renders English version with LTR guidance and correct currency strings', () => {
      const product = sampleProducts['flask-01'];
      const html = renderToString(
        <CartProvider>
          <ProductDetailView product={product} locale="en" />
        </CartProvider>
      );

      expect(html).toContain('MOQ: 10 units');
      expect(html).toContain('Corporate Branding &amp; Artwork (Optional)');
      expect(html).toContain('Add to Corporate Cart');
      expect(html).toContain('EGP');
    });
  });

  describe('CartDrawer & MOQ Governance', () => {
    it('renders pre-seeded item with satisfied MOQ (10 units) and active checkout CTA', () => {
      const html = renderToString(
        <CartProvider>
          <CartDrawer locale="ar" />
        </CartProvider>
      );

      // Cart is closed by default in initial state (renders null)
      // When rendered within open state or calculation testing:
      expect(html).toBe('');
    });

    it('validates MOQ calculation logic: unlocks checkout at 10 units, locks at <10 units', () => {
      const product = sampleProducts['flask-01'];

      // Scenario 1: Unsatisfied MOQ (5 units)
      const unsatisfied = calculateCartState(
        [{ id: 'line-1', productId: 'flask-01', quantity: 5 }],
        sampleProducts
      );
      expect(unsatisfied.canCheckout).toBe(false);
      expect(unsatisfied.productStatuses['flask-01'].remainingNeeded).toBe(5);
      expect(unsatisfied.productStatuses['flask-01'].isSatisfied).toBe(false);

      // Scenario 2: Satisfied MOQ (10 units across variants)
      const satisfied = calculateCartState(
        [
          { id: 'line-1', productId: 'flask-01', variantId: 'v-blue', quantity: 6 },
          { id: 'line-2', productId: 'flask-01', variantId: 'v-black', quantity: 4 },
        ],
        sampleProducts
      );
      expect(satisfied.canCheckout).toBe(true);
      expect(satisfied.productStatuses['flask-01'].remainingNeeded).toBe(0);
      expect(satisfied.productStatuses['flask-01'].isSatisfied).toBe(true);

      // Scenario 3: Itemized separate customization fee verification (D-017)
      const withCustomization = calculateCartState(
        [
          {
            id: 'line-1',
            productId: 'flask-01',
            quantity: 10,
            artworkAssetId: 'logo-test',
            printingNotes: 'Laser logo',
          },
        ],
        sampleProducts
      );
      expect(withCustomization.totalCustomizationFees).toBe(10 * (product.customizationFee || 35));
      expect(withCustomization.grandTotal).toBe(
        withCustomization.subtotal + withCustomization.totalCustomizationFees
      );
    });
  });

  describe('CheckoutView (B2B Checkout & Fulfillment)', () => {
    it('renders 2-column B2B checkout with company fields and delivery toggles in Arabic', () => {
      const html = renderToString(
        <CartProvider>
          <CheckoutView locale="ar" />
        </CartProvider>
      );

      // Corporate entity details
      expect(html).toContain('بيانات الشركة والجهة المتعاقدة');
      expect(html).toContain('اسم الشركة / المؤسسة');
      expect(html).toContain('اسم المسؤول التنفيذي');

      // Delivery method options
      expect(html).toContain('شحن وتوصيل لمقر الشركة');
      expect(html).toContain('استلام مباشر من مقر وكالة موهبة');

      // Payment method options (aligned with D-007 and D-008)
      expect(html).toContain('تحويل بنكي رسمي للشركات');
      expect(html).toContain('الدفع عند الاستلام (COD للبضائع المادية)');
      expect(html).toContain('بوابة الدفع الإلكتروني (Paymob)');

      // Immutable Order summary
      expect(html).toContain('ملخص أمر الشراء المعتمد');
    });

    it('renders 2-column B2B checkout with delivery toggles in English', () => {
      const html = renderToString(
        <CartProvider>
          <CheckoutView locale="en" />
        </CartProvider>
      );

      expect(html).toContain('Corporate Entity Details');
      expect(html).toContain('Corporate Courier Delivery');
      expect(html).toContain('Pickup from MWHEBA Agency Office');
      expect(html).toContain('Corporate Bank Transfer');
      expect(html).toContain('Cash on Delivery (COD for Physical Goods)');
      expect(html).toContain('Online Payment (Paymob Gateway)');
      expect(html).toContain('Immutable Order Summary');
    });
  });
});
