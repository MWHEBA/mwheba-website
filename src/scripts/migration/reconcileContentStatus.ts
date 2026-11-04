import { getPayload } from 'payload';
import config from '../../payload.config';
import { logger } from '../../shared/lib/logger';

/**
 * Reconciles content status in database:
 * Guarantees that unapproved drafts (case studies without verified data, proposed blog articles)
 * are NEVER left with _status: 'published'.
 */
export async function reconcileContentStatus() {
  logger.info('Starting content status reconciliation...');
  const payload = await getPayload({ config });

  let updatedPosts = 0;
  let updatedProjects = 0;

  // 1. Audit Blog Posts
  const posts = await payload.find({
    collection: 'blog-posts',
    draft: true,
    limit: 500,
    overrideAccess: true,
  });

  for (const post of posts.docs) {
    if (post.approvalStatus !== 'approved_for_publishing' && post._status === 'published') {
      await payload.update({
        collection: 'blog-posts',
        id: post.id,
        data: {
          _status: 'draft',
        },
        draft: true,
        overrideAccess: true,
      });
      updatedPosts++;
      logger.info(`Reconciled blog post #${post.id} (${post.slug}) to draft status.`);
    }
  }

  // 2. Audit Portfolio Projects
  const projects = await payload.find({
    collection: 'portfolio-projects',
    draft: true,
    limit: 500,
    overrideAccess: true,
  });

  for (const project of projects.docs) {
    if (project.approvalStatus !== 'approved_for_publishing' && project._status === 'published') {
      await payload.update({
        collection: 'portfolio-projects',
        id: project.id,
        data: {
          _status: 'draft',
        },
        draft: true,
        overrideAccess: true,
      });
      updatedProjects++;
      logger.info(`Reconciled portfolio project #${project.id} (${project.slug}) to draft status.`);
    }
  }

  logger.info(`Reconciliation complete: ${updatedPosts} posts reconciled, ${updatedProjects} projects reconciled.`);
  return { updatedPosts, updatedProjects };
}

if (process.argv[1]?.endsWith('reconcileContentStatus.ts')) {
  reconcileContentStatus()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

