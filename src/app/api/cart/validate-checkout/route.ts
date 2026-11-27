import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { CART_COOKIE_NAME, getCartSummary } from '@/modules/cart-checkout/services/cartStorage';
import { assertCartCanCheckout, calculateCartSummary } from '@/modules/cart-checkout/services/cartCalculator';
import { applyCartCookie, resolveCartRequest } from '@/modules/cart-checkout/services/cartRequest';

/**
 * Direct HTTP API Endpoint for Server Checkout Gating (Ticket B2B-02).
 * Strictly prevents direct API or script callers from bypassing MOQ validation.
 * Cart retrieval is cryptographically bound to the HMAC-signed session cookie or authenticated user.
 * Arbitrary or guessed cartId in the request body is strictly rejected with HTTP 403 Forbidden.
 * Returns HTTP 422 Unprocessable Entity when MOQ rules are violated.
 */
export async function POST(req: NextRequest) {
  let guestCookie: Awaited<ReturnType<typeof resolveCartRequest>>['guestCookie'] = null;
  const respond = (body: object, status = 200) =>
    applyCartCookie(NextResponse.json(body, { status }), guestCookie);

  try {
    const payload = await getPayload({ config: configPromise });
    const session = await resolveCartRequest(payload, {
      headers: req.headers,
      signedCartCookie: req.cookies.get(CART_COOKIE_NAME)?.value,
    });
    guestCookie = session.guestCookie;
    let requestedCartId: number | null = null;
    try {
      const body = await req.json();
      if (body?.cartId !== undefined && body?.cartId !== null) {
        const parsed = Number(body.cartId);
        if (Number.isSafeInteger(parsed) && parsed > 0) {
          requestedCartId = parsed;
        } else {
          return respond(
            {
              error: 'INVALID_CART_ID',
              message: 'Invalid cart ID format.',
            },
            400
          );
        }
      }
    } catch {
      // Body may be empty
    }

    if (requestedCartId !== null && requestedCartId !== session.cart?.id) {
      return respond(
        {
          error: 'FORBIDDEN_CART_ACCESS',
          message: 'Access denied: The requested cart does not belong to the verified session.',
          canCheckout: false,
        },
        403
      );
    }

    if (!session.cart) {
      return respond(
        {
          error: 'CHECKOUT_CART_EMPTY',
          message: 'Cart is empty or session expired.',
          canCheckout: false,
          validationErrors: ['Cart is empty.'],
        },
        422
      );
    }

    const summary = await getCartSummary(payload, session.cart.id);
    assertCartCanCheckout(summary);

    return respond({
      success: true,
      canCheckout: true,
      summary,
    });
  } catch (err: any) {
    if (err.status === 422 || err.statusCode === 422 || err.code === 'CHECKOUT_MOQ_VIOLATION') {
      return respond(
        {
          error: err.code || 'CHECKOUT_MOQ_VIOLATION',
          message: err.message,
          canCheckout: false,
          validationErrors: err.validationErrors || [err.message],
          productGroupings: err.productGroupings,
        },
        422
      );
    }

    return respond(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred during checkout validation.',
      },
      500
    );
  }
}

export async function GET(req: NextRequest) {
  let guestCookie: Awaited<ReturnType<typeof resolveCartRequest>>['guestCookie'] = null;
  try {
    const payload = await getPayload({ config: configPromise });
    const session = await resolveCartRequest(payload, {
      headers: req.headers,
      signedCartCookie: req.cookies.get(CART_COOKIE_NAME)?.value,
    });
    guestCookie = session.guestCookie;
    const summary = session.cart
      ? await getCartSummary(payload, session.cart.id)
      : calculateCartSummary([]);
    return applyCartCookie(NextResponse.json(summary), guestCookie);
  } catch (err: any) {
    return applyCartCookie(
      NextResponse.json({ error: 'CART_FETCH_ERROR', message: err.message }, { status: 500 }),
      guestCookie
    );
  }
}
