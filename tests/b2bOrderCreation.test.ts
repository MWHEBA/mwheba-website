import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import { NextRequest } from 'next/server';
import configPromise from '@/payload.config';
import { signCartId } from '@/modules/cart-checkout/logic/cartSession';
import { CART_COOKIE_NAME, getOrCreateCart } from '@/modules/cart-checkout/services/cartStorage';
import { createOrderFromCart } from '@/modules/orders/services/orderService';
import { resolveDeliveryTariff } from '@/modules/orders/services/deliveryTariff';
import { POST as checkoutRoute } from '@/app/api/checkout/create-order/route';
import { POST as quoteRoute } from '@/app/api/checkout/quote/route';
import { GET as cartItemsGet, POST as cartItemsPost } from '@/app/api/cart/items/route';

describe('B2B-04: Mixed Cart, Inline Checkout Registration & Order Snapshots', () => {
  let payload: any;
  let physicalProductA: any; // e.g. Executive Flask (MOQ: 10, basePrice: 200, customFee: 30)
  let physicalProductWithVariants: any; // Product with variants (MOQ: 10)
  let variantRed: any;
  let variantBlue: any;
  let serviceProduct: any; // Digital Agency Service (MOQ: 1, basePrice: 15000, customFee: 0)
  let customerUser: any;
  let testAsset: any;

  const cleanupUserIds: (string | number)[] = [];
  const cleanupOrderIds: (string | number)[] = [];
  const cleanupCartIds: (string | number)[] = [];
  const cleanupAssetIds: (string | number)[] = [];
  const cleanupProductIds: (string | number)[] = [];

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    // 1. Create a physical product with MOQ = 10, customization fee = 30 EGP
    physicalProductA = await payload.create({
      collection: 'products',
      data: {
        title: 'B2B Thermal Flask Executive',
        slug: `flask-exec-${Date.now()}`,
        itemType: 'physical',
        basePrice: 200,
        priceInEGP: 200,
        customizationFee: 30,
        minOrderQuantity: 10,
        sku: 'FLASK-EXEC-01',
        _status: 'published',
      },
    });
    cleanupProductIds.push(physicalProductA.id);

    // 2. Create physical product with multiple variants for MOQ aggregation testing
    const colorType = await payload.create({
      collection: 'variantTypes',
      data: {
        name: `color_${Date.now()}`,
        label: 'Color',
      },
    });

    const redOption = await payload.create({
      collection: 'variantOptions',
      data: {
        variantType: colorType.id,
        label: 'Ruby Red',
        value: `red_${Date.now()}`,
      },
    });

    const blueOption = await payload.create({
      collection: 'variantOptions',
      data: {
        variantType: colorType.id,
        label: 'Sapphire Blue',
        value: `blue_${Date.now()}`,
      },
    });

    physicalProductWithVariants = await payload.create({
      collection: 'products',
      data: {
        title: 'B2B Corporate Ceramic Mug',
        slug: `corp-mug-${Date.now()}`,
        itemType: 'physical',
        basePrice: 80,
        priceInEGP: 80,
        customizationFee: 15,
        minOrderQuantity: 10,
        enableVariants: true,
        variantTypes: [colorType.id],
        sku: 'MUG-CORP-BASE',
        _status: 'published',
      },
    });
    cleanupProductIds.push(physicalProductWithVariants.id);

    variantRed = await payload.create({
      collection: 'variants',
      data: {
        title: 'Mug - Ruby Red',
        product: physicalProductWithVariants.id,
        options: [redOption.id],
        priceInEGP: 85,
        _status: 'published',
      },
    });

    variantBlue = await payload.create({
      collection: 'variants',
      data: {
        title: 'Mug - Sapphire Blue',
        product: physicalProductWithVariants.id,
        options: [blueOption.id],
        priceInEGP: 85,
        _status: 'published',
      },
    });

    // 3. Create digital service package with MOQ = 1
    serviceProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'Complete Corporate Identity & Brand Guidelines',
        slug: `corp-branding-${Date.now()}`,
        itemType: 'service',
        basePrice: 15000,
        priceInEGP: 15000,
        customizationFee: 0,
        minOrderQuantity: 1,
        sku: 'SRV-BRANDING-FULL',
        _status: 'published',
      },
    });
    cleanupProductIds.push(serviceProduct.id);

    // 4. Create an existing customer user for authenticated checkout tests
    const existingUser = await payload.create({
      collection: 'users',
      data: {
        email: `pre_existing_customer_${Date.now()}@mwheba-client.com`,
        password: 'SecurePassword2026!',
        roles: ['customer'],
      },
    });
    customerUser = existingUser;
    cleanupUserIds.push(existingUser.id);

    // 5. Create a test artwork asset
    testAsset = await payload.create({
      collection: 'artwork-assets',
      data: {
        storageKey: `artwork/test_logo_${Date.now()}.svg`,
        originalFilename: 'corporate_logo_vector.svg',
        mimeType: 'image/svg+xml',
        fileSize: 45000,
        status: 'pending_order',
        scanStatus: 'clean',
        verificationStatus: 'valid',
        ownerSession: 'test-session',
      },
      context: {
        isTrustedUpload: true,
      },
    });
    cleanupAssetIds.push(testAsset.id);
  });

  afterAll(async () => {
    // Clean up created orders
    for (const orderId of cleanupOrderIds) {
      try {
        await payload.delete({ collection: 'orders', id: orderId });
      } catch {}
    }
    // Clean up created users
    for (const userId of cleanupUserIds) {
      try {
        await payload.delete({ collection: 'users', id: userId });
      } catch {}
    }
    // Clean up created assets
    for (const assetId of cleanupAssetIds) {
      try {
        await payload.delete({ collection: 'artwork-assets', id: assetId, context: { isTrustedUpload: true } });
      } catch {}
    }
    // Clean up created products and variants
    if (variantRed) try { await payload.delete({ collection: 'variants', id: variantRed.id }); } catch {}
    if (variantBlue) try { await payload.delete({ collection: 'variants', id: variantBlue.id }); } catch {}
    for (const prodId of cleanupProductIds) {
      try {
        await payload.delete({ collection: 'products', id: prodId });
      } catch {}
    }
    // Clean up carts
    for (const cartId of cleanupCartIds) {
      try {
        await payload.delete({ collection: 'carts', id: cartId });
      } catch {}
    }
  });

  // =========================================================================
  // 1. Strict Product ID MOQ Governance (D-009)
  // =========================================================================
  describe('1. Minimum Order Quantity (MOQ) Validation at Checkout', () => {
    it('strictly rejects checkout when physical product quantity is under 10 units', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      // Add only 5 units of flask (MOQ is 10)
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [
            {
              product: physicalProductA.id,
              quantity: 5,
            },
          ],
        },
      });

      await expect(
        createOrderFromCart(payload, {
          cartId: cart.id,
          guestSecret: cart.secret,
          customer: {
            email: `guest_moq_${Date.now()}@test.com`,
            password: 'StrongPassword123!',
            companyName: 'MOQ Test Corp',
            contactPerson: 'Ahmed Zaki',
            phone: '+201011112222',
          },
          delivery: {
            method: 'pickup',
          },
          paymentMethod: 'bank_transfer',
        })
      ).rejects.toThrow(/MOQ_VIOLATION/);
    });

    it('aggregates variants belonging to the same Product ID to satisfy MOQ (5 Red + 5 Blue = 10)', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      // Add 5 Red + 5 Blue of the same Mug product
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [
            {
              product: physicalProductWithVariants.id,
              variant: variantRed.id,
              quantity: 5,
            },
            {
              product: physicalProductWithVariants.id,
              variant: variantBlue.id,
              quantity: 5,
            },
          ],
        },
      });

      const guestEmail = `guest_variant_moq_${Date.now()}@test.com`;
      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: {
          email: guestEmail,
          password: 'StrongPassword123!',
          companyName: 'Variant Aggregate Corp',
          contactPerson: 'Mohamed Tarek',
          phone: '+201099998888',
        },
        delivery: {
          method: 'pickup',
        },
        paymentMethod: 'bank_transfer',
      });

      expect(result.success).toBe(true);
      expect(result.orderNumber).toMatch(/^MWH-\d{4}-\d+/);
      cleanupOrderIds.push(result.order.id);
      cleanupUserIds.push(result.customerId);

      // Verify variant lines snapshot in the order
      expect(result.order.items).toHaveLength(2);
      expect(result.order.items[0].productTitle).toBe('B2B Corporate Ceramic Mug');
      expect(result.order.items[0].variantTitle).toContain('Ruby Red');
      expect(result.order.items[0].unitPrice).toBe(85);
      expect(result.order.items[1].variantTitle).toContain('Sapphire Blue');
      expect(result.order.items[1].unitPrice).toBe(85);
    });

    it('permits digital service packages with quantity = 1 (services exempt from 10-unit physical MOQ)', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [
            {
              product: serviceProduct.id,
              quantity: 1,
            },
          ],
        },
      });

      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: {
          email: `service_moq_${Date.now()}@test.com`,
          password: 'StrongPassword123!',
          companyName: 'Service Brand Corp',
          contactPerson: 'Sara Nour',
          phone: '+201055554444',
        },
        delivery: {
          method: 'pickup',
        },
        paymentMethod: 'bank_transfer',
      });

      expect(result.success).toBe(true);
      cleanupOrderIds.push(result.order.id);
      cleanupUserIds.push(result.customerId);

      expect(result.order.items[0].fulfillmentType).toBe('service');
      expect(result.order.items[0].unitPrice).toBe(15000);
      expect(result.order.items[0].lineTotal).toBe(15000);
    });
  });

  // =========================================================================
  // 2. Mixed Cart & Server-Authoritative Pricing (D-011, D-017)
  // =========================================================================
  describe('2. Mixed Carts (Physical Goods + Agency Digital Services)', () => {
    it('calculates separate unit price and customization fee server-side for physical + service items', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      // Mixed cart: 10 Flasks (with custom artwork) + 1 Branding Service Package
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [
            {
              product: physicalProductA.id,
              quantity: 10,
              artworkAssetId: String(testAsset.id),
              printingNotes: 'Laser engrave logo on front center in metallic gold.',
            },
            {
              product: serviceProduct.id,
              quantity: 1,
            },
          ],
        },
      });

      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: {
          email: `mixed_cart_buyer_${Date.now()}@test.com`,
          password: 'StrongPassword123!',
          companyName: 'Enterprise Horizons Egypt',
          contactPerson: 'Karim Ezzat',
          phone: '+201234567890',
          taxId: '987-654-321',
        },
        delivery: {
          method: 'shipping',
          shippingAddress: {
            governorate: 'القاهرة (Cairo)',
            city: 'المعادي (Maadi)',
            streetAddress: 'شارع النصر، مبنى دجلة بلازا',
            buildingDetails: 'الدور 5، مكتب 502',
          },
          fulfillmentNotes: 'يرجى التسليم خلال أوقات العمل الرسمية 9 ص - 5 م',
        },
        paymentMethod: 'bank_transfer',
      });

      expect(result.success).toBe(true);
      cleanupOrderIds.push(result.order.id);
      cleanupUserIds.push(result.customerId);

      const order = result.order;

      // 1. Verify Company & Delivery details
      expect(order.companyName).toBe('Enterprise Horizons Egypt');
      expect(order.contactPerson).toBe('Karim Ezzat');
      expect(order.phone).toBe('+201234567890');
      expect(order.taxId).toBe('987-654-321');
      expect(order.deliveryMethod).toBe('shipping');
      expect(order.shippingFee).toBe(80);

      // 2. Verify Line Item 0: Physical Flask (with customization)
      const flaskLine = order.items[0];
      expect(flaskLine.fulfillmentType).toBe('physical');
      expect(flaskLine.productTitle).toBe('B2B Thermal Flask Executive');
      expect(flaskLine.sku).toBeDefined();
      expect(flaskLine.quantity).toBe(10);
      expect(flaskLine.unitPrice).toBe(200); // Base price
      expect(flaskLine.customizationFee).toBe(30); // Separate printing fee (D-017)
      expect(flaskLine.lineTotal).toBe((200 + 30) * 10); // 2300 EGP
      expect(flaskLine.artworkAssetId).toBe(String(testAsset.id));
      expect(flaskLine.artworkStorageKey).toBe(testAsset.storageKey);
      expect(flaskLine.artworkOriginalFilename).toBe('corporate_logo_vector.svg');
      expect(flaskLine.printingNotes).toBe('Laser engrave logo on front center in metallic gold.');

      // 3. Verify Line Item 1: Digital Service Package
      const srvLine = order.items[1];
      expect(srvLine.fulfillmentType).toBe('service');
      expect(srvLine.productTitle).toBe('Complete Corporate Identity & Brand Guidelines');
      expect(srvLine.sku).toBeDefined();
      expect(srvLine.quantity).toBe(1);
      expect(srvLine.unitPrice).toBe(15000);
      expect(srvLine.customizationFee).toBe(0);
      expect(srvLine.lineTotal).toBe(15000);

      // 4. Verify Server Totals
      // Base Subtotal: (200 * 10) + (15000 * 1) = 17000 EGP
      expect(order.subtotal).toBe(17000);
      // Total Customization Fees: 30 * 10 = 300 EGP
      expect(order.totalCustomizationFees).toBe(300);
      // Shipping Fee: 80 EGP (provisional Cairo tariff, D-015)
      expect(order.shippingFee).toBe(80);
      // Grand Total: 17000 + 300 + 80 = 17380 EGP
      expect(order.amount).toBe(17380);

      // 5. Verify initial statuses per B2B-04
      expect(order.orderStatus).toBe('pending');
      expect(order.paymentStatus).toBe('unpaid');
      expect(order.fulfillmentStatus).toBe('unfulfilled');

      // 6. Verify attached artwork transitioned to committed_order
      const updatedAsset = await payload.findByID({
        collection: 'artwork-assets',
        id: testAsset.id,
      });
      expect(updatedAsset.status).toBe('committed_order');
      const assetUploaderId = typeof updatedAsset.uploader === 'object' ? updatedAsset.uploader.id : updatedAsset.uploader;
      expect(String(assetUploaderId)).toBe(String(result.customerId));

      // 7. Verify cart was cleared in database
      const clearedCart = await payload.findByID({
        collection: 'carts',
        id: cart.id,
      });
      expect(clearedCart.items).toHaveLength(0);
    });
  });

  // =========================================================================
  // 3. Seamless Inline Registration (D-013)
  // =========================================================================
  describe('3. Seamless Inline Customer Registration (Zero Temporary Passwords)', () => {
    it('creates a new customer account directly from checkout using customer-provided password', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [{ product: serviceProduct.id, quantity: 1 }],
        },
      });

      const uniqueEmail = `seamless_buyer_${Date.now()}@delta-holdings.eg`;
      const plainPassword = 'RealEnterprisePassword2026!';

      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: {
          email: uniqueEmail,
          password: plainPassword,
          companyName: 'Delta Holdings Group',
          contactPerson: 'Mona El-Shazly',
          phone: '+201122334455',
        },
        delivery: {
          method: 'pickup',
        },
        paymentMethod: 'bank_transfer',
      });

      expect(result.success).toBe(true);
      expect(result.userCreated).toBe(true);
      cleanupOrderIds.push(result.order.id);
      cleanupUserIds.push(result.customerId);

      // Verify the user exists in database and has role ['customer']
      const createdUser = await payload.findByID({
        collection: 'users',
        id: result.customerId,
      });

      expect(createdUser.email).toBe(uniqueEmail);
      expect(createdUser.roles).toContain('customer');

      // Verify user can authenticate with the provided password (proving it was hashed and stored securely, no temp password)
      const loginAttempt = await payload.login({
        collection: 'users',
        data: {
          email: uniqueEmail,
          password: plainPassword,
        },
      });
      expect(loginAttempt.user.id).toBe(result.customerId);
      expect(loginAttempt.token).toBeDefined();
    });

    it('rejects guest checkout if customer email is already registered, preventing account hijacking', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [{ product: serviceProduct.id, quantity: 1 }],
        },
      });

      // Try checking out as guest using customerUser's already-registered email
      await expect(
        createOrderFromCart(payload, {
          cartId: cart.id,
          guestSecret: cart.secret,
          customer: {
            email: customerUser.email,
            password: 'SomeRandomPassword!',
            companyName: 'Impostor Corp',
            contactPerson: 'Hacker',
            phone: '+201000000000',
          },
          delivery: {
            method: 'pickup',
          },
          paymentMethod: 'bank_transfer',
        })
      ).rejects.toThrow(/EMAIL_ALREADY_REGISTERED/);
    });

    it('allows an authenticated user to place an order without supplying a password', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          customer: customerUser.id,
          items: [{ product: serviceProduct.id, quantity: 1 }],
        },
      });

      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        user: { id: customerUser.id, email: customerUser.email, roles: customerUser.roles },
        customer: {
          email: customerUser.email,
          companyName: 'Pre-Registered Logistics Co',
          contactPerson: 'Existing User',
          phone: '+201144778899',
        },
        delivery: {
          method: 'pickup',
        },
        paymentMethod: 'bank_transfer',
      });

      expect(result.success).toBe(true);
      expect(result.userCreated).toBe(false);
      expect(result.customerId).toBe(customerUser.id);
      const orderCustId = typeof result.order.customer === 'object' ? result.order.customer.id : result.order.customer;
      expect(orderCustId).toBe(customerUser.id);
      cleanupOrderIds.push(result.order.id);
    });
  });

  // =========================================================================
  // 4. Delivery Method: Shipping vs Office Pickup (D-015)
  // =========================================================================
  describe('4. Delivery Method Selection & Office Pickup Fulfillment', () => {
    it('sets fulfillment notes to "Office Pickup" and waives shipping fee for agency office pickup', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [{ product: physicalProductA.id, quantity: 10 }],
        },
      });

      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: {
          email: `pickup_buyer_${Date.now()}@agency.eg`,
          password: 'StrongPassword123!',
          companyName: 'Cairo Creative Partners',
          contactPerson: 'Youssef Gamal',
          phone: '+201012341234',
        },
        delivery: {
          method: 'pickup',
          fulfillmentNotes: 'Will send company driver with corporate stamp',
        },
        paymentMethod: 'bank_transfer',
      });

      expect(result.success).toBe(true);
      cleanupOrderIds.push(result.order.id);
      cleanupUserIds.push(result.customerId);

      expect(result.order.deliveryMethod).toBe('pickup');
      expect(result.order.shippingFee).toBe(0);
      expect(result.order.fulfillmentNotes).toContain('Office Pickup');
      expect(result.order.fulfillmentNotes).toContain('Will send company driver');
    });

    it('persists structured Egyptian address and charges standard shipping for delivery orders', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [{ product: physicalProductA.id, quantity: 10 }],
        },
      });

      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: {
          email: `shipping_buyer_${Date.now()}@alex-ind.eg`,
          password: 'StrongPassword123!',
          companyName: 'Alexandria Heavy Industries',
          contactPerson: 'Tarek Farouk',
          phone: '+201299887766',
        },
        delivery: {
          method: 'shipping',
          shippingAddress: {
            governorate: 'الإسكندرية (Alexandria)',
            city: 'سموحة (Smouha)',
            streetAddress: 'طريق 14 مايو، برج السرايا',
            buildingDetails: 'الدور 8، مكتب 804',
          },
        },
        paymentMethod: 'bank_transfer',
      });

      expect(result.success).toBe(true);
      cleanupOrderIds.push(result.order.id);
      cleanupUserIds.push(result.customerId);

      expect(result.order.deliveryMethod).toBe('shipping');
      expect(result.order.shippingFee).toBe(90);
      expect(result.order.shippingAddress.state).toBe('الإسكندرية (Alexandria)');
      expect(result.order.shippingAddress.city).toBe('سموحة (Smouha)');
      expect(result.order.shippingAddress.addressLine1).toBe('طريق 14 مايو، برج السرايا');
      expect(result.order.shippingAddress.addressLine2).toBe('الدور 8، مكتب 804');
    });
  });

  // =========================================================================
  // 5. COD Scope & Restrictions (D-021)
  // =========================================================================
  describe('5. Cash on Delivery (COD) Scope & Restrictions (D-021)', () => {
    it('strictly prohibits Cash on Delivery for mixed carts containing digital services', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      // Mixed cart: Flasks + Branding service
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [
            { product: physicalProductA.id, quantity: 10 },
            { product: serviceProduct.id, quantity: 1 },
          ],
        },
      });

      await expect(
        createOrderFromCart(payload, {
          cartId: cart.id,
          guestSecret: cart.secret,
          customer: {
            email: `cod_mixed_${Date.now()}@test.com`,
            password: 'StrongPassword123!',
            companyName: 'Mixed COD Tester',
            contactPerson: 'Tester',
            phone: '+201011111111',
          },
          delivery: { method: 'pickup' },
          paymentMethod: 'cod',
        })
      ).rejects.toThrow(/COD_PROHIBITED_FOR_MIXED_CART/);
    });

    it('strictly prohibits Cash on Delivery for pure digital service orders', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [{ product: serviceProduct.id, quantity: 1 }],
        },
      });

      await expect(
        createOrderFromCart(payload, {
          cartId: cart.id,
          guestSecret: cart.secret,
          customer: {
            email: `cod_digital_${Date.now()}@test.com`,
            password: 'StrongPassword123!',
            companyName: 'Digital COD Tester',
            contactPerson: 'Tester',
            phone: '+201011111111',
          },
          delivery: { method: 'pickup' },
          paymentMethod: 'cod',
        })
      ).rejects.toThrow(/COD_PROHIBITED_FOR_DIGITAL/);
    });

    it('allows Cash on Delivery for pure physical merchandise with pending_collection status', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [{ product: physicalProductA.id, quantity: 10 }],
        },
      });

      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: {
          email: `cod_physical_${Date.now()}@test.com`,
          password: 'StrongPassword123!',
          companyName: 'Pure Physical COD Corp',
          contactPerson: 'Adel Emam',
          phone: '+201022223333',
        },
        delivery: { method: 'pickup' },
        paymentMethod: 'cod',
      });

      expect(result.success).toBe(true);
      cleanupOrderIds.push(result.order.id);
      cleanupUserIds.push(result.customerId);

      expect(result.order.paymentMethod).toBe('cod');
      expect(result.order.paymentStatus).toBe('unpaid');
      expect(result.order.remittanceStatus).toBe('pending_collection');
    });
  });

  // =========================================================================
  // 6. Immutable Order Snapshot (Financial Immutability)
  // =========================================================================
  describe('6. Immutable Order Snapshots vs Catalog Edits', () => {
    it('guarantees that modifying catalog prices and titles in /admin has zero effect on placed order snapshots', async () => {
      // 1. Create a dedicated product for this immutability test
      const catalogProd = await payload.create({
        collection: 'products',
        data: {
          title: 'Original Notebook Title',
          slug: `orig-notebook-${Date.now()}`,
          itemType: 'physical',
          basePrice: 120,
          priceInEGP: 120,
          customizationFee: 20,
          minOrderQuantity: 10,
          sku: 'ORIG-NOTE-01',
          _status: 'published',
        },
      });
      cleanupProductIds.push(catalogProd.id);

      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [
            {
              product: catalogProd.id,
              quantity: 10,
            },
          ],
        },
      });

      // 2. Place the order
      const result = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        customer: {
          email: `immutable_test_${Date.now()}@test.com`,
          password: 'StrongPassword123!',
          companyName: 'Immutability Verification Corp',
          contactPerson: 'Eng. Hany',
          phone: '+201088887777',
        },
        delivery: { method: 'pickup' },
        paymentMethod: 'bank_transfer',
      });

      const orderId = result.order.id;
      cleanupOrderIds.push(orderId);
      cleanupUserIds.push(result.customerId);

      // Initial frozen values
      expect(result.order.subtotal).toBe(1200); // 10 * 120
      expect(result.order.items[0].productTitle).toBe('Original Notebook Title');
      expect(result.order.items[0].unitPrice).toBe(120);

      // 3. ADMIN TAMPERING: Update catalog product in database (raise price to 500, change title)
      await payload.update({
        collection: 'products',
        id: catalogProd.id,
        data: {
          title: 'MODIFIED AND EXPENSIVE NOTEBOOK',
          basePrice: 500,
          priceInEGP: 500,
          customizationFee: 100,
        },
      });

      // 4. Fetch the order record back from database
      const fetchedOrder = await payload.findByID({
        collection: 'orders',
        id: orderId,
      });

      // 5. Verify order snapshot is 100% frozen and untouched
      expect(fetchedOrder.subtotal).toBe(1200);
      expect(fetchedOrder.amount).toBe(1200);
      expect(fetchedOrder.items[0].productTitle).toBe('Original Notebook Title');
      expect(fetchedOrder.items[0].unitPrice).toBe(120);
      expect(fetchedOrder.items[0].lineTotal).toBe(1200);
    });
  });

  // =========================================================================
  // 7. Atomic Transaction Rollback on Failure
  // =========================================================================
  describe('7. Atomic PostgreSQL Transaction Rollback', () => {
    it('rolls back all database changes if an error occurs during order creation', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [{ product: physicalProductA.id, quantity: 10 }],
        },
      });

      // Create a fresh test artwork asset that should NOT be committed if transaction rolls back
      const rollBackAsset = await payload.create({
        collection: 'artwork-assets',
        data: {
          storageKey: `artwork/rollback_test_${Date.now()}.svg`,
          originalFilename: 'rollback_test.svg',
          mimeType: 'image/svg+xml',
          fileSize: 1000,
          status: 'pending_order',
          scanStatus: 'clean',
          verificationStatus: 'valid',
          ownerSession: 'rollback-session',
        },
        context: { isTrustedUpload: true },
      });
      cleanupAssetIds.push(rollBackAsset.id);

      // Add asset to cart line
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [
            {
              product: physicalProductA.id,
              quantity: 10,
              artworkAssetId: String(rollBackAsset.id),
            },
          ],
        },
      });

      const guestEmail = `rollback_user_${Date.now()}@fail.eg`;

      // Mock an unrecoverable failure during the order creation workflow by passing an invalid shipping address structure when method is shipping
      // but let's test a failure that throws after user creation or during transaction:
      // If we attempt with invalid payment method or simulate an error:
      await expect(
        createOrderFromCart(payload, {
          cartId: cart.id,
          guestSecret: cart.secret,
          customer: {
            email: guestEmail,
            password: 'ValidPassword123!',
            companyName: 'Rollback Corp',
            contactPerson: 'Failing Person',
            phone: '+201099999999',
          },
          delivery: {
            method: 'shipping',
            // Missing shippingAddress fields will fail validation
            shippingAddress: {
              governorate: '',
              city: '',
              streetAddress: '',
            },
          },
          paymentMethod: 'bank_transfer',
        })
      ).rejects.toThrow();

      // 1. Verify user was NOT created in database
      const userCheck = await payload.find({
        collection: 'users',
        where: { email: { equals: guestEmail } },
      });
      expect(userCheck.totalDocs).toBe(0);

      // 2. Verify artwork asset remains in 'pending_order' status
      const assetCheck = await payload.findByID({
        collection: 'artwork-assets',
        id: rollBackAsset.id,
      });
      expect(assetCheck.status).toBe('pending_order');

      // 3. Verify cart items were NOT emptied
      const cartCheck = await payload.findByID({
        collection: 'carts',
        id: cart.id,
      });
      expect(cartCheck.items).toHaveLength(1);
    });
  });

  // =========================================================================
  // 8. End-to-End API Route (/api/checkout/create-order)
  // =========================================================================
  describe('8. End-to-End Checkout API Route (/api/checkout/create-order)', () => {
    it('successfully processes checkout request from signed cart session cookie', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [{ product: physicalProductA.id, quantity: 10 }],
        },
      });

      const signedCookie = signCartId(cart.id);

      const req = new NextRequest('http://localhost:3000/api/checkout/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${CART_COOKIE_NAME}=${signedCookie}`,
        },
        body: JSON.stringify({
          customer: {
            email: `route_buyer_${Date.now()}@route-test.eg`,
            password: 'StrongRoutePassword123!',
            companyName: 'Route Test Corp',
            contactPerson: 'Mohamed Salah',
            phone: '+201098765432',
          },
          delivery: {
            method: 'pickup',
            fulfillmentNotes: 'Will pickup from office reception',
          },
          paymentMethod: 'bank_transfer',
        }),
      });

      const res = await checkoutRoute(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.orderNumber).toMatch(/^MWH-\d{4}-\d+/);
      expect(data.status).toBe('pending');
      expect(data.paymentStatus).toBe('unpaid');
      expect(data.total).toBe(2000); // 10 * 200

      cleanupOrderIds.push(data.orderId);
      cleanupUserIds.push(data.customerId);
    });

    it('returns 400 Bad Request when checking out an empty cart', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      const signedCookie = signCartId(cart.id);

      const req = new NextRequest('http://localhost:3000/api/checkout/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${CART_COOKIE_NAME}=${signedCookie}`,
        },
        body: JSON.stringify({
          customer: {
            email: `empty_buyer_${Date.now()}@fail.eg`,
            password: 'StrongPassword123!',
            companyName: 'Empty Corp',
            contactPerson: 'None',
            phone: '+201000000000',
          },
          delivery: { method: 'pickup' },
          paymentMethod: 'bank_transfer',
        }),
      });

      const res = await checkoutRoute(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('EMPTY_CART');
    });
  });

  // =========================================================================
  // 9. B2B-04 Blocker Validations: Paymob Lockdown, Tariff Status & Idempotent Recovery
  // =========================================================================
  describe('9. B2B-04 Blocker Validations', () => {
    // 1. Paymob Lockdown: Must reject with 422 PAYMOB_GATEWAY_DEFERRED (D-008)
    it('strictly rejects Paymob paymentMethod with 422 PAYMOB_GATEWAY_DEFERRED in service and API route', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [{ product: physicalProductA.id, quantity: 10 }],
        },
      });

      // A. Verify rejection at the service layer
      await expect(
        createOrderFromCart(payload, {
          cartId: cart.id, guestSecret: cart.secret,
          customer: {
            email: `paymob_svc_${Date.now()}@mwheba.test`,
            password: 'SecurePassword2026!',
            companyName: 'Service Paymob Test Corp',
            contactPerson: 'Adel Emam',
            phone: '+201011112222',
          },
          delivery: { method: 'pickup' },
          paymentMethod: 'paymob' as any,
        })
      ).rejects.toThrowError(/PAYMOB_GATEWAY_DEFERRED/);

      // B. Verify rejection at the API route layer
      const signedCookie = signCartId(cart.id);
      const req = new NextRequest('http://localhost:3000/api/checkout/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${CART_COOKIE_NAME}=${signedCookie}`,
        },
        body: JSON.stringify({
          customer: {
            email: `paymob_route_${Date.now()}@mwheba.test`,
            password: 'SecurePassword2026!',
            companyName: 'Route Paymob Test Corp',
            contactPerson: 'Samir Ghanem',
            phone: '+201011113333',
          },
          delivery: { method: 'pickup' },
          paymentMethod: 'paymob',
        }),
      });

      const res = await checkoutRoute(req);
      expect(res.status).toBe(422);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('PAYMOB_GATEWAY_DEFERRED');
    });

    // 2. Delivery Tariff Resolution & Schedule Status (D-015)
    it('resolves delivery tariff with provisional status and pending_owner_tariff_approval (D-015)', () => {
      const shippingTariff = resolveDeliveryTariff({
        method: 'shipping',
        governorate: 'Cairo',
      });

      expect(shippingTariff.amount).toBe(80);
      expect(shippingTariff.isProvisional).toBe(true);
      expect(shippingTariff.tariffScheduleStatus).toBe('pending_owner_tariff_approval');

      const defaultShippingTariff = resolveDeliveryTariff({
        method: 'shipping',
      });
      expect(defaultShippingTariff.amount).toBe(150);
      expect(defaultShippingTariff.isProvisional).toBe(true);
      expect(defaultShippingTariff.tariffScheduleStatus).toBe('pending_owner_tariff_approval');

      const pickupTariff = resolveDeliveryTariff({
        method: 'pickup',
      });
      expect(pickupTariff.amount).toBe(0);
      expect(pickupTariff.isProvisional).toBe(true);
      expect(pickupTariff.tariffScheduleStatus).toBe('pending_owner_tariff_approval');
    });

    // 3. Strict Transaction Enforcement: Database transaction must be available
    it('fails immediately with 500 DATABASE_TRANSACTION_UNAVAILABLE if beginTransaction is not available', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [{ product: physicalProductA.id, quantity: 10 }],
        },
      });

      // Temporarily mock beginTransaction to undefined
      const originalBeginTx = payload.db?.beginTransaction;
      try {
        if (payload.db) {
          payload.db.beginTransaction = undefined;
        }

        await expect(
          createOrderFromCart(payload, {
            cartId: cart.id, guestSecret: cart.secret,
            customer: {
              email: `no_tx_${Date.now()}@mwheba.test`,
              password: 'SecurePassword2026!',
              companyName: 'No Tx Corp',
              contactPerson: 'Nour El-Sherif',
              phone: '+201099998888',
            },
            delivery: { method: 'pickup' },
            paymentMethod: 'bank_transfer',
          })
        ).rejects.toThrowError(/DATABASE_TRANSACTION_UNAVAILABLE/);
      } finally {
        if (payload.db) {
          payload.db.beginTransaction = originalBeginTx;
        }
      }
    });

    // 4. Ambiguous Commit & Lost Network Response Recovery
    it('recovers cleanly from lost network response: retry with same cart returns existing order instead of EMPTY_CART', async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);

      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: {
          items: [{ product: physicalProductA.id, quantity: 10 }],
        },
      });

      const clientOrderEmail = `lost_network_client_${Date.now()}@mwheba.test`;
      const idempotencyKey = `op_checkout_${Date.now()}_retry_test`;

      // 1. Initial order creation
      const firstResult = await createOrderFromCart(payload, {
        cartId: cart.id, guestSecret: cart.secret,
        idempotencyKey,
        customer: {
          email: clientOrderEmail,
          password: 'SecurePassword2026!',
          companyName: 'Lost Network Recovery Corp',
          contactPerson: 'Youssef Chahine',
          phone: '+201055554444',
        },
        delivery: { method: 'pickup' },
        paymentMethod: 'bank_transfer',
      });

      expect(firstResult.success).toBe(true);
      expect(firstResult.order.id).toBeDefined();
      expect(firstResult.orderNumber).toMatch(/^MWH-\d{4}-\d+/);
      expect(firstResult.isIdempotentReplay).toBeFalsy();
      cleanupOrderIds.push(firstResult.order.id);
      cleanupUserIds.push(firstResult.customerId);

      // Verify cart in PostgreSQL is now empty and marked purchased
      const cartAfterFirstCommit = await payload.findByID({
        collection: 'carts',
        id: cart.id,
      });
      expect(cartAfterFirstCommit.items).toEqual([]);
      expect(cartAfterFirstCommit.purchasedAt).toBeDefined();

      // 2. Client retry simulation (response was dropped in transit, client retries with same cart / idempotencyKey)
      const secondResult = await createOrderFromCart(payload, {
        cartId: cart.id, guestSecret: cart.secret,
        idempotencyKey,
        customer: {
          email: clientOrderEmail,
          password: 'SecurePassword2026!',
          companyName: 'Lost Network Recovery Corp',
          contactPerson: 'Youssef Chahine',
          phone: '+201055554444',
        },
        delivery: { method: 'pickup' },
        paymentMethod: 'bank_transfer',
      });

      // Must succeed and return the EXACT same order without throwing EMPTY_CART
      expect(secondResult.success).toBe(true);
      expect(secondResult.order.id).toBe(firstResult.order.id);
      expect(secondResult.orderNumber).toBe(firstResult.orderNumber);
      expect(secondResult.isIdempotentReplay).toBe(true);

      // 3. Test retry via API route layer with signed cart cookie
      const signedCookie = signCartId(cart.id);
      const retryReq = new NextRequest('http://localhost:3000/api/checkout/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${CART_COOKIE_NAME}=${signedCookie}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          customer: {
            email: clientOrderEmail,
            companyName: 'Lost Network Recovery Corp',
            contactPerson: 'Youssef Chahine',
            phone: '+201055554444',
          },
          delivery: { method: 'pickup' },
          paymentMethod: 'bank_transfer',
        }),
      });

      const retryRes = await checkoutRoute(retryReq);
      expect(retryRes.status).toBe(200); // 200 OK for idempotent replayed order

      const retryData = await retryRes.json();
      expect(retryData.success).toBe(true);
      expect(retryData.orderId).toBe(firstResult.order.id);
      expect(retryData.orderNumber).toBe(firstResult.orderNumber);
      expect(retryData.isIdempotentReplay).toBe(true);

      // 4. Verify in PostgreSQL that only ONE order exists for this cart
      const existingOrders = await payload.find({
        collection: 'orders',
        where: {
          cart: { equals: cart.id },
        },
      });
      expect(existingOrders.totalDocs).toBe(1);
    });
  });

  // =========================================================================
  // 10. Review fixes: server quote, scoped idempotency, post-purchase session
  // =========================================================================
  describe('10. Server quote, scoped idempotency & post-purchase session journey', () => {
    const customerFor = (tag: string) => ({
      email: `${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@mwheba.test`,
      password: 'SecurePassword2026!',
      companyName: `${tag} Corp`,
      contactPerson: 'Test Buyer',
      phone: '+201012345678',
    });

    const readSetCookie = (res: Response): string | null => {
      const raw = res.headers.get('set-cookie') || '';
      const match = raw.match(new RegExp(`${CART_COOKIE_NAME}=[^;]+`));
      return match ? match[0] : null;
    };

    const makeCartWithItem = async () => {
      const cart = await getOrCreateCart(payload);
      cleanupCartIds.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: physicalProductA.id, quantity: 10 }] },
      });
      return cart;
    };

    const cookieReq = (url: string, cookie: string | null, method: string, body?: any) =>
      new NextRequest(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

    it('server quote matches the saved order shipping fee and total; stale or client-set fees are rejected/ignored', async () => {
      const cart = await makeCartWithItem();
      const cookie = `${CART_COOKIE_NAME}=${signCartId(cart.id)}`;

      const quoteRes = await quoteRoute(
        cookieReq('http://localhost:3000/api/checkout/quote', cookie, 'POST', {
          delivery: { method: 'shipping', governorate: 'Cairo' },
        })
      );
      expect(quoteRes.status).toBe(200);
      const quote = await quoteRes.json();
      expect(quote.shippingFee).toBe(80);
      expect(quote.isProvisional).toBe(true);
      expect(quote.tariffScheduleStatus).toBe('pending_owner_tariff_approval');

      const shippingAddress = { governorate: 'Cairo', city: 'Maadi', streetAddress: 'Street 9' };

      // Stale displayed fee (e.g. old UI value of 150) must be rejected with 409, no order created
      const staleRes = await checkoutRoute(
        cookieReq('http://localhost:3000/api/checkout/create-order', cookie, 'POST', {
          customer: customerFor('stale'),
          delivery: { method: 'shipping', shippingAddress, expectedShippingFee: 150 },
          paymentMethod: 'bank_transfer',
        })
      );
      expect(staleRes.status).toBe(409);
      expect((await staleRes.json()).error).toContain('SHIPPING_QUOTE_MISMATCH');
      expect((await payload.find({ collection: 'orders', where: { cart: { equals: cart.id } } })).totalDocs).toBe(0);

      // Matching quote + client-supplied customFee (ignored) -> saved values equal the quote
      const okRes = await checkoutRoute(
        cookieReq('http://localhost:3000/api/checkout/create-order', cookie, 'POST', {
          customer: customerFor('quoted'),
          delivery: { method: 'shipping', shippingAddress, expectedShippingFee: quote.shippingFee, customFee: 1 },
          paymentMethod: 'bank_transfer',
        })
      );
      expect(okRes.status).toBe(201);
      const ok = await okRes.json();
      cleanupOrderIds.push(ok.orderId);
      cleanupUserIds.push(ok.customerId);
      const saved = await payload.findByID({ collection: 'orders', id: ok.orderId });
      expect(saved.shippingFee).toBe(quote.shippingFee);
      expect(Number(ok.total)).toBe(quote.grandTotal);
    });

    it('does not replay an order for a victim idempotency key presented from a different cart', async () => {
      const victimCart = await makeCartWithItem();
      const attackerCart = await makeCartWithItem();
      const key = `victim_key_${Date.now()}`;

      const victimOrder = await createOrderFromCart(payload, {
        cartId: victimCart.id,
        guestSecret: victimCart.secret,
        idempotencyKey: key,
        customer: customerFor('victim'),
        delivery: { method: 'pickup' },
        paymentMethod: 'bank_transfer',
      });
      cleanupOrderIds.push(victimOrder.order.id);
      cleanupUserIds.push(victimOrder.customerId);

      // Attacker, own valid session, victim's key: must NOT receive the victim's order
      const attackerOrder = await createOrderFromCart(payload, {
        cartId: attackerCart.id,
        guestSecret: attackerCart.secret,
        idempotencyKey: key,
        customer: customerFor('attacker'),
        delivery: { method: 'pickup' },
        paymentMethod: 'bank_transfer',
      });
      cleanupOrderIds.push(attackerOrder.order.id);
      cleanupUserIds.push(attackerOrder.customerId);
      expect(attackerOrder.isIdempotentReplay).toBe(false);
      expect(attackerOrder.order.id).not.toBe(victimOrder.order.id);
      expect(attackerOrder.orderNumber).not.toBe(victimOrder.orderNumber);

      // Attacker presenting the victim's cart without its secret is forbidden
      await expect(
        createOrderFromCart(payload, {
          cartId: victimCart.id,
          guestSecret: attackerCart.secret,
          idempotencyKey: key,
          customer: customerFor('attacker2'),
          delivery: { method: 'pickup' },
          paymentMethod: 'bank_transfer',
        })
      ).rejects.toThrowError(/FORBIDDEN_CART_ACCESS/);

      // Same cart + same key still replays for the legitimate owner
      const replay = await createOrderFromCart(payload, {
        cartId: victimCart.id,
        guestSecret: victimCart.secret,
        idempotencyKey: key,
        customer: customerFor('victim'),
        delivery: { method: 'pickup' },
        paymentMethod: 'bank_transfer',
      });
      expect(replay.isIdempotentReplay).toBe(true);
      expect(replay.order.id).toBe(victimOrder.order.id);

      // Same cart, different key: no replay (cart is already purchased and empty)
      await expect(
        createOrderFromCart(payload, {
          cartId: victimCart.id,
          guestSecret: victimCart.secret,
          idempotencyKey: `${key}_other`,
          customer: customerFor('victim'),
          delivery: { method: 'pickup' },
          paymentMethod: 'bank_transfer',
        })
      ).rejects.toThrowError(/EMPTY_CART/);
    });

    it('lets a guest start a second independent order after a completed purchase (cookie still points to purchased cart)', async () => {
      // 1. Initialise a guest session
      const initRes = await cartItemsGet(cookieReq('http://localhost:3000/api/cart/items?init=true', null, 'GET'));
      const init = await initRes.json();
      const cookie1 = readSetCookie(initRes as any);
      expect(cookie1).toBeTruthy();
      cleanupCartIds.push(init.cartId);

      // 2. Add an item and place the first order
      const add1 = await cartItemsPost(
        cookieReq('http://localhost:3000/api/cart/items', cookie1, 'POST', {
          productId: physicalProductA.id,
          quantity: 10,
          operationKey: `journey_add_1_${Date.now()}`,
        })
      );
      expect(add1.status).toBe(200);

      const order1Res = await checkoutRoute(
        cookieReq('http://localhost:3000/api/checkout/create-order', cookie1, 'POST', {
          customer: customerFor('journey1'),
          delivery: { method: 'pickup' },
          paymentMethod: 'bank_transfer',
        })
      );
      expect(order1Res.status).toBe(201);
      const order1 = await order1Res.json();
      cleanupOrderIds.push(order1.orderId);
      cleanupUserIds.push(order1.customerId);

      // 3. Stale cookie must not be treated as a valid session; adding with it is refused
      const staleAdd = await cartItemsPost(
        cookieReq('http://localhost:3000/api/cart/items', cookie1, 'POST', {
          productId: physicalProductA.id,
          quantity: 10,
          operationKey: `journey_stale_${Date.now()}`,
        })
      );
      expect(staleAdd.status).toBeGreaterThanOrEqual(400);

      // 4. GET ?init=true with the stale cookie bootstraps a NEW cart and cookie
      const reinitRes = await cartItemsGet(cookieReq('http://localhost:3000/api/cart/items?init=true', cookie1, 'GET'));
      const reinit = await reinitRes.json();
      const cookie2 = readSetCookie(reinitRes as any);
      expect(reinit.cartId).toBeDefined();
      expect(reinit.cartId).not.toBe(init.cartId);
      expect(cookie2).toBeTruthy();
      expect(cookie2).not.toBe(cookie1);
      cleanupCartIds.push(reinit.cartId);

      // 5. Add a new product and place an independent second order
      const add2 = await cartItemsPost(
        cookieReq('http://localhost:3000/api/cart/items', cookie2, 'POST', {
          productId: physicalProductA.id,
          quantity: 10,
          operationKey: `journey_add_2_${Date.now()}`,
        })
      );
      expect(add2.status).toBe(200);

      const order2Res = await checkoutRoute(
        cookieReq('http://localhost:3000/api/checkout/create-order', cookie2, 'POST', {
          customer: customerFor('journey2'),
          delivery: { method: 'pickup' },
          paymentMethod: 'bank_transfer',
        })
      );
      expect(order2Res.status).toBe(201);
      const order2 = await order2Res.json();
      cleanupOrderIds.push(order2.orderId);
      cleanupUserIds.push(order2.customerId);

      expect(order2.isIdempotentReplay).toBe(false);
      expect(order2.orderId).not.toBe(order1.orderId);
      expect(order2.orderNumber).not.toBe(order1.orderNumber);
    });
  });
});
