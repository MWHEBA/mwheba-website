/**
 * MWHEBA 2.0 Order Service
 * Atomic order creation workflow inside a PostgreSQL transaction (D-007, D-009, D-010, D-011, D-013, D-015, D-017, D-021).
 */

import type { Payload } from 'payload';
import { validateCartMoq } from '../../cart-checkout/logic/moqEngine';
import { withCartLock } from '../../cart-checkout/services/cartStorage';
import { resolveDeliveryTariff } from './deliveryTariff';

export interface CreateOrderCustomerInput {
  email: string;
  password?: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  taxId?: string;
}

export interface CreateOrderDeliveryInput {
  method: 'shipping' | 'pickup';
  shippingAddress?: {
    governorate: string;
    city: string;
    streetAddress: string;
    buildingDetails?: string;
  };
  fulfillmentNotes?: string;
  /** Shipping fee the customer was shown (from the server quote). Rejected with 409 if it differs from the server tariff. */
  expectedShippingFee?: number;
}

export interface CreateOrderFromCartInput {
  cartId: number;
  guestSecret?: string;
  idempotencyKey?: string;
  user?: {
    id: number;
    email: string;
    roles?: string[];
  } | null;
  customer: CreateOrderCustomerInput;
  delivery: CreateOrderDeliveryInput;
  paymentMethod: 'cod' | 'bank_transfer';
  /** Grand total the customer saw (from the server quote). Rejected with 409 if the server total differs. */
  expectedGrandTotal?: number;
}

export interface CreateOrderResult {
  success: boolean;
  order: any;
  orderNumber: string;
  customerId: number;
  userCreated: boolean;
  isIdempotentReplay?: boolean;
}

/**
 * Atomic workflow to create an order from an active cart inside a PostgreSQL transaction.
 *
 * Rules:
 * 1. Cart is locked via PostgreSQL advisory lock (`withCartLock`) to prevent concurrent cart tampering.
 * 2. Cart ownership is strictly verified against active auth session or guest secret.
 * 3. Ambiguous Commit / Lost Response Recovery: If order was already committed for this cart or idempotencyKey,
 *    returns the existing order without throwing an empty-cart error.
 * 4. Server-authoritative catalog prices, separate customization fees, and strict Product ID MOQ (>=10 for physical) are re-validated.
 * 5. Mixed carts (physical + services) are supported; COD is strictly blocked if mixed or digital (D-021).
 * 6. Paymob selection is strictly prohibited at this stage and rejected with 422 (D-008).
 * 7. Seamless inline registration: Guest enters password directly. No temporary passwords. If email already registered, rejects with 409.
 * 8. OrderItems snapshot is frozen (productTitle, variantTitle, sku, basePrice, customizationFee, lineTotal, artwork details).
 * 9. Delivery tariff: Standard shipping and pickup fees resolved via delivery tariff engine and marked as provisional pending owner sign-off (D-015).
 * 10. Statuses initialized: orderStatus = 'pending', paymentStatus = 'unpaid', fulfillmentStatus = 'unfulfilled'.
 * 11. Transaction requirement: Fails immediately if beginTransaction is not available; full rollback on any failure.
 */
