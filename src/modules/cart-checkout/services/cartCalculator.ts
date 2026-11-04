import type { Payload } from 'payload';
import { customizationFeePerUnit } from '../logic/customizationFee';

export interface HydratedCartItem {
  id: string;
  productId: number;
  productTitle: string;
  productSlug: string;
  productType: 'physical' | 'fixed_service';
  itemType: 'physical' | 'service';
  minOrderQuantity: number;
  basePrice: number;
  variantId?: number;
  variantTitle?: string;
  unitPrice: number;
  quantity: number;
  customizationFeePerUnit: number;
  lineCustomizationFee: number;
  lineSubtotal: number;
  lineTotal: number;
  artworkAssetId?: string;
  printingNotes?: string;
}

export interface VariantQuantityEntry {
  variantId?: number;
  variantTitle?: string;
  quantity: number;
}

export interface ProductMoqGrouping {
  productId: number;
  productTitle: string;
  productType: 'physical' | 'fixed_service';
  itemType: 'physical' | 'service';
  minOrderQuantity: number;
  totalQuantity: number;
  isSatisfied: boolean;
  remainingNeeded: number;
  variants: VariantQuantityEntry[];
}

export interface CartCalculationSummary {
  items: HydratedCartItem[];
  productGroupings: Record<number, ProductMoqGrouping>;
  totalItemsCount: number;
  subtotal: number;
  totalCustomizationFees: number;
  grandTotal: number;
  currency: 'EGP';
  canCheckout: boolean;
  validationErrors: string[];
}

/**
 * Calculates cart state from fully hydrated cart items.
 * Strictly adheres to DECISIONS.md D-009, D-010, D-017, D-018:
 * - Aggregates quantities strictly per Product ID across variants.
 * - Rejects pooling / merging across different Product IDs.
 * - Customization fees itemized as separate financial line charges.
 */
export function calculateCartSummary(
  items: HydratedCartItem[],
  shippingFee: number = 0
): CartCalculationSummary {
  const productGroupings: Record<number, ProductMoqGrouping> = {};
  let subtotal = 0;
  let totalCustomizationFees = 0;
  let totalItemsCount = 0;
  const validationErrors: string[] = [];

  // 1. Group line items by Product ID and accumulate financials
  for (const item of items) {
    const pId = item.productId;
    totalItemsCount += item.quantity;
    subtotal += item.lineSubtotal;
    totalCustomizationFees += item.lineCustomizationFee;

    if (!productGroupings[pId]) {
      productGroupings[pId] = {
        productId: pId,
        productTitle: item.productTitle,
        productType: item.productType,
        itemType: item.itemType,
        minOrderQuantity: item.minOrderQuantity,
        totalQuantity: 0,
        isSatisfied: false,
        remainingNeeded: item.minOrderQuantity,
        variants: [],
      };
    }

    const group = productGroupings[pId];
    group.totalQuantity += item.quantity;
    group.variants.push({
      variantId: item.variantId,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
    });
  }

  // 2. Evaluate MOQ strictly per Product ID (No cross-product aggregation)
  let canCheckout = items.length > 0;

  if (items.length === 0) {
    canCheckout = false;
    validationErrors.push('Cart is empty.');
  }

  for (const [idStr, group] of Object.entries(productGroupings)) {
    const requiredMoq = group.minOrderQuantity || 1;
    group.isSatisfied = group.totalQuantity >= requiredMoq;
    group.remainingNeeded = group.isSatisfied ? 0 : requiredMoq - group.totalQuantity;

    if (!group.isSatisfied) {
      canCheckout = false;
      const errorMsg =
        group.itemType === 'physical'
          ? `Product "${group.productTitle}" requires a minimum order quantity of ${requiredMoq} units across variants (currently ${group.totalQuantity} in cart, ${group.remainingNeeded} more required).`
          : `Service package "${group.productTitle}" requires a quantity of at least ${requiredMoq} unit.`;
      validationErrors.push(errorMsg);
    }
  }

  const grandTotal = subtotal + totalCustomizationFees + shippingFee;

  return {
    items,
    productGroupings,
    totalItemsCount,
    subtotal,
    totalCustomizationFees,
    grandTotal,
    currency: 'EGP',
    canCheckout,
    validationErrors,
  };
}

