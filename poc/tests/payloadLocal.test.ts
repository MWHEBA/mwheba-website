import { describe, it, expect, beforeAll } from 'vitest';
import configPromise from '../src/payload.config';
import { getPayload, Payload } from 'payload';

describe('Payload Local Commerce Integration (Track 1A)', () => {
  let payload: Payload;
  let adminUser: any;
  let customerUserA: any;
  let customerUserB: any;
  let productAId: number;
  let productBId: number;
  let serviceProductId: number;
  let blackVariantId: number;
  let whiteVariantId: number;
  let artworkAssetAId: number;
  let placedOrderId: number;

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    const timestamp = Date.now();

    // 1. Seed Finance Officer / Admin
    adminUser = await payload.create({
      collection: 'users',
      data: {
        email: `finance-${timestamp}@mwheba.com`,
        password: 'Password123!',
        roles: ['admin', 'finance'],
      },
      context: { isSystemSeed: true },
    });

    // 2. Seed Customer A
    customerUserA = await payload.create({
      collection: 'users',
      data: {
        email: `customerA-${timestamp}@client.eg`,
        password: 'Password123!',
        roles: ['customer'],
      },
    });

    // 3. Seed Customer B
    customerUserB = await payload.create({
      collection: 'users',
      data: {
        email: `customerB-${timestamp}@client.eg`,
        password: 'Password123!',
        roles: ['customer'],
      },
    });

    // 4. Create Variant Types and Options for Colors
    const colorType = await payload.create({
      collection: 'variantTypes',
      data: {
        name: `color-${timestamp}`,
        label: 'Color',
      },
      user: adminUser,
    });

    const blackOption = await payload.create({
      collection: 'variantOptions',
      data: {
        variantType: colorType.id,
        label: 'Black',
        value: 'black',
      },
      user: adminUser,
    });

    const whiteOption = await payload.create({
      collection: 'variantOptions',
      data: {
        variantType: colorType.id,
        label: 'White',
        value: 'white',
      },
      user: adminUser,
    });

    // 5. Seed Product A (Physical Thermal Mug with Variants, MOQ 10, customization fee 35 EGP)
    const prodA = await payload.create({
      collection: 'products',
      data: {
        title: 'Premium Thermal Mug',
        slug: `thermal-mug-${timestamp}`,
        _status: 'published',
        itemType: 'physical',
        minOrderQuantity: 10,
        customizationFee: 35,
        enableVariants: true,
        variantTypes: [colorType.id],
        priceInEGPEnabled: true,
        priceInEGP: 250,
      },
      user: adminUser,
    });
    productAId = prodA.id as number;

    // Create real Variant documents with official plugin pricing field: priceInEGP
    const blackVar = await payload.create({
      collection: 'variants',
      data: {
        product: productAId,
        title: 'Black Variant',
        options: [blackOption.id],
        priceInEGPEnabled: true,
        priceInEGP: 250,
        _status: 'published',
      },
      user: adminUser,
    });
    blackVariantId = blackVar.id as number;

    const whiteVar = await payload.create({
      collection: 'variants',
      data: {
        product: productAId,
        title: 'White Variant',
        options: [whiteOption.id],
        priceInEGPEnabled: true,
        priceInEGP: 250,
        _status: 'published',
      },
      user: adminUser,
    });
    whiteVariantId = whiteVar.id as number;

    // 6. Seed Product B (Physical Ceramic Mug, MOQ 10, customization fee 20 EGP)
    const prodB = await payload.create({
      collection: 'products',
      data: {
        title: 'Ceramic Coffee Mug',
        slug: `ceramic-mug-${timestamp}`,
        _status: 'published',
        itemType: 'physical',
        minOrderQuantity: 10,
        customizationFee: 20,
        priceInEGPEnabled: true,
        priceInEGP: 180,
      },
      user: adminUser,
    });
    productBId = prodB.id as number;

    // 7. Seed Service Product (Digital Brand Identity, MOQ 1, fee 0 EGP)
    const srvProd = await payload.create({
      collection: 'products',
      data: {
        title: 'Brand Identity Package',
        slug: `brand-identity-${timestamp}`,
        _status: 'published',
        itemType: 'service',
        minOrderQuantity: 1,
        customizationFee: 0,
        priceInEGPEnabled: true,
        priceInEGP: 15000,
      },
      user: adminUser,
    });
    serviceProductId = srvProd.id as number;
  }, 30000);

  it('proves file privacy and RBAC access control with overrideAccess: false', async () => {
    // 1. Customer A uploads private vector artwork asset
    const asset = await payload.create({
      collection: 'artwork-assets',
      data: {
        storageKey: 'artworks/corp-logo-v1-uuid.pdf',
        originalFilename: 'corporate-logo-v1.pdf',
        fileSize: 2048500,
        mimeType: 'application/pdf',
        verificationStatus: 'valid',
        uploader: customerUserA.id,
      },
      user: customerUserA,
      overrideAccess: false,
    });
    expect(asset.id).toBeDefined();
    artworkAssetAId = asset.id as number;

    // 2. Customer A can read their own artwork
    const customerAQuery = await payload.find({
      collection: 'artwork-assets',
      where: { id: { equals: artworkAssetAId } },
      user: customerUserA,
      overrideAccess: false,
    });
    expect(customerAQuery.docs.length).toBe(1);

    // 3. Customer B CANNOT read Customer A's artwork (Privacy Isolation Proven)
    const customerBQuery = await payload.find({
      collection: 'artwork-assets',
      where: { id: { equals: artworkAssetAId } },
      user: customerUserB,
      overrideAccess: false,
    });
    expect(customerBQuery.docs.length).toBe(0);

    // 4. Admin / Finance CAN read Customer A's artwork
    const adminQuery = await payload.find({
      collection: 'artwork-assets',
      where: { id: { equals: artworkAssetAId } },
      user: adminUser,
      overrideAccess: false,
    });
    expect(adminQuery.docs.length).toBe(1);
  });

  it('enforces RBAC on Users collection: prevents self-escalation, cross-account tampering, and forces customer role on public signup', async () => {
    // 1. Customer attempts self-privilege escalation to admin and finance -> Throws Forbidden
    await expect(
      payload.update({
        collection: 'users',
        id: customerUserA.id,
        data: {
          roles: ['admin', 'finance'],
        },
        user: customerUserA,
        overrideAccess: false,
      })
    ).rejects.toThrow(/Privilege Escalation Forbidden/);

    // Verify Customer A's roles remain strictly ['customer']
    const refreshedCustomerA = await payload.findByID({
      collection: 'users',
      id: customerUserA.id,
      user: adminUser,
    });
    expect(refreshedCustomerA.roles).toEqual(['customer']);

    // 2. Customer A attempts to update Customer B's account with overrideAccess: false -> Access Denied / 0 docs
    await expect(
      payload.update({
        collection: 'users',
        id: customerUserB.id,
        data: {
          name: 'Tampered Name',
        },
        user: customerUserA,
        overrideAccess: false,
      })
    ).rejects.toThrow();

    // 3. Public registration attempt declaring admin/finance roles with overrideAccess: false -> Server forces ['customer']
    const publicUser = await payload.create({
      collection: 'users',
      data: {
        email: `public-signup-${Date.now()}@test.eg`,
        password: 'Password123!',
        roles: ['admin', 'finance'], // Attacker attempts to declare admin!
      },
      overrideAccess: false,
    });
    expect(publicUser.id).toBeDefined();
    expect(publicUser.roles).toEqual(['customer']); // STRICTLY FORCED TO CUSTOMER!

    // 4. Authorized administrator CAN update user roles (e.g. promoting customer to finance)
    const promotedUser = await payload.update({
      collection: 'users',
      id: publicUser.id,
      data: {
        roles: ['customer', 'finance'],
      },
      user: adminUser,
      overrideAccess: false,
    });
    expect(promotedUser.roles).toContain('finance');
  });

  it('verifies ownership of artwork at order creation and rejects unauthorized asset linkage', async () => {
    // Customer B attempts to create order attaching Customer A's artwork -> Throws Forbidden
    await expect(
      payload.create({
        collection: 'orders',
        data: {
          customer: customerUserB.id,
          customerEmail: customerUserB.email,
          items: [
            {
              product: productAId,
              variant: blackVariantId,
              quantity: 10,
              artworkAssetId: String(artworkAssetAId), // Owned by Customer A!
            },
          ],
        },
        user: customerUserB,
      })
    ).rejects.toThrow('Forbidden: Customer cannot attach artwork assets owned by another user.');
  });

  it('enforces MOQ server-side across variants in Payload order hook and blocks invalid orders', async () => {
    // 1. Attempt empty items order -> Rejected
    await expect(
      payload.create({
        collection: 'orders',
        data: {
          customer: customerUserA.id,
          customerEmail: customerUserA.email,
          items: [],
        },
        user: customerUserA,
      })
    ).rejects.toThrow('Order Validation Failed: An order must contain at least one line item.');

    // 2. Attempt incomplete quantity (5 units of Black variant when MOQ is 10) -> Rejected
    await expect(
      payload.create({
        collection: 'orders',
        data: {
          customer: customerUserA.id,
          customerEmail: customerUserA.email,
          items: [
            {
              product: productAId,
              variant: blackVariantId,
              quantity: 5,
            },
          ],
        },
        user: customerUserA,
      })
    ).rejects.toThrow(/MOQ Violation \(D-009\)/);

    // 3. Attempt cross-product pooling (5 of Product A + 5 of Product B) -> Rejected
    await expect(
      payload.create({
        collection: 'orders',
        data: {
          customer: customerUserA.id,
          customerEmail: customerUserA.email,
          items: [
            { product: productAId, variant: blackVariantId, quantity: 5 },
            { product: productBId, quantity: 5 },
          ],
        },
        user: customerUserA,
      })
    ).rejects.toThrow(/MOQ Violation \(D-009\)/);
  });

  it('strictly rejects cross-product variant assignment (Variant Mismatch Guard)', async () => {
    // Attempting to create an order specifying Product B with a variant belonging to Product A
    await expect(
      payload.create({
        collection: 'orders',
        data: {
          customer: customerUserA.id,
          customerEmail: customerUserA.email,
          items: [
            {
              product: productBId, // Ceramic Mug
              variant: blackVariantId, // Belongs to Product A (Thermal Mug)!
              quantity: 10,
            },
          ],
        },
        user: customerUserA,
      })
    ).rejects.toThrow(/Variant Mismatch Error/);
  });

  it('creates valid mixed-variant order using real Variant IDs, freezes price & artwork snapshot', async () => {
    // Valid order: 4 Black Mugs + 6 White Mugs (Product A, total 10 units = MOQ satisfied!) + 1 Service Package
    const createdOrder = await payload.create({
      collection: 'orders',
      data: {
        customer: customerUserA.id,
        customerEmail: customerUserA.email,
        paymentMethod: 'bank_transfer',
        items: [
          {
            product: productAId,
            variant: blackVariantId,
            quantity: 4,
            artworkAssetId: String(artworkAssetAId),
            printingNotes: 'Front laser engraving - Black Mug',
          },
          {
            product: productAId,
            variant: whiteVariantId,
            quantity: 6,
            artworkAssetId: String(artworkAssetAId),
            printingNotes: 'Front laser engraving - White Mug',
          },
          {
            product: serviceProductId,
            quantity: 1,
          },
        ],
      },
      user: customerUserA,
    });

    expect(createdOrder.id).toBeDefined();
    placedOrderId = createdOrder.id as number;

    // Re-read order directly from database
    const savedOrder = await payload.findByID({
      collection: 'orders',
      id: placedOrderId,
      user: adminUser,
    });

    // Verify financial snapshot:
    // Physical base: (250 * 4) + (250 * 6) = 2,500 EGP
    // Service base: 15,000 EGP
    // Subtotal: 17,500 EGP
    // Customization Fees: (35 * 4) + (35 * 6) = 350 EGP
    // Grand Total: 17,850 EGP
    expect(savedOrder.amount).toBe(17850);
    expect(savedOrder.subtotal).toBe(17500);
    expect(savedOrder.totalCustomizationFees).toBe(350);
    expect(savedOrder.paymentStatus).toBe('pending_verification');

    // Verify snapshot fields on individual items
    const items = (savedOrder.items || []) as any[];
    expect(items.length).toBe(3);

    // Line 1: 4 Black Mugs
    expect(items[0].quantity).toBe(4);
    expect(items[0].unitPrice).toBe(250);
    expect(items[0].customizationFee).toBe(35);
    expect(items[0].lineTotal).toBe(1140);
    expect(items[0].artworkStorageKey).toBe('artworks/corp-logo-v1-uuid.pdf');
    expect(items[0].artworkOriginalFilename).toBe('corporate-logo-v1.pdf');
    expect(items[0].fulfillmentType).toBe('physical');

    // Line 2: 6 White Mugs
    expect(items[1].quantity).toBe(6);
    expect(items[1].unitPrice).toBe(250);
    expect(items[1].customizationFee).toBe(35);
    expect(items[1].lineTotal).toBe(1710);
    expect(items[1].artworkStorageKey).toBe('artworks/corp-logo-v1-uuid.pdf');
    expect(items[1].fulfillmentType).toBe('physical');

    // Line 3: Digital Service
    expect(items[2].quantity).toBe(1);
    expect(items[2].unitPrice).toBe(15000);
    expect(items[2].customizationFee).toBe(0);
    expect(items[2].lineTotal).toBe(15000);
    expect(items[2].fulfillmentType).toBe('service');
  });

  it('protects frozen price snapshot from mutating when catalog prices change and order is updated', async () => {
    // 1. Malicious / legitimate catalog update: Double prices and triple customization fee in catalog
    await payload.update({
      collection: 'products',
      id: productAId,
      data: {
        priceInEGP: 500, // Was 250
        customizationFee: 100, // Was 35
      },
      user: adminUser,
    });

    await payload.update({
      collection: 'variants',
      id: blackVariantId,
      data: {
        priceInEGP: 500, // Was 250
      },
      user: adminUser,
    });

    // 2. Perform an order update (e.g. updating notes or fulfillment state)
    await payload.update({
      collection: 'orders',
      id: placedOrderId,
      data: {
        paymentStatus: 'pending_verification',
      },
      user: adminUser,
    });

    // 3. Re-read the placed order from database
    const refreshedOrder = await payload.findByID({
      collection: 'orders',
      id: placedOrderId,
      user: adminUser,
    });

    // CRITICAL PROOF: Placed order total MUST NOT regress to 20,350+ EGP!
    // It must remain strictly frozen at the original 17,850 EGP!
    expect(refreshedOrder.amount).toBe(17850);
    expect(refreshedOrder.subtotal).toBe(17500);
    expect(refreshedOrder.totalCustomizationFees).toBe(350);

    const refreshedItems = (refreshedOrder.items || []) as any[];
    expect(refreshedItems[0].unitPrice).toBe(250);
    expect(refreshedItems[0].customizationFee).toBe(35);
    expect(refreshedItems[0].lineTotal).toBe(1140);
  });

  it('strictly prohibits mutating purchased items, quantities, or variants on an existing order', async () => {
    // Read current items of placed order
    const orderBefore = await payload.findByID({
      collection: 'orders',
      id: placedOrderId,
      user: adminUser,
    });
    const originalItems = (orderBefore.items || []) as any[];

    // 1. Attempt to mutate quantity of the first item from 4 to 1 -> Throws error
    await expect(
      payload.update({
        collection: 'orders',
        id: placedOrderId,
        data: {
          items: [
            {
              ...originalItems[0],
              quantity: 1, // Tampered quantity!
            },
            originalItems[1],
            originalItems[2],
          ],
        },
        user: customerUserA,
      })
    ).rejects.toThrow(/Order Immutability Error/);

    // 2. Attempt to remove an item from the placed order -> Throws error
    await expect(
      payload.update({
        collection: 'orders',
        id: placedOrderId,
        data: {
          items: [originalItems[0]], // Stripped items!
        },
        user: customerUserA,
      })
    ).rejects.toThrow(/Order Immutability Error/);

    // 3. Verify order items remain completely unchanged in database
    const orderAfter = await payload.findByID({
      collection: 'orders',
      id: placedOrderId,
      user: adminUser,
    });
    const itemsAfter = (orderAfter.items || []) as any[];
    expect(itemsAfter.length).toBe(3);
    expect(itemsAfter[0].quantity).toBe(4);
    expect(itemsAfter[1].quantity).toBe(6);
    expect(itemsAfter[2].quantity).toBe(1);
    expect(orderAfter.amount).toBe(17850);
  });

  it('prevents post-order tampering of artwork storageKey on assets bound to placed orders', async () => {
    // Customer attempts to modify the storageKey of the artwork bound to placedOrderId -> Throws error
    await expect(
      payload.update({
        collection: 'artwork-assets',
        id: artworkAssetAId,
        data: {
          storageKey: 'artworks/malicious-tampered-logo.pdf',
        },
        user: customerUserA,
      })
    ).rejects.toThrow('Immutable Asset Error: Cannot alter storageKey of an artwork asset bound to placed order(s).');
  });

  it('sanitizes bank transfer creation, guards duplicate approval, and appends to audit trail', async () => {
    // 1. Client attempts to forge pre-approved bank transfer at creation -> Server forces pending_verification
    const forgedAttempt = await payload.create({
      collection: 'bank-transfers',
      data: {
        order: placedOrderId,
        claimedAmount: 17850,
        bankReferenceCode: 'FORGED-REF-001',
        status: 'approved',
        internalReconciliationCode: 'FORGED-REC',
      },
      user: customerUserA,
    });

    expect(forgedAttempt.status).toBe('pending_verification');
    expect(forgedAttempt.internalReconciliationCode).toBeFalsy();

    // 2. Unauthorized customer attempt to approve transfer -> Throws Forbidden
    await expect(
      payload.update({
        collection: 'bank-transfers',
        id: forgedAttempt.id,
        data: {
          status: 'approved',
          internalReconciliationCode: 'FORGED-REC',
        },
        user: customerUserA,
      })
    ).rejects.toThrow('Forbidden: Only finance officers can update bank transfer verification status.');

    // 3. Authorized finance officer approves transfer with reconciliation code and confirmed amount
    const recCode = `REC-BANK-CIB-${Date.now()}`;
    const approvedTransfer = await payload.update({
      collection: 'bank-transfers' as any,
      id: forgedAttempt.id,
      data: {
        status: 'approved',
        confirmedAmount: 17850,
        internalReconciliationCode: recCode,
      },
      user: adminUser,
    }) as any;
    expect(approvedTransfer.status).toBe('approved');
    expect(approvedTransfer.internalReconciliationCode).toBe(recCode);

    // 4. Immutability & deletion guards on approved transfers:
    // A: Attempting to update status or omit status to mutate reference/amount is strictly rejected
    await expect(
      payload.update({
        collection: 'bank-transfers' as any,
        id: forgedAttempt.id,
        data: {
          bankReferenceCode: 'TAMPERED-BANK-REF',
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/BANK_TRANSFER_IMMUTABLE_AFTER_APPROVAL/);

    await expect(
      payload.update({
        collection: 'bank-transfers' as any,
        id: forgedAttempt.id,
        data: {
          status: 'approved',
        },
        user: adminUser,
      })
    ).rejects.toThrowError(/BANK_TRANSFER_IMMUTABLE_AFTER_APPROVAL/);

    // B: Attempting to delete an approved bank transfer is strictly blocked
    await expect(
      payload.delete({
        collection: 'bank-transfers' as any,
        id: forgedAttempt.id,
        user: adminUser,
      })
    ).rejects.toThrowError(/BANK_TRANSFER_DELETION_FORBIDDEN_AFTER_APPROVAL/);

    // 5. Read back the order from the database and verify atomic synchronization & append-only audit log
    const verifiedOrder = await payload.findByID({
      collection: 'orders',
      id: placedOrderId,
      user: adminUser,
    });

    expect(verifiedOrder.paymentStatus).toBe('paid');
    expect(verifiedOrder.paidAt).toBeDefined();

    // Verify audit log has BOTH original creation entry AND the bank confirmation entry (append-only)
    const logEntries = (verifiedOrder.auditLog || []) as any[];
    expect(logEntries.length).toBeGreaterThanOrEqual(2);
    expect(logEntries[0].entry).toContain('Order created in pending state');
    expect(logEntries.some((log: any) => log.entry?.includes(recCode))).toBe(true);
  });
});
