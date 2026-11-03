import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mwheba.com';

export interface BilingualMetadataInput {
  title: string;
  description: string;
  path: string;
  locale: 'ar' | 'en';
  imageUrl?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  noIndex?: boolean;
}

/**
 * Builds standard, consistent, high-fidelity SEO metadata adhering to project guidelines.
 * Self-references canonical URL and interlinks Arabic and English hreflang alternates.
 */
export function buildBilingualMetadata({
  title,
  description,
  path,
  locale,
  imageUrl,
  imageAlt,
  type = 'website',
  publishedTime,
  modifiedTime,
  authors,
  noIndex = false,
}: BilingualMetadataInput): Metadata {
  const isArabic = locale === 'ar';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const brandSuffix = isArabic ? 'وكالة موهبة' : 'MWHEBA Agency';
  const fullTitle = title.includes(brandSuffix) ? title : `${title} | ${brandSuffix}`;

  const canonicalUrl = `${SITE_URL}/${locale}${cleanPath === '/' ? '' : cleanPath}`;
  const arUrl = `${SITE_URL}/ar${cleanPath === '/' ? '' : cleanPath}`;
  const enUrl = `${SITE_URL}/en${cleanPath === '/' ? '' : cleanPath}`;

  const ogImage = imageUrl || `${SITE_URL}/icon.png`;

  return {
    metadataBase: new URL(SITE_URL),
    title: fullTitle,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'ar': arUrl,
        'en': enUrl,
        'ar-EG': arUrl,
        'en-US': enUrl,
        'x-default': arUrl, // Arabic is primary default locale
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: isArabic ? 'وكالة موهبة للدعاية والإعلان' : 'MWHEBA Corporate Agency',
      locale: isArabic ? 'ar_EG' : 'en_US',
      alternateLocale: isArabic ? ['en_US'] : ['ar_EG'],
      type,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: imageAlt || fullTitle,
        },
      ],
      ...(type === 'article' && {
        publishedTime,
        modifiedTime,
        authors: authors || [isArabic ? 'فريق موهبة التحريري' : 'MWHEBA Editorial Team'],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
  };
}
