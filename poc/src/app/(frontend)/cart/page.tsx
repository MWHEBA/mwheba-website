import { cookies } from 'next/headers';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { Cart } from '../../../payload-types';
import { calculateCartState, type CartLineItem, type ProductItem } from '../../../logic/moqEngine';
import { readCartId } from '../../../logic/cartSession';
import { addToCart, removeCartItem, setCartQuantity } from './actions';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const payload = await getPayload({ config });
  const cookie = (await cookies()).get('poc_cart')?.value;
  const cartId = readCartId(cookie);
  const products = await payload.find({
    collection: 'products', where: { and: [{ itemType: { equals: 'physical' } }, { _status: { equals: 'published' } }] },
    limit: 1, depth: 0,
  });
  const product = products.docs[0];
  const variants = product ? await payload.find({
    collection: 'variants', where: { product: { equals: product.id } }, limit: 1, depth: 0,
  }) : null;
  const variant = variants?.docs[0];

  let cart: Cart | null = null;
  if (cartId) {
    try {
      cart = await payload.findByID({ collection: 'carts', id: cartId, depth: 1 });
    } catch {
      cart = null;
    }
  }

  const catalog: Record<string, ProductItem> = {};
  const lines: CartLineItem[] = [];
  for (const item of cart?.items || []) {
    const linked = item.product;
    if (!linked || typeof linked !== 'object') continue;
    const id = String(linked.id);
    catalog[id] = {
      id, title: linked.title, itemType: linked.itemType,
      minOrderQuantity: linked.minOrderQuantity || 10, basePrice: linked.priceInEGP || linked.basePrice || 0,
      customizationFee: linked.customizationFee || 0,
    };
    lines.push({
      id: item.id || '', productId: id, quantity: item.quantity,
      variantId: item.variant ? String(typeof item.variant === 'object' ? item.variant.id : item.variant) : undefined,
      artworkAssetId: item.artworkAssetId || undefined,
      printingNotes: item.printingNotes || undefined,
    });
  }
  const state = calculateCartState(lines, catalog);

  return <main>
    <h1>POC cart</h1>
    <p className="muted">Native Payload cart persistence and minimum quantity check.</p>

    <section className="panel" aria-labelledby="product-heading">
      <h2 id="product-heading">Add a product</h2>
      {product ? <>
        <p>{product.title}</p>
        <p className="muted">Minimum quantity: {product.minOrderQuantity || 10}</p>
        <form action={addToCart}>
          <input type="hidden" name="productId" value={product.id} />
          {variant && <input type="hidden" name="variantId" value={variant.id} />}
          <button type="submit">Add 5 units</button>
        </form>
      </> : <p className="muted">Publish a physical product in the admin panel to begin.</p>}
    </section>

    <section className="panel" aria-labelledby="cart-heading">
      <h2 id="cart-heading">Your cart</h2>
      {lines.length === 0 ? <p className="muted">Your cart is empty.</p> : lines.map((line) => {
        const status = state.productStatuses[line.productId];
        return <div key={line.id}>
          <p><strong>{catalog[line.productId].title}</strong> · {line.quantity} units</p>
          {!status.isSatisfied && <p className="notice" role="status">
            {status.remainingNeeded} more units required to reach the minimum.
          </p>}
          <div className="row">
            <form action={setCartQuantity} className="row">
              <input type="hidden" name="itemId" value={line.id} />
              <label htmlFor={`quantity-${line.id}`}>Quantity</label>
              <input id={`quantity-${line.id}`} type="number" name="quantity" min="1" max="10000" defaultValue={line.quantity} />
              <button type="submit">Update</button>
            </form>
            <form action={removeCartItem}>
              <input type="hidden" name="itemId" value={line.id} />
              <button className="secondary" type="submit">Remove</button>
            </form>
          </div>
        </div>;
      })}
      <p>Checkout status: {state.canCheckout ? 'Ready' : 'Minimum quantity not met'}</p>
      <button type="button" disabled={!state.canCheckout}>Continue to checkout</button>
    </section>
  </main>;
}
