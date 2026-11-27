'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { cartCookieOptions, resolveCartRequest } from '../services/cartRequest';
import {
  CART_COOKIE_NAME,
  addItemToCart,
  assertCartArtworkOwnership,
  updateItemQuantity,
  removeItemFromCart,
  clearPersistentCart,
  getCartSummary,
  type CartMutationItem,
} from '../services/cartStorage';
import {
  assertCartCanCheckout,
  type CartCalculationSummary,
} from '../services/cartCalculator';

async function getSessionCart(initialize = false) {
  const payload = await getPayload({ config: configPromise });
  const cookieStore = await cookies();
  const { cart, guestCookie } = await resolveCartRequest(payload, {
    headers: await headers(),
    signedCartCookie: cookieStore.get(CART_COOKIE_NAME)?.value,
    initialize,
  });
  if (guestCookie !== null) cookieStore.set({ name: CART_COOKIE_NAME, ...cartCookieOptions(guestCookie) });
  return { payload, cart, cartId: cart?.id ?? null };
}

/**
 * Server Action: Retrieves the current persistent cart and calculated MOQ state.
 */
export async function getCartAction(): Promise<CartCalculationSummary> {
  const { payload, cartId } = await getSessionCart(true);
  if (!cartId) throw new Error('CART_NOT_FOUND: No active cart session.');
  return getCartSummary(payload, cartId);
}

/**
 * Server Action: Permissively adds an item to the persistent cart in PostgreSQL.
 * Computes remaining MOQ needed per Product ID.
 */
export async function addToCartAction(
  item: CartMutationItem
): Promise<CartCalculationSummary> {
  const { payload, cart } = await getSessionCart(true);
  if (!cart) throw new Error('CART_NOT_FOUND: No active cart session.');
  if (item.artworkAssetId) await assertCartArtworkOwnership(payload, cart, item.artworkAssetId);
  const summary = await addItemToCart(payload, cart.id, item);
  revalidatePath('/[locale]/store', 'layout');
  revalidatePath('/[locale]/checkout', 'page');
  return summary;
}

/**
 * Server Action: Updates quantity of a line item in PostgreSQL.
 */
export async function updateCartItemQuantityAction(
  itemId: string,
  quantity: number,
  operationKey: string
): Promise<CartCalculationSummary> {
  const { payload, cartId } = await getSessionCart();
  if (!cartId) {
    throw new Error('CART_NOT_FOUND: No active cart session.');
  }

  const summary = await updateItemQuantity(payload, cartId, itemId, quantity, operationKey);
  revalidatePath('/[locale]/store', 'layout');
  revalidatePath('/[locale]/checkout', 'page');
  return summary;
}

/**
 * Server Action: Removes a line item from the persistent cart in PostgreSQL.
 */
export async function removeCartItemAction(
  itemId: string,
  operationKey: string
): Promise<CartCalculationSummary> {
  const { payload, cartId } = await getSessionCart();
  if (!cartId) {
    throw new Error('CART_NOT_FOUND: No active cart session.');
  }

  const summary = await removeItemFromCart(payload, cartId, itemId, operationKey);
  revalidatePath('/[locale]/store', 'layout');
  revalidatePath('/[locale]/checkout', 'page');
  return summary;
}

/**
 * Server Action: Clears all items in the persistent cart in PostgreSQL.
 */
export async function clearCartAction(
  operationKey: string
): Promise<CartCalculationSummary> {
  const { payload, cartId } = await getSessionCart();
  if (!cartId) {
    return {
      items: [],
      productGroupings: {},
      totalItemsCount: 0,
      subtotal: 0,
      totalCustomizationFees: 0,
      grandTotal: 0,
      currency: 'EGP',
      canCheckout: false,
      validationErrors: ['Cart is empty.'],
    };
  }

  const summary = await clearPersistentCart(payload, cartId, operationKey);
  revalidatePath('/[locale]/store', 'layout');
  revalidatePath('/[locale]/checkout', 'page');
  return summary;
}

/**
 * Server Action: Rigorous server-side checkout barrier.
 * Verifies that all MOQ rules are satisfied per Product ID before order placement.
 * Throws HTTP 422 if MOQ is violated.
 */
export async function validateCartForCheckoutAction(): Promise<{
  valid: true;
  summary: CartCalculationSummary;
}> {
  const { payload, cartId } = await getSessionCart();
  if (!cartId) {
    const error: any = new Error('CHECKOUT_CART_EMPTY: Cart is empty.');
    error.status = 422;
    error.statusCode = 422;
    error.validationErrors = ['Cart is empty.'];
    throw error;
  }

  const summary = await getCartSummary(payload, cartId);
  assertCartCanCheckout(summary);

  return { valid: true, summary };
}
