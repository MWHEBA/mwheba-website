import type { Payload } from 'payload';
import { legacyServicesData } from './data/legacyServices';
import { logger } from '../../shared/lib/logger';

export interface MigrationSummary {
  created: number;
  updated: number;
  total: number;
  collection: string;
}

/**
 * Imports or updates legacy service pages into the `pages` collection.
 * Idempotent: checks for existing pages by slug and updates them in-place.
 */
export async function importServices(payload: Payload): Promise<MigrationSummary> {
  logger.info('Starting migration: Services & Corporate Pages...');
  let created = 0;
  let updated = 0;

  for (const item of legacyServicesData) {
    const pageSlug = `services/${item.slug}`;

    const existing = await payload.find({
      collection: 'pages',
      where: {
        slug: { equals: pageSlug },
      },
      limit: 1,
      overrideAccess: true,
    });

    const arabicBlocks = [
      {
        blockType: 'hero',
        headline: item.ar.title,
        subtitle: item.ar.subtitle,
        theme: 'dark',
      },
      {
        blockType: 'servicesGrid',
        title: 'محاور الخدمة والتنفيذ',
        services: item.ar.features.map((feat) => ({
          title: feat,
          description: item.ar.summary,
        })),
      },
      {
        blockType: 'cta',
        title: `طلب استشارة وتحديد نطاق عمل ${item.ar.title}`,
        description: 'تواصل مع فريق موهبة الاستشاري لمناقشة متطلبات مشروعك والحصول على عرض فني ومالي مفصل.',
        buttonText: 'طلب استشارة فورية',
        buttonLink: '/contact',
        theme: 'dark',
      },
    ];

    const englishBlocks = [
      {
        blockType: 'hero',
        headline: item.en.title,
        subtitle: item.en.subtitle,
        theme: 'dark',
      },
      {
        blockType: 'servicesGrid',
        title: 'Core Capabilities & Execution',
        services: item.en.features.map((feat) => ({
          title: feat,
          description: item.en.summary,
        })),
      },
      {
        blockType: 'cta',
        title: `Schedule an Executive Consultation for ${item.en.title}`,
        description: 'Connect with our senior enterprise directors to define scope, deliverables, and customized pricing.',
        buttonText: 'Request Consultation',
        buttonLink: '/contact',
        theme: 'dark',
      },
    ];

    if (existing.docs.length > 0) {
      const docId = existing.docs[0].id;
      // Update Arabic
      await payload.update({
        collection: 'pages',
        id: docId,
        locale: 'ar',
        data: {
          title: item.ar.title,
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          layout: arabicBlocks as any,
          meta: {
            title: `${item.ar.title} | وكالة موهبة`,
            description: item.ar.metaDescription,
          },
          _status: 'published',
        },
        overrideAccess: true,
      });

      // Update English
      await payload.update({
        collection: 'pages',
        id: docId,
        locale: 'en',
        data: {
          title: item.en.title,
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          layout: englishBlocks as any,
          meta: {
            title: `${item.en.title} | MWHEBA Agency`,
            description: item.en.metaDescription,
          },
          _status: 'published',
        },
        overrideAccess: true,
      });

      updated++;
      logger.info(`Updated existing service page: ${pageSlug}`);
    } else {
      // Create Arabic
      const createdDoc = await payload.create({
        collection: 'pages',
        locale: 'ar',
        data: {
          title: item.ar.title,
          slug: pageSlug,
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          layout: arabicBlocks as any,
          meta: {
            title: `${item.ar.title} | وكالة موهبة`,
            description: item.ar.metaDescription,
          },
          _status: 'published',
        },
        overrideAccess: true,
      });

      // Populate English
      await payload.update({
        collection: 'pages',
        id: createdDoc.id,
        locale: 'en',
        data: {
          title: item.en.title,
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          layout: englishBlocks as any,
          meta: {
            title: `${item.en.title} | MWHEBA Agency`,
            description: item.en.metaDescription,
          },
          _status: 'published',
        },
        overrideAccess: true,
      });

      created++;
      logger.info(`Created new service page: ${pageSlug}`);
    }
  }

  const summary = {
    created,
    updated,
    total: created + updated,
    collection: 'pages',
  };

  logger.info(`Services migration completed: ${created} created, ${updated} updated.`);
  return summary;
}

// Standalone execution support
if (process.argv[1]?.endsWith('importServices.ts')) {
  (async () => {
    const { getPayload } = await import('payload');
    const { default: config } = await import('../../payload.config');
    const payload = await getPayload({ config });
    await importServices(payload);
    process.exit(0);
  })().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
