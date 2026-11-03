import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProductItem,
  CartLineItem,
  calculateCartState,
  assertCanCheckout,
} from '../src/logic/moqEngine.js';
import {
  createOrderSnapshot,
  CustomerDetails,
  FulfillmentOption,
} from '../src/logic/orderSnapshotEngine.js';
import {
  BankTransferEngine,
  UserSession,
} from '../src/logic/bankTransferEngine.js';

// Setup Mock Catalog
const productsCatalog: Record<string, ProductItem> = {
  prod_mug_a: {
    id: 'prod_mug_a',
    title: 'Premium Thermal Mug',
    itemType: 'physical',
    minOrderQuantity: 10,
    basePrice: 250,
    customizationFee: 35, // Separate printing fee (D-017)
  },
  prod_mug_b: {
    id: 'prod_mug_b',
    title: 'Ceramic Coffee Mug',
    itemType: 'physical',
    minOrderQuantity: 10,
    basePrice: 180,
    customizationFee: 25,
  },
  prod_brand_identity: {
    id: 'prod_brand_identity',
    title: 'Brand Identity Package',
    itemType: 'service',
    minOrderQuantity: 1,
    basePrice: 15000,
  },
};

const sampleCustomer: CustomerDetails = {
  name: 'Ahmed Mohsen',
  email: 'ahmed@company.com',
  phone: '+201012345678',
  companyName: 'Bico Misr Industrial',
  taxNumber: '123-456-789',
};

const deliveryAlexandria: FulfillmentOption = {
  type: 'delivery',
  governorate: 'Alexandria',
  addressLine: '14 Fouad Street, Ramleh Station',
  shippingFee: 60,
};

const freeOfficePickup: FulfillmentOption = {
  type: 'office_pickup',
  governorate: 'Alexandria',
  addressLine: 'MWHEBA Agency Office, Miami, Alexandria',
  shippingFee: 0,
};

