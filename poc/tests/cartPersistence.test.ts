import { beforeAll, describe, expect, it } from 'vitest';
import { getPayload, type Payload } from 'payload';
import configPromise from '../src/payload.config';
import { calculateCartState } from '../src/logic/moqEngine';

describe('Native Payload cart persistence', () => {
  let payload: Payload;
  let customer: any;
  let product: any;

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });
    const stamp = Date.now();
    customer = await payload.create({
      collection: 'users',
      data: { email: `cart-${stamp}@client.eg`, password: 'Password123!', roles: ['customer'] },
    });
    product = await payload.create({
      collection: 'products',
      data: {
        title: 'POC Cart Mug',
        slug: `poc-cart-mug-${stamp}`,
        _status: 'published',
        itemType: 'physical',
        minOrderQuantity: 10,
        priceInEGPEnabled: true,
        priceInEGP: 250,
      },
    });
  }, 30000);

  it('persists 5, 6, 4, empty, and 5 in the native carts collection', async () => {
    const cart = await payload.create({
      collection: 'carts',
      data: { customer: customer.id, items: [{ product: product.id, quantity: 5 }] },
      user: customer,
      overrideAccess: false,
    });

    const read = async () => payload.findByID({
      collection: 'carts', id: cart.id, depth: 0, user: customer, overrideAccess: false,
    });
    const setQuantity = async (quantity: number | null) => {
      const saved = await read();
      await payload.update({
        collection: 'carts', id: cart.id, user: customer, overrideAccess: false,
        data: { items: quantity === null ? [] : [{ ...saved.items![0], product: product.id, quantity }] },
      });
    };

    for (const quantity of [5, 6, 4]) {
      if (quantity !== 5) await setQuantity(quantity);
      const saved = await read();
      expect(saved.items).toHaveLength(1);
      expect(saved.items?.[0].quantity).toBe(quantity);
    }

    await setQuantity(null);
    expect((await read()).items ?? []).toHaveLength(0);

    await payload.update({
      collection: 'carts', id: cart.id, user: customer, overrideAccess: false,
      data: { items: [{ product: product.id, quantity: 5 }] },
    });
    const saved = await read();
    expect(saved.items?.[0].quantity).toBe(5);

    const state = calculateCartState(
      [{ id: saved.items![0].id!, productId: String(product.id), quantity: saved.items![0].quantity }],
      {
        [String(product.id)]: {
          id: String(product.id), title: product.title, itemType: 'physical',
          minOrderQuantity: 10, basePrice: 250,
        },
      },
    );
    expect(state.canCheckout).toBe(false);
    expect(state.productStatuses[String(product.id)].remainingNeeded).toBe(5);
  }, 30000);
});
