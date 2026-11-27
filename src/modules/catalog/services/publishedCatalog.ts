import type { Payload, Where } from 'payload';
import type { Media, Product, Variant, VariantOption } from '@/payload-types';
import { isValidLocale, type Locale } from '@/shared/lib/i18n';
import { resolveCatalogSku, resolveCatalogUnitPrice } from './catalogPrice';
import { catalogLocale, catalogProductTitle } from './catalogProduct';
import {
  CATALOG_MAX_PAGE,
  parseCatalogFilters,
  type CatalogSearchParams,
} from './catalogFilters';

export const CATALOG_PAGE_SIZE = 12;

export interface PublicCatalogTerm {
  id: number;
  slug: string;
  title: string;
}

const productSelect = {
  title: true,
  storefrontTitle: true,
  slug: true,
  description: true,
  storefrontDescription: true,
  basePrice: true,
  priceInEGP: true,
  productType: true,
  minOrderQuantity: true,
  category: true,
  gallery: true,
  enableVariants: true,
} as const;

const productDetailSelect = { ...productSelect, allowArtworkUpload: true, customizationFee: true, sku: true } as const;
// Payload's upload URL read hook depends on filename, which stays out of the public view model.
const mediaSelect = { id: true, mediaType: true, filename: true, url: true, alt: true, width: true, height: true } as const;
const mediaPopulate = { media: mediaSelect } as const;