/**
 * Hydrates raw cart lines from Payload into fully qualified HydratedCartItem objects.
 */
export async function hydrateCartLines(
  rawItems: any[],
  payload: Payload
): Promise<HydratedCartItem[]> {
  if (!rawItems || rawItems.length === 0) return [];

  const productCache = new Map<number, any>();
  const variantCache = new Map<number, any>();

  const hydratedItems: HydratedCartItem[] = [];

  for (const raw of rawItems) {
    const rawProdId = typeof raw.product === 'object' && raw.product !== null ? raw.product.id : raw.product;
    const prodId = Number(rawProdId);
    if (!Number.isSafeInteger(prodId) || prodId <= 0) continue;

    // Fetch product
    let product = productCache.get(prodId);
    if (!product) {
      try {
        product = await payload.findByID({
          collection: 'products',
          id: prodId,
          depth: 0,
        });
        if (product) productCache.set(prodId, product);
      } catch {
        continue;
      }
    }
    if (!product) continue;

    // Fetch variant if present
    let variant: any = null;
    const rawVarId = typeof raw.variant === 'object' && raw.variant !== null ? raw.variant.id : raw.variant;
    const varId = rawVarId ? Number(rawVarId) : undefined;
    if (varId && Number.isSafeInteger(varId) && varId > 0) {
      variant = variantCache.get(varId);
      if (!variant) {
        try {
          variant = await payload.findByID({
            collection: 'variants',
            id: varId,
            depth: 0,
          });
          if (variant) variantCache.set(varId, variant);
        } catch {
          // Variant missing
        }
      }
    }

    const qty = Math.max(1, Number(raw.quantity) || 1);

    // Resolve unit price: variant price first, then product basePrice
    let unitPrice = 0;
    if (variant && typeof variant.priceInEGP === 'number') {
      unitPrice = variant.priceInEGP;
    } else if (typeof product.priceInEGP === 'number') {
      unitPrice = product.priceInEGP;
    } else if (typeof product.basePrice === 'number') {
      unitPrice = product.basePrice;
    }

    // Separate customization fee
    const feePerUnit = customizationFeePerUnit(raw, product);
    const lineCustomizationFee = feePerUnit * qty;
    const lineSubtotal = unitPrice * qty;
    const lineTotal = lineSubtotal + lineCustomizationFee;

    hydratedItems.push({
      id: String(raw.id || `line-${prodId}-${varId || 0}`),
      productId: prodId,
      productTitle: String(product.title || 'Product'),
      productSlug: String(product.slug || ''),
      productType: product.productType === 'fixed_service' ? 'fixed_service' : 'physical',
      itemType: product.itemType === 'service' ? 'service' : 'physical',
      minOrderQuantity: Number(product.minOrderQuantity) || (product.productType === 'fixed_service' ? 1 : 10),
      basePrice: Number(product.basePrice) || 0,
      variantId: varId,
      variantTitle: variant?.title ? String(variant.title) : undefined,
      unitPrice,
      quantity: qty,
      customizationFeePerUnit: feePerUnit,
      lineCustomizationFee,
      lineSubtotal,
      lineTotal,
      artworkAssetId: raw.artworkAssetId ? String(raw.artworkAssetId) : undefined,
      printingNotes: raw.printingNotes ? String(raw.printingNotes) : undefined,
    });
  }

  return hydratedItems;
}

/**
 * Server Checkout Barrier: Throws HTTP 422 if MOQ rules or business invariants are not satisfied.
 * Direct API calls cannot bypass this guard.
 */
export function assertCartCanCheckout(summary: CartCalculationSummary): void {
  if (!summary.canCheckout || summary.validationErrors.length > 0) {
    const error: any = new Error(
      `CHECKOUT_MOQ_VIOLATION: ${summary.validationErrors.join('; ')}`
    );
    error.status = 422;
    error.statusCode = 422;
    error.code = 'CHECKOUT_MOQ_VIOLATION';
    error.validationErrors = summary.validationErrors;
    error.productGroupings = summary.productGroupings;
    throw error;
  }
}
