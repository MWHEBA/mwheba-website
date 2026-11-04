import type { Payload } from 'payload';
import { legacyPortfolioData } from './data/legacyPortfolio';
import { logger } from '../../shared/lib/logger';
import type { MigrationSummary } from './importServices';

/**
 * Imports or updates legacy portfolio case studies into the `portfolio-projects` collection.
 * Idempotent: checks for existing projects by unique slug and updates in-place.
 */
export async function importPortfolio(payload: Payload): Promise<MigrationSummary> {
  logger.info('Starting migration: Portfolio Case Studies...');
  let created = 0;
  let updated = 0;

  for (const item of legacyPortfolioData) {
    const existing = await payload.find({
      collection: 'portfolio-projects',
      where: {
        slug: { equals: item.slug },
      },
      draft: true,
      limit: 1,
      overrideAccess: true,
    });

    if (existing.docs.length > 0) {
      const docId = existing.docs[0].id;

      // Update Arabic
      await payload.update({
        collection: 'portfolio-projects',
        id: docId,
        locale: 'ar',
        draft: true,
        data: {
          title: item.ar.title,
          clientName: item.ar.clientName,
          industry: item.ar.industry,
          serviceCategory: item.serviceCategory,
          featured: item.featured,
          projectDate: String(item.year),
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          summary: item.ar.summary,
          coverImageAlt: item.ar.coverImageAlt,
          narrative: item.ar.narrative,
          deliverables: item.ar.deliverables,
          results: item.ar.results,
          _status: 'draft',
        },
        overrideAccess: true,
      });

      // Update English
      await payload.update({
        collection: 'portfolio-projects',
        id: docId,
        locale: 'en',
        draft: true,
        data: {
          title: item.en.title,
          clientName: item.en.clientName,
          industry: item.en.industry,
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          summary: item.en.summary,
          coverImageAlt: item.en.coverImageAlt,
          narrative: item.en.narrative,
          deliverables: item.en.deliverables,
          results: item.en.results,
          _status: 'draft',
        },
        overrideAccess: true,
      });

      updated++;
      logger.info(`Updated existing portfolio project: ${item.slug}`);
    } else {
      // Create Arabic
      const createdDoc = await payload.create({
        collection: 'portfolio-projects',
        locale: 'ar',
        data: {
          title: item.ar.title,
          slug: item.slug,
          clientName: item.ar.clientName,
          industry: item.ar.industry,
          serviceCategory: item.serviceCategory,
          featured: item.featured,
          projectDate: String(item.year),
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          summary: item.ar.summary,
          coverImageAlt: item.ar.coverImageAlt,
          narrative: item.ar.narrative,
          deliverables: item.ar.deliverables,
          results: item.ar.results,
          _status: 'draft',
        },
        overrideAccess: true,
      });

      // Update English
      await payload.update({
        collection: 'portfolio-projects',
        id: createdDoc.id,
        locale: 'en',
        draft: true,
        data: {
          title: item.en.title,
          clientName: item.en.clientName,
          industry: item.en.industry,
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          summary: item.en.summary,
          coverImageAlt: item.en.coverImageAlt,
          narrative: item.en.narrative,
          deliverables: item.en.deliverables,
          results: item.en.results,
          _status: 'draft',
        },
        overrideAccess: true,
      });

      created++;
      logger.info(`Created new portfolio project: ${item.slug}`);
    }
  }

  const summary: MigrationSummary = {
    created,
    updated,
    total: created + updated,
    collection: 'portfolio-projects',
  };

  logger.info(`Portfolio migration completed: ${created} created, ${updated} updated.`);
  return summary;
}

// Standalone execution support
if (process.argv[1]?.endsWith('importPortfolio.ts')) {
  (async () => {
    const { getPayload } = await import('payload');
    const { default: config } = await import('../../payload.config');
    const payload = await getPayload({ config });
    await importPortfolio(payload);
    process.exit(0);
  })().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
