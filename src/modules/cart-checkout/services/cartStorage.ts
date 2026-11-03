import type { Payload } from 'payload';
import {
  calculateCartSummary,
  hydrateCartLines,
  type CartCalculationSummary,
} from './cartCalculator';

export const CART_COOKIE_NAME = 'mwheba_cart';

export interface CartMutationItem {
  productId: number;
  variantId?: number;
  quantity: number;
  artworkAssetId?: string;
  printingNotes?: string;
}

const inProcessLocks = new Map<number, Promise<void>>();

/**
 * Execute a mutation on a cart with a PostgreSQL advisory lock (cross-process)
 * and in-process queue serialization per cartId, with automatic retry.
 */
export async function withCartLock<T>(
  payload: Payload,
  cartId: number,
  mutator: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  // 1. In-process serialization per cartId within this process
  while (inProcessLocks.has(cartId)) {
    try {
      await inProcessLocks.get(cartId);
    } catch {
      // Ignore previous errors
    }
  }

  let releaseInProcess!: () => void;
  const inProcessPromise = new Promise<void>((resolve) => {
    releaseInProcess = resolve;
  });
  inProcessLocks.set(cartId, inProcessPromise);

  try {
    const pool = (payload.db as any)?.pool;
    if (!pool) {
      throw new Error(
        'DATABASE_LOCK_UNAVAILABLE: PostgreSQL database pool is required for atomic cart mutations.'
      );
    }

    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let client: any = null;
      let lockAcquired = false;

      try {
        client = await pool.connect();
        // Acquire PostgreSQL 64-bit advisory lock for cross-process concurrency
        await client.query('SELECT pg_advisory_lock($1)', [cartId]);
        lockAcquired = true;

        const result = await mutator();
        return result;
      } catch (err: any) {
        lastError = err;
        const isRetryable =
          err.code === '40001' || // serialization_failure
          err.code === '40P01' || // deadlock_detected
          err.message?.includes('deadlock') ||
          err.message?.includes('could not serialize') ||
          err.message?.includes('connection');

        if (isRetryable && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 50));
          continue;
        }

        // Fail-closed: Never fall back to in-process locking if DB lock failed
        if (!lockAcquired) {
          throw new Error(
            `DATABASE_LOCK_FAILED: Failed to acquire atomic PostgreSQL cart lock for cart ${cartId}: ${err.message}`
          );
        }
        throw err;
      } finally {
        if (client) {
          if (lockAcquired) {
            try {
              await client.query('SELECT pg_advisory_unlock($1)', [cartId]);
            } catch {
              // Ignore unlock cleanup error
            }
          }
          try {
            client.release();
          } catch {}
        }
      }
    }
    throw lastError;
  } finally {
    inProcessLocks.delete(cartId);
    releaseInProcess();
  }
}

/**
 * Loads or creates a persistent Cart document in PostgreSQL.
 */
export async function getOrCreateCart(
  payload: Payload,
  cartId?: number | null,
  customerId?: number | null
): Promise<any> {
  if (cartId && Number.isSafeInteger(cartId) && cartId > 0) {
    try {
      const existing = await payload.findByID({
        collection: 'carts',
        id: cartId,
        depth: 0,
      });
      // Return existing cart if not yet completed / purchased
      if (existing && !existing.purchasedAt) {
        return existing;
      }
    } catch {
      // Cart not found, create new
    }
  }

  // Create new cart in PostgreSQL
  const newCart = await payload.create({
    collection: 'carts',
    data: {
      customer: customerId || undefined,
      currency: 'EGP',
      items: [],
      subtotal: 0,
    },
    depth: 0,
  });

  return newCart;
}

/**
 * Permissively adds an item to the persistent cart in PostgreSQL.
 * If identical line (same product, variant, artwork, notes) exists, increments quantity.
 * Allows incomplete quantities (e.g. 5 units) while calculating remaining MOQ needed.
 */
