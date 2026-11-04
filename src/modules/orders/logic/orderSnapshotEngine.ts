/**
 * MWHEBA 2.0 Order Snapshot Engine
 * Guarantees immutable preservation of cart line items, pricing, separate customization fees,
 * and artwork attachments at checkout time (per DECISIONS.md D-010, D-017).
 */

import { CartCalculationResult, CartLineItem, ProductItem, assertCanCheckout } from '../../cart-checkout/logic/moqEngine';
import { lineHasCustomization, customizationFeePerUnit } from '../../cart-checkout/logic/customizationFee';

export type { CartLineItem, ProductItem, CartCalculationResult };

export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  companyName?: string;
  taxNumber?: string;
}

export interface FulfillmentOption {
  type: 'delivery' | 'office_pickup';
  governorate?: string;
  addressLine?: string;
  shippingFee: number;
}

export interface OrderItemSnapshot {
  lineId: string;
  productId: string;
  productTitle: string;
  variantId?: string;
  variantName?: string;
  itemType: 'physical' | 'service';
  quantity: number;
  unitBasePrice: number;
  unitCustomizationFee: number;
  lineSubtotal: number;
  lineCustomizationTotal: number;
  lineTotal: number;
  artworkAssetId?: string;
  printingNotes?: string;
}

export interface OrderSnapshot {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  orderStatus: 'draft' | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'payment_pending' | 'pending_verification' | 'paid' | 'failed' | 'refunded';
  fulfillmentStatus: 'unfulfilled' | 'in_production' | 'ready_for_pickup' | 'shipped' | 'delivered' | 'returned_to_origin' | 'cancelled';
  paymentMethod: 'cod' | 'bank_transfer' | 'paymob';
  remittanceStatus: 'not_applicable' | 'pending_collection' | 'collected_by_courier' | 'remitted_to_company';
  proofStatus: 'not_required' | 'proof_pending' | 'proof_approved';
  proofApprovedAt?: string | null;
  codDetails?: {
    requiredAmount: number;
    collectedAmount?: number;
    collectorType?: 'courier' | 'office_staff';
    collectorName?: string;
    collectedAt?: string;
    collectionReference?: string;
    courierRemittanceBatchId?: string;
    refusalReason?: string;
    refusalRecordedAt?: string;
  };
  customer: CustomerDetails;
  fulfillment: FulfillmentOption;
  items: OrderItemSnapshot[];
  financials: {
    itemsSubtotal: number;
    totalCustomizationFees: number;
    shippingFee: number;
    grandTotal: number;
    grandTotalCents: number; // Integer for gateway integration (e.g. 250000)
    currency: 'EGP';
  };
}

/**
 * Converts a monetary amount in EGP to integer piastres (qirsh/cents).
 * Strictly rejects non-finite values and fractional piastres (more than 2 decimal places in EGP).
 */
export function toIntegerPiastres(amount: number, fieldName = 'Monetary amount'): number {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    throw new Error(`INVALID_MONETARY_AMOUNT: ${fieldName} must be a valid finite number.`);
  }
  if (amount <= 0) {
    throw new Error(`INVALID_MONETARY_AMOUNT: ${fieldName} must be greater than zero.`);
  }

  const rawPiastres = amount * 100;
  const roundedPiastres = Math.round(rawPiastres);

  // Reject fractional piastres (sub-cent values, e.g. 2100.005 EGP)
  if (Math.abs(rawPiastres - roundedPiastres) > 1e-4) {
    throw new Error(
      `FRACTIONAL_PIASTRE_PROHIBITED: ${fieldName} (${amount} EGP) contains fractional piastres (more than 2 decimal places). Currency precision is strictly 2 decimal places (exact integer piastres).`
    );
  }

  return roundedPiastres;
}

let orderCounter = 1000;

export function createOrderSnapshot(
  cartItems: CartLineItem[],
  products: Record<string, ProductItem>,
  customer: CustomerDetails,
  fulfillment: FulfillmentOption,
  paymentMethod: 'cod' | 'bank_transfer' | 'paymob' = 'cod'
): OrderSnapshot {
  // 1. Strict server-authoritative validation: throws 422 if MOQ or rules fail
  const calculated = assertCanCheckout(cartItems, products, fulfillment.shippingFee);

  // 2. COD Scope & Validation Rules (D-021)
  if (paymentMethod === 'cod') {
    const hasPhysical = cartItems.some((item) => products[item.productId]?.itemType === 'physical');
    const hasService = cartItems.some((item) => products[item.productId]?.itemType === 'service');

    if (hasService && !hasPhysical) {
      const err = new Error('COD_PROHIBITED_FOR_DIGITAL: Cash on Delivery is strictly prohibited for service packages and digital deliverables.');
      (err as any).statusCode = 422;
      throw err;
    }

    if (hasService && hasPhysical) {
      const err = new Error('COD_PROHIBITED_FOR_MIXED_CART: Mixed carts containing digital services cannot use Cash on Delivery. Please use Bank Transfer or checkout separately.');
      (err as any).statusCode = 422;
      throw err;
    }
  }

  // 3. Generate unique order identifiers
  orderCounter++;
  const orderId = `ord_${Date.now()}_${orderCounter}`;
  const orderNumber = `MWH-${new Date().getFullYear()}-${orderCounter}`;

  // 4. Freeze immutable snapshot of each line item
  let hasCustomization = false;
  const itemSnapshots: OrderItemSnapshot[] = cartItems.map((item) => {
    const product = products[item.productId];
    const unitBasePrice = product.basePrice;
    const unitCustomizationFee = customizationFeePerUnit(item, product);
    const lineSubtotal = unitBasePrice * item.quantity;
    const lineCustomizationTotal = unitCustomizationFee * item.quantity;

    if (lineHasCustomization(item)) {
      hasCustomization = true;
    }

    return {
      lineId: item.id,
      productId: item.productId,
      productTitle: product.title,
      variantId: item.variantId,
      variantName: item.variantName,
      itemType: product.itemType,
      quantity: item.quantity,
      unitBasePrice,
      unitCustomizationFee,
      lineSubtotal,
      lineCustomizationTotal,
      lineTotal: lineSubtotal + lineCustomizationTotal,
      artworkAssetId: item.artworkAssetId,
      printingNotes: item.printingNotes,
    };
  });

  const grandTotal = calculated.grandTotal;
  const grandTotalCents = Math.round(grandTotal * 100);

  return {
    orderId,
    orderNumber,
    createdAt: new Date().toISOString(),
    orderStatus: paymentMethod === 'cod' ? 'confirmed' : 'pending',
    paymentStatus: paymentMethod === 'bank_transfer' ? 'pending_verification' : 'unpaid',
    fulfillmentStatus: 'unfulfilled',
    paymentMethod,
    remittanceStatus: paymentMethod === 'cod' ? 'pending_collection' : 'not_applicable',
    proofStatus: hasCustomization ? 'proof_pending' : 'not_required',
    proofApprovedAt: null,
    codDetails: paymentMethod === 'cod' ? { requiredAmount: grandTotal } : undefined,
    customer: { ...customer },
    fulfillment: { ...fulfillment },
    items: itemSnapshots,
    financials: {
      itemsSubtotal: calculated.subtotal,
      totalCustomizationFees: calculated.totalCustomizationFees,
      shippingFee: fulfillment.shippingFee,
      grandTotal,
      grandTotalCents,
      currency: 'EGP',
    },
  };
}
