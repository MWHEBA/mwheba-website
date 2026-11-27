import type { Payload, PayloadRequest } from 'payload';
import type { Product, Variant } from '@/payload-types';
import { defaultLocale, type Locale } from '@/shared/lib/i18n';
import { resolveCatalogSku, resolveCatalogUnitPrice } from '@/modules/catalog/services/catalogPrice';
import { catalogLocale, catalogProductTitle, catalogSelectionError, isPublishedCatalogItem } from '@/modules/catalog/services/catalogProduct';
import { checkInventoryAvailability, inventoryIssueMessage, type InventoryIssue } from '@/modules/inventory/services/inventoryService';
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
  sku?: string;
  availabilityError?: string;
  stockIssue?: InventoryIssue;
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
 * Applies DECISIONS.md D-009, D-010, D-017, and D-018.
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
  const reportedStock = new Set<string>();

  // 1. Group line items by Product ID and accumulate financials
  for (const item of items) {
    const pId = item.productId;
    totalItemsCount += item.quantity;
    subtotal += item.lineSubtotal;
    totalCustomizationFees += item.lineCustomizationFee;
    if (item.availabilityError) {
      validationErrors.push(item.availabilityError);
      continue;
    }
    if (item.stockIssue) {
      const stockKey = item.variantId == null ? `product:${item.productId}` : `variant:${item.variantId}`;
      if (!reportedStock.has(stockKey)) {
        reportedStock.add(stockKey);
        const label = item.variantTitle ? `${item.productTitle} (${item.variantTitle})` : item.productTitle;
        validationErrors.push(inventoryIssueMessage(item.stockIssue, label));
      }
    }

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
  let canCheckout = items.length > 0 && validationErrors.length === 0;

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
  payload: Payload,
  locale: Locale = defaultLocale,
  req?: Partial<PayloadRequest>,
): Promise<HydratedCartItem[]> {
  if (!rawItems || rawItems.length === 0) return [];

  const productCache = new Map<number, Product | null>();
  const variantCache = new Map<number, Variant | null>();

  const hydratedItems: HydratedCartItem[] = [];

  for (const raw of rawItems) {
    const rawProdId = typeof raw.product === 'object' && raw.product !== null ? raw.product.id : raw.product;
    const numericId = Number(rawProdId);
    const prodId = Number.isSafeInteger(numericId) && numericId > 0 ? numericId : 0;

    // Fetch product
    if (prodId && !productCache.has(prodId)) {
      const product = await payload.findByID({
        collection: 'products',
        id: prodId,
        depth: 0,
        joins: false,
        draft: false,
        disableErrors: true,
        req,
        ...catalogLocale(locale),
      });
      productCache.set(prodId, isPublishedCatalogItem(product) ? product : null);
    }
    const product = productCache.get(prodId);

    // Fetch variant if present
    const rawVarId = typeof raw.variant === 'object' && raw.variant !== null ? raw.variant.id : raw.variant;
    const varId = rawVarId ? Number(rawVarId) : undefined;
    if (varId && Number.isSafeInteger(varId) && varId > 0 && !variantCache.has(varId)) {
      const variant = await payload.findByID({
        collection: 'variants',
        id: varId,
        depth: 0,
        draft: false,
        disableErrors: true,
        req,
      });
      variantCache.set(varId, variant);
    }
    const variant = varId ? variantCache.get(varId) : undefined;

    const qty = Number(raw.quantity);
    const validQuantity = Number.isSafeInteger(qty) && qty > 0;
    const availabilityError = catalogSelectionError(product, varId, variant, Boolean(raw.artworkAssetId))
      ?? (validQuantity ? null : 'INVALID_QUANTITY: Quantity must be a positive whole integer.');
    const unitPrice = !availabilityError && product ? resolveCatalogUnitPrice(product, variant) ?? 0 : 0;

    // Separate customization fee
    const feePerUnit = !availabilityError && product ? customizationFeePerUnit(raw, product) : 0;
    const quantity = validQuantity ? qty : 0;
    const lineCustomizationFee = feePerUnit * quantity;
    const lineSubtotal = unitPrice * quantity;
    const lineTotal = lineSubtotal + lineCustomizationFee;

    hydratedItems.push({
      id: String(raw.id || `line-${prodId}-${varId || 0}`),
      productId: prodId,
      productTitle: product ? catalogProductTitle(product) : 'Product',
      productSlug: product?.slug ?? '',
      productType: product?.productType === 'fixed_service' ? 'fixed_service' : 'physical',
      itemType: product?.itemType === 'service' ? 'service' : 'physical',
      minOrderQuantity: product?.minOrderQuantity ?? (product?.productType === 'fixed_service' ? 1 : 10),
      basePrice: product?.basePrice ?? 0,
      variantId: varId,
      variantTitle: !availabilityError && variant?.title ? variant.title : undefined,
      sku: !availabilityError && product ? resolveCatalogSku(product, variant) ?? undefined : undefined,
      availabilityError: availabilityError ?? undefined,
      unitPrice,
      quantity,
      customizationFeePerUnit: feePerUnit,
      lineCustomizationFee,
      lineSubtotal,
      lineTotal,
      artworkAssetId: raw.artworkAssetId ? String(raw.artworkAssetId) : undefined,
      printingNotes: raw.printingNotes ? String(raw.printingNotes) : undefined,
    });
  }

  return checkInventoryAvailability(payload, hydratedItems, req);
}

/**
 * Server Checkout Barrier: Throws HTTP 422 if MOQ rules or business invariants are not satisfied.
 * Direct API calls cannot bypass this guard.
 */
export function assertCartCanCheckout(summary: CartCalculationSummary): void {
  if (!summary.canCheckout || summary.validationErrors.length > 0) {
    const stockCode = summary.items.find((item) => item.stockIssue)?.stockIssue?.code;
    const code = stockCode ?? 'CHECKOUT_MOQ_VIOLATION';
    const error: any = new Error(
      `${code}: ${summary.validationErrors.join('; ')}`
    );
    error.status = 422;
    error.statusCode = 422;
    error.code = code;
    error.validationErrors = summary.validationErrors;
    error.productGroupings = summary.productGroupings;
    throw error;
  }
}