export async function addItemToCart(
  payload: Payload,
  cartId: number,
  item: CartMutationItem
): Promise<CartCalculationSummary> {
  if (!Number.isSafeInteger(item.productId) || item.productId <= 0) {
    throw new Error('INVALID_PRODUCT_ID: Valid positive integer productId is required.');
  }
  const qty = Number(item.quantity);
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    throw new Error('INVALID_QUANTITY: Quantity must be a positive whole integer.');
  }

  // Validate product exists and is published
  const product = await payload.findByID({
    collection: 'products',
    id: item.productId,
    depth: 0,
  });
  if (!product || product._status !== 'published') {
    throw new Error(`PRODUCT_UNAVAILABLE: Product ${item.productId} is not available.`);
  }

  // Validate variant if provided
  if (item.variantId) {
    const variant = await payload.findByID({
      collection: 'variants',
      id: item.variantId,
      depth: 0,
    });
    if (!variant) {
      throw new Error(`VARIANT_NOT_FOUND: Variant ${item.variantId} does not exist.`);
    }
    const variantProdId =
      typeof variant.product === 'object' && variant.product !== null
        ? variant.product.id
        : variant.product;
    if (String(variantProdId) !== String(item.productId)) {
      throw new Error(
        `VARIANT_MISMATCH: Variant ${item.variantId} belongs to product ${variantProdId}, not ${item.productId}.`
      );
    }
  }

  return withCartLock(payload, cartId, async () => {
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    const items = [...(cart.items || [])];

    // Find existing matching line item
    const existingIndex = items.findIndex((existing: any) => {
      const existingProdId =
        typeof existing.product === 'object' && existing.product !== null
          ? existing.product.id
          : existing.product;
      const existingVarId =
        typeof existing.variant === 'object' && existing.variant !== null
          ? existing.variant.id
          : existing.variant;

      return (
        Number(existingProdId) === Number(item.productId) &&
        Number(existingVarId || 0) === Number(item.variantId || 0) &&
        String(existing.artworkAssetId || '') === String(item.artworkAssetId || '') &&
        String(existing.printingNotes || '') === String(item.printingNotes || '')
      );
    });

    if (existingIndex >= 0) {
      items[existingIndex] = {
        ...items[existingIndex],
        quantity: Number(items[existingIndex].quantity) + qty,
      };
    } else {
      items.push({
        product: item.productId,
        variant: item.variantId || undefined,
        quantity: qty,
        artworkAssetId: item.artworkAssetId || undefined,
        printingNotes: item.printingNotes || undefined,
      });
    }

    // Hydrate and calculate
    const hydrated = await hydrateCartLines(items, payload);
    const summary = calculateCartSummary(hydrated);

    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items,
        subtotal: summary.subtotal,
      },
      depth: 0,
    });

    return summary;
  });
}

/**
 * Updates quantity of a specific line item in the persistent PostgreSQL cart.
 */
export async function updateItemQuantity(
  payload: Payload,
  cartId: number,
  itemId: string,
  newQuantity: number
): Promise<CartCalculationSummary> {
  const qty = Number(newQuantity);
  if (!Number.isSafeInteger(qty) || qty < 0) {
    throw new Error('INVALID_QUANTITY: Quantity must be a non-negative whole integer.');
  }

  return withCartLock(payload, cartId, async () => {
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    let items = [...(cart.items || [])];

    if (qty === 0) {
      // Remove item
      items = items.filter((it: any) => String(it.id) !== String(itemId));
    } else {
      const targetIndex = items.findIndex((it: any) => String(it.id) === String(itemId));
      if (targetIndex === -1) {
        throw new Error(`CART_ITEM_NOT_FOUND: Line item ${itemId} not found in cart.`);
      }
      items[targetIndex] = {
        ...items[targetIndex],
        quantity: qty,
      };
    }

    const hydrated = await hydrateCartLines(items, payload);
    const summary = calculateCartSummary(hydrated);

    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items,
        subtotal: summary.subtotal,
      },
      depth: 0,
    });

    return summary;
  });
}

/**
 * Removes a specific line item from the persistent cart in PostgreSQL.
 */
export async function removeItemFromCart(
  payload: Payload,
  cartId: number,
  itemId: string
): Promise<CartCalculationSummary> {
  return withCartLock(payload, cartId, async () => {
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    const items = (cart.items || []).filter((it: any) => String(it.id) !== String(itemId));
    const hydrated = await hydrateCartLines(items, payload);
    const summary = calculateCartSummary(hydrated);

    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items,
        subtotal: summary.subtotal,
      },
      depth: 0,
    });

    return summary;
  });
}

/**
 * Clears all items from the persistent cart in PostgreSQL.
 */
export async function clearPersistentCart(
  payload: Payload,
  cartId: number
): Promise<CartCalculationSummary> {
  return withCartLock(payload, cartId, async () => {
    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items: [],
        subtotal: 0,
      },
      depth: 0,
    });

    return calculateCartSummary([]);
  });
}

/**
 * Retrieves and calculates the current cart state from PostgreSQL.
 */
export async function getCartSummary(
  payload: Payload,
  cartId: number,
  shippingFee: number = 0
): Promise<CartCalculationSummary> {
  const cart = await payload.findByID({
    collection: 'carts',
    id: cartId,
    depth: 0,
  });

  const hydrated = await hydrateCartLines(cart.items || [], payload);
  return calculateCartSummary(hydrated, shippingFee);
}
