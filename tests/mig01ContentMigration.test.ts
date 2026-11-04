import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { importServices } from '@/scripts/migration/importServices';
import { importPosts } from '@/scripts/migration/importPosts';
import { importPortfolio } from '@/scripts/migration/importPortfolio';
import { runContentMigration } from '@/scripts/migration/index';
import { legacyServicesData } from '@/scripts/migration/data/legacyServices';
import { legacyBlogPostsData } from '@/scripts/migration/data/legacyPosts';
import { legacyPortfolioData } from '@/scripts/migration/data/legacyPortfolio';

describe('MIG-01: Content Transformation & Ingestion Pipeline', () => {
  let payload: any;
  const cleanup = {
    pages: [] as (string | number)[],
    posts: [] as (string | number)[],
    projects: [] as (string | number)[],
  };

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });
  });

  afterAll(async () => {
    for (const id of cleanup.pages) {
      await payload.delete({ collection: 'pages', id, overrideAccess: true }).catch(() => null);
    }
    for (const id of cleanup.posts) {
      await payload.delete({ collection: 'blog-posts', id, overrideAccess: true }).catch(() => null);
    }
    for (const id of cleanup.projects) {
      await payload.delete({ collection: 'portfolio-projects', id, overrideAccess: true }).catch(() => null);
    }
  });

  // ===========================================================================
  // 1. Service Pages Migration & UTF-8 Integrity
  // ===========================================================================
  describe('1. Services Migration (importServices)', () => {
    it('imports all 6 core audited services into pages collection with flawless Arabic and English content', async () => {
      const summary = await importServices(payload);

      expect(summary.total).toBe(legacyServicesData.length);
      expect(summary.collection).toBe('pages');

      // Verify each service page in database
      for (const expected of legacyServicesData) {
        const pageSlug = `services/${expected.slug}`;

        // Arabic check
        const arPage = await payload.find({
          collection: 'pages',
          where: { slug: { equals: pageSlug } },
          locale: 'ar',
          limit: 1,
          overrideAccess: true,
        });

        expect(arPage.docs.length).toBe(1);
        const arDoc = arPage.docs[0];
        cleanup.pages.push(arDoc.id);

        expect(arDoc._status).toBe('published');
        expect(arDoc.title).toBe(expected.ar.title);
        // Verify UTF-8 characters are intact and not corrupted
        expect(arDoc.title).not.toContain('?');
        expect(arDoc.title).not.toContain('&#');

        // Check layout blocks in Arabic
        expect(Array.isArray(arDoc.layout)).toBe(true);
        expect(arDoc.layout.length).toBeGreaterThanOrEqual(3);
        const heroBlock = arDoc.layout.find((b: any) => b.blockType === 'hero');
        expect(heroBlock).toBeDefined();
        expect(heroBlock.headline).toBe(expected.ar.title);

        // English check
        const enPage = await payload.find({
          collection: 'pages',
          where: { slug: { equals: pageSlug } },
          locale: 'en',
          limit: 1,
          overrideAccess: true,
        });

        expect(enPage.docs.length).toBe(1);
        const enDoc = enPage.docs[0];
        expect(enDoc.title).toBe(expected.en.title);
        const enHeroBlock = enDoc.layout.find((b: any) => b.blockType === 'hero');
        expect(enHeroBlock).toBeDefined();
        expect(enHeroBlock.headline).toBe(expected.en.title);
      }
    });

    it('demonstrates 100% idempotency: running importServices a second time updates in-place without duplicating', async () => {
      const secondSummary = await importServices(payload);

      // No new pages should be created; all should be updated
      expect(secondSummary.created).toBe(0);
      expect(secondSummary.updated).toBe(legacyServicesData.length);
      expect(secondSummary.total).toBe(legacyServicesData.length);

      // Verify page count in collection has not increased
      const allPages = await payload.find({
        collection: 'pages',
        where: { slug: { contains: 'services/' } },
        limit: 100,
        overrideAccess: true,
      });

      expect(allPages.totalDocs).toBe(legacyServicesData.length);
    });
  });

  // ===========================================================================
  // 2. Knowledge Blog Articles Migration (importPosts)
  // ===========================================================================
  describe('2. Knowledge Blog Posts Migration (importPosts)', () => {
    it('imports curated B2B articles into blog-posts collection with bilingual content and categories', async () => {
      const summary = await importPosts(payload);

      expect(summary.total).toBe(legacyBlogPostsData.length);
      expect(summary.collection).toBe('blog-posts');

      for (const expected of legacyBlogPostsData) {
        // Arabic check
        const arPost = await payload.find({
          collection: 'blog-posts',
          where: { slug: { equals: expected.slug } },
          locale: 'ar',
          limit: 1,
          overrideAccess: true,
        });

        expect(arPost.docs.length).toBe(1);
        const doc = arPost.docs[0];
        cleanup.posts.push(doc.id);

        expect(doc._status).toBe('published');
        expect(doc.title).toBe(expected.ar.title);
        expect(doc.category).toBe(expected.category);
        expect(doc.readingTimeMinutes).toBe(expected.readingTimeMinutes);
        expect(doc.excerpt).toBe(expected.ar.excerpt);
        expect(doc.content).toBe(expected.ar.content);
        expect(doc.author).toBe(expected.author);

        // English check
        const enPost = await payload.find({
          collection: 'blog-posts',
          where: { slug: { equals: expected.slug } },
          locale: 'en',
          limit: 1,
          overrideAccess: true,
        });

        expect(enPost.docs.length).toBe(1);
        const enDoc = enPost.docs[0];
        expect(enDoc.title).toBe(expected.en.title);
        expect(enDoc.excerpt).toBe(expected.en.excerpt);
        expect(enDoc.content).toBe(expected.en.content);
      }
    });

    it('demonstrates 100% idempotency: re-running importPosts updates existing posts without duplicates', async () => {
      const secondSummary = await importPosts(payload);

      expect(secondSummary.created).toBe(0);
      expect(secondSummary.updated).toBe(legacyBlogPostsData.length);

      const allPosts = await payload.find({
        collection: 'blog-posts',
        limit: 100,
        overrideAccess: true,
      });

      expect(allPosts.totalDocs).toBe(legacyBlogPostsData.length);
    });
  });

  // ===========================================================================
  // 3. Portfolio Case Studies Migration (importPortfolio)
  // ===========================================================================
  describe('3. Portfolio Projects Migration (importPortfolio)', () => {
    it('imports verified enterprise client case studies with metrics, deliverables, and industries', async () => {
      const summary = await importPortfolio(payload);

      expect(summary.total).toBe(legacyPortfolioData.length);
      expect(summary.collection).toBe('portfolio-projects');

      for (const expected of legacyPortfolioData) {
        // Arabic check
        const arProject = await payload.find({
          collection: 'portfolio-projects',
          where: { slug: { equals: expected.slug } },
          locale: 'ar',
          limit: 1,
          overrideAccess: true,
        });

        expect(arProject.docs.length).toBe(1);
        const doc = arProject.docs[0];
        cleanup.projects.push(doc.id);

        expect(doc._status).toBe('published');
        expect(doc.title).toBe(expected.ar.title);
        expect(doc.clientName).toBe(expected.ar.clientName);
        expect(doc.industry).toBe(expected.ar.industry);
        expect(doc.serviceCategory).toBe(expected.serviceCategory);
        expect(doc.projectDate).toBe(String(expected.year));
        expect(Array.isArray(doc.deliverables)).toBe(true);
        expect(Array.isArray(doc.results)).toBe(true);
        expect(doc.coverImageAlt).toBe(expected.ar.coverImageAlt);
        expect(doc.deliverables.length).toBe(expected.ar.deliverables.length);

        // English check
        const enProject = await payload.find({
          collection: 'portfolio-projects',
          where: { slug: { equals: expected.slug } },
          locale: 'en',
          limit: 1,
          overrideAccess: true,
        });

        expect(enProject.docs.length).toBe(1);
        const enDoc = enProject.docs[0];
        expect(enDoc.title).toBe(expected.en.title);
        expect(enDoc.clientName).toBe(expected.en.clientName);
        expect(enDoc.industry).toBe(expected.en.industry);
      }
    });

    it('demonstrates 100% idempotency: re-running importPortfolio updates in-place', async () => {
      const secondSummary = await importPortfolio(payload);

      expect(secondSummary.created).toBe(0);
      expect(secondSummary.updated).toBe(legacyPortfolioData.length);

      const allProjects = await payload.find({
        collection: 'portfolio-projects',
        limit: 100,
        overrideAccess: true,
      });

      expect(allProjects.totalDocs).toBe(legacyPortfolioData.length);
    });
  });

  // ===========================================================================
  // 4. Master Migration Orchestrator (runContentMigration)
  // ===========================================================================
  describe('4. Master Migration Pipeline Runner', () => {
    it('executes full content migration pipeline cleanly within reasonable time and returns complete summary', async () => {
      const report = await runContentMigration();

      expect(report).toBeDefined();
      expect(report.services.total).toBe(6);
      expect(report.posts.total).toBe(3);
      expect(report.portfolio.total).toBe(3);
      expect(report.durationMs).toBeGreaterThan(0);
      expect(report.durationMs).toBeLessThan(30000); // completes in well under 30s
    });
  });
});
