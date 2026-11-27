interface CatalogPrice {
  priceInEGP?: number | null;
}

/** Resolve a server-authoritative EGP unit amount, treating zero as a configured price. */
export function resolveCatalogUnitPrice(
  product: CatalogPrice & { basePrice?: number | null },
  variant?: CatalogPrice | null,
): number | null {
  return [variant?.priceInEGP, product.priceInEGP, product.basePrice].find(
    (price): price is number => typeof price === 'number' && Number.isFinite(price),
  ) ?? null;
}

/** A variant owns its SKU independently of its parent product. */
export function resolveCatalogSku(
  product: { sku?: string | null },
  variant?: { sku?: string | null } | null,
): string | null {
  return (variant ?? product).sku?.trim() || null;
}
