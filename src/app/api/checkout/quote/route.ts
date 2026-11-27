import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { CART_COOKIE_NAME } from '@/modules/cart-checkout/services/cartStorage';
import { applyCartCookie, resolveCartRequest } from '@/modules/cart-checkout/services/cartRequest';
import { buildCheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import { isStorefrontCustomer } from '@/modules/identity/access/roles';

/**
 * POST /api/checkout/quote
 * Returns a server-authoritative delivery quote and order total for the active session cart.
 * Client-supplied fees are ignored.
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
    if (!session.cart) {
      return respond({ success: false, error: 'NO_ACTIVE_CART' }, 404);
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return respond({ success: false, error: 'INVALID_JSON' }, 400);
    }

    const method = body?.delivery?.method;
    if (method != null && method !== 'shipping' && method !== 'pickup') {
      return respond({ success: false, error: 'INVALID_DELIVERY_METHOD' }, 400);
    }

    const customerId = isStorefrontCustomer(session.user) ? session.user.id : undefined;
    const quote = await buildCheckoutQuote(payload, session.cart.id, {
      method,
      addressId: body?.delivery?.addressId,
      customerId,
      optionId: typeof body?.delivery?.optionId === 'string' ? body.delivery.optionId : undefined,
      governorate: typeof body?.delivery?.governorate === 'string' ? body.delivery.governorate : undefined,
    });

    return respond({ success: true, ...quote });
  } catch (error: any) {
    if (error.status === 404 && error.message?.startsWith('SAVED_ADDRESS_UNAVAILABLE:')) {
      return respond({ success: false, error: error.message }, 404);
    }
    return respond({ success: false, error: 'QUOTE_FAILED' }, 500);
  }
}
