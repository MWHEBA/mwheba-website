import type { Locale } from '@/shared/lib/i18n';
import { resolveCatalogUnitPrice } from './catalogPrice';

interface CatalogProduct {
  id: number;
  _status?: string | null;
  deletedAt?: string | null;
  enableVariants?: boolean | null;
  priceInEGP?: number | null;
  basePrice?: number | null;
  allowArtworkUpload?: boolean | null;
}

interface CatalogVariant {
  _status?: string | null;
  deletedAt?: string | null;
  product: number | { id: number };
  priceInEGP?: number | null;
}

export function catalogLocale(locale: Locale) {
  return { locale, fallbackLocale: locale === 'ar' ? 'en' as const : 'ar' as const };
}

export function catalogProductTitle(product: { title: string; storefrontTitle?: string | null }): string {
  return product.storefrontTitle?.trim() || product.title;
}

export function isPublishedCatalogItem<T extends { _status?: string | null; deletedAt?: string | null }>(
  item: T | null | undefined,
): item is T {
  return item?._status === 'published' && !item.deletedAt;
}

export function catalogSelectionError(
  product: CatalogProduct | null | undefined,
  variantId: number | undefined,
  variant: CatalogVariant | null | undefined,
  hasArtwork = false,
): string | null {
  if (!isPublishedCatalogItem(product)) return 'PRODUCT_UNAVAILABLE: This product is unavailable.';
  if (variantId !== undefined) {
    if (!isPublishedCatalogItem(variant)) return 'VARIANT_UNAVAILABLE: This variant is unavailable.';
    const parentId = typeof variant.product === 'object' ? variant.product?.id : variant.product;
    if (Number(parentId) !== product.id) return 'VARIANT_MISMATCH: This variant does not belong to this product.';
    if (product.enableVariants !== true) return 'VARIANT_UNAVAILABLE: This product does not offer variants.';
  } else if (product.enableVariants === true) {
    return 'VARIANT_REQUIRED: Select a variant for this product.';
  }
  if (resolveCatalogUnitPrice(product, variant) === null) return 'PRICE_UNAVAILABLE: This item has no configured price.';
  if (hasArtwork && product.allowArtworkUpload === false) {
    return 'CUSTOMIZATION_UNAVAILABLE: This product does not accept artwork.';
  }
  return null;
}
