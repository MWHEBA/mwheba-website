import { describe, it, expect } from 'vitest';
import {
  calculateCartState,
  assertCanCheckout,
  validateCartMoq,
  type CartLineItem,
  type ProductItem,
} from '../src/modules/cart-checkout/logic/moqEngine';
import { createOrderSnapshot } from '../src/modules/orders/logic/orderSnapshotEngine';

describe('B2B Core Commerce: MOQ & Order Snapshot Engine', () => {
  const catalog: Record<string, ProductItem> = {
    prod_a: {
      id: 'prod_a',
      title: 'Premium Mug',
      itemType: 'physical',
      minOrderQuantity: 10,
      basePrice: 250,
      customizationFee: 35,
    },
    prod_b: {
      id: 'prod_b',
      title: 'Ceramic Mug',
      itemType: 'physical',
      minOrderQuantity: 10,
      basePrice: 150,
    },
    serv_1: {
      id: 'serv_1',
      title: 'Brand Identity',
      itemType: 'service',
      minOrderQuantity: 1,
      basePrice: 15000,
    },
  };

  describe('Mixed-Variant MOQ (POC-01 / D-009)', () => {
    it('aggregates variants of same Product ID to satisfy MOQ of 10', () => {
      const items: CartLineItem[] = [
        { id: '1', productId: 'prod_a', variantId: 'var_black', quantity: 5 },
        { id: '2', productId: 'prod_a', variantId: 'var_white', quantity: 5 },
      ];
      const state = calculateCartState(items, catalog);
      expect(state.canCheckout).toBe(true);
      expect(state.subtotal).toBe(2500);
      expect(state.productStatuses['prod_a'].isSatisfied).toBe(true);
    });

    it('rejects checkout when total units across variants is under 10', () => {
      const items: CartLineItem[] = [
        { id: '1', productId: 'prod_a', variantId: 'var_black', quantity: 4 },
        { id: '2', productId: 'prod_a', variantId: 'var_white', quantity: 5 },
      ];
      const state = calculateCartState(items, catalog);
      expect(state.canCheckout).toBe(false);
      expect(state.productStatuses['prod_a'].remainingNeeded).toBe(1);
      expect(() => assertCanCheckout(items, catalog)).toThrow(/requires a minimum order quantity of 10/);
    });
  });

  describe('Cross-Product Isolation (POC-02B / D-009)', () => {
    it('strictly prevents pooling across different products', () => {
      const items: CartLineItem[] = [
        { id: '1', productId: 'prod_a', quantity: 5 },
        { id: '2', productId: 'prod_b', quantity: 5 },
      ];
      const state = calculateCartState(items, catalog);
      expect(state.canCheckout).toBe(false);
      expect(state.productStatuses['prod_a'].isSatisfied).toBe(false);
      expect(state.productStatuses['prod_b'].isSatisfied).toBe(false);
    });
  });

  describe('Order Snapshot & Immutability (POC-05 / D-010 / D-017)', () => {
    it('creates frozen order snapshot with separate itemized printing fees and integer cents', () => {
      const items: CartLineItem[] = [
        { id: '1', productId: 'prod_a', quantity: 10, artworkAssetId: 'art_123', printingNotes: 'Laser front' },
      ];
      const customer = { name: 'Acme Corp', email: 'acme@test.com', phone: '01000000000' };
      const fulfillment = { type: 'delivery' as const, shippingFee: 100 };

      const order = createOrderSnapshot(items, catalog, customer, fulfillment, 'cod');
      expect(order.orderStatus).toBe('confirmed');
      expect(order.paymentStatus).toBe('unpaid');
      expect(order.financials.itemsSubtotal).toBe(2500);
      expect(order.financials.totalCustomizationFees).toBe(350); // 10 * 35
      expect(order.financials.shippingFee).toBe(100);
      expect(order.financials.grandTotal).toBe(2950);
      expect(order.financials.grandTotalCents).toBe(295000);
      expect(order.items[0].artworkAssetId).toBe('art_123');
    });

    it('rejects COD for digital services per D-021', () => {
      const items: CartLineItem[] = [
        { id: '1', productId: 'serv_1', quantity: 1 },
      ];
      const customer = { name: 'Digital Buyer', email: 'buyer@test.com', phone: '01000000000' };
      const fulfillment = { type: 'office_pickup' as const, shippingFee: 0 };

      expect(() => createOrderSnapshot(items, catalog, customer, fulfillment, 'cod')).toThrow(
        /COD_PROHIBITED_FOR_DIGITAL/
      );
    });
  });
});
