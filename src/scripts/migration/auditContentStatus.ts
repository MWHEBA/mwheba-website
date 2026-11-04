import { getPayload } from 'payload';
import config from '../../payload.config';

async function main() {
  const payload = await getPayload({ config });

  const posts = await payload.find({
    collection: 'blog-posts',
    draft: true,
    limit: 100,
    overrideAccess: true,
  });
  console.log('Blog posts in DB:', posts.docs.map((p: any) => ({ id: p.id, slug: p.slug, status: p._status })));

  const projects = await payload.find({
    collection: 'portfolio-projects',
    draft: true,
    limit: 100,
    overrideAccess: true,
  });
  console.log('Portfolio projects in DB:', projects.docs.map((pr: any) => ({ id: pr.id, slug: pr.slug, status: pr._status })));

  const services = await payload.find({
    collection: 'pages',
    where: { slug: { contains: 'services/' } },
    draft: true,
    limit: 100,
    overrideAccess: true,
  });
  console.log('Service pages in DB:', services.docs.map((s: any) => ({ id: s.id, slug: s.slug, status: s._status })));
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