export async function createOrderFromCart(
  payload: Payload,
  input: CreateOrderFromCartInput
): Promise<CreateOrderResult> {
  const { cartId, guestSecret, idempotencyKey, user, customer, delivery, paymentMethod } = input;

  if (!cartId || typeof cartId !== 'number') {
    const err = new Error('INVALID_CART_ID: Valid numeric cart ID is required.');
    (err as any).statusCode = 400;
    throw err;
  }

  // Enforce Paymob rejection at service layer (D-008)
  if ((paymentMethod as string) === 'paymob') {
    const err = new Error(
      'PAYMOB_GATEWAY_DEFERRED: Online gateway payments (Paymob) are deferred to Phase 2 per DECISIONS.md D-008. Please choose Corporate Bank Transfer or Cash on Delivery.'
    );
    (err as any).statusCode = 422;
    throw err;
  }

  // 1. Execute entire order workflow under the cart's PostgreSQL advisory lock
  return withCartLock(payload, cartId, async () => {
    // 2. Fetch active cart
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
    });

    if (!cart) {
      const err = new Error(`CART_NOT_FOUND: Cart ID ${cartId} does not exist.`);
      (err as any).statusCode = 404;
      throw err;
    }

    // Verify ownership
    if (user?.id) {
      const cartCustomerId = typeof cart.customer === 'object' && cart.customer !== null ? (cart.customer as any).id : cart.customer;
      if (cartCustomerId && String(cartCustomerId) !== String(user.id)) {
        const err = new Error('FORBIDDEN_CART_ACCESS: You do not own this cart.');
        (err as any).statusCode = 403;
        throw err;
      }
    } else {
      if (!guestSecret || String(cart.secret || '') !== String(guestSecret)) {
        const err = new Error('FORBIDDEN_CART_ACCESS: Invalid guest session secret for this cart.');
        (err as any).statusCode = 403;
        throw err;
      }
    }

    // 3. AMBIGUOUS COMMIT / LOST RESPONSE RECOVERY (Idempotent Retry)
    // If the transaction committed and the response was lost, the client retry with the same cart/key
    // should return the existing order rather than failing on an empty cart.
    // Replay is scoped to the SAME cart AND the SAME key. A key belonging to another cart never matches.
    const searchConditions: any[] = [{ cart: { equals: cartId } }];
    if (idempotencyKey) {
      searchConditions.push({ idempotencyKey: { equals: idempotencyKey } });
    }

    const existingOrders = await payload.find({
      collection: 'orders',
      where: {
        and: searchConditions,
      },
      sort: '-createdAt',
      limit: 1,
    });

    if (existingOrders.totalDocs > 0) {
      const existingOrder = existingOrders.docs[0];
      const orderCustId = typeof existingOrder.customer === 'object' && existingOrder.customer !== null ? existingOrder.customer.id : existingOrder.customer;

      const isAuthorized = user?.id
        ? String(orderCustId) === String(user.id)
        : (guestSecret && String(cart.secret || '') === String(guestSecret));

      if (isAuthorized && existingOrder.orderStatus !== 'cancelled') {
        return {
          success: true,
          order: existingOrder,
          orderNumber: String(existingOrder.orderNumber || ''),
          customerId: Number(orderCustId),
          userCreated: false,
          isIdempotentReplay: true,
        };
      }
    }

    // Check non-empty items only after checking for existing committed order
    if (!cart.items || !Array.isArray(cart.items) || cart.items.length === 0) {
      const err = new Error('EMPTY_CART: Cannot checkout an empty cart.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 4. Customer validation & seamless registration check (D-013)
    const normalizedEmail = (customer.email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      const err = new Error('INVALID_EMAIL: A valid customer email is required for checkout.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!customer.companyName?.trim()) {
      const err = new Error('MISSING_COMPANY_NAME: Company legal name is required for B2B checkout.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!customer.contactPerson?.trim()) {
      const err = new Error('MISSING_CONTACT_PERSON: Contact person name is required.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!customer.phone?.trim()) {
      const err = new Error('MISSING_PHONE: Contact mobile / WhatsApp phone number is required.');
      (err as any).statusCode = 400;
      throw err;
    }

    // Check delivery validation
    if (delivery.method === 'shipping') {
      const addr = delivery.shippingAddress;
      if (!addr?.governorate?.trim() || !addr?.city?.trim() || !addr?.streetAddress?.trim()) {
        const err = new Error('INCOMPLETE_SHIPPING_ADDRESS: Governorate, city, and street address are required for standard shipping.');
        (err as any).statusCode = 400;
        throw err;
      }
    }

    // 5. Server-authoritative catalog pricing, variant verification, and MOQ calculation
    const productMap = new Map<string | number, any>();
    const variantMap = new Map<string | number, any>();
    const attachedAssetIds: string[] = [];

    for (const item of cart.items) {
      const prodId = typeof item.product === 'object' && item.product !== null ? (item.product as any).id : item.product;
      if (!prodId) {
        const err = new Error('MALFORMED_CART_ITEM: Missing product reference.');
        (err as any).statusCode = 400;
        throw err;
      }

      if (!productMap.has(prodId)) {
        const product = await payload.findByID({
          collection: 'products',
          id: prodId,
        });
        if (!product) {
          const err = new Error(`PRODUCT_NOT_FOUND: Product ID ${prodId} not found in catalog.`);
          (err as any).statusCode = 404;
          throw err;
        }
        productMap.set(prodId, product);
      }

      if (item.variant) {
        const varId = typeof item.variant === 'object' && item.variant !== null ? (item.variant as any).id : item.variant;
        if (!variantMap.has(varId)) {
          const variant = await payload.findByID({
            collection: 'variants',
            id: varId,
          });
          if (!variant) {
            const err = new Error(`VARIANT_NOT_FOUND: Variant ID ${varId} not found in catalog.`);
            (err as any).statusCode = 404;
            throw err;
          }
          variantMap.set(varId, variant);
        }

        const variantDoc = variantMap.get(varId);
        const parentProdId = typeof variantDoc.product === 'object' && variantDoc.product !== null ? variantDoc.product.id : variantDoc.product;
        if (String(parentProdId) !== String(prodId)) {
          const err = new Error(`VARIANT_MISMATCH: Variant ${varId} does not belong to product ${prodId}.`);
          (err as any).statusCode = 422;
          throw err;
        }
      }

      if (item.artworkAssetId) {
        attachedAssetIds.push(String(item.artworkAssetId));
      }
    }

    // MOQ validation (D-009)
    const cartForMoq = cart.items.map((item: any) => {
      const prodId = typeof item.product === 'object' && item.product !== null ? item.product.id : item.product;
      const prod = productMap.get(prodId);
      return {
        productId: String(prodId),
        productTitle: prod.title || 'Product',
        itemType: prod.itemType || 'physical',
        minOrderQuantity: prod.minOrderQuantity || 1,
        quantity: Number(item.quantity) || 1,
        variantId: item.variant ? String(typeof item.variant === 'object' ? item.variant.id : item.variant) : undefined,
      };
    });

    const moqResult = validateCartMoq(cartForMoq);
    if (!moqResult.valid) {
      const err = new Error(`MOQ_VIOLATION: ${moqResult.errors.join('; ')}`);
      (err as any).statusCode = 422;
      throw err;
    }

    // COD Scope & Restrictions (D-021)
    const hasPhysical = cart.items.some((item: any) => {
      const prodId = typeof item.product === 'object' && item.product !== null ? item.product.id : item.product;
      return productMap.get(prodId)?.itemType === 'physical';
    });
    const hasService = cart.items.some((item: any) => {
      const prodId = typeof item.product === 'object' && item.product !== null ? item.product.id : item.product;
      return productMap.get(prodId)?.itemType === 'service';
    });

    if (paymentMethod === 'cod') {
      if (hasService && !hasPhysical) {
        const err = new Error('COD_PROHIBITED_FOR_DIGITAL: Cash on Delivery is strictly prohibited for service packages and digital deliverables.');
        (err as any).statusCode = 422;
        throw err;
      }
      if (hasService && hasPhysical) {
        const err = new Error('COD_PROHIBITED_FOR_MIXED_CART: Mixed carts containing digital services cannot use Cash on Delivery. Please use Bank Transfer or checkout separately.');
        (err as any).statusCode = 422;
        throw err;
      }
    }

    // 6. STRICT POSTGRESQL TRANSACTION ENFORCEMENT
    // Operating without transactions is strictly prohibited. If beginTransaction is missing or fails, throw immediately.
    if (typeof (payload.db as any)?.beginTransaction !== 'function') {
      const err = new Error(
        'DATABASE_TRANSACTION_UNAVAILABLE: PostgreSQL transaction support is strictly required for atomic order creation. Operating without transactions is prohibited.'
      );
      (err as any).statusCode = 500;
      throw err;
    }

    const transactionID = await (payload.db as any).beginTransaction();
    if (!transactionID) {
      const err = new Error(
        'TRANSACTION_BEGIN_FAILED: Could not establish a database transaction for order creation.'
      );
      (err as any).statusCode = 500;
      throw err;
    }

    const txReq: any = {
      payload,
      transactionID,
      context: {
        isTrustedOrderWorkflow: true,
      },
    };

    try {
      // 7. Seamless User Registration / Association
      let customerId: number;
      let userCreated = false;

      if (user?.id) {
        customerId = user.id;
      } else {
        // Guest checkout: check if user already exists
        const existingUsers = await payload.find({
          collection: 'users',
          where: {
            email: { equals: normalizedEmail },
          },
          limit: 1,
          req: txReq,
        });

        if (existingUsers.totalDocs > 0) {
          const err = new Error(
            'EMAIL_ALREADY_REGISTERED: An account with this email address already exists. Please log in first to proceed with your order.'
          );
          (err as any).statusCode = 409;
          throw err;
        }

        if (!customer.password || customer.password.length < 8) {
          const err = new Error(
            'PASSWORD_REQUIRED: Customer must specify a password of at least 8 characters for seamless account creation. Temporary passwords are strictly forbidden.'
          );
          (err as any).statusCode = 400;
          throw err;
        }

        const newUser = await payload.create({
          collection: 'users',
          data: {
            email: normalizedEmail,
            password: customer.password,
            roles: ['customer'],
          },
          req: txReq,
        });

        customerId = newUser.id;
        userCreated = true;
      }

      // 8. Verify artwork asset references
      for (const assetId of attachedAssetIds) {
        const asset = await payload.findByID({
          collection: 'artwork-assets',
          id: assetId,
          req: txReq,
        });

        if (!asset) {
          const err = new Error(`ARTWORK_NOT_FOUND: Artwork asset ${assetId} not found.`);
          (err as any).statusCode = 404;
          throw err;
        }
      }

      // 9. Build frozen OrderItems snapshot
      const orderItems = cart.items.map((item: any) => {
        const prodId = typeof item.product === 'object' && item.product !== null ? item.product.id : item.product;
        const prod = productMap.get(prodId);
        const varId = item.variant
          ? typeof item.variant === 'object' && item.variant !== null
            ? item.variant.id
            : item.variant
          : undefined;
        const variantDoc = varId ? variantMap.get(varId) : undefined;

        let unitPrice = 0;
        if (variantDoc && typeof variantDoc.priceInEGP === 'number') {
          unitPrice = variantDoc.priceInEGP;
        } else if (typeof prod.priceInEGP === 'number') {
          unitPrice = prod.priceInEGP;
        } else if (typeof prod.basePrice === 'number') {
          unitPrice = prod.basePrice;
        }

        const qty = Number(item.quantity) || 1;
        const feePerUnit = item.artworkAssetId ? Number(prod.customizationFee) || 0 : 0;
        const lineTotal = (unitPrice + feePerUnit) * qty;

        return {
          product: prodId,
          variant: varId || undefined,
          productTitle: prod.title || 'Product',
          variantTitle: variantDoc?.title || '',
          sku: variantDoc?.sku || prod.sku || '',
          quantity: qty,
          unitPrice,
          customizationFee: feePerUnit,
          lineTotal,
          fulfillmentType: prod.itemType || 'physical',
          artworkAssetId: item.artworkAssetId || undefined,
          printingNotes: item.printingNotes || '',
        };
      });

      // 10. Delivery Tariff Resolution (D-015 Parameterization)
      const tariffQuote = resolveDeliveryTariff({
        method: delivery.method,
        governorate: delivery.shippingAddress?.governorate,
      });

      if (typeof delivery.expectedShippingFee === 'number' && delivery.expectedShippingFee !== tariffQuote.amount) {
        const err = new Error(`SHIPPING_QUOTE_MISMATCH: Displayed shipping fee (${delivery.expectedShippingFee}) differs from the current server quote (${tariffQuote.amount}). Please review the updated total.`);
        (err as any).statusCode = 409;
        throw err;
      }

      const shippingFee = tariffQuote.amount;

      // Server-authoritative total vs. the total the customer saw. Any drift (product price,
      // customization fee, tariff) is rejected with 409 BEFORE the order is created.
      if (typeof input.expectedGrandTotal === 'number') {
        const serverGrandTotal = orderItems.reduce((sum: number, line: any) => sum + line.lineTotal, 0) + shippingFee;
        if (input.expectedGrandTotal !== serverGrandTotal) {
          const err = new Error(`PRICE_QUOTE_MISMATCH: Displayed total (${input.expectedGrandTotal}) differs from the current server total (${serverGrandTotal}). Please review the updated quote.`);
          (err as any).statusCode = 409;
          throw err;
        }
      }
      const fulfillmentNotes = delivery.method === 'pickup'
        ? (delivery.fulfillmentNotes
            ? `${delivery.fulfillmentNotes} • ${tariffQuote.fulfillmentNoteEn}`
            : tariffQuote.fulfillmentNoteEn)
        : (delivery.fulfillmentNotes || tariffQuote.fulfillmentNoteEn);

      const shippingAddress =
        delivery.method === 'shipping' && delivery.shippingAddress
          ? {
              company: customer.companyName,
              firstName: customer.contactPerson,
              phone: customer.phone,
              state: delivery.shippingAddress.governorate,
              city: delivery.shippingAddress.city,
              addressLine1: delivery.shippingAddress.streetAddress,
              addressLine2: delivery.shippingAddress.buildingDetails || '',
              country: 'EG' as const,
            }
          : undefined;

      // 11. Generate order number from sequence
      let orderNumber = `MWH-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      try {
        const pool = (payload.db as any)?.pool;
        if (pool) {
          const seqRes = await pool.query("SELECT nextval('order_number_seq') AS seq");
          const seq = seqRes.rows[0]?.seq;
          if (seq) {
            orderNumber = `MWH-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;
          }
        }
      } catch {
        // Fallback to random unique format
      }

      // 12. Create order record inside transaction
      const order = await payload.create({
        collection: 'orders',
        data: {
          orderNumber,
          cart: cartId,
          idempotencyKey: idempotencyKey || undefined,
          customer: customerId,
          customerEmail: normalizedEmail,
          companyName: customer.companyName,
          contactPerson: customer.contactPerson,
          phone: customer.phone,
          taxId: customer.taxId || '',
          deliveryMethod: delivery.method,
          fulfillmentNotes,
          shippingAddress: shippingAddress as any,
          items: orderItems as any,
          shippingFee,
          paymentMethod,
          orderStatus: 'pending',
          paymentStatus: 'unpaid',
          fulfillmentStatus: 'unfulfilled',
        },
        req: txReq,
      });

      // 13. Transition attached artwork assets to committed_order
      for (const assetId of attachedAssetIds) {
        await payload.update({
          collection: 'artwork-assets',
          id: assetId,
          data: {
            status: 'committed_order',
            uploader: customerId,
          },
          req: txReq,
        });
      }

      // 14. Mark cart purchased and empty items in database inside transaction
      await payload.update({
        collection: 'carts',
        id: cartId,
        data: {
          items: [],
          purchasedAt: new Date().toISOString(),
        },
        req: txReq,
      });

      // 15. Commit PostgreSQL transaction
      if (typeof (payload.db as any)?.commitTransaction === 'function') {
        await (payload.db as any).commitTransaction(transactionID);
      }

      return {
        success: true,
        order,
        orderNumber: String(order.orderNumber || orderNumber),
        customerId,
        userCreated,
        isIdempotentReplay: false,
      };
    } catch (error) {
      // 16. Rollback on ANY failure
      if (typeof (payload.db as any)?.rollbackTransaction === 'function') {
        try {
          await (payload.db as any).rollbackTransaction(transactionID);
        } catch {
          // Ignore secondary rollback errors
        }
      }
      throw error;
    }
  });
}
