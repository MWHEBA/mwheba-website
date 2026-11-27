/**
 * MWHEBA 2.0 Order Service
 * Atomic order creation workflow inside a PostgreSQL transaction (D-007, D-009, D-010, D-011, D-013, D-015, D-017, D-021).
 */

import { APIError, type Payload, type PayloadRequest } from 'payload';
import { sql } from '@payloadcms/db-postgres';
import type { Order } from '@/payload-types';
import { isDeepStrictEqual } from 'node:util';
import { isRetiredCart, withCartLock } from '../../cart-checkout/services/cartStorage';
import type { CheckoutFulfillmentMethod } from './checkoutFulfillment';
import { priceCheckoutCart, type CheckoutPaymentMethod, type CheckoutShippingAddress } from './checkoutQuote';
import { createJobsForOrder } from '@/modules/fulfillment/services/fulfillmentService';
import { normalizeCustomerEmail, validCustomerEmail } from '@/modules/identity/logic/accountPaths';
import { allocateOrderInventory, getInventoryTransaction, inventoryOrderError } from '@/modules/inventory/services/inventoryService';

export interface CreateOrderCustomerInput {
  email: string;
  password?: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  taxId?: string;
}

export interface CreateOrderDeliveryInput {
  method: CheckoutFulfillmentMethod;
  optionId?: string;
  expectedFulfillmentConfirmation?: string;
  addressId?: number;
  shippingAddress?: CheckoutShippingAddress;
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
  delivery?: CreateOrderDeliveryInput;
  paymentMethod: CheckoutPaymentMethod;
  /** Grand total the customer saw (from the server quote). REQUIRED: rejected with 409 if the server total differs. */
  expectedGrandTotal: number;
  /** Confirmation returned by the server for the displayed lines, charges and fulfillment. */
  expectedQuoteConfirmation: string | null;
}

export interface CreateOrderResult {
  success: boolean;
  order: any;
  orderNumber: string;
  customerId: number;
  userCreated: boolean;
  isIdempotentReplay?: boolean;
}

function priceQuoteMismatch(expectedTotal: number, currentTotal: number | null | undefined) {
  const message = expectedTotal === currentTotal
    ? 'The quoted order details changed. Please review the updated quote.'
    : `Displayed total (${expectedTotal}) differs from the current server total (${currentTotal ?? 'unavailable'}). Please review the updated quote.`;
  return Object.assign(
    new Error(`PRICE_QUOTE_MISMATCH: ${message}`),
    { statusCode: 409 },
  );
}

function orderLinePricing(item: NonNullable<Order['items']>[number]) {
  return [
    typeof item.product === 'object' ? item.product?.id : item.product,
    (typeof item.variant === 'object' ? item.variant?.id : item.variant) ?? null,
    item.sku ?? '', item.fulfillmentType, item.quantity, item.unitPrice, item.customizationFee, item.lineTotal,
    item.artworkAssetId ?? '', item.printingNotes ?? '',
  ];
}

