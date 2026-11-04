import fs from 'node:fs';
import path from 'node:path';
import { SITE_URL } from './seo';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface SchemaProductInput {
  name: string;
  description?: string;
  slug: string;
  priceEgp: number;
  imageUrl?: string;
  sku?: string;
  inStock?: boolean;
}

export interface SchemaArticleInput {
  title: string;
  description?: string;
  slug: string;
  publishedAt?: string;
  updatedAt?: string;
  authorName?: string;
  imageUrl?: string;
}

export interface LocalBusinessVerificationOptions {
  telephone?: string;
  address?: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode?: string;
    addressCountry: string;
  };
  geo?: {
    latitude: number;
    longitude: number;
  };
  openingHours?: {
    days: string[];
    opens: string;
    closes: string;
  }[];
}

/**
 * Returns an absolute URL to the logo, strictly validating that the asset file exists on disk.
 */
export function getVerifiedLogoUrl(): string {
  const primaryRelPath = 'public/brand/logo-wide.png';
  const fullPath = path.resolve(process.cwd(), primaryRelPath);

  if (fs.existsSync(fullPath)) {
    return `${SITE_URL}/brand/logo-wide.png`;
  }

  // Fallback to verified favicon/icon if primary brand asset is moved
  const fallbackRel = 'public/brand/icon-192.png';
  if (fs.existsSync(path.resolve(process.cwd(), fallbackRel))) {
    return `${SITE_URL}/brand/icon-192.png`;
  }

  return `${SITE_URL}/icon.png`;
}

/**
 * Generates Schema.org Organization structured data.
 * Zero placeholder rule: Omits phone, postal address, and hours unless explicitly documented.
 */
export function generateOrganizationSchema(locale: 'ar' | 'en' = 'ar') {
  const isArabic = locale === 'ar';
  const logoUrl = getVerifiedLogoUrl();

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
    name: isArabic ? 'وكالة موهبة للدعاية والإعلان والبرمجيات' : 'MWHEBA Corporate Agency',
    legalName: isArabic
      ? 'مؤسسة موهبة للدعاية والإعلان والتسويق الرقمي'
      : 'MWHEBA Agency for Advertising & Digital Marketing',
    url: `${SITE_URL}/${locale}`,
    logo: logoUrl,
    description: isArabic
      ? 'وكالة مصرية متخصصة في الهوية المؤسسية، التسويق الرقمي، والحلول البرمجية وتوريد الهدايا الترويجية للشركات.'
      : 'A premier Egyptian corporate agency specialized in brand identity, digital marketing, enterprise software, and corporate merchandising.',
    email: 'info@mwheba.com',
    sameAs: [
      'https://www.facebook.com/mwheba',
      'https://www.linkedin.com/company/mwheba',
      'https://www.instagram.com/mwheba',
    ],
  };

  return schema;
}

/**
 * Generates Schema.org ProfessionalService structured data.
 * Zero placeholder rule: Only emits physical address, geo coordinates, and hours if verified data is supplied.
 */
export function generateLocalBusinessSchema(
  locale: 'ar' | 'en' = 'ar',
  verified?: LocalBusinessVerificationOptions,
) {
  const isArabic = locale === 'ar';
  const logoUrl = getVerifiedLogoUrl();

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${SITE_URL}#localbusiness`,
    name: isArabic ? 'وكالة موهبة' : 'MWHEBA Agency',
    image: logoUrl,
    url: `${SITE_URL}/${locale}`,
    priceRange: 'EGP',
    currenciesAccepted: 'EGP',
    paymentAccepted: 'Cash on Delivery, Bank Wire Transfer',
  };

  if (verified?.telephone) {
    schema.telephone = verified.telephone;
  }

  if (verified?.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: verified.address.streetAddress,
      addressLocality: verified.address.addressLocality,
      addressRegion: verified.address.addressRegion,
      ...(verified.address.postalCode ? { postalCode: verified.address.postalCode } : {}),
      addressCountry: verified.address.addressCountry,
    };
  }

  if (verified?.geo) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: verified.geo.latitude,
      longitude: verified.geo.longitude,
    };
  }

  if (verified?.openingHours && verified.openingHours.length > 0) {
    schema.openingHoursSpecification = verified.openingHours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    }));
  }

  return schema;
}

/**
 * Generates Schema.org Product structured data for B2B merchandise products.
 * Zero placeholder rule: Only emits availability when inStock is explicitly defined (never defaults to InStock).
 */
export function generateProductSchema(product: SchemaProductInput, locale: 'ar' | 'en' = 'ar') {
  const productUrl = `${SITE_URL}/${locale}/store/${product.slug}`;

  const offers: Record<string, any> = {
    '@type': 'Offer',
    url: productUrl,
    priceCurrency: 'EGP',
    price: product.priceEgp.toFixed(2),
    seller: {
      '@type': 'Organization',
      name: locale === 'ar' ? 'وكالة موهبة' : 'MWHEBA Agency',
    },
  };

  // Only emit availability if explicitly provided
  if (product.inStock !== undefined) {
    offers.availability = product.inStock
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock';
  }

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: product.name,
    offers,
  };

  if (product.description) {
    schema.description = product.description;
  }

  if (product.imageUrl) {
    schema.image = product.imageUrl.startsWith('http')
      ? product.imageUrl
      : `${SITE_URL}${product.imageUrl}`;
  }

  if (product.sku) {
    schema.sku = product.sku;
  }

  return schema;
}

/**
 * Generates Schema.org BlogPosting structured data for knowledge articles.
 * Zero placeholder rule: Only emits datePublished and dateModified if actual dates exist (never invents fallback dates).
 */
export function generateArticleSchema(article: SchemaArticleInput, locale: 'ar' | 'en' = 'ar') {
  const isArabic = locale === 'ar';
  const articleUrl = `${SITE_URL}/${locale}/blog/${article.slug}`;
  const logoUrl = getVerifiedLogoUrl();

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${articleUrl}#article`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    headline: article.title,
    publisher: {
      '@type': 'Organization',
      name: isArabic ? 'وكالة موهبة' : 'MWHEBA Agency',
      logo: {
        '@type': 'ImageObject',
        url: logoUrl,
      },
    },
  };

  if (article.description) {
    schema.description = article.description;
  }

  if (article.imageUrl) {
    schema.image = article.imageUrl.startsWith('http')
      ? article.imageUrl
      : `${SITE_URL}${article.imageUrl}`;
  }

  // Strict: only output publication dates if authentically provided
  if (article.publishedAt) {
    schema.datePublished = article.publishedAt;
  }

  if (article.updatedAt) {
    schema.dateModified = article.updatedAt;
  } else if (article.publishedAt) {
    schema.dateModified = article.publishedAt;
  }

  if (article.authorName) {
    schema.author = {
      '@type': 'Person',
      name: article.authorName,
    };
  }

  return schema;
}

/**
 * Generates Schema.org BreadcrumbList structured data.
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}
