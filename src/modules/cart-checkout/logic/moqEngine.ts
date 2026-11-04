/**
 * MWHEBA 2.0 Core Commerce Logic: MOQ & Customization Engine
 * Strictly adheres to DECISIONS.md D-009, D-010, D-017, D-018
 */

import { customizationFeePerUnit } from './customizationFee';

export interface ProductItem {
  id: string;
  title: string;
  itemType: 'physical' | 'service';
  minOrderQuantity: number;
  basePrice: number;
  customizationFee?: number; // Separate printing/engraving fee per unit
}

export interface CartLineItem {
  id: string;
  productId: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  artworkAssetId?: string;
  printingNotes?: string;
}

export interface ProductMoqStatus {
  productId: string;
  productTitle: string;
  totalQuantity: number;
  minOrderQuantity: number;
  isSatisfied: boolean;
  remainingNeeded: number;
}

export interface CartCalculationResult {
  items: CartLineItem[];
  productStatuses: Record<string, ProductMoqStatus>;
  subtotal: number;
  totalCustomizationFees: number; // Itemized separate printing charges (D-017)
  grandTotal: number;
  canCheckout: boolean;
  validationErrors: string[];
}

/**
 * Calculates cart state, variant aggregation per Product ID, incomplete quantities, and separate printing fees.
 */
export function calculateCartState(
  items: CartLineItem[],
  products: Record<string, ProductItem>,
  shippingFee: number = 0
): CartCalculationResult {
  const productQuantities: Record<string, number> = {};
  const productStatuses: Record<string, ProductMoqStatus> = {};
  let subtotal = 0;
  let totalCustomizationFees = 0;
  const validationErrors: string[] = [];

  // 1. Aggregate quantities strictly per Product ID across variants
  for (const item of items) {
    const product = products[item.productId];
    if (!product) continue;

    productQuantities[item.productId] = (productQuantities[item.productId] || 0) + item.quantity;
    
    // Subtotal: base product price * quantity
    subtotal += product.basePrice * item.quantity;

    // Separate customization fee: customization fee * quantity (if printing requested or artwork attached)
    totalCustomizationFees += customizationFeePerUnit(item, product) * item.quantity;
  }

  // 2. Evaluate MOQ per individual Product ID (No cross-product aggregation)
  let canCheckout = true;
  for (const [productId, product] of Object.entries(products)) {
    const totalQty = productQuantities[productId] || 0;
    if (totalQty === 0) continue; // Not in cart

    const minMoq = product.minOrderQuantity || 1;
    const isSatisfied = totalQty >= minMoq;
    const remainingNeeded = isSatisfied ? 0 : minMoq - totalQty;

    productStatuses[productId] = {
      productId,
      productTitle: product.title,
      totalQuantity: totalQty,
      minOrderQuantity: minMoq,
      isSatisfied,
      remainingNeeded,
    };

    if (!isSatisfied) {
      canCheckout = false;
      validationErrors.push(
        `Product "${product.title}" requires a minimum order quantity of ${minMoq} units across variants (currently ${totalQty} in cart, ${remainingNeeded} more required).`
      );
    }
  }

  // Empty cart cannot checkout
  if (items.length === 0) {
    canCheckout = false;
    validationErrors.push('Cart is empty.');
  }

  const grandTotal = subtotal + totalCustomizationFees + shippingFee;

  return {
    items,
    productStatuses,
    subtotal,
    totalCustomizationFees,
    grandTotal,
    canCheckout,
    validationErrors,
  };
}

/**
 * Server-side checkout barrier: Throws HTTP 422 error if cart fails MOQ or business rules.
 */
export function assertCanCheckout(
  items: CartLineItem[],
  products: Record<string, ProductItem>,
  shippingFee: number = 0
): CartCalculationResult {
  const result = calculateCartState(items, products, shippingFee);
  if (!result.canCheckout) {
    const error: any = new Error(result.validationErrors.join('; '));
    error.status = 422;
    error.statusCode = 422;
    error.validationErrors = result.validationErrors;
    throw error;
  }
  return result;
}

export interface SimpleCartItem {
  productId: string;
  productTitle: string;
  itemType: 'physical' | 'service';
  minOrderQuantity: number;
  quantity: number;
  variantId?: string;
}

/**
 * Validates MOQ rules across variants per Product ID (D-009).
 */
export function validateCartMoq(items: SimpleCartItem[]): { valid: boolean; errors: string[] } {
  if (!items || items.length === 0) {
    return { valid: false, errors: ['Cart is empty.'] };
  }
  const qtyByProduct: Record<string, { title: string; moq: number; total: number }> = {};
  for (const it of items) {
    if (!qtyByProduct[it.productId]) {
      qtyByProduct[it.productId] = {
        title: it.productTitle,
        moq: it.minOrderQuantity || 1,
        total: 0,
      };
    }
    qtyByProduct[it.productId].total += it.quantity;
  }

  const errors: string[] = [];
  for (const [, p] of Object.entries(qtyByProduct)) {
    if (p.total < p.moq) {
      errors.push(
        `Product "${p.title}" requires a minimum order quantity of ${p.moq} units across variants (currently ${p.total} in cart, ${p.moq - p.total} more required).`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
