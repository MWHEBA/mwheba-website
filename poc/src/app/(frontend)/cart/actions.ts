'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getPayload } from 'payload';
import config from '@payload-config';
import { readCartId, signCartId } from '../../../logic/cartSession';

async function loadCart(payload: Awaited<ReturnType<typeof getPayload>>) {
  const cookieStore = await cookies();
  const cartId = readCartId(cookieStore.get('poc_cart')?.value);
  if (!cartId) return null;
  try {
    return await payload.findByID({ collection: 'carts', id: cartId, depth: 0 });
  } catch {
    return null;
  }
}

export async function addToCart(formData: FormData) {
  const productId = Number(formData.get('productId'));
  const variantId = Number(formData.get('variantId'));
  if (!Number.isSafeInteger(productId) || productId <= 0) throw new Error('Invalid product');
  const payload = await getPayload({ config });
  const product = await payload.findByID({ collection: 'products', id: productId, overrideAccess: false });
  if (!product || product._status !== 'published') throw new Error('Product unavailable');
  if (variantId) {
    const variant = await payload.findByID({ collection: 'variants', id: variantId, overrideAccess: false });
    const variantProductId = typeof variant.product === 'object' ? variant.product?.id : variant.product;
    if (variantProductId !== productId) throw new Error('Variant does not belong to product');
  }
  const cart = await loadCart(payload);
  const items = [...(cart?.items || [])];
  const existing = items.find((item) => {
    const itemProductId = typeof item.product === 'object' ? item.product?.id : item.product;
    const itemVariantId = typeof item.variant === 'object' ? item.variant?.id : item.variant;
    return itemProductId === productId && (itemVariantId || 0) === (variantId || 0);
  });
  if (existing) existing.quantity += 5;
  else items.push({ product: productId, ...(variantId ? { variant: variantId } : {}), quantity: 5 });
  const saved = cart
    ? await payload.update({ collection: 'carts', id: cart.id, data: { items }, depth: 0 })
    : await payload.create({ collection: 'carts', data: { items }, depth: 0 });
  (await cookies()).set('poc_cart', signCartId(saved.id), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7,
  });
  revalidatePath('/cart');
}

export async function setCartQuantity(formData: FormData) {
  const quantity = Number(formData.get('quantity'));
  const itemId = String(formData.get('itemId') || '');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000 || !itemId) throw new Error('Invalid quantity');
  const payload = await getPayload({ config });
  const cart = await loadCart(payload);
  if (!cart) throw new Error('Cart unavailable');
  const items = [...(cart.items || [])];
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error('Cart item unavailable');
  item.quantity = quantity;
  await payload.update({ collection: 'carts', id: cart.id, data: { items }, depth: 0 });
  revalidatePath('/cart');
}

export async function removeCartItem(formData: FormData) {
  const itemId = String(formData.get('itemId') || '');
  const payload = await getPayload({ config });
  const cart = await loadCart(payload);
  if (!cart) return;
  const items = (cart.items || []).filter((item) => item.id !== itemId);
  await payload.update({ collection: 'carts', id: cart.id, data: { items }, depth: 0 });
  revalidatePath('/cart');
}
