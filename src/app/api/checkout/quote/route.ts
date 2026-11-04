import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { readCartId } from '@/modules/cart-checkout/logic/cartSession';
import { CART_COOKIE_NAME, getCartSummary } from '@/modules/cart-checkout/services/cartStorage';
import { resolveDeliveryTariff } from '@/modules/orders/services/deliveryTariff';

/**
 * POST /api/checkout/quote
 * Returns a server-authoritative delivery quote and order total for the active session cart.
 * The tariff schedule is provisional until the owner approves D-015; the response says so explicitly.
 * Client-supplied fees are ignored.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise });

    const sessionCartId = readCartId(req.cookies.get(CART_COOKIE_NAME)?.value);
    if (!sessionCartId) {
      return NextResponse.json({ success: false, error: 'NO_ACTIVE_CART' }, { status: 404 });
    }

    const cart = await payload.findByID({ collection: 'carts', id: sessionCartId, depth: 0 }).catch(() => null);
    if (!cart || cart.purchasedAt) {
      return NextResponse.json({ success: false, error: 'NO_ACTIVE_CART' }, { status: 404 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'INVALID_JSON' }, { status: 400 });
    }

    const method = body?.delivery?.method;
    if (method !== 'shipping' && method !== 'pickup') {
      return NextResponse.json({ success: false, error: 'INVALID_DELIVERY_METHOD' }, { status: 400 });
    }

    const governorate =
      typeof body?.delivery?.governorate === 'string' ? body.delivery.governorate : undefined;
    const tariff = resolveDeliveryTariff({ method, governorate });
    const summary = await getCartSummary(payload, sessionCartId, tariff.amount);

    return NextResponse.json({
      success: true,
      shippingFee: tariff.amount,
      currency: tariff.currency,
      isProvisional: tariff.isProvisional,
      tariffScheduleStatus: tariff.tariffScheduleStatus,
      subtotal: summary.subtotal,
      totalCustomizationFees: summary.totalCustomizationFees,
      grandTotal: summary.grandTotal,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'QUOTE_FAILED' }, { status: 500 });
  }
}