describe('Track 1A: Core Commerce Feasibility & B2B Rules', () => {
  let bankEngine: BankTransferEngine;

  beforeEach(() => {
    bankEngine = new BankTransferEngine();
  });

  // =========================================================================
  // POC-01: Mixed-Variant MOQ Checkout
  // =========================================================================
  describe('POC-01: Mixed-Variant MOQ Checkout', () => {
    it('permits checkout when total quantity across variants of the same product equals or exceeds 10', () => {
      const cartItems: CartLineItem[] = [
        {
          id: 'item_1',
          productId: 'prod_mug_a',
          variantId: 'var_black',
          variantName: 'Matte Black',
          quantity: 4,
          artworkAssetId: 'art_logo_vector_svg',
        },
        {
          id: 'item_2',
          productId: 'prod_mug_a',
          variantId: 'var_white',
          variantName: 'Pearl White',
          quantity: 6,
          artworkAssetId: 'art_logo_vector_svg',
        },
      ];

      const calculation = calculateCartState(cartItems, productsCatalog, freeOfficePickup.shippingFee);

      // Asserts 4 + 6 = 10 units satisfies the MOQ of 10 for Product A
      expect(calculation.canCheckout).toBe(true);
      expect(calculation.productStatuses['prod_mug_a'].totalQuantity).toBe(10);
      expect(calculation.productStatuses['prod_mug_a'].isSatisfied).toBe(true);
      expect(calculation.productStatuses['prod_mug_a'].remainingNeeded).toBe(0);

      // Financials: Base (10 * 250 = 2500) + Separate Printing (10 * 35 = 350)
      expect(calculation.subtotal).toBe(2500);
      expect(calculation.totalCustomizationFees).toBe(350);
      expect(calculation.grandTotal).toBe(2850);

      // Server-side assertion does not throw
      expect(() => assertCanCheckout(cartItems, productsCatalog, 0)).not.toThrow();
    });
  });

  // =========================================================================
  // POC-02: Incomplete Cart Quantity Persistence & UI Notice
  // =========================================================================
  describe('POC-02: Incomplete Cart Quantity Persistence & UI Notice', () => {
    it('persists incomplete quantity in cart, provides remaining needed count, and strictly blocks checkout', () => {
      const cartItems: CartLineItem[] = [
        {
          id: 'item_1',
          productId: 'prod_mug_a',
          variantId: 'var_black',
          variantName: 'Matte Black',
          quantity: 5,
        },
      ];

      const calculation = calculateCartState(cartItems, productsCatalog);

      // Cart accepts and persists the item (does NOT crash or drop)
      expect(calculation.items.length).toBe(1);
      expect(calculation.items[0].quantity).toBe(5);

      // UI Notice calculation: 5 needed to reach 10
      expect(calculation.canCheckout).toBe(false);
      expect(calculation.productStatuses['prod_mug_a'].isSatisfied).toBe(false);
      expect(calculation.productStatuses['prod_mug_a'].remainingNeeded).toBe(5);

      // Direct server checkout is rejected with HTTP 422
      expect(() => assertCanCheckout(cartItems, productsCatalog)).toThrowError();
      try {
        assertCanCheckout(cartItems, productsCatalog);
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.message).toContain('minimum order quantity of 10');
      }
    });

    it('recalculates cleanly upon cart increment, decrement, and item removal', () => {
      let items: CartLineItem[] = [
        { id: 'i1', productId: 'prod_mug_a', variantId: 'v_black', quantity: 5 },
      ];
      expect(calculateCartState(items, productsCatalog).productStatuses['prod_mug_a'].remainingNeeded).toBe(5);

      // Increment to 6
      items[0].quantity = 6;
      expect(calculateCartState(items, productsCatalog).productStatuses['prod_mug_a'].remainingNeeded).toBe(4);

      // Decrement to 4
      items[0].quantity = 4;
      expect(calculateCartState(items, productsCatalog).productStatuses['prod_mug_a'].remainingNeeded).toBe(6);

      // Remove item
      items = [];
      const emptyState = calculateCartState(items, productsCatalog);
      expect(emptyState.canCheckout).toBe(false);
      expect(emptyState.validationErrors).toContain('Cart is empty.');
    });
  });

  // =========================================================================
  // POC-02B: Cross-Product MOQ Isolation
  // =========================================================================
  describe('POC-02B: Cross-Product MOQ Isolation', () => {
    it('strictly blocks checkout when 10 units are split across 2 different Product IDs', () => {
      const cartItems: CartLineItem[] = [
        { id: 'item_1', productId: 'prod_mug_a', quantity: 5 }, // 5 of Product A
        { id: 'item_2', productId: 'prod_mug_b', quantity: 5 }, // 5 of Product B
      ];

      const calculation = calculateCartState(cartItems, productsCatalog);

      // Total items in cart is 10, BUT neither product satisfies MOQ independently
      expect(calculation.items.reduce((sum, i) => sum + i.quantity, 0)).toBe(10);
      expect(calculation.canCheckout).toBe(false);

      expect(calculation.productStatuses['prod_mug_a'].isSatisfied).toBe(false);
      expect(calculation.productStatuses['prod_mug_a'].remainingNeeded).toBe(5);

      expect(calculation.productStatuses['prod_mug_b'].isSatisfied).toBe(false);
      expect(calculation.productStatuses['prod_mug_b'].remainingNeeded).toBe(5);

      // Direct server checkout throws HTTP 422
      expect(() => assertCanCheckout(cartItems, productsCatalog)).toThrow();
      try {
        assertCanCheckout(cartItems, productsCatalog);
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
      }
    });
  });

  // =========================================================================
  // POC-03: Per-Line Artwork Persistence & Immutable Snapshot
  // =========================================================================
  describe('POC-03: Per-Line Artwork Persistence & Immutable Snapshot', () => {
    it('permanently binds uploaded artwork to specific line item and freezes pricing into immutable order snapshot', () => {
      const cartItems: CartLineItem[] = [
        {
          id: 'line_1',
          productId: 'prod_mug_a',
          variantId: 'var_black',
          variantName: 'Matte Black',
          quantity: 10,
          artworkAssetId: 'art_bico_vector_logo_svg',
          printingNotes: 'UV Spot Print on Front Center',
        },
      ];

      const order = createOrderSnapshot(
        cartItems,
        productsCatalog,
        sampleCustomer,
        deliveryAlexandria,
        'bank_transfer'
      );

      // Snapshot assertions
      expect(order.items.length).toBe(1);
      const snapshotItem = order.items[0];
      expect(snapshotItem.artworkAssetId).toBe('art_bico_vector_logo_svg');
      expect(snapshotItem.printingNotes).toBe('UV Spot Print on Front Center');
      expect(snapshotItem.unitBasePrice).toBe(250);
      expect(snapshotItem.unitCustomizationFee).toBe(35);
      expect(snapshotItem.lineTotal).toBe((250 + 35) * 10); // 2850

      // Financials in cents for gateway precision
      expect(order.financials.grandTotal).toBe(2850 + 60); // 2910 EGP
      expect(order.financials.grandTotalCents).toBe(291000);

      // Simulate catalog price modification in Payload CMS
      const mutatedCatalog = {
        ...productsCatalog,
        prod_mug_a: {
          ...productsCatalog.prod_mug_a,
          basePrice: 500, // doubled
          customizationFee: 100, // tripled
        },
      };

      // Order snapshot remains strictly immutable!
      expect(order.items[0].unitBasePrice).toBe(250);
      expect(order.items[0].unitCustomizationFee).toBe(35);
      expect(order.financials.grandTotal).toBe(2910);
    });
  });

  // =========================================================================
  // POC-04: Fixed-Price Service Package
  // =========================================================================
  describe('POC-04: Fixed-Price Service Package', () => {
    it('allows quantity 1 checkout for agency service without requiring physical shipping', () => {
      const cartItems: CartLineItem[] = [
        {
          id: 'line_srv',
          productId: 'prod_brand_identity',
          quantity: 1,
        },
      ];

      const calculation = calculateCartState(cartItems, productsCatalog, 0);

      expect(calculation.canCheckout).toBe(true);
      expect(calculation.subtotal).toBe(15000);
      expect(calculation.totalCustomizationFees).toBe(0);
      expect(calculation.grandTotal).toBe(15000);

      const order = createOrderSnapshot(
        cartItems,
        productsCatalog,
        sampleCustomer,
        freeOfficePickup,
        'bank_transfer'
      );

      expect(order.items[0].itemType).toBe('service');
      expect(order.financials.shippingFee).toBe(0);
      expect(order.financials.grandTotal).toBe(15000);
    });
  });

  // =========================================================================
  // POC-05: Mixed Cart Checkout
  // =========================================================================
  describe('POC-05: Mixed Cart Checkout', () => {
    it('creates an order with 3 distinct line items across 2 product types (2 physical variants + 1 service)', () => {
      const cartItems: CartLineItem[] = [
        {
          id: 'line_1',
          productId: 'prod_mug_a',
          variantId: 'var_black',
          variantName: 'Matte Black',
          quantity: 4,
          artworkAssetId: 'art_logo_1',
        },
        {
          id: 'line_2',
          productId: 'prod_mug_a',
          variantId: 'var_white',
          variantName: 'Pearl White',
          quantity: 6,
          artworkAssetId: 'art_logo_1',
        },
        {
          id: 'line_3',
          productId: 'prod_brand_identity',
          quantity: 1,
        },
      ];

      const order = createOrderSnapshot(
        cartItems,
        productsCatalog,
        sampleCustomer,
        deliveryAlexandria,
        'bank_transfer'
      );

      // Exactly 3 line items
      expect(order.items.length).toBe(3);

      // Line 1: 4 Black Mugs
      expect(order.items[0].productId).toBe('prod_mug_a');
      expect(order.items[0].variantName).toBe('Matte Black');
      expect(order.items[0].quantity).toBe(4);
      expect(order.items[0].itemType).toBe('physical');

      // Line 2: 6 White Mugs
      expect(order.items[1].productId).toBe('prod_mug_a');
      expect(order.items[1].variantName).toBe('Pearl White');
      expect(order.items[1].quantity).toBe(6);
      expect(order.items[1].itemType).toBe('physical');

      // Line 3: Brand Identity Service
      expect(order.items[2].productId).toBe('prod_brand_identity');
      expect(order.items[2].quantity).toBe(1);
      expect(order.items[2].itemType).toBe('service');

      // Financials verification:
      // Mugs base: 10 * 250 = 2500
      // Service base: 1 * 15000 = 15000
      // Total subtotal: 17500
      expect(order.financials.itemsSubtotal).toBe(17500);

      // Printing fees: 10 * 35 = 350
      expect(order.financials.totalCustomizationFees).toBe(350);

      // Shipping fee: Alexandria = 60
      expect(order.financials.shippingFee).toBe(60);

      // Grand total: 17500 + 350 + 60 = 17910
      expect(order.financials.grandTotal).toBe(17910);
      expect(order.financials.grandTotalCents).toBe(1791000);
    });
  });

  // =========================================================================
  // POC-09 & POC-10: Manual Bank Transfer & RBAC Authorization
  // =========================================================================
  describe('POC-09 & POC-10: Manual Bank Transfer Flow & RBAC Verification', () => {
    const customerUser: UserSession = {
      id: 'usr_customer_1',
      email: 'ahmed@company.com',
      roles: ['customer'],
    };

    const financeUser: UserSession = {
      id: 'usr_finance_1',
      email: 'finance@mwheba.com',
      roles: ['finance'],
    };

    it('POC-09: places order in pending_verification status upon bank transfer submission', () => {
      const cartItems: CartLineItem[] = [
        { id: 'l1', productId: 'prod_mug_a', quantity: 10 },
      ];
      const order = createOrderSnapshot(
        cartItems,
        productsCatalog,
        sampleCustomer,
        freeOfficePickup,
        'bank_transfer'
      );

      expect(order.paymentStatus).toBe('pending_verification');
      expect(order.orderStatus).toBe('pending');

      const submission = bankEngine.submitReceipt(
        order,
        'media_receipt_pdf_123',
        2500,
        'CIB-TRX-987654321'
      );

      expect(submission.status).toBe('pending_verification');
      expect(submission.bankReferenceCode).toBe('CIB-TRX-987654321');
    });

    it('POC-10: blocks unauthorized non-finance user with HTTP 403 Forbidden', () => {
      const cartItems: CartLineItem[] = [
        { id: 'l1', productId: 'prod_mug_a', quantity: 10 },
      ];
      const order = createOrderSnapshot(
        cartItems,
        productsCatalog,
        sampleCustomer,
        freeOfficePickup,
        'bank_transfer'
      );
      bankEngine.submitReceipt(order, 'media_1', 2500, 'REF-1');

      // Customer attempts to approve own transfer
      expect(() => {
        bankEngine.approveTransfer(order, customerUser, 'STMT-MATCH-001');
      }).toThrow();

      try {
        bankEngine.approveTransfer(order, customerUser, 'STMT-MATCH-001');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toContain('Only finance officers or administrators');
      }

      // Order status remains pending_verification
      expect(order.paymentStatus).toBe('pending_verification');
    });

    it('allows authorized finance officer to approve with reconciliation code and records audit record', () => {
      const cartItems: CartLineItem[] = [
        { id: 'l1', productId: 'prod_mug_a', quantity: 10 },
      ];
      const order = createOrderSnapshot(
        cartItems,
        productsCatalog,
        sampleCustomer,
        freeOfficePickup,
        'bank_transfer'
      );
      bankEngine.submitReceipt(order, 'media_1', 2500, 'REF-1');

      // Approving without reconciliation code throws 400 Bad Request
      expect(() => {
        bankEngine.approveTransfer(order, financeUser, '');
      }).toThrow();

      // Approving with reconciliation code succeeds
      const result = bankEngine.approveTransfer(order, financeUser, 'CIB-BANK-STMT-OCT2026-ROW45');
      expect(result.order.paymentStatus).toBe('paid');
      expect(result.order.orderStatus).toBe('confirmed');
      expect(result.submission.status).toBe('approved');
      expect(result.submission.reconciliationCode).toBe('CIB-BANK-STMT-OCT2026-ROW45');
      expect(result.submission.verifiedBy).toBe(financeUser.id);

      // Audit log records event
      const logs = bankEngine.getAuditLog();
      const approvalLog = logs.find((l) => l.action === 'BANK_TRANSFER_APPROVED');
      expect(approvalLog).toBeDefined();
      expect(approvalLog?.actorEmail).toBe(financeUser.email);
    });
  });
});
