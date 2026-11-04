import { SITE_URL } from './seo';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface SchemaProductInput {
  name: string;
  description: string;
  slug: string;
  priceEgp: number;
  imageUrl?: string;
  sku?: string;
  inStock?: boolean;
}

export interface SchemaArticleInput {
  title: string;
  description: string;
  slug: string;
  publishedAt?: string;
  updatedAt?: string;
  authorName?: string;
  imageUrl?: string;
}

/**
 * Generates Schema.org Organization structured data.
 */
export function generateOrganizationSchema(locale: 'ar' | 'en' = 'ar') {
  const isArabic = locale === 'ar';

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
    name: isArabic ? 'وكالة موهبة للدعاية والإعلان والبرمجيات' : 'MWHEBA Corporate Agency',
    legalName: isArabic
      ? 'مؤسسة موهبة للدعاية والإعلان والتسويق الرقمي'
      : 'MWHEBA Agency for Advertising & Digital Marketing',
    url: `${SITE_URL}/${locale}`,
    logo: `${SITE_URL}/brand/logo-wide.png`,
    description: isArabic
      ? 'وكالة مصرية رائدة متخصصة في الهوية المؤسسية، التسويق الرقمي، والحلول البرمجية وتوريد الهدايا الترويجية للشركات.'
      : 'A premier Egyptian corporate agency specialized in brand identity, digital marketing, enterprise software, and corporate merchandising.',
    email: 'info@mwheba.com',
    telephone: '+20-10-0000-0000',
    address: {
      '@type': 'PostalAddress',
      streetAddress: isArabic ? 'شارع الطيران، مدينة نصر' : 'Al-Tayaran St, Nasr City',
      addressLocality: isArabic ? 'القاهرة' : 'Cairo',
      addressRegion: isArabic ? 'محافظة القاهرة' : 'Cairo Governorate',
      postalCode: '11765',
      addressCountry: 'EG',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+20-10-0000-0000',
        contactType: 'sales & customer service',
        areaServed: 'EG',
        availableLanguage: ['Arabic', 'English'],
      },
    ],
    sameAs: [
      'https://www.facebook.com/mwheba',
      'https://www.linkedin.com/company/mwheba',
      'https://www.instagram.com/mwheba',
    ],
  };
}

/**
 * Generates Schema.org ProfessionalService / LocalBusiness structured data.
 */
export function generateLocalBusinessSchema(locale: 'ar' | 'en' = 'ar') {
  const isArabic = locale === 'ar';

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${SITE_URL}#localbusiness`,
    name: isArabic ? 'مقر وكالة موهبة - القاهرة' : 'MWHEBA Agency Headquarters - Cairo',
    image: `${SITE_URL}/brand/logo-wide.png`,
    url: `${SITE_URL}/${locale}`,
    telephone: '+20-10-0000-0000',
    priceRange: 'EGP',
    currenciesAccepted: 'EGP',
    paymentAccepted: 'Cash on Delivery, Bank Wire Transfer',
    address: {
      '@type': 'PostalAddress',
      streetAddress: isArabic ? 'شارع الطيران، مدينة نصر' : 'Al-Tayaran St, Nasr City',
      addressLocality: isArabic ? 'القاهرة' : 'Cairo',
      addressRegion: isArabic ? 'محافظة القاهرة' : 'Cairo Governorate',
      postalCode: '11765',
      addressCountry: 'EG',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 30.0561,
      longitude: 31.3301,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        opens: '09:00',
        closes: '17:00',
      },
    ],
  };
}

/**
 * Generates Schema.org Product structured data for B2B merchandise products.
 */
export function generateProductSchema(product: SchemaProductInput, locale: 'ar' | 'en' = 'ar') {
  const productUrl = `${SITE_URL}/${locale}/store/${product.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: product.name,
    description: product.description,
    image: product.imageUrl || `${SITE_URL}/icon.png`,
    sku: product.sku || `MWH-${product.slug.toUpperCase()}`,
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'EGP',
      price: product.priceEgp.toFixed(2),
      availability:
        product.inStock === false
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      priceValidUntil: '2027-12-31',
      seller: {
        '@type': 'Organization',
        name: locale === 'ar' ? 'وكالة موهبة' : 'MWHEBA Agency',
      },
    },
  };
}

/**
 * Generates Schema.org Article / BlogPosting structured data for knowledge posts.
 */
export function generateArticleSchema(article: SchemaArticleInput, locale: 'ar' | 'en' = 'ar') {
  const isArabic = locale === 'ar';
  const articleUrl = `${SITE_URL}/${locale}/blog/${article.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${articleUrl}#article`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    headline: article.title,
    description: article.description,
    image: article.imageUrl || `${SITE_URL}/icon.png`,
    datePublished: article.publishedAt || '2026-01-01T08:00:00+02:00',
    dateModified: article.updatedAt || article.publishedAt || '2026-01-01T08:00:00+02:00',
    author: {
      '@type': 'Organization',
      name: article.authorName || (isArabic ? 'فريق موهبة التحريري' : 'MWHEBA Editorial Team'),
      url: `${SITE_URL}/${locale}`,
    },
    publisher: {
      '@type': 'Organization',
      name: isArabic ? 'وكالة موهبة' : 'MWHEBA Agency',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/brand/logo-wide.png`,
      },
    },
  };
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
