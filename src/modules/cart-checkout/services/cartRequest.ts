import type { NextResponse } from 'next/server';
import type { Payload } from 'payload';
import { hasRole } from '@/modules/identity/access/roles';
import type { Cart } from '@/payload-types';
import { readCartId, signCartId } from '../logic/cartSession';
import { findActiveCustomerCart, reconcileCustomerCart } from './cartMerge';
import { CART_COOKIE_NAME, getOrCreateCart, isRetiredCart } from './cartStorage';

type CartUser = Awaited<ReturnType<Payload['auth']>>['user'];
export type CartCookieUpdate = 'clear' | number | null;

interface CartRequestOptions {
  headers: Headers;
  signedCartCookie?: string;
  guestSecret?: string | null;
  initialize?: boolean;
  allowPurchasedGuest?: boolean;
}

function isGuestCart(cart: Cart | null | undefined): cart is Cart {
  return Boolean(cart && !cart.customer && !isRetiredCart(cart));
}

/** Resolve cart ownership before any public read or write. A native secret can read a guest
 * cart but only a signed storefront cookie can hand one off to an authenticated customer. */
export async function resolveCartRequest(payload: Payload, options: CartRequestOptions): Promise<{
  cart: Cart | null;
  user: CartUser;
  guestCookie: CartCookieUpdate;
}> {
  const { user } = await payload.auth({ headers: options.headers });
  const customer = user?.collection === 'users' && !hasRole(user, [
    'super_admin', 'catalog_manager', 'operations', 'creative_director', 'finance', 'marketer',
  ]) ? user : null;
  const signedCartId = readCartId(options.signedCartCookie);
  const signedCart = signedCartId === null ? null : await payload.findByID({
    collection: 'carts', id: signedCartId, depth: 0, disableErrors: true,
  });
  const guestCart = isGuestCart(signedCart) ? signedCart : null;

  if (customer) {
    const source = guestCart && !guestCart.purchasedAt ? guestCart : null;
    let cart = source ? null : await findActiveCustomerCart(payload, customer.id);
    if (source || (!cart && options.initialize)) {
      cart = await reconcileCustomerCart(payload, customer.id, source?.id ?? null, Boolean(options.initialize));
    }
    return { cart, user, guestCookie: options.signedCartCookie ? 'clear' : null };
  }

  if (guestCart && (!guestCart.purchasedAt || options.allowPurchasedGuest)) {
    return { cart: guestCart, user, guestCookie: null };
  }
  if (options.guestSecret) {
    const { docs: [cart] } = await payload.find({
      collection: 'carts',
      where: { and: [{ secret: { equals: options.guestSecret } }, { customer: { exists: false } }] },
      limit: 1,
      depth: 0,
    });
    if (isGuestCart(cart) && (!cart.purchasedAt || options.allowPurchasedGuest)) {
      return { cart, user, guestCookie: null };
    }
  }
  if (options.initialize) {
    const cart = await getOrCreateCart(payload);
    return { cart, user, guestCookie: cart.id };
  }
  return { cart: null, user, guestCookie: options.signedCartCookie ? 'clear' : null };
}

export function cartCookieOptions(update: Exclude<CartCookieUpdate, null>) {
  return {
    value: update === 'clear' ? '' : signCartId(update),
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: update === 'clear' ? 0 : 60 * 60 * 24 * 30,
  };
}

export function applyCartCookie(response: NextResponse, update: CartCookieUpdate) {
  if (update !== null) response.cookies.set({ name: CART_COOKIE_NAME, ...cartCookieOptions(update) });
  return response;
}
