import type { MetadataRoute } from 'next';
import { getPayloadClient } from '@/lib/payload';
import { SITE_URL } from '@/shared/lib/seo';

/**
 * Dynamic Sitemap Generator.
 * Rendered on-demand (`force-dynamic`) so newly published CMS articles, pages,
 * and portfolio case studies appear immediately without requiring an application rebuild.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Paginates through all published documents in batches to ensure
 * no content is omitted when records exceed single-page query limits.
 */
async function fetchAllPublishedDocs(
  payload: any,
  collection: string,
  batchSize: number = 100
): Promise<any[]> {
  const allDocs: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const res = await payload.find({
        collection,
        where: {
          _status: { equals: 'published' },
        },
        limit: batchSize,
        page,
        sort: '-createdAt',
      });

      if (res.docs && res.docs.length > 0) {
        allDocs.push(...res.docs);
      }

      if (res.hasNextPage) {
        page += 1;
      } else {
        hasMore = false;
      }
    } catch {
      hasMore = false;
    }
  }

  return allDocs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadClient();
  const entries: MetadataRoute.Sitemap = [];

  // 1. Static Core Landing Pages
  const staticRoutes = [
    { path: '', changeFrequency: 'daily' as const, priority: 1.0 },
    { path: '/store', changeFrequency: 'daily' as const, priority: 0.9 },
    { path: '/portfolio', changeFrequency: 'weekly' as const, priority: 0.9 },
    { path: '/blog', changeFrequency: 'daily' as const, priority: 0.9 },
    { path: '/contact', changeFrequency: 'monthly' as const, priority: 0.8 },
  ];

  for (const route of staticRoutes) {
    const arUrl = `${SITE_URL}/ar${route.path}`;
    const enUrl = `${SITE_URL}/en${route.path}`;

    entries.push({
      url: arUrl,
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: {
          ar: arUrl,
          en: enUrl,
          'x-default': arUrl,
        },
      },
    });

    entries.push({
      url: enUrl,
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: {
          ar: arUrl,
          en: enUrl,
          'x-default': arUrl,
        },
      },
    });
  }

  // 2. Dynamic Published CMS Pages (Paginated in batches)
  const pages = await fetchAllPublishedDocs(payload, 'pages', 100);
  for (const page of pages) {
    if (!page.slug) continue;
    const slug = page.slug === 'home' || page.slug === 'index' ? '' : `/${page.slug}`;
    if (!slug) continue;

    const arUrl = `${SITE_URL}/ar${slug}`;
    const enUrl = `${SITE_URL}/en${slug}`;
    const lastModified = page.updatedAt ? new Date(page.updatedAt) : new Date();

    entries.push({
      url: arUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          ar: arUrl,
          en: enUrl,
          'x-default': arUrl,
        },
      },
    });

    entries.push({
      url: enUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          ar: arUrl,
          en: enUrl,
          'x-default': arUrl,
        },
      },
    });
  }

  // 3. Dynamic Published Portfolio Projects (Paginated in batches)
  const projects = await fetchAllPublishedDocs(payload, 'portfolio-projects', 100);
  for (const project of projects) {
    if (!project.slug) continue;
    const arUrl = `${SITE_URL}/ar/portfolio/${project.slug}`;
    const enUrl = `${SITE_URL}/en/portfolio/${project.slug}`;
    const lastModified = project.updatedAt ? new Date(project.updatedAt) : new Date();

    entries.push({
      url: arUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          ar: arUrl,
          en: enUrl,
          'x-default': arUrl,
        },
      },
    });

    entries.push({
      url: enUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          ar: arUrl,
          en: enUrl,
          'x-default': arUrl,
        },
      },
    });
  }

  // 4. Dynamic Published Blog Posts (Paginated in batches)
  const posts = await fetchAllPublishedDocs(payload, 'blog-posts', 100);
  for (const post of posts) {
    if (!post.slug) continue;
    const arUrl = `${SITE_URL}/ar/blog/${post.slug}`;
    const enUrl = `${SITE_URL}/en/blog/${post.slug}`;
    const lastModified = post.updatedAt ? new Date(post.updatedAt) : new Date();

    entries.push({
      url: arUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: {
        languages: {
          ar: arUrl,
          en: enUrl,
          'x-default': arUrl,
        },
      },
    });

    entries.push({
      url: enUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: {
        languages: {
          ar: arUrl,
          en: enUrl,
          'x-default': arUrl,
        },
      },
    });
  }

  // 5. Dynamic Published Store Products (Paginated in batches)
  const products = await fetchAllPublishedDocs(payload, 'products', 100);
  for (const product of products) {
    if (!product.slug) continue;
    const arUrl = `${SITE_URL}/ar/store/${product.slug}`;
    const enUrl = `${SITE_URL}/en/store/${product.slug}`;
    const lastModified = product.updatedAt ? new Date(product.updatedAt) : new Date();

    entries.push({
      url: arUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          ar: arUrl,
          en: enUrl,
          'x-default': arUrl,
        },
      },
    });

    entries.push({
      url: enUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          ar: arUrl,
          en: enUrl,
          'x-default': arUrl,
        },
      },
    });
  }

  return entries;
}
