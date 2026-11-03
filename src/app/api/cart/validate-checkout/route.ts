import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { readCartId } from '@/modules/cart-checkout/logic/cartSession';
import { CART_COOKIE_NAME, getCartSummary } from '@/modules/cart-checkout/services/cartStorage';
import { assertCartCanCheckout } from '@/modules/cart-checkout/services/cartCalculator';

/**
 * Direct HTTP API Endpoint for Server Checkout Gating (Ticket B2B-02).
 * Strictly prevents direct API or script callers from bypassing MOQ validation.
 * Cart retrieval is cryptographically bound to the HMAC-signed session cookie or authenticated user.
 * Arbitrary or guessed cartId in the request body is strictly rejected with HTTP 403 Forbidden.
 * Returns HTTP 422 Unprocessable Entity when MOQ rules are violated.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise });

    // 1. Resolve verified cart ID from cryptographically signed session cookie
    const cookieVal = req.cookies.get(CART_COOKIE_NAME)?.value;
    const sessionCartId = readCartId(cookieVal);

    // 2. Check for optional authenticated user session
    let authUser: any = null;
    try {
      const authResult = await payload.auth({ headers: req.headers });
      authUser = authResult?.user || null;
    } catch {
      // Unauthenticated visitor
    }

    // 3. Inspect request body for explicit cartId (if supplied)
    let requestedCartId: number | null = null;
    try {
      const body = await req.json();
      if (body?.cartId !== undefined && body?.cartId !== null) {
        const parsed = Number(body.cartId);
        if (Number.isSafeInteger(parsed) && parsed > 0) {
          requestedCartId = parsed;
        } else {
          return NextResponse.json(
            {
              error: 'INVALID_CART_ID',
              message: 'Invalid cart ID format.',
            },
            { status: 400 }
          );
        }
      }
    } catch {
      // Body may be empty
    }

    // 4. SECURITY DEFENSE: Prevent cross-session cart access or enumeration
    // If a cartId was explicitly provided in the body, it MUST match the signed session cookie
    // or belong to the authenticated user.
    if (requestedCartId !== null) {
      let isAuthorized = false;

      if (sessionCartId !== null && requestedCartId === sessionCartId) {
        isAuthorized = true;
      } else if (authUser) {
        try {
          const targetCart = await payload.findByID({
            collection: 'carts',
            id: requestedCartId,
            depth: 0,
          });
          const cartCustomerId =
            typeof targetCart?.customer === 'object' && targetCart?.customer !== null
              ? targetCart.customer.id
              : targetCart?.customer;
          if (cartCustomerId && String(cartCustomerId) === String(authUser.id)) {
            isAuthorized = true;
          }
        } catch {
          // Cart not found
        }
      }

      if (!isAuthorized) {
        return NextResponse.json(
          {
            error: 'FORBIDDEN_CART_ACCESS',
            message: 'Access denied: The requested cart does not belong to the verified session.',
            canCheckout: false,
          },
          { status: 403 }
        );
      }
    }

    const effectiveCartId = requestedCartId ?? sessionCartId;

    if (!effectiveCartId) {
      return NextResponse.json(
        {
          error: 'CHECKOUT_CART_EMPTY',
          message: 'Cart is empty or session expired.',
          canCheckout: false,
          validationErrors: ['Cart is empty.'],
        },
        { status: 422 }
      );
    }

    const summary = await getCartSummary(payload, effectiveCartId);
    assertCartCanCheckout(summary);

    return NextResponse.json({
      success: true,
      canCheckout: true,
      summary,
    });
  } catch (err: any) {
    if (err.status === 422 || err.statusCode === 422 || err.code === 'CHECKOUT_MOQ_VIOLATION') {
      return NextResponse.json(
        {
          error: 'CHECKOUT_MOQ_VIOLATION',
          message: err.message,
          canCheckout: false,
          validationErrors: err.validationErrors || [err.message],
          productGroupings: err.productGroupings,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred during checkout validation.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise });
    const cookieVal = req.cookies.get(CART_COOKIE_NAME)?.value;
    const cartId = readCartId(cookieVal);

    if (!cartId) {
      return NextResponse.json({
        items: [],
        productGroupings: {},
        totalItemsCount: 0,
        subtotal: 0,
        totalCustomizationFees: 0,
        grandTotal: 0,
        currency: 'EGP',
        canCheckout: false,
        validationErrors: ['Cart is empty.'],
      });
    }

    const summary = await getCartSummary(payload, cartId);
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'CART_FETCH_ERROR', message: err.message },
      { status: 500 }
    );
  }
}
