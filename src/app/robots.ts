import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/ar',
          '/ar/',
          '/en',
          '/en/',
          '/icon.png',
          '/apple-icon.png',
        ],
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/ar/checkout',
          '/ar/checkout/',
          '/en/checkout',
          '/en/checkout/',
          '/account',
          '/account/',
          '/*preview*',
          '/*token*',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
