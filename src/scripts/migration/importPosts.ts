import type { Payload } from 'payload';
import { legacyBlogPostsData } from './data/legacyPosts';
import { logger } from '../../shared/lib/logger';
import type { MigrationSummary } from './importServices';

/**
 * Imports or updates legacy blog posts into the `blog-posts` collection.
 * Idempotent: checks for existing posts by unique slug and updates in-place.
 */
export async function importPosts(payload: Payload): Promise<MigrationSummary> {
  logger.info('Starting migration: Knowledge Blog Articles...');
  let created = 0;
  let updated = 0;

  for (const item of legacyBlogPostsData) {
    const existing = await payload.find({
      collection: 'blog-posts',
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
        collection: 'blog-posts',
        id: docId,
        locale: 'ar',
        draft: true,
        data: {
          title: item.ar.title,
          author: item.author,
          publishedAt: item.publishedAt,
          category: item.category,
          readingTimeMinutes: item.readingTimeMinutes,
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          excerpt: item.ar.excerpt,
          content: item.ar.content,
          coverImageAlt: item.ar.coverImageAlt,
          tags: item.ar.tags.map((tag) => ({ tag })),
          _status: 'draft',
        },
        overrideAccess: true,
      });

      // Update English
      await payload.update({
        collection: 'blog-posts',
        id: docId,
        locale: 'en',
        draft: true,
        data: {
          title: item.en.title,
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          excerpt: item.en.excerpt,
          content: item.en.content,
          coverImageAlt: item.en.coverImageAlt,
          tags: item.en.tags.map((tag) => ({ tag })),
          _status: 'draft',
        },
        overrideAccess: true,
      });

      updated++;
      logger.info(`Updated existing blog post: ${item.slug}`);
    } else {
      // Create Arabic
      const createdDoc = await payload.create({
        collection: 'blog-posts',
        locale: 'ar',
        data: {
          title: item.ar.title,
          slug: item.slug,
          author: item.author,
          publishedAt: item.publishedAt,
          category: item.category,
          readingTimeMinutes: item.readingTimeMinutes,
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          excerpt: item.ar.excerpt,
          content: item.ar.content,
          coverImageAlt: item.ar.coverImageAlt,
          tags: item.ar.tags.map((tag) => ({ tag })),
          _status: 'draft',
        },
        overrideAccess: true,
      });

      // Update English
      await payload.update({
        collection: 'blog-posts',
        id: createdDoc.id,
        locale: 'en',
        draft: true,
        data: {
          title: item.en.title,
          sourceOrigin: item.sourceOrigin,
          sourceReference: item.sourceReference,
          approvalStatus: item.approvalStatus,
          excerpt: item.en.excerpt,
          content: item.en.content,
          coverImageAlt: item.en.coverImageAlt,
          tags: item.en.tags.map((tag) => ({ tag })),
          _status: 'draft',
        },
        overrideAccess: true,
      });

      created++;
      logger.info(`Created new blog post: ${item.slug}`);
    }
  }

  const summary: MigrationSummary = {
    created,
    updated,
    total: created + updated,
    collection: 'blog-posts',
  };

  logger.info(`Blog posts migration completed: ${created} created, ${updated} updated.`);
  return summary;
}

// Standalone execution support
if (process.argv[1]?.endsWith('importPosts.ts')) {
  (async () => {
    const { getPayload } = await import('payload');
    const { default: config } = await import('../../payload.config');
    const payload = await getPayload({ config });
    await importPosts(payload);
    process.exit(0);
  })().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