export interface PublicCatalogMedia {
  id: number;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface PublicCatalogProduct {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  productType: Product['productType'];
  minOrderQuantity: number;
  basePrice: number | null;
  price: number | null;
  category: number | null;
  enableVariants: boolean;
  media: PublicCatalogMedia[];
}

export interface PublicCatalogVariant {
  id: number;
  title: string;
  sku: string | null;
  price: number | null;
  options: { id: number; label: string; typeId: number; typeLabel: string }[];
  media: PublicCatalogMedia[];
}

export interface PublicCatalogProductDetail extends PublicCatalogProduct {
  sku: string | null;
  allowArtworkUpload: boolean;
  customizationFee: number;
  variants: PublicCatalogVariant[];
}

const publishedOnly: Where = { _status: { equals: 'published' } };

function catalogMedia(gallery: Product['gallery']): PublicCatalogMedia[] {
  return (gallery ?? []).flatMap((media) => {
    if (typeof media !== 'object' || media.mediaType !== 'public' || !media.url) return [];
    if (!/^\/(?![\/\\])|^https?:\/\//i.test(media.url)) return [];
    const { id, alt, width, height }: Media = media;
    return [{ id, url: media.url, alt: alt ?? '', width: width ?? null, height: height ?? null }];
  });
}

function publicProduct(product: Pick<Product, 'id' | keyof typeof productSelect>, price: number | null): PublicCatalogProduct {
  return {
    id: product.id,
    title: catalogProductTitle(product),
    slug: product.slug,
    description: product.storefrontDescription?.trim() || product.description || null,
    productType: product.productType,
    minOrderQuantity: product.minOrderQuantity ?? (product.productType === 'fixed_service' ? 1 : 10),
    basePrice: product.basePrice ?? null,
    price,
    category: typeof product.category === 'object' ? product.category?.id ?? null : product.category ?? null,
    enableVariants: product.enableVariants === true,
    media: catalogMedia(product.gallery),
  };
}

function publicVariant(product: Pick<Product, 'basePrice' | 'priceInEGP' | 'sku'>, variant: Pick<Variant, 'id' | 'options' | 'priceInEGP' | 'sku' | 'title'>): PublicCatalogVariant {
  const options = (variant.options ?? []).filter((option): option is VariantOption => typeof option === 'object').map((option) => ({
    id: option.id,
    label: option.label,
    typeId: typeof option.variantType === 'object' ? option.variantType.id : option.variantType,
    typeLabel: typeof option.variantType === 'object' ? option.variantType.label : '',
  }));
  return {
    id: variant.id,
    title: options.map(({ label }) => label).join(' / ') || variant.title || '',
    sku: resolveCatalogSku(product, variant),
    price: resolveCatalogUnitPrice(product, variant),
    options,
    media: [],
  };
}

function setLowestPrice(prices: Map<number, number>, id: number, price: number | null) {
  const previous = prices.get(id);
  if (price !== null && (previous === undefined || price < previous)) prices.set(id, price);
}

export async function readPublishedCatalog(
  payload: Pick<Payload, 'find'>,
  locale: Locale,
  searchParams: CatalogSearchParams,
) {
  const parsed = parseCatalogFilters(searchParams);
  const { filters } = parsed;

  const taxonomyOptions = {
    where: { isActive: { equals: true } },
    select: { id: true, slug: true, title: true },
    depth: 0,
    pagination: false,
    sort: ['slug', 'id'],
    ...catalogLocale(locale),
    overrideAccess: false,
  } as const;

  // The filter directory contains only public labels and IDs. Product results are paginated separately.
  const [categoryResult, tagResult] = await Promise.all([
    payload.find({ collection: 'categories', ...taxonomyOptions, sort: [...taxonomyOptions.sort] }),
    payload.find({ collection: 'product-tags', ...taxonomyOptions, sort: [...taxonomyOptions.sort] }),
  ]);
  const categories: PublicCatalogTerm[] = categoryResult.docs;
  const tags: PublicCatalogTerm[] = tagResult.docs;
  const category = categories.find(({ slug }) => slug === filters.category);
  const tag = tags.find(({ slug }) => slug === filters.tag);
  const invalid = parsed.invalid || Boolean((filters.category && !category) || (filters.tag && !tag));
  const result = { categories, tags, filters, invalid, page: filters.page };

  if (invalid) {
    return { ...result, products: [] as PublicCatalogProduct[], totalDocs: 0, totalPages: 0 };
  }

  const conditions = [publishedOnly];
  if (category) conditions.push({ category: { equals: category.id } });
  if (tag) conditions.push({ tags: { contains: tag.id } });
  if (filters.q) {
    // PostgreSQL LIKE treats these characters as wildcards unless escaped.
    const value = filters.q.replace(/[\\%_]/g, '\\$&');
    conditions.push({ or: [
      { title: { contains: value } },
      { description: { contains: value } },
      { storefrontTitle: { contains: value } },
      { storefrontDescription: { contains: value } },
    ] });
  }

  const products = await payload.find({
    collection: 'products',
    where: { and: conditions },
    select: productSelect,
    draft: false,
    depth: 1,
    joins: false,
    populate: mediaPopulate,
    ...catalogLocale(locale),
    overrideAccess: false,
    limit: CATALOG_PAGE_SIZE,
    page: filters.page,
    sort: ['-createdAt', 'id'],
  });

  const variableProducts = new Map(products.docs.filter((product) => product.enableVariants === true).map((product) => [product.id, product]));
  const lowestPrices = new Map<number, number>();
  if (variableProducts.size) {
    // Fetch only price fields for variants attached to parents on this page.
    const variants = await payload.find({
      collection: 'variants',
      where: { and: [publishedOnly, { product: { in: [...variableProducts.keys()] } }] },
      select: { product: true, priceInEGP: true },
      draft: false,
      depth: 0,
      pagination: false,
      overrideAccess: false,
    });
    for (const variant of variants.docs) {
      const productId = typeof variant.product === 'object' ? variant.product.id : variant.product;
      const product = variableProducts.get(productId);
      if (product) setLowestPrice(lowestPrices, productId, resolveCatalogUnitPrice(product, variant));
    }
  }

  return {
    ...result,
    products: products.docs.map((product) => publicProduct(product, product.enableVariants === true
      ? lowestPrices.get(product.id) ?? null
      : resolveCatalogUnitPrice(product))),
    totalDocs: products.totalDocs,
    totalPages: Math.min(products.totalPages, CATALOG_MAX_PAGE),
  };
}

export type PublishedCatalog = Awaited<ReturnType<typeof readPublishedCatalog>>;

export async function readPublishedProduct(
  payload: Pick<Payload, 'find'>,
  locale: Locale,
  slug: string,
) : Promise<PublicCatalogProductDetail | null> {
  if (!isValidLocale(locale) || !slug || slug.includes('\0')) return null;

  async function findProductBySlug(value: string) {
    const { docs } = await payload.find({
      collection: 'products',
      where: { and: [publishedOnly, { slug: { equals: value } }] },
      select: productDetailSelect,
      draft: false,
      depth: 1,
      joins: false,
      populate: mediaPopulate,
      ...catalogLocale(locale),
      overrideAccess: false,
      limit: 1,
      pagination: false,
    });
    return docs[0] ?? null;
  }

  let product = await findProductBySlug(slug);
  if (!product && slug.includes('%')) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(slug);
    } catch {
      return null;
    }
    if (decoded !== slug && !decoded.includes('\0')) product = await findProductBySlug(decoded);
  }
  if (!product) return null;

  let variants: PublicCatalogVariant[] = [];
  let price = resolveCatalogUnitPrice(product);
  if (product.enableVariants === true) {
    const result = await payload.find({
      collection: 'variants',
      where: { and: [publishedOnly, { product: { equals: product.id } }] },
      select: { title: true, options: true, priceInEGP: true, sku: true },
      populate: { variantOptions: { label: true, variantType: true }, variantTypes: { label: true } },
      draft: false,
      depth: 2,
      ...catalogLocale(locale),
      overrideAccess: false,
      sort: 'id',
      pagination: false,
    });
    variants = result.docs.map((variant) => publicVariant(product, variant));
    price = variants.reduce<number | null>((lowest, variant) => variant.price !== null && (lowest === null || variant.price < lowest)
      ? variant.price : lowest, null);
  }

  return {
    ...publicProduct(product, price),
    sku: product.enableVariants === true ? null : resolveCatalogSku(product),
    allowArtworkUpload: product.productType === 'physical' && product.allowArtworkUpload === true,
    customizationFee: product.customizationFee ?? 0,
    variants,
  };
}
