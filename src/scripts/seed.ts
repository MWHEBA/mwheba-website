import { getPayload } from 'payload';
import config from '../payload.config';
import { logger } from '../shared/lib/logger';

async function seed() {
  logger.info('Starting MWHEBA 2.0 database seeding...');
  const payload = await getPayload({ config });

  // 1. Create or verify Super Admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@mwheba.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'MwhebaAdmin2026!Secure';

  const existingAdmin = await payload.find({
    collection: 'users',
    where: { email: { equals: adminEmail } },
    limit: 1,
  });

  let adminUser: any = existingAdmin.docs[0];
  if (!adminUser) {
    logger.info(`Creating super_admin user: ${adminEmail}`);
    adminUser = await payload.create({
      collection: 'users',
      data: {
        email: adminEmail,
        password: adminPassword,
        name: 'MWHEBA Super Admin',
        roles: ['super_admin'],
      },
      context: { isSystemSeed: true },
    });
    logger.info('Super admin created successfully.');
  } else {
    logger.info(`Super admin ${adminEmail} already exists. Skipping.`);
  }

  // 2. Create or verify Staff users for RBAC testing
  const staffRoles = [
    { email: 'finance@mwheba.com', name: 'MWHEBA Finance', roles: ['finance'] },
    { email: 'operations@mwheba.com', name: 'MWHEBA Operations', roles: ['operations'] },
    { email: 'catalog@mwheba.com', name: 'MWHEBA Catalog Manager', roles: ['catalog_manager'] },
    { email: 'marketer@mwheba.com', name: 'MWHEBA Marketing', roles: ['marketer'] },
    { email: 'client@example.com', name: 'Sample Corporate Client', roles: ['customer'] },
  ];

  for (const staff of staffRoles) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: staff.email } },
      limit: 1,
    });
    if (!existing.docs.length) {
      await payload.create({
        collection: 'users',
        data: {
          email: staff.email,
          password: 'Password123!Secure',
          name: staff.name,
          roles: staff.roles as any,
        },
        context: { isSystemSeed: true },
      });
      logger.info(`Created user ${staff.email} with roles: ${staff.roles.join(', ')}`);
    }
  }

  // 3. Create or verify Categories
  const categories = [
    { title: 'Corporate Merchandise & Giveaways', slug: 'merchandise' },
    { title: 'Digital Creative & Branding Services', slug: 'services' },
  ];

  const categoryMap = new Map<string, string | number>();
  for (const cat of categories) {
    const existing = await payload.find({
      collection: 'categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
    });
    if (existing.docs.length > 0) {
      categoryMap.set(cat.slug, existing.docs[0].id);
    } else {
      const created = await payload.create({
        collection: 'categories',
        data: {
          title: cat.title,
          slug: cat.slug,
        },
      });
      categoryMap.set(cat.slug, created.id);
      logger.info(`Created category: ${cat.title}`);
    }
  }

  // 4. Create sample Physical Product: Thermal Travel Mug (MOQ 10, variants, printing fee 35 EGP)
  const mugSlug = 'premium-thermal-mug';
  const existingMug = await payload.find({
    collection: 'products',
    where: { slug: { equals: mugSlug } },
    limit: 1,
  });

  let mugProduct: any = existingMug.docs[0];
  if (!mugProduct) {
    mugProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'Premium Stainless Thermal Travel Mug 500ml',
        slug: mugSlug,
        itemType: 'physical',
        productType: 'physical',
        minOrderQuantity: 10,
        basePrice: 250,
        customizationFee: 35,
        enableVariants: true,
        _status: 'published',
      },
    });
    logger.info(`Created physical product: ${mugProduct.title}`);

    // Create variants for Product A: Matte Black, Pearl White, Brushed Silver
    const variantColors = [
      { name: 'Matte Black', price: 250 },
      { name: 'Pearl White', price: 250 },
      { name: 'Brushed Silver', price: 260 },
    ];

    for (const v of variantColors) {
      await payload.create({
        collection: 'variants',
        data: {
          title: v.name,
          product: mugProduct.id,
          priceInEGP: v.price,
          _status: 'published',
          options: [],
        },
      });
      logger.info(`Created variant: ${v.name} for mug product.`);
    }
  } else {
    logger.info(`Product ${mugSlug} already exists. Skipping.`);
  }

  // 5. Create sample Digital Service Package: Brand Identity Package (MOQ 1, zero shipping)
  const serviceSlug = 'brand-identity-package';
  const existingService = await payload.find({
    collection: 'products',
    where: { slug: { equals: serviceSlug } },
    limit: 1,
  });

  if (!existingService.docs.length) {
    const serviceProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'Corporate Brand Identity & Guidelines Package',
        slug: serviceSlug,
        itemType: 'service',
        productType: 'fixed_service',
        minOrderQuantity: 1,
        basePrice: 15000,
        customizationFee: 0,
        enableVariants: false,
        _status: 'published',
      },
    });
    logger.info(`Created digital service package: ${serviceProduct.title}`);
  } else {
    logger.info(`Service ${serviceSlug} already exists. Skipping.`);
  }

  logger.info('Database seeding completed successfully and idempotently.');
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Failed to seed database', { error: err.message, stack: err.stack });
  process.exit(1);
});
