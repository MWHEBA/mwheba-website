'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { readCartId, signCartId } from '../logic/cartSession';
import {
  CART_COOKIE_NAME,
  getOrCreateCart,
  addItemToCart,
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

async function getSessionCartId(): Promise<number | null> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(CART_COOKIE_NAME)?.value;
  return readCartId(cookieVal);
}

async function setSessionCartCookie(cartId: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE_NAME, signCartId(cartId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/**
 * Server Action: Retrieves the current persistent cart and calculated MOQ state.
 */
export async function getCartAction(): Promise<CartCalculationSummary> {
  const payload = await getPayload({ config: configPromise });
  const cartId = await getSessionCartId();
  if (!cartId) {
    const newCart = await getOrCreateCart(payload);
    await setSessionCartCookie(newCart.id);
    return getCartSummary(payload, newCart.id);
  }

  return getCartSummary(payload, cartId);
}

/**
 * Server Action: Permissively adds an item to the persistent cart in PostgreSQL.
 * Computes remaining MOQ needed per Product ID.
 */
export async function addToCartAction(
  item: CartMutationItem
): Promise<CartCalculationSummary> {
  const payload = await getPayload({ config: configPromise });
  let cartId = await getSessionCartId();

  if (!cartId) {
    const newCart = await getOrCreateCart(payload);
    cartId = Number(newCart.id);
    await setSessionCartCookie(cartId);
  }

  const validCartId: number = cartId;
  const summary = await addItemToCart(payload, validCartId, item);
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
  const payload = await getPayload({ config: configPromise });
  const cartId = await getSessionCartId();
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
  const payload = await getPayload({ config: configPromise });
  const cartId = await getSessionCartId();
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
  const payload = await getPayload({ config: configPromise });
  const cartId = await getSessionCartId();
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
  const payload = await getPayload({ config: configPromise });
  const cartId = await getSessionCartId();
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
