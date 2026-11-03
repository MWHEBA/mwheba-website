import { getPayload } from 'payload';
import configPromise from '../payload.config';

async function seed() {
  const payload = await getPayload({ config: configPromise });

  console.log('Seeding representative data for POC-12 Admin Walkthrough...');

  // 1. Ensure Admin User
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@mwheba.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Password123!';
  
  const existingAdmins = await payload.find({
    collection: 'users',
    where: { email: { equals: adminEmail } },
    overrideAccess: true,
  });

  let adminUser: any;
  if (existingAdmins.docs.length === 0) {
    adminUser = await payload.create({
      collection: 'users',
      data: {
        email: adminEmail,
        password: adminPassword,
        roles: ['admin', 'finance'],
      },
      context: { isSystemSeed: true },
    });
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    adminUser = existingAdmins.docs[0];
    console.log(`Found existing admin user: ${adminEmail}`);
  }

  // 2. Ensure Representative Physical Product
  const existingMugs = await payload.find({
    collection: 'products',
    where: { slug: { equals: 'corporate-steel-tumbler' } },
    overrideAccess: true,
  });

  let physicalProduct: any;
  if (existingMugs.docs.length === 0) {
    physicalProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'Corporate Stainless Steel Tumbler (500ml)',
        slug: 'corporate-steel-tumbler',
        _status: 'published',
        itemType: 'physical',
        minOrderQuantity: 10,
        basePrice: 200,
        customizationFee: 25,
      },
      overrideAccess: true,
    });
    console.log('Created physical product: Corporate Stainless Steel Tumbler');
  } else {
    physicalProduct = existingMugs.docs[0];
    console.log('Found physical product: Corporate Stainless Steel Tumbler');
  }

  // 3. Ensure Representative Service Product
  const existingServices = await payload.find({
    collection: 'products',
    where: { slug: { equals: 'enterprise-brand-identity' } },
    overrideAccess: true,
  });

  let serviceProduct: any;
  if (existingServices.docs.length === 0) {
    serviceProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'Enterprise Brand Identity & Guidelines Package',
        slug: 'enterprise-brand-identity',
        _status: 'published',
        itemType: 'service',
        minOrderQuantity: 1,
        basePrice: 25000,
        customizationFee: 0,
      },
      overrideAccess: true,
    });
    console.log('Created service product: Enterprise Brand Identity');
  } else {
    serviceProduct = existingServices.docs[0];
    console.log('Found service product: Enterprise Brand Identity');
  }

  // 4. Ensure Customer User
  const customerEmail = 'procurement@nile-holdings.com';
  const existingCustomers = await payload.find({
    collection: 'users',
    where: { email: { equals: customerEmail } },
    overrideAccess: true,
  });

  let customerUser: any;
  if (existingCustomers.docs.length === 0) {
    customerUser = await payload.create({
      collection: 'users',
      data: {
        email: customerEmail,
        password: 'Password123!',
        roles: ['customer'],
      },
      context: { isSystemSeed: true },
    });
    console.log(`Created customer user: ${customerEmail}`);
  } else {
    customerUser = existingCustomers.docs[0];
    console.log(`Found existing customer user: ${customerEmail}`);
  }

  // 5. Seed Representative Orders for Walkthrough
  const existingOrders = await payload.find({
    collection: 'orders',
    overrideAccess: true,
    limit: 5,
  });

  if (existingOrders.docs.length === 0) {
    // Order 1: Active COD Order (Proof Approved, Shipped, Payment Pending)
    await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerEmail,
        paymentMethod: 'cod',
        paymentStatus: 'unpaid',
        orderStatus: 'processing',
        fulfillmentStatus: 'shipped',
        proofStatus: 'proof_approved',
        remittanceStatus: 'pending_collection',
        subtotal: 2000,
        totalCustomizationFees: 250,
        shippingFee: 100,
        amount: 2350,
        total: 2350,
        items: [
          {
            product: physicalProduct.id,
            title: physicalProduct.title,
            quantity: 10,
            unitPrice: 200,
            customizationFee: 25,
            lineTotal: 2250,
            fulfillmentType: 'physical',
            printingNotes: 'Laser engraving front side with high contrast',
          },
        ],
      },
      overrideAccess: true,
    });
    console.log('Created sample COD order');

    // Order 2: Bank Transfer Order (Pending Finance Review)
    const bankOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUser.id,
        customerEmail: customerEmail,
        paymentMethod: 'bank_transfer',
        paymentStatus: 'pending_verification',
        orderStatus: 'confirmed',
        fulfillmentStatus: 'unfulfilled',
        proofStatus: 'proof_approved',
        subtotal: 25000,
        totalCustomizationFees: 0,
        shippingFee: 0,
        amount: 25000,
        total: 25000,
        items: [
          {
            product: serviceProduct.id,
            title: serviceProduct.title,
            quantity: 1,
            unitPrice: 25000,
            customizationFee: 0,
            lineTotal: 25000,
            fulfillmentType: 'service',
            printingNotes: 'Full brand guidelines document + vector package',
          },
        ],
      },
      overrideAccess: true,
    });

    // Create accompanying Bank Transfer Document
    await payload.create({
      collection: 'bank-transfers',
      data: {
        order: bankOrder.id,
        claimedAmount: 25000,
        bankReferenceCode: 'CIB-DEPOSIT-2026-REF88',
        status: 'pending_verification',
      },
      user: customerUser,
    });
    console.log('Created sample Bank Transfer order with pending verification');
  } else {
    console.log(`Found ${existingOrders.docs.length} existing orders in database.`);
  }

  console.log('Admin walkthrough data ready.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
