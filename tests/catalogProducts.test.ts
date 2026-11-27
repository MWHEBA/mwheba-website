import { randomUUID } from 'node:crypto';
import { getPayload, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config from '../src/payload.config';
import type { Product, User, Variant } from '../src/payload-types';
import {
  addItemToCart,
  getCartSummary,
  getOrCreateCart,
} from '../src/modules/cart-checkout/services/cartStorage';
import { readPublishedCatalog, readPublishedProduct } from '../src/modules/catalog/services/publishedCatalog';
import { openFixtureStock } from './fixtures/inventory';

describe('Published products and variants', () => {
  const fixture = 'products-' + randomUUID().slice(0, 8);
  const created: { collection: 'products' | 'variants' | 'variantTypes' | 'variantOptions' | 'media' | 'users' | 'carts'; id: number }[] = [];
  let payload: Payload;
  let manager: User;
  let customer: User;
  let simple: Product;
  let variable: Product;
  let foreignProduct: Product;
  let draftProduct: Product;
  let blue: Variant;
  let red: Variant;
  let draftVariant: Variant;
  let foreignVariant: Variant;
  let colorType: number;
  let blackOption: number;
  let publicMediaId: number;
  let unusedOption: number;

  async function createUser(role: User['roles'][number]) {
    const user = await payload.create({
      collection: 'users',
      data: { email: fixture + '-' + role + '@example.com', password: randomUUID(), roles: [role] },
      context: { isSystemSeed: true },
    });
    created.push({ collection: 'users', id: user.id });
    return { ...user, collection: 'users' as const };
  }

  async function createProduct(key: string, data: Partial<Product> = {}) {
    const product = await payload.create({
      collection: 'products',
      overrideAccess: false,
      user: manager,
      depth: 0,
      locale: 'ar',
      data: {
        title: fixture + ' ' + key,
        slug: fixture + '-' + key,
        productType: 'physical',
        basePrice: 100,
        _status: 'published',
        ...data,
      },
    });
    created.push({ collection: 'products', id: product.id });
    return product;
  }

  async function createVariant(product: Product, option: number, data: Partial<Variant> = {}) {
    const variant = await payload.create({
      collection: 'variants',
      overrideAccess: false,
      user: manager,
      depth: 0,
      data: { product: product.id, options: [option], _status: 'published', ...data },
    });
    created.push({ collection: 'variants', id: variant.id });
    return variant;
  }

  beforeAll(async () => {
    payload = await getPayload({ config });
    manager = await createUser('catalog_manager');
    customer = await createUser('customer');
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
      'base64',
    );
    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Catalog flask', mediaType: 'public' },
      file: { data: image, mimetype: 'image/png', name: fixture + '.png', size: image.length },
    });
    publicMediaId = media.id;
    created.push({ collection: 'media', id: media.id });

    const color = await payload.create({
      collection: 'variantTypes',
      data: { name: fixture + '-color', label: 'Color' },
    });
    colorType = color.id;
    created.push({ collection: 'variantTypes', id: color.id });
    const options = new Map<string, number>();
    for (const label of ['Blue', 'Red', 'Black', 'White']) {
      const option = await payload.create({
        collection: 'variantOptions',
        data: { variantType: color.id, label, value: label.toLowerCase() },
      });
      options.set(label, option.id);
      created.push({ collection: 'variantOptions', id: option.id });
    }
    blackOption = options.get('Black')!;
    unusedOption = options.get('White')!;

    simple = await createProduct('قارورة', {
      sku: '  ' + fixture + '-simple    ',
      storefrontTitle: 'قارورة للاختبار',
      storefrontDescription: 'وصف القارورة',
      gallery: [media.id],
      basePrice: 130,
      priceInEGP: 149.95,
    });
    await payload.update({
      collection: 'products',
      id: simple.id,
      overrideAccess: false,
      user: manager,
      locale: 'en',
      data: { storefrontTitle: 'Catalog flask', storefrontDescription: 'Reusable flask' },
    });
    variable = await createProduct('options', {
      enableVariants: true, variantTypes: [color.id], priceInEGP: 170, storefrontTitle: 'خيارات الألوان',
    });
    foreignProduct = await createProduct('foreign', { enableVariants: true, variantTypes: [color.id] });
    draftProduct = await createProduct('draft', { _status: 'draft' });
    blue = await createVariant(variable, options.get('Blue')!, { sku: fixture + '-blue', priceInEGP: 185.5 });
    red = await createVariant(variable, options.get('Red')!, { sku: fixture + '-red', priceInEGP: 219 });
    draftVariant = await createVariant(variable, blackOption, {
      sku: fixture + '-draft', priceInEGP: 1, _status: 'draft',
    });
    foreignVariant = await createVariant(foreignProduct, options.get('Blue')!, { sku: fixture + '-foreign', priceInEGP: 5 });
    await openFixtureStock(payload, 'product', simple.id);
    await openFixtureStock(payload, 'variant', blue.id);
    await openFixtureStock(payload, 'variant', red.id);
  });

  afterAll(async () => {
    if (!payload) return;
    for (const entry of created.reverse()) await payload.delete({ ...entry, depth: 0 });
  });

  it('projects current public media, localized copy and real published options', async () => {
    const en = await readPublishedProduct(payload, 'en', encodeURIComponent(simple.slug));
    const ar = await readPublishedProduct(payload, 'ar', simple.slug);
    expect(ar).toMatchObject({ id: simple.id, title: 'قارورة للاختبار', description: 'وصف القارورة' });
    expect(en).toMatchObject({
      id: simple.id, title: 'Catalog flask', description: 'Reusable flask', sku: fixture + '-simple', price: 149.95,
    });
    const rawProduct = await payload.findByID({ collection: 'products', id: simple.id, depth: 1, overrideAccess: false, locale: 'en' });
    expect(rawProduct.gallery?.[0]).toMatchObject({ id: publicMediaId, mediaType: 'public', url: expect.any(String) });
    expect(en?.media).toEqual([{
      id: publicMediaId, alt: 'Catalog flask', url: expect.stringContaining(fixture + '.png'), width: 1, height: 1,
    }]);
    expect(en).not.toHaveProperty('createdAt');

    const detail = await readPublishedProduct(payload, 'en', variable.slug);
    expect(detail).toMatchObject({ id: variable.id, title: 'خيارات الألوان', price: 185.5, sku: null });
    expect(detail?.variants).toMatchObject([
      { id: blue.id, sku: blue.sku, price: 185.5, options: [{ label: 'Blue', typeId: colorType, typeLabel: 'Color' }] },
      { id: red.id, sku: red.sku, price: 219, options: [{ label: 'Red', typeId: colorType, typeLabel: 'Color' }] },
    ]);
    const listing = await readPublishedCatalog(payload, 'en', { q: fixture });
    expect(listing.products).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: simple.id, price: 149.95 }),
      expect.objectContaining({ id: variable.id, price: 185.5 }),
    ]));
    expect(listing.products.map(({ id }) => id)).not.toContain(draftProduct.id);
    await expect(readPublishedProduct(payload, 'en', draftProduct.slug)).resolves.toBeNull();
  });

  it('persists simple and variant relationships and rehydrates the selected SKUs and EGP amounts', async () => {
    const cart = await getOrCreateCart(payload);
    created.push({ collection: 'carts', id: cart.id });
    await addItemToCart(payload, cart.id, { productId: simple.id, quantity: 10, operationKey: randomUUID() }, 'en');
    await addItemToCart(payload, cart.id, { productId: variable.id, variantId: blue.id, quantity: 5, operationKey: randomUUID() });
    const summary = await addItemToCart(payload, cart.id, {
      productId: variable.id, variantId: red.id, quantity: 5, operationKey: randomUUID(),
    }, 'en');

    expect(summary.canCheckout).toBe(true);
    expect(summary.productGroupings[variable.id]).toMatchObject({ totalQuantity: 10, isSatisfied: true });
    const stored = await payload.findByID({ collection: 'carts', id: cart.id, depth: 0 });
    expect(stored.items).toMatchObject([
      { product: simple.id, quantity: 10 },
      { product: variable.id, variant: blue.id, quantity: 5 },
      { product: variable.id, variant: red.id, quantity: 5 },
    ]);
    const refreshed = await getCartSummary(payload, cart.id, 0, 'en');
    expect(refreshed.items).toMatchObject([
      { productId: simple.id, productTitle: 'Catalog flask', sku: fixture + '-simple', unitPrice: 149.95 },
      { productId: variable.id, variantId: blue.id, sku: blue.sku, unitPrice: 185.5 },
      { productId: variable.id, variantId: red.id, sku: red.sku, unitPrice: 219 },
    ]);
    expect(stored.subtotal).toBeCloseTo(3522);
    expect(refreshed.subtotal).toBeCloseTo(3522);

    for (const [productId, variantId, error] of [
      [variable.id, 0, 'VARIANT_UNAVAILABLE'],
      [variable.id, 2_000_000_000, 'VARIANT_UNAVAILABLE'],
      [variable.id, undefined, 'VARIANT_REQUIRED'],
      [variable.id, draftVariant.id, 'VARIANT_UNAVAILABLE'],
      [variable.id, foreignVariant.id, 'VARIANT_MISMATCH'],
      [draftProduct.id, undefined, 'PRODUCT_UNAVAILABLE'],
    ] as const) {
      await expect(addItemToCart(payload, cart.id, { productId, variantId, quantity: 1, operationKey: randomUUID() }))
        .rejects.toMatchObject({ status: 422, message: expect.stringContaining(error) });
    }

    const unchanged = await payload.findByID({ collection: 'carts', id: cart.id, depth: 0 });
    expect(unchanged.items).toEqual(stored.items);
    expect(unchanged.appliedOperations).toEqual(stored.appliedOperations);
    expect(unchanged.subtotal).toBe(stored.subtotal);
  });

  it('hides an unpublished product and rejects an existing cart line after unpublishing', async () => {
    const archived = await createProduct('archive', { sku: fixture + '-archive' });
    await openFixtureStock(payload, 'product', archived.id);
    const cart = await getOrCreateCart(payload);
    created.push({ collection: 'carts', id: cart.id });
    const item = { productId: archived.id, quantity: 10, operationKey: randomUUID() };
    await expect(addItemToCart(payload, cart.id, item)).resolves.toMatchObject({ canCheckout: true });

    await payload.update({
      collection: 'products', id: archived.id, data: { _status: 'draft' },
      unpublishAllLocales: true, overrideAccess: false, user: manager,
    });
    await expect(readPublishedProduct(payload, 'en', archived.slug)).resolves.toBeNull();
    await expect(addItemToCart(payload, cart.id, { ...item, operationKey: randomUUID() }))
      .rejects.toMatchObject({ status: 422, message: expect.stringContaining('PRODUCT_UNAVAILABLE') });
    const summary = await getCartSummary(payload, cart.id);
    expect(summary.canCheckout).toBe(false);
    expect(summary.items[0].availabilityError).toContain('PRODUCT_UNAVAILABLE');
  });

  it('rejects a normalized duplicate SKU across both collections', async () => {
    await expect(createVariant(variable, unusedOption, {
      sku: '  ' + simple.sku!.toUpperCase() + '  ', priceInEGP: 200,
    })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('sku') });
    await expect(createProduct('collision', { sku: '  ' + blue.sku!.toUpperCase() + '  ' }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('sku') });
    const saved = await payload.findByID({ collection: 'variants', id: blue.id });
    expect(saved.sku).toBe(fixture + '-blue');
  });

  it('permits a manager to price and publish a variant while restricting destructive and cross-domain writes', async () => {
    const draft = await createVariant(variable, unusedOption, { sku: fixture + '-restricted', _status: 'draft' });
    const published = await payload.update({
      collection: 'variants', id: draft.id, data: { _status: 'published', priceInEGP: 0 },
      overrideAccess: false, user: manager,
    });
    expect(published).toMatchObject({ _status: 'published', priceInEGP: 0 });
    const zero = await readPublishedProduct(payload, 'en', variable.slug);
    expect(zero?.variants.find(({ id }) => id === draft.id)).toMatchObject({ price: 0, sku: draft.sku });

    await expect(payload.update({
      collection: 'variants', id: draft.id, data: { priceInEGP: 9 }, overrideAccess: false, user: customer,
    })).rejects.toMatchObject({ status: 403 });
    await expect(payload.delete({
      collection: 'variants', id: draft.id, overrideAccess: false, user: manager,
    })).rejects.toMatchObject({ status: 403 });
    await expect(payload.delete({
      collection: 'products', id: simple.id, overrideAccess: false, user: manager,
    })).rejects.toMatchObject({ status: 403 });
    await expect(payload.update({
      collection: 'users', id: customer.id, data: { roles: ['super_admin'] }, overrideAccess: false, user: manager,
    })).rejects.toThrow(/Privilege Escalation Forbidden/);
  });
});
