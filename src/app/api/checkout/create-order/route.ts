import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { readCartId } from '@/modules/cart-checkout/logic/cartSession';
import { CART_COOKIE_NAME } from '@/modules/cart-checkout/services/cartStorage';
import { createOrderFromCart } from '@/modules/orders/services/orderService';
import { buildCheckoutQuote } from '@/modules/orders/services/checkoutQuote';

export async function POST(req: NextRequest) {
  let quoteContext: { cartId: number; method: 'shipping' | 'pickup'; governorate?: string } | null = null;
  try {
    const payload = await getPayload({ config: configPromise });

    // 1. Resolve user if authenticated
    let user: any = null;
    try {
      const auth = await payload.auth({ headers: req.headers });
      if (auth?.user) {
        user = auth.user;
      }
    } catch {
      // Unauthenticated guest
    }

    // 2. Resolve active cart
    const cookieVal = req.cookies.get(CART_COOKIE_NAME)?.value;
    const sessionCartId = readCartId(cookieVal);
    let cart: any = null;

    if (sessionCartId) {
      cart = await payload.findByID({
        collection: 'carts',
        id: sessionCartId,
        depth: 0,
      });
    }

    if (!cart && user?.id) {
      const userCarts = await payload.find({
        collection: 'carts',
        where: { customer: { equals: user.id } },
        limit: 1,
        depth: 0,
      });
      if (userCarts.docs?.[0]) {
        cart = userCarts.docs[0];
      }
    }

    const guestSecret = req.headers.get('x-guest-secret');
    if (!cart && guestSecret) {
      const guestCarts = await payload.find({
        collection: 'carts',
        where: { secret: { equals: guestSecret } },
        limit: 1,
        depth: 0,
      });
      if (guestCarts.docs?.[0]) {
        cart = guestCarts.docs[0];
      }
    }

    if (!cart) {
      return NextResponse.json(
        { success: false, error: 'NO_ACTIVE_CART: No active cart session was found for this checkout request.' },
        { status: 404 }
      );
    }

    // 3. Parse checkout payload
    const body = await req.json();
    const { customer, delivery, paymentMethod } = body;

    if (!customer || !delivery || !paymentMethod) {
      return NextResponse.json(
        { success: false, error: 'INVALID_PAYLOAD: customer, delivery, and paymentMethod are required.' },
        { status: 400 }
      );
    }

    // Explicitly reject Paymob payment method at this stage (D-008)
    if (paymentMethod === 'paymob') {
      return NextResponse.json(
        {
          success: false,
          error: 'PAYMOB_GATEWAY_DEFERRED: Online gateway payments (Paymob) are deferred to Phase 2 per DECISIONS.md D-008. Please choose Corporate Bank Transfer or Cash on Delivery.',
        },
        { status: 422 }
      );
    }

    // 4. Resolve idempotency key from headers or body
    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      body.idempotencyKey ||
      undefined;

    // 5. Create order atomically inside PostgreSQL transaction
    quoteContext = {
      cartId: cart.id,
      method: delivery.method === 'pickup' ? 'pickup' : 'shipping',
      governorate: delivery.shippingAddress?.governorate,
    };
    const result = await createOrderFromCart(payload, {
      cartId: cart.id,
      guestSecret: cart.secret,
      idempotencyKey,
      user,
      customer,
      delivery,
      paymentMethod,
      expectedGrandTotal: typeof body.expectedGrandTotal === 'number' ? body.expectedGrandTotal : undefined,
    });

    const status = result.isIdempotentReplay ? 200 : 201;

    const response = NextResponse.json(
      {
        success: true,
        orderId: result.order.id,
        orderNumber: result.orderNumber,
        customerId: result.customerId,
        userCreated: result.userCreated,
        total: result.order.total || result.order.amount,
        status: result.order.orderStatus,
        paymentStatus: result.order.paymentStatus,
        isIdempotentReplay: Boolean(result.isIdempotentReplay),
      },
      { status }
    );

    return response;
  } catch (error: any) {
    const statusCode = error.statusCode || 400;

    // On a price/tariff drift, return the refreshed server quote so the client can re-confirm.
    let updatedQuote: unknown;
    if (statusCode === 409 && quoteContext && /QUOTE_MISMATCH/.test(String(error.message))) {
      try {
        const payload = await getPayload({ config: configPromise });
        updatedQuote = await buildCheckoutQuote(payload, quoteContext.cartId, {
          method: quoteContext.method,
          governorate: quoteContext.governorate,
        });
      } catch {
        updatedQuote = undefined;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'ORDER_CREATION_FAILED',
        ...(updatedQuote ? { updatedQuote } : {}),
      },
      { status: statusCode }
    );
  }
}
