import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { readCartId, signCartId } from '@/modules/cart-checkout/logic/cartSession';
import {
  CART_COOKIE_NAME,
  getOrCreateCart,
  addItemToCart,
  updateItemQuantity,
  removeItemFromCart,
  clearPersistentCart,
  getCartSummary,
} from '@/modules/cart-checkout/services/cartStorage';

/**
 * Helper to resolve cart ID from signed session cookie or authenticated user.
 */
async function resolveCart(req: NextRequest, payload: any) {
  const cookieVal = req.cookies.get(CART_COOKIE_NAME)?.value;
  const sessionCartId = readCartId(cookieVal);

  if (sessionCartId) {
    const existing = await payload.findByID({
      collection: 'carts',
      id: sessionCartId,
      depth: 0,
    });
    if (existing) {
      return { cart: existing, isNew: false };
    }
  }

  // Check guest secret header or query param if passed in request
  const guestSecret = req.headers.get('x-guest-secret') || req.nextUrl.searchParams.get('secret');
  if (guestSecret) {
    const carts = await payload.find({
      collection: 'carts',
      where: { secret: { equals: guestSecret } },
      limit: 1,
      depth: 0,
    });
    if (carts.docs?.[0]) {
      return { cart: carts.docs[0], isNew: false };
    }
  }

  // Check authenticated customer
  try {
    const authResult = await payload.auth({ headers: req.headers });
    if (authResult?.user?.id) {
      const userCarts = await payload.find({
        collection: 'carts',
        where: { customer: { equals: authResult.user.id } },
        limit: 1,
        depth: 0,
      });
      if (userCarts.docs?.[0]) {
        return { cart: userCarts.docs[0], isNew: false };
      }
    }
  } catch {
    // Guest flow
  }

  // Initialize new guest cart with native Payload Ecommerce secret
  const newCart = await getOrCreateCart(payload);
  return { cart: newCart, isNew: true };
}

/**
 * POST /api/cart/items
 * Adds an item to the persistent cart with mandatory client-generated operationKey.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise });
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_JSON', message: 'Malformed JSON payload.' },
        { status: 400 }
      );
    }

    const { productId, variantId, quantity, artworkAssetId, printingNotes, operationKey } = body || {};

    if (!operationKey || typeof operationKey !== 'string' || !operationKey.trim()) {
      return NextResponse.json(
        {
          error: 'MISSING_OPERATION_KEY',
          message: 'A client-generated operationKey is required for idempotent cart mutation.',
        },
        { status: 400 }
      );
    }

    if (!productId || !quantity || Number(quantity) <= 0) {
      return NextResponse.json(
        {
          error: 'INVALID_PARAMETERS',
          message: 'Valid productId and positive quantity are required.',
        },
        { status: 422 }
      );
    }

    const { cart, isNew } = await resolveCart(req, payload);

    const summary = await addItemToCart(payload, cart.id, {
      productId,
      variantId: variantId ? Number(variantId) || variantId : undefined,
      quantity: Number(quantity),
      artworkAssetId: artworkAssetId ? String(artworkAssetId) : undefined,
      printingNotes: printingNotes ? String(printingNotes) : undefined,
      operationKey: operationKey.trim(),
    });

    const response = NextResponse.json({
      success: true,
      cartId: cart.id,
      guestSecret: cart.secret,
      operationKey: operationKey.trim(),
      summary,
    });

    if (isNew) {
      response.cookies.set(CART_COOKIE_NAME, signCartId(cart.id), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'INTERNAL_ERROR' },
      { status: err.status || err.statusCode || 500 }
    );
  }
}

/**
 * PATCH /api/cart/items
 * Updates quantity of a line item with mandatory operationKey.
 */
export async function PATCH(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise });
    const body = await req.json();
    const { itemId, quantity, operationKey } = body || {};

    if (!operationKey || typeof operationKey !== 'string' || !operationKey.trim()) {
      return NextResponse.json(
        {
          error: 'MISSING_OPERATION_KEY',
          message: 'A client-generated operationKey is required for idempotent cart mutation.',
        },
        { status: 400 }
      );
    }

    if (!itemId || quantity === undefined || Number(quantity) < 0) {
      return NextResponse.json(
        { error: 'INVALID_PARAMETERS', message: 'Valid itemId and non-negative quantity required.' },
        { status: 422 }
      );
    }

    const cookieVal = req.cookies.get(CART_COOKIE_NAME)?.value;
    const cartId = readCartId(cookieVal);
    if (!cartId) {
      return NextResponse.json({ error: 'CART_NOT_FOUND', message: 'No active cart.' }, { status: 404 });
    }

    const summary = await updateItemQuantity(
      payload,
      cartId,
      String(itemId),
      Number(quantity),
      operationKey.trim()
    );

    return NextResponse.json({
      success: true,
      cartId,
      operationKey: operationKey.trim(),
      summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'INTERNAL_ERROR' },
      { status: err.status || err.statusCode || 500 }
    );
  }
}

/**
 * DELETE /api/cart/items
 * Removes a line item with mandatory operationKey.
 */
export async function DELETE(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise });
    const body = await req.json();
    const { itemId, clearAll, operationKey } = body || {};

    if (!operationKey || typeof operationKey !== 'string' || !operationKey.trim()) {
      return NextResponse.json(
        {
          error: 'MISSING_OPERATION_KEY',
          message: 'A client-generated operationKey is required for idempotent cart mutation.',
        },
        { status: 400 }
      );
    }

    const cookieVal = req.cookies.get(CART_COOKIE_NAME)?.value;
    const cartId = readCartId(cookieVal);
    if (!cartId) {
      return NextResponse.json({ error: 'CART_NOT_FOUND', message: 'No active cart.' }, { status: 404 });
    }

    let summary;
    if (clearAll || itemId === 'all') {
      summary = await clearPersistentCart(payload, cartId, operationKey.trim());
    } else {
      if (!itemId) {
        return NextResponse.json({ error: 'INVALID_PARAMETERS', message: 'Valid itemId required.' }, { status: 422 });
      }
      summary = await removeItemFromCart(payload, cartId, String(itemId), operationKey.trim());
    }

    return NextResponse.json({
      success: true,
      cartId,
      operationKey: operationKey.trim(),
      summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'INTERNAL_ERROR' },
      { status: err.status || err.statusCode || 500 }
    );
  }
}

/**
 * GET /api/cart/items
 * Reads current cart state using session cookie or guest secret query param.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise });
    const { searchParams } = new URL(req.url);
    const guestSecret = searchParams.get('secret');

    let cartId: number | null = null;

    if (guestSecret) {
      // Find guest cart strictly by native Payload Ecommerce secret
      const carts = await payload.find({
        collection: 'carts',
        where: { secret: { equals: guestSecret } },
        limit: 1,
        depth: 0,
      });
      if (carts.docs?.[0]) {
        cartId = carts.docs[0].id;
      }
    }

    if (!cartId) {
      const cookieVal = req.cookies.get(CART_COOKIE_NAME)?.value;
      cartId = readCartId(cookieVal);
    }

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
    return NextResponse.json({
      cartId,
      summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