async function readCommittedCheckout(payload: Payload, cartId: number, order: Order) {
  const closedCart = await payload.findByID({ collection: 'carts', id: cartId, depth: 0, disableErrors: true });
  if (!closedCart?.purchasedAt || closedCart.items?.length) return null;
  const persisted = await payload.findByID({ collection: 'orders', id: order.id, depth: 0, disableErrors: true });
  const persistedCartId = typeof persisted?.cart === 'object' ? persisted.cart?.id : persisted?.cart;
  const actorId = typeof order.customer === 'object' ? order.customer?.id : order.customer;
  const persistedActor = typeof persisted?.customer === 'object' ? persisted.customer?.id : persisted?.customer;
  if (persistedCartId !== cartId || persistedActor !== actorId
    || (persisted?.idempotencyKey || undefined) !== (order.idempotencyKey || undefined)) return null;
  return persisted ?? null;
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
 * 9. Physical fulfillment is resolved from the approved pilot configuration and checked against the buyer's quote.
 * 10. Statuses initialized: orderStatus = 'pending', paymentStatus = 'unpaid', fulfillmentStatus = 'unfulfilled'.
 * 11. Transaction requirement: Fails immediately if beginTransaction is not available; full rollback on any failure.
 */
export async function createOrderFromCart(
  payload: Payload,
  input: CreateOrderFromCartInput
): Promise<CreateOrderResult> {
  const { cartId, guestSecret, idempotencyKey, user, customer, delivery, paymentMethod } = input;

  if (!Number.isSafeInteger(cartId) || cartId < 1) {
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

  if (paymentMethod !== 'cod' && paymentMethod !== 'bank_transfer') {
    throw new APIError('PAYMENT_METHOD_UNAVAILABLE: Choose an available payment method.', 422);
  }

  // 1. Execute entire order workflow under the cart's PostgreSQL advisory lock
  return withCartLock(payload, cartId, async () => {
    // 2. Fetch active cart
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    if (!cart || isRetiredCart(cart)) {
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
      if (cart.customer || !guestSecret || String(cart.secret || '') !== String(guestSecret)) {
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

      const matchesOperation = (existingOrder.idempotencyKey || undefined) === (idempotencyKey || undefined);
      if (cart.purchasedAt && isAuthorized && matchesOperation) {
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

    if (typeof input.expectedGrandTotal !== 'number' || !Number.isFinite(input.expectedGrandTotal)) {
      throw new APIError('EXPECTED_GRAND_TOTAL_REQUIRED: expectedGrandTotal (the total shown to the customer) is required to place an order.', 400);
    }

    // Check non-empty items only after checking for existing committed order
    if (cart.purchasedAt || !cart.items || !Array.isArray(cart.items) || cart.items.length === 0) {
      const err = new Error('EMPTY_CART: Cannot checkout an empty cart.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 4. Customer validation & seamless registration check (D-013)
    const normalizedEmail = normalizeCustomerEmail(user?.email ?? customer.email);
    if (!validCustomerEmail(normalizedEmail)) {
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

    // 6. STRICT POSTGRESQL TRANSACTION ENFORCEMENT
    // Operating without transactions is strictly prohibited. If beginTransaction is missing or fails, throw immediately.
    if (typeof payload.db?.beginTransaction !== 'function' || typeof payload.db.commitTransaction !== 'function'
      || typeof payload.db.rollbackTransaction !== 'function') {
      const err = new Error(
        'DATABASE_TRANSACTION_UNAVAILABLE: PostgreSQL transaction support is strictly required for atomic order creation. Operating without transactions is prohibited.'
      );
      (err as any).statusCode = 500;
      throw err;
    }

    const transactionID = await payload.db.beginTransaction();
    if (!transactionID) {
      const err = new Error(
        'TRANSACTION_BEGIN_FAILED: Could not establish a database transaction for order creation.'
      );
      (err as any).statusCode = 500;
      throw err;
    }

    const txReq: Partial<PayloadRequest> = {
      payload,
      transactionID,
      context: {
        isTrustedOrderWorkflow: true,
      },
    };

    let attemptedOrder: Order | undefined;

    try {
      const tx = await getInventoryTransaction(payload, txReq);
      await tx.execute(sql`SELECT id FROM carts WHERE id = ${cartId} FOR UPDATE`);
      const lockedCart = await payload.findByID({ collection: 'carts', id: cartId, depth: 0, req: txReq });
      if (lockedCart.purchasedAt || !lockedCart.items?.length || isRetiredCart(lockedCart)) {
        throw new APIError('EMPTY_CART: Cannot checkout a closed or empty cart.', 400);
      }
      if (lockedCart.customer !== cart.customer || lockedCart.secret !== cart.secret) {
        throw new APIError('FORBIDDEN_CART_ACCESS: Cart ownership changed. Reopen checkout.', 403);
      }

      const priced = await priceCheckoutCart(payload, lockedCart, {
        method: delivery?.method,
        optionId: delivery?.optionId,
        addressId: delivery?.addressId,
        customerId: user?.id,
        shippingAddress: delivery?.shippingAddress,
      }, txReq);
      const { quote, lines, summary, shippingAddress: shippingAddressInput, amounts, settings, codEligibility } = priced;
      const { fulfillment } = quote;
      const option = fulfillment.selected;

      const unavailableLine = lines.find((line) => line.availabilityError);
      if (unavailableLine?.availabilityError) {
        throw new APIError(unavailableLine.availabilityError, 422);
      }
      const stockLine = lines.find((line) => line.stockIssue);
      if (stockLine?.stockIssue) {
        const label = stockLine.variantTitle ? `${stockLine.productTitle} (${stockLine.variantTitle})` : stockLine.productTitle;
        throw inventoryOrderError(stockLine.stockIssue, label);
      }
      if (!summary.canCheckout) {
        throw new APIError(`MOQ_VIOLATION: ${summary.validationErrors.join('; ')}`, 422);
      }
      if (paymentMethod === 'cod' && !codEligibility.eligible) {
        throw new APIError(`${codEligibility.code}: ${codEligibility.message}`, 422);
      }
      if (fulfillment.required && (delivery?.method === 'shipping' || option?.method === 'shipping')
        && ![shippingAddressInput?.governorate, shippingAddressInput?.city, shippingAddressInput?.streetAddress]
          .every((value) => typeof value === 'string' && value.trim())) {
        throw new APIError('INCOMPLETE_SHIPPING_ADDRESS: Governorate, city, and street address are required for courier delivery.', 400);
      }

      if (fulfillment.required) {
        const hasConfirmation = Boolean(delivery?.optionId && delivery.expectedFulfillmentConfirmation);
        if (hasConfirmation && (!option || delivery?.expectedFulfillmentConfirmation !== option.confirmation)) {
          throw new APIError('FULFILLMENT_QUOTE_MISMATCH: Delivery or pickup has changed. Review the updated quote.', 409);
        }
        if (!option) {
          throw new APIError(`FULFILLMENT_UNAVAILABLE: ${fulfillment.issue ?? 'Choose an available fulfillment method.'}`, 422);
        }
        if (!hasConfirmation) {
          throw new APIError('EXPECTED_FULFILLMENT_REQUIRED: Confirm the quoted delivery or pickup option before placing the order.', 400);
        }
        if (paymentMethod === 'cod' && !quote.codEligible) {
          throw new APIError('COD_PROHIBITED_FOR_FULFILLMENT: Cash on Delivery is unavailable for the selected option.', 422);
        }
      }
      if (option && typeof delivery?.expectedShippingFee === 'number' && delivery.expectedShippingFee !== amounts.shippingFee) {
        throw new APIError(`SHIPPING_QUOTE_MISMATCH: Displayed shipping fee (${delivery.expectedShippingFee}) differs from the current server quote (${amounts.shippingFee}). Please review the updated total.`, 409);
      }
      if (input.expectedGrandTotal !== amounts.grandTotal) {
        throw priceQuoteMismatch(input.expectedGrandTotal, amounts.grandTotal);
      }
      const expectedConfirmation = input.expectedQuoteConfirmation;
      if (typeof expectedConfirmation === 'string' && expectedConfirmation.length > 0 && expectedConfirmation !== quote.confirmation) {
        throw priceQuoteMismatch(input.expectedGrandTotal, amounts.grandTotal);
      }
      if (!quote.paymentMethods.includes(paymentMethod)) {
        throw new APIError('BANK_TRANSFER_UNAVAILABLE: Choose an available payment method.', 422);
      }
      if (amounts.grandTotalPiastres <= 0) {
        throw new APIError('INVALID_ORDER_TOTAL: The order total must be greater than zero.', 422);
      }
      if (!quote.confirmation || typeof expectedConfirmation !== 'string' || !expectedConfirmation) {
        throw new APIError('EXPECTED_QUOTE_CONFIRMATION_REQUIRED: Confirm the current server quote before placing the order.', 400);
      }

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

        if (typeof customer.password !== 'string' || customer.password.length < 8 || customer.password.length > 128) {
          const err = new Error(
            'PASSWORD_REQUIRED: Customer must specify a password between 8 and 128 characters.'
          );
          (err as any).statusCode = 400;
          throw err;
        }

        const newUser = await payload.create({
          collection: 'users',
          data: {
            email: normalizedEmail,
            password: customer.password,
            name: customer.contactPerson.trim(),
            companyName: customer.companyName.trim(),
            taxId: customer.taxId?.trim(),
            roles: ['customer'],
          },
          req: txReq,
        });

        customerId = newUser.id;
        userCreated = true;
      }

      // 8. Verify artwork asset references
      const attachedAssetIds = lines.flatMap((line) => line.artworkAssetId ? [line.artworkAssetId] : []);
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

      const orderItems: NonNullable<Order['items']> = lines.map((line) => ({
        product: line.productId,
        variant: line.variantId,
        productTitle: line.productTitle,
        variantTitle: line.variantTitle,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        customizationFee: line.customizationFeePerUnit,
        lineTotal: line.lineTotal,
        fulfillmentType: line.itemType,
        artworkAssetId: line.artworkAssetId,
        printingNotes: line.printingNotes ?? '',
      }));
      const expectedOrderLinePricing = orderItems.map(orderLinePricing);
      const fulfillmentNotes = option && typeof delivery?.fulfillmentNotes === 'string'
        ? delivery.fulfillmentNotes.trim() : undefined;

      const shippingAddress =
        option?.method === 'shipping' && shippingAddressInput
          ? {
              company: customer.companyName,
              firstName: customer.contactPerson,
              phone: customer.phone,
              state: shippingAddressInput.governorate.trim(),
              city: shippingAddressInput.city.trim(),
              addressLine1: shippingAddressInput.streetAddress.trim(),
              addressLine2: typeof shippingAddressInput.buildingDetails === 'string'
                ? shippingAddressInput.buildingDetails.trim() : '',
              country: 'EG' as const,
            }
          : undefined;

      // 11. Generate order number from sequence
      const { rows: [orderSequence] } = await tx.execute<{ sequence: string }>(sql`
        SELECT nextval('order_number_seq')::text AS sequence
      `);
      const orderNumber = `MWH-${new Date().getFullYear()}-${orderSequence.sequence.padStart(5, '0')}`;

      // 12. Create order record inside transaction with frozen snapshots
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
          deliveryMethod: option?.method ?? null,
          fulfillmentNotes,
          shippingAddress,
          items: orderItems,
          shippingFee: amounts.shippingFee,
          taxAmount: amounts.taxAmount,
          currency: quote.currency,
          taxReviewStatus: 'pending_accountant_review',
          paymentMethod,
          orderStatus: paymentMethod === 'cod' ? 'confirmed' : 'pending',
          paymentStatus: 'unpaid',
          fulfillmentStatus: 'unfulfilled',
          remittanceStatus: paymentMethod === 'cod' ? 'pending_collection' : 'not_applicable',
          appliedTariff: option ? {
            status: 'owner_approved',
            amount: option.amount,
            currency: option.currency,
            governorate: shippingAddress?.state ?? null,
            regionCode: option.regionCode,
            method: option.method,
            optionId: option.id,
            configurationReference: option.configurationReference,
            codAllowed: option.codAllowed,
            label: option.label,
            ...(option.pickup ? { pickup: option.pickup } : {}),
            tariffScheduleStatus: 'owner_approved',
            capturedAt: new Date().toISOString(),
          } : null,
          appliedProductionPolicy: settings.productionPolicy || 'require_payment_clearance',
        },
        req: txReq,
      });

      // The order hook re-reads the catalog. Reject offsetting edits as well as changes to the total.
      if (order.grandTotalPiastres !== amounts.grandTotalPiastres
        || order.amount !== amounts.grandTotal || order.currency !== quote.currency
        || order.subtotal !== amounts.subtotal || order.totalCustomizationFees !== amounts.totalCustomizationFees
        || order.shippingFee !== amounts.shippingFee || order.taxAmount !== amounts.taxAmount
        || !isDeepStrictEqual(order.items?.map(orderLinePricing), expectedOrderLinePricing)) {
        throw priceQuoteMismatch(input.expectedGrandTotal, order.amount);
      }

      await allocateOrderInventory(payload, txReq, order.id, lines);

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

      // 14b. Create per-line fulfillment jobs (physical vs service tracks) inside the same transaction
      await createJobsForOrder(payload, order, txReq);

      // 15. Commit PostgreSQL transaction
      attemptedOrder = order;
      await payload.db.commitTransaction(transactionID);
      const persisted = await readCommittedCheckout(payload, cartId, order);
      if (!persisted) throw new APIError('ORDER_COMMIT_UNCONFIRMED: Retry checkout with the same operation key.', 503);

      return {
        success: true,
        order: persisted,
        orderNumber: String(persisted.orderNumber || orderNumber),
        customerId,
        userCreated,
        isIdempotentReplay: false,
      };
    } catch (error) {
      // 16. Rollback on ANY failure
      try {
        await payload.db.rollbackTransaction(transactionID);
      } catch {
        // The commit path independently checks for a persisted order.
      }
      if (attemptedOrder) {
        const recovered = await readCommittedCheckout(payload, cartId, attemptedOrder).catch(() => null);
        if (recovered) {
          return {
            success: true,
            order: recovered,
            orderNumber: String(recovered.orderNumber || ''),
            customerId: Number(typeof recovered.customer === 'object' ? recovered.customer?.id : recovered.customer),
            userCreated: false,
            isIdempotentReplay: true,
          };
        }
        throw new APIError('ORDER_COMMIT_UNCONFIRMED: Retry checkout with the same operation key.', 503);
      }
      throw error;
    }
  });
}
