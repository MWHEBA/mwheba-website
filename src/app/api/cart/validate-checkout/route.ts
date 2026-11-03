import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { readCartId } from '@/modules/cart-checkout/logic/cartSession';
import { CART_COOKIE_NAME, getCartSummary } from '@/modules/cart-checkout/services/cartStorage';
import { assertCartCanCheckout } from '@/modules/cart-checkout/services/cartCalculator';

/**
 * Direct HTTP API Endpoint for Server Checkout Gating (Ticket B2B-02).
 * Strictly prevents direct API or script callers from bypassing MOQ validation.
 * Returns HTTP 422 Unprocessable Entity when MOQ rules are violated.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise });

    // Allow reading cartId from body for API testing or fallback to session cookie
    let cartId: number | null = null;
    try {
      const body = await req.json();
      if (body?.cartId && Number.isSafeInteger(Number(body.cartId))) {
        cartId = Number(body.cartId);
      }
    } catch {
      // Body may be empty, proceed to cookie
    }

    if (!cartId) {
      const cookieVal = req.cookies.get(CART_COOKIE_NAME)?.value;
      cartId = readCartId(cookieVal);
    }

    if (!cartId) {
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

    const summary = await getCartSummary(payload, cartId);
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
