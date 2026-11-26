import { NextRequest, NextResponse } from 'next/server';
import { APIError, getPayload } from 'payload';
import configPromise from '@/payload.config';
import { calculateCartSummary } from '@/modules/cart-checkout/services/cartCalculator';
import { applyCartCookie, resolveCartRequest, type CartCookieUpdate } from '@/modules/cart-checkout/services/cartRequest';
import {
  CART_COOKIE_NAME,
  getCartSummary,
  addItemToCart,
  assertCartArtworkOwnership,
  updateItemQuantity,
  removeItemFromCart,
  clearPersistentCart,
} from '@/modules/cart-checkout/services/cartStorage';
import { defaultLocale, isValidLocale } from '@/shared/lib/i18n';

function readCartLocale(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale');
  return locale && isValidLocale(locale) ? locale : defaultLocale;
}

function cartError(error: unknown) {
  if (error instanceof APIError) {
    const message = error.message === 'FORBIDDEN_ARTWORK_ACCESS'
      ? 'Cannot attach an artwork asset belonging to another session or user.'
      : undefined;
    return NextResponse.json({ error: error.message, message }, { status: error.status });
  }
  return NextResponse.json({ error: 'CART_REQUEST_FAILED' }, { status: 500 });
}

async function readMutation(req: NextRequest) {
  const body: Record<string, unknown> | null = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new APIError('INVALID_JSON: Malformed JSON payload.', 400, undefined, true);
  }
  if (typeof body.operationKey !== 'string' || !body.operationKey.trim()) {
    throw new APIError('MISSING_OPERATION_KEY', 400, undefined, true);
  }
  return { body, operationKey: body.operationKey.trim() };
}

function inputId(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
}

function readQuantity(value: unknown) {
  return typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
}

async function getRequestCart(req: NextRequest, options?: { initialize?: boolean; allowSecret?: boolean }) {
  const payload = await getPayload({ config: configPromise });
  const session = await resolveCartRequest(payload, {
    headers: req.headers,
    signedCartCookie: req.cookies.get(CART_COOKIE_NAME)?.value,
    guestSecret: options?.allowSecret ? req.headers.get('x-guest-secret') || req.nextUrl.searchParams.get('secret') : null,
    initialize: options?.initialize,
  });
  return { payload, ...session };
}

/** Adds an item to an existing guest or authenticated cart. */
export async function POST(req: NextRequest) {
  let guestCookie: CartCookieUpdate = null;
  try {
    const { body, operationKey } = await readMutation(req);
    const productId = inputId(body.productId);
    const variantId = inputId(body.variantId);
    const artworkAssetId = body.artworkAssetId ? inputId(body.artworkAssetId) : undefined;
    const quantity = readQuantity(body.quantity);
    if (!productId || !Number.isSafeInteger(quantity) || quantity <= 0 ||
      (body.variantId != null && !variantId) || (body.artworkAssetId && !artworkAssetId)) {
      return NextResponse.json({ error: 'INVALID_PARAMETERS', message: 'Valid IDs and a positive whole quantity are required.' }, { status: 422 });
    }
    const session = await getRequestCart(req, { allowSecret: true });
    const { payload, cart } = session;
    guestCookie = session.guestCookie;
    if (!cart) {
      return applyCartCookie(NextResponse.json({
        error: 'SESSION_REQUIRED', message: 'Active cart session required. Initialize the cart before adding items.',
      }, { status: 401 }), guestCookie);
    }
    if (artworkAssetId) await assertCartArtworkOwnership(payload, cart, String(artworkAssetId));
    const summary = await addItemToCart(payload, cart.id, {
      productId,
      variantId,
      quantity,
      artworkAssetId: artworkAssetId ? String(artworkAssetId) : undefined,
      printingNotes: typeof body.printingNotes === 'string' ? body.printingNotes : undefined,
      operationKey,
    }, readCartLocale(req));
    return applyCartCookie(NextResponse.json({
      success: true, cartId: cart.id, guestSecret: cart.customer ? undefined : cart.secret, operationKey, summary,
    }), guestCookie);
  } catch (error) {
    return applyCartCookie(cartError(error), guestCookie);
  }
}

/** Sets one line quantity. */
export async function PATCH(req: NextRequest) {
  let guestCookie: CartCookieUpdate = null;
  try {
    const { body, operationKey } = await readMutation(req);
    const itemId = inputId(body.itemId);
    const quantity = readQuantity(body.quantity);
    if (!itemId || !Number.isSafeInteger(quantity) || quantity < 0) {
      return NextResponse.json({ error: 'INVALID_PARAMETERS', message: 'A line ID and non-negative whole quantity are required.' }, { status: 422 });
    }
    const session = await getRequestCart(req);
    const { payload, cart } = session;
    guestCookie = session.guestCookie;
    if (!cart) return applyCartCookie(NextResponse.json({ error: 'CART_NOT_FOUND' }, { status: 404 }), guestCookie);
    const summary = await updateItemQuantity(payload, cart.id, String(itemId), quantity, operationKey, readCartLocale(req));
    return applyCartCookie(NextResponse.json({ success: true, cartId: cart.id, operationKey, summary }), guestCookie);
  } catch (error) {
    return applyCartCookie(cartError(error), guestCookie);
  }
}

/** Removes one line or clears the cart. */
export async function DELETE(req: NextRequest) {
  let guestCookie: CartCookieUpdate = null;
  try {
    const { body, operationKey } = await readMutation(req);
    const itemId = inputId(body.itemId);
    if (body.clearAll !== true && !itemId) return NextResponse.json({ error: 'INVALID_PARAMETERS' }, { status: 422 });
    const session = await getRequestCart(req);
    const { payload, cart } = session;
    guestCookie = session.guestCookie;
    if (!cart) return applyCartCookie(NextResponse.json({ error: 'CART_NOT_FOUND' }, { status: 404 }), guestCookie);
    const locale = readCartLocale(req);
    const summary = body.clearAll === true || itemId === 'all'
      ? await clearPersistentCart(payload, cart.id, operationKey, locale)
      : await removeItemFromCart(payload, cart.id, String(itemId), operationKey, locale);
    return applyCartCookie(NextResponse.json({ success: true, cartId: cart.id, operationKey, summary }), guestCookie);
  } catch (error) {
    return applyCartCookie(cartError(error), guestCookie);
  }
}

/** Reads the active cart and initializes a session only when requested. */
export async function GET(req: NextRequest) {
  let guestCookie: CartCookieUpdate = null;
  try {
    const session = await getRequestCart(req, {
      initialize: req.nextUrl.searchParams.get('init') === 'true',
      allowSecret: true,
    });
    const { payload, cart } = session;
    guestCookie = session.guestCookie;
    const summary = cart
      ? await getCartSummary(payload, cart.id, 0, readCartLocale(req))
      : calculateCartSummary([]);
    const response = cart
      ? NextResponse.json({ cartId: cart.id, guestSecret: cart.customer ? undefined : cart.secret, summary })
      : NextResponse.json({ ...summary, summary });
    response.headers.set('Cache-Control', 'private, no-store');
    return applyCartCookie(response, guestCookie);
  } catch (error) {
    const response = cartError(error);
    response.headers.set('Cache-Control', 'private, no-store');
    return applyCartCookie(response, guestCookie);
  }
}
