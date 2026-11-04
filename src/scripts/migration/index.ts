import { getPayload } from 'payload';
import config from '../../payload.config';
import { logger } from '../../shared/lib/logger';
import { importServices } from './importServices';
import { importPosts } from './importPosts';
import { importPortfolio } from './importPortfolio';

/**
 * Master Content Migration Runner (Ticket MIG-01)
 * Extracts and ingests historical and curated agency content into Payload CMS.
 */
export async function runContentMigration() {
  const startTime = Date.now();
  logger.info('====================================================');
  logger.info('MWHEBA 2.0 | Content Migration Pipeline (MIG-01)');
  logger.info('====================================================');

  const payload = await getPayload({ config });

  const servicesSummary = await importServices(payload);
  const postsSummary = await importPosts(payload);
  const portfolioSummary = await importPortfolio(payload);

  const durationMs = Date.now() - startTime;

  logger.info('----------------------------------------------------');
  logger.info('Migration Execution Summary:');
  logger.info(`- Services:  ${servicesSummary.created} created, ${servicesSummary.updated} updated (total: ${servicesSummary.total})`);
  logger.info(`- Posts:     ${postsSummary.created} created, ${postsSummary.updated} updated (total: ${postsSummary.total})`);
  logger.info(`- Portfolio: ${portfolioSummary.created} created, ${portfolioSummary.updated} updated (total: ${portfolioSummary.total})`);
  logger.info(`Total Execution Time: ${durationMs}ms`);
  logger.info('====================================================');

  return {
    services: servicesSummary,
    posts: postsSummary,
    portfolio: portfolioSummary,
    durationMs,
  };
}

if (process.argv[1]?.endsWith('index.ts')) {
  runContentMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Master migration failed:', err);
      process.exit(1);
    });
}
