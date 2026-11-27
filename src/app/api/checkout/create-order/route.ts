import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { CART_COOKIE_NAME, isRetiredCart } from '@/modules/cart-checkout/services/cartStorage';
import { applyCartCookie, resolveCartRequest } from '@/modules/cart-checkout/services/cartRequest';
import { createOrderFromCart } from '@/modules/orders/services/orderService';
import { buildCheckoutQuote, type CheckoutQuoteDeliveryInput } from '@/modules/orders/services/checkoutQuote';
import { isStorefrontCustomer } from '@/modules/identity/access/roles';
import { accountLocale, normalizeCustomerEmail } from '@/modules/identity/logic/accountPaths';
import { payloadAccountCookie } from '@/modules/identity/services/customerAccount';
import { sameAccountOrigin } from '@/modules/identity/services/customerMail';

export async function POST(req: NextRequest) {
  if (!sameAccountOrigin(req)) return NextResponse.json({ success: false, error: 'FORBIDDEN_ORIGIN' }, { status: 403 });
  let guestCookie: Awaited<ReturnType<typeof resolveCartRequest>>['guestCookie'] = null;
  const respond = (body: object, status = 200) =>
    applyCartCookie(NextResponse.json(body, { status }), guestCookie);
  let quoteContext: { cartId: number; delivery: CheckoutQuoteDeliveryInput } | null = null;
  try {
    const payload = await getPayload({ config: configPromise });
    const session = await resolveCartRequest(payload, {
      headers: req.headers,
      signedCartCookie: req.cookies.get(CART_COOKIE_NAME)?.value,
      guestSecret: req.headers.get('x-guest-secret') ?? undefined,
      allowPurchasedGuest: true,
    });
    guestCookie = session.guestCookie;
    const { user } = session;
    if (user && !isStorefrontCustomer(user)) {
      return respond({ success: false, error: 'CUSTOMER_SESSION_REQUIRED: Sign in to a customer account to check out.' }, 403);
    }
    const noActiveCart = () => respond(
      { success: false, error: 'NO_ACTIVE_CART: No active cart session was found for this checkout request.' },
      404
    );
    if (!session.cart && !user) return noActiveCart();

    // 3. Parse checkout payload
    const body = await req.json();
    const { customer, delivery, paymentMethod, expectedCartId } = body;

    if (!customer || !paymentMethod || (delivery != null && !['shipping', 'pickup'].includes(delivery.method))) {
      return respond(
        { success: false, error: 'INVALID_PAYLOAD: Provide customer and paymentMethod and a valid delivery method when applicable.' },
        400
      );
    }
    if (expectedCartId !== undefined
      && (typeof expectedCartId !== 'number' || !Number.isSafeInteger(expectedCartId) || expectedCartId < 1)) {
      return respond({
        success: false,
        code: 'INVALID_CART_ID',
        error: 'INVALID_CART_ID: Provide a valid checkout cart ID.',
      }, 400);
    }

    // Explicitly reject Paymob payment method at this stage (D-008)
    if (paymentMethod === 'paymob') {
      return respond(
        {
          success: false,
          error: 'PAYMOB_GATEWAY_DEFERRED: Online gateway payments (Paymob) are deferred to Phase 2 per DECISIONS.md D-008. Please choose Corporate Bank Transfer or Cash on Delivery.',
        },
        422
      );
    }

    // 4. Resolve idempotency key from headers or body
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      body.idempotencyKey ||
      undefined;

    let cart = session.cart;
    if (user && typeof idempotencyKey === 'string' && idempotencyKey) {
      // Only a committed order can authorize recovery of a previous cart.
      const replayCartId = expectedCartId ?? cart?.id;
      const { docs } = await payload.find({
        collection: 'orders',
        where: {
          customer: { equals: user.id },
          idempotencyKey: { equals: idempotencyKey },
          ...(replayCartId === undefined ? {} : { cart: { equals: replayCartId } }),
        },
        limit: replayCartId === undefined ? 2 : 1,
        depth: 0,
      });
      const order = docs.length === 1 ? docs[0] : undefined;
      const orderedCartId = typeof order?.cart === 'object' ? order.cart?.id : order?.cart;
      if (orderedCartId) {
        const purchasedCart = await payload.findByID({
          collection: 'carts',
          id: orderedCartId,
          depth: 0,
          disableErrors: true,
        });
        const owner = purchasedCart?.customer;
        if (purchasedCart?.purchasedAt && !isRetiredCart(purchasedCart)
          && (owner == null || (typeof owner === 'object' ? owner.id : owner) === user.id)) {
          cart = purchasedCart;
        }
      }
    }
    if (expectedCartId !== undefined && expectedCartId !== cart?.id) {
      return respond({
        success: false,
        code: 'CHECKOUT_CART_MISMATCH',
        error: 'CHECKOUT_CART_MISMATCH: The checkout request is for a different cart. Review the current cart before confirming.',
      }, 409);
    }
    if (!cart) return noActiveCart();

    // 5. Create order atomically inside PostgreSQL transaction
    const quoteGovernorate = delivery?.method === 'pickup'
      ? delivery.comparisonGovernorate
      : delivery?.shippingAddress?.governorate;
    quoteContext = {
      cartId: cart.id,
      delivery: {
        method: delivery?.method,
        optionId: delivery?.optionId,
        governorate: typeof quoteGovernorate === 'string' ? quoteGovernorate : undefined,
        addressId: delivery?.addressId,
        customerId: user?.id,
      },
    };
    const result = await createOrderFromCart(payload, {
      cartId: cart.id,
      guestSecret: user ? undefined : cart.secret ?? undefined,
      idempotencyKey,
      user,
      customer,
      delivery,
      paymentMethod,
      expectedGrandTotal: body.expectedGrandTotal,
      expectedQuoteConfirmation: body.expectedQuoteConfirmation,
    });

    const status = result.isIdempotentReplay ? 200 : 201;

    let authCookie: string | undefined;
    const checkoutEmail = normalizeCustomerEmail(customer.email);
    if (!user && (result.userCreated || result.isIdempotentReplay) && typeof customer.password === 'string'
      && checkoutEmail === result.order.customerEmail) {
      try {
        const session = await payload.login({
          collection: 'users', depth: 0, context: { storefrontAccount: true },
          data: { email: checkoutEmail, password: customer.password },
        });
        if (session.token && isStorefrontCustomer(session.user) && session.user.id === result.customerId) {
          authCookie = payloadAccountCookie(payload, session.token);
          guestCookie = 'clear';
        }
      } catch {
        // Checkout already committed. Account sign-in can recover the order independently.
      }
    }

    const response = respond(
      {
        success: true,
        orderId: result.order.id,
        orderNumber: result.orderNumber,
        customerId: result.customerId,
        userCreated: result.userCreated,
        total: result.order.amount,
        status: result.order.orderStatus,
        paymentStatus: result.order.paymentStatus,
        paymentMethod: result.order.paymentMethod,
        fulfillment: result.order.appliedTariff ?? null,
        shippingCity: result.order.shippingAddress?.city ?? null,
        isIdempotentReplay: Boolean(result.isIdempotentReplay),
        sessionEstablished: Boolean(user || authCookie),
        orderUrl: `/${accountLocale(body.locale)}/account/orders/${result.order.id}`,
      },
      status
    );
    if (authCookie) response.headers.append('Set-Cookie', authCookie);
    return response;
  } catch (error: any) {
    const statusCode = error.statusCode || error.status || 400;
    const safeError = typeof error.message === 'string' && /^[A-Z0-9_]+: /.test(error.message)
      ? error.message : 'ORDER_CREATION_FAILED';
    const code = safeError.split(':', 1)[0];

    // On a price/tariff drift, return the refreshed server quote so the client can re-confirm.
    let updatedQuote: unknown;
    if (statusCode === 409 && quoteContext && code.endsWith('_QUOTE_MISMATCH')) {
      try {
        const payload = await getPayload({ config: configPromise });
        updatedQuote = await buildCheckoutQuote(payload, quoteContext.cartId, quoteContext.delivery);
      } catch {
        updatedQuote = undefined;
      }
    }

    return respond(
      {
        success: false,
        error: safeError,
        code,
        ...(updatedQuote ? { updatedQuote } : {}),
      },
      statusCode
    );
  }
}
