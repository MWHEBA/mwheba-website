import { randomUUID } from 'node:crypto';
import { getPayload, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config from '../src/payload.config';
import type { Product, User } from '../src/payload-types';
import {
  CATALOG_PAGE_SIZE,
  readPublishedCatalog,
  readPublishedProduct,
} from '../src/modules/catalog/services/publishedCatalog';

describe('Published product taxonomy', () => {
  let payload: Payload;
  let manager: User;
  let customer: User;
  let category: number;
  let tag: number;
  let service: Product;
  let archiveCandidate: Product;
  let archivedCategory: number;
  let archivedTag: number;
  const fixture = `taxonomy-${randomUUID().slice(0, 8)}`;
  const categorySlug = `${fixture}-category`;
  const tagSlug = `${fixture}-tag`;
  const archivedCategorySlug = `${fixture}-archived-category`;
  const archivedTagSlug = `${fixture}-archived-tag`;
  const created: { collection: 'products' | 'categories' | 'product-tags' | 'users'; id: number }[] = [];

  async function createUser(role: User['roles'][number]) {
    const user = await payload.create({
      collection: 'users',
      data: { email: `${fixture}-${role}@example.com`, password: randomUUID(), roles: [role] },
      context: { isSystemSeed: true },
    });
    created.push({ collection: 'users', id: user.id });
    return { ...user, collection: 'users' as const };
  }

  async function createCategory(slug: string) {
    const term = await payload.create({
      collection: 'categories',
      data: { slug, title: slug },
      overrideAccess: false,
      user: manager,
    });
    created.push({ collection: 'categories', id: term.id });
    return term;
  }

  async function createTag(slug: string) {
    const term = await payload.create({
      collection: 'product-tags',
      data: { slug, title: 'هدايا الشركات' },
      locale: 'ar',
      overrideAccess: false,
      user: manager,
    });
    created.push({ collection: 'product-tags', id: term.id });
    await payload.update({
      collection: 'product-tags',
      id: term.id,
      data: { title: 'Corporate gifts' },
      locale: 'en',
      overrideAccess: false,
      user: manager,
    });
    return term;
  }

  async function createProduct(key: string, data: Partial<Product> = {}) {
    const product = await payload.create({
      collection: 'products',
      data: {
        title: `${fixture} ${key}`,
        slug: `${fixture}-${key}`,
        productType: 'physical',
        _status: 'published',
        ...data,
      },
      depth: 0,
    });
    created.push({ collection: 'products', id: product.id });
    return product;
  }

  beforeAll(async () => {
    payload = await getPayload({ config });
    manager = await createUser('catalog_manager');
    customer = await createUser('customer');
    category = (await createCategory(categorySlug)).id;
    tag = (await createTag(tagSlug)).id;
    archivedCategory = (await createCategory(archivedCategorySlug)).id;
    archivedTag = (await createTag(archivedTagSlug)).id;
    await createProduct('both', { category, tags: [tag, archivedTag] });
    await createProduct('category-only', { category });
    await createProduct('tag-only', { tags: [tag] });
    await createProduct('draft', { category, tags: [tag], _status: 'draft' });
    archiveCandidate = await createProduct('archive-candidate', {
      category: archivedCategory,
      tags: [archivedTag],
    });
    service = await createProduct('service', { productType: 'fixed_service', basePrice: 275 });
    await payload.update({
      collection: 'categories', id: archivedCategory, data: { isActive: false },
      overrideAccess: false, user: manager,
    });
    await payload.update({
      collection: 'product-tags', id: archivedTag, data: { isActive: false },
      overrideAccess: false, user: manager,
    });
  });

  afterAll(async () => {
    for (const record of created.reverse()) {
      await payload.delete(record);
    }
  });

  it('intersects category and tag filters over published products only', async () => {
    const byCategory = await readPublishedCatalog(payload, 'ar', { category: categorySlug });
    const byTag = await readPublishedCatalog(payload, 'ar', { tag: tagSlug });
    const byBoth = await readPublishedCatalog(payload, 'ar', { category: categorySlug, tag: tagSlug });
    expect(byCategory.products.map(({ slug }) => slug).sort())
      .toEqual([`${fixture}-both`, `${fixture}-category-only`]);
    expect(byTag.products.map(({ slug }) => slug).sort())
      .toEqual([`${fixture}-both`, `${fixture}-tag-only`]);
    expect(byBoth.products.map(({ slug }) => slug)).toEqual([`${fixture}-both`]);
    expect(byBoth.totalDocs).toBe(1);

    const literalSearch = await readPublishedCatalog(payload, 'ar', { category: categorySlug, q: `${fixture}%` });
    expect(literalSearch.products).toEqual([]);
  });

  it('hides archived terms while preserving publication of their products', async () => {
    const listing = await readPublishedCatalog(payload, 'ar', {});
    expect(listing.categories.map(({ slug }) => slug)).not.toContain(archivedCategorySlug);
    expect(listing.tags.map(({ slug }) => slug)).not.toContain(archivedTagSlug);
    expect(listing.products.map(({ id }) => id)).toContain(archiveCandidate.id);

    for (const filters of [
      { category: archivedCategorySlug },
      { tag: archivedTagSlug },
      { category: categorySlug, tag: `${fixture}-missing-tag` },
      { category: `${fixture}-missing-category` },
      { tag: [tagSlug, tagSlug] },
    ]) {
      const result = await readPublishedCatalog(payload, 'ar', filters);
      expect(result).toMatchObject({ invalid: true, totalDocs: 0, products: [] });
    }
  });

  it('blocks deletion of referenced terms and hides archived terms from customer reads', async () => {
    await expect(payload.delete({
      collection: 'categories', id: archivedCategory, overrideAccess: false, user: manager,
    })).rejects.toMatchObject({ status: 409 });
    await expect(payload.delete({
      collection: 'product-tags', id: archivedTag, overrideAccess: false, user: manager,
    })).rejects.toMatchObject({ status: 409 });
    const customerTerms = await payload.find({
      collection: 'product-tags', overrideAccess: false, user: customer,
      where: { id: { in: [tag, archivedTag] } },
    });
    expect(customerTerms.docs.map(({ id }) => id)).toEqual([tag]);
  });

  it('uses the requested label locale with the same public tag identity', async () => {
    const arabic = await readPublishedCatalog(payload, 'ar', { tag: tagSlug });
    const english = await readPublishedCatalog(payload, 'en', { tag: tagSlug });
    expect(arabic.tags).toContainEqual({ id: tag, slug: tagSlug, title: 'هدايا الشركات' });
    expect(english.tags).toContainEqual({ id: tag, slug: tagSlug, title: 'Corporate gifts' });
    expect(arabic.products.map(({ id }) => id)).toEqual(english.products.map(({ id }) => id));
  });

  it('bounds pages and keeps matching products distinct across consecutive pages', async () => {
    const paginationTag = await createTag(`${fixture}-pagination`);
    for (let index = 0; index < CATALOG_PAGE_SIZE + 1; index++) {
      await createProduct(`paged-${index}`, { category, tags: [paginationTag.id] });
    }

    const filters = { category: categorySlug, tag: paginationTag.slug };
    const first = await readPublishedCatalog(payload, 'en', filters);
    const second = await readPublishedCatalog(payload, 'en', { ...filters, page: '2' });
    const repeated = await readPublishedCatalog(payload, 'en', { ...filters, page: '1' });
    expect(first).toMatchObject({ page: 1, totalPages: 2, totalDocs: CATALOG_PAGE_SIZE + 1 });
    expect(first.products).toHaveLength(CATALOG_PAGE_SIZE);
    expect(second).toMatchObject({ page: 2, totalPages: 2, totalDocs: CATALOG_PAGE_SIZE + 1 });
    expect(second.products).toHaveLength(1);
    expect(first.products.map(({ id }) => id)).not.toContain(second.products[0].id);
    expect(repeated.products.map(({ id }) => id)).toEqual(first.products.map(({ id }) => id));
    const excessive = await readPublishedCatalog(payload, 'en', { ...filters, page: '1001' });
    expect(excessive).toMatchObject({ invalid: true, totalDocs: 0, products: [] });
  });

  it('rejects duplicate slugs and nonexistent relationship targets', async () => {
    await expect(createCategory(categorySlug)).rejects.toThrow();
    await expect(createTag(tagSlug)).rejects.toThrow();
    await expect(payload.update({
      collection: 'products', id: service.id, data: { tags: [2_000_000_000] },
    })).rejects.toThrow();
    await expect(payload.update({
      collection: 'products', id: service.id, data: { category: 2_000_000_000 }, draft: true,
      overrideAccess: false, user: manager,
    })).rejects.toThrow();
    const saved = await payload.findByID({ collection: 'products', id: service.id, depth: 0 });
    expect(saved.tags ?? []).toEqual([]);
  });

  it('keeps published slugs stable while allowing edits to taxonomy labels', async () => {
    const legacySlug = `${fixture}-Legacy-${'ه'.repeat(210)}`;
    const legacyCategory = await createCategory(legacySlug);
    const labeledTag = await createTag(`${fixture}-editable-label`);
    const product = await createProduct('legacy', { category: legacyCategory.id, slug: `${legacySlug}-product` });
    const attemptedSlug = `${fixture}-attempted-rename`;
    const updatedCategory = await payload.update({
      collection: 'categories', id: legacyCategory.id, data: { slug: attemptedSlug, title: 'New category label' },
      overrideAccess: false, user: manager,
    });
    const updatedTag = await payload.update({
      collection: 'product-tags', id: labeledTag.id, data: { slug: attemptedSlug, title: 'New tag label' },
      locale: 'en', overrideAccess: false, user: manager,
    });
    expect(updatedCategory).toMatchObject({ slug: legacySlug, title: 'New category label' });
    expect(updatedTag).toMatchObject({ slug: labeledTag.slug, title: 'New tag label' });
    const catalog = await readPublishedCatalog(payload, 'en', { category: legacySlug });
    expect(catalog.products.map(({ id }) => id)).toEqual([product.id]);
    await expect(readPublishedProduct(payload, 'en', product.slug)).resolves.toMatchObject({ id: product.id });
  });

  it('returns no public detail for a stored draft or a missing slug', async () => {
    const draft = await createProduct('shadowing-draft', { _status: 'draft', slug: `${fixture}-demo-slug` });
    await expect(readPublishedProduct(payload, 'ar', draft.slug)).resolves.toBeNull();
    await expect(readPublishedProduct(payload, 'ar', `${fixture}-no-product`)).resolves.toBeNull();
  });

  it('permits customer label reads, protects customer writes and keeps draft assignments off the storefront', async () => {
    await expect(payload.findByID({
      collection: 'product-tags', id: tag, overrideAccess: false, user: customer,
    })).resolves.toMatchObject({ id: tag, title: 'هدايا الشركات' });
    await expect(payload.update({
      collection: 'product-tags', id: tag, data: { title: 'Unauthorized edit' },
      overrideAccess: false, user: customer,
    })).rejects.toThrow();
    await expect(payload.update({
      collection: 'products', id: service.id, data: { tags: [tag] }, draft: true,
      overrideAccess: false, user: customer,
    })).rejects.toThrow();
    await payload.update({
      collection: 'products', id: service.id, data: { category, tags: [tag] }, draft: true,
      depth: 0, overrideAccess: false, user: manager,
    });
    const draft = await payload.findByID({ collection: 'products', id: service.id, draft: true, depth: 0 });
    expect(draft).toMatchObject({
      category, tags: [tag], productType: 'fixed_service', itemType: 'service',
      basePrice: 275, minOrderQuantity: 1,
    });

    await payload.update({
      collection: 'products', id: service.id, data: { basePrice: 1, tags: [tag] }, draft: true,
      overrideAccess: false, user: manager,
    });
    const live = await payload.findByID({ collection: 'products', id: service.id, depth: 0 });
    expect(live).toMatchObject({ _status: 'published', basePrice: 275 });
    expect(live.category ?? null).toBeNull();
    expect(live.tags ?? []).toEqual([]);
    const latestDraft = await payload.findByID({ collection: 'products', id: service.id, draft: true, depth: 0 });
    expect(latestDraft).toMatchObject({ category, tags: [tag], basePrice: 1 });
  });

  it('blocks deleting terms referenced only by a historical product draft', async () => {
    const historicalCategory = await createCategory(`${fixture}-historical-category`);
    const historicalTag = await createTag(`${fixture}-historical-tag`);
    const product = await createProduct('historical');
    const updateDraft = {
      collection: 'products' as const,
      id: product.id,
      draft: true,
      overrideAccess: false,
      user: manager,
    };
    await payload.update({ ...updateDraft, data: { category: historicalCategory.id, tags: [historicalTag.id] } });
    await payload.update({ ...updateDraft, data: { category: null, tags: [] } });
    const latest = await payload.findByID({ collection: 'products', id: product.id, draft: true, depth: 0 });
    expect(latest.category ?? null).toBeNull();
    expect(latest.tags ?? []).toEqual([]);

    await expect(payload.delete({
      collection: 'categories', id: historicalCategory.id, overrideAccess: false, user: manager,
    })).rejects.toMatchObject({ status: 409 });
    await expect(payload.delete({
      collection: 'product-tags', id: historicalTag.id, overrideAccess: false, user: manager,
    })).rejects.toMatchObject({ status: 409 });
  });
});
