import type { Payload } from 'payload';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  calculateCartSummary,
  hydrateCartLines,
  type CartCalculationSummary,
} from './cartCalculator';

export const CART_COOKIE_NAME = 'mwheba_cart';

export interface CartMutationItem {
  productId: number | string;
  variantId?: number | string;
  quantity: number;
  artworkAssetId?: string;
  printingNotes?: string;
  operationKey: string;
}

export interface CartLockContext {
  readonly hasSaved: boolean;
  markSaved: () => void;
}

export function parseAppliedOperations(field: any): string[] {
  if (Array.isArray(field)) {
    return field.filter((k): k is string => typeof k === 'string' && Boolean(k.trim()));
  }
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed)
        ? parsed.filter((k): k is string => typeof k === 'string' && Boolean(k.trim()))
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function appendAppliedOperation(newOpKey: string, existingOpsField: any): string[] {
  const existing = parseAppliedOperations(existingOpsField);
  return [newOpKey, ...existing.filter((k) => k !== newOpKey)].slice(0, 50);
}

export function matchesCartItem(it: any, idx: number, itemId: string): boolean {
  if (it.id && String(it.id) === String(itemId)) return true;
  if (String(idx) === String(itemId)) return true;
  const itProdId = typeof it.product === 'object' && it.product !== null ? it.product.id : it.product;
  const itVarId = typeof it.variant === 'object' && it.variant !== null ? it.variant.id : it.variant;
  if (String(itProdId) === String(itemId)) return true;
  if (`line-${itProdId}-${itVarId || 0}` === String(itemId) || `line_${itProdId}_${itVarId || 0}` === String(itemId)) return true;
  if (typeof itemId === 'string' && itemId.startsWith(`line-${itProdId}-${itVarId || 0}`)) return true;
  return false;
}

const inProcessLocks = new Map<number, Promise<void>>();
const asyncLockStorage = new AsyncLocalStorage<Set<number>>();

/**
 * Execute a mutation on a cart with a PostgreSQL advisory lock (cross-process)
 * and in-process queue serialization per cartId, with safe idempotency-aware retry.
 * Supports reentrancy across nested calls in the same async execution context.
 *
 * CRITICAL IDEMPOTENCY INVARIANT:
 * Retries are STRICTLY PERMITTED only when we can prove that the mutation has NOT been saved (hasSaved === false).
 * If the database update succeeded and an interruption/error occurs afterwards,
 * we never re-execute the mutation to prevent duplicate increments or double-charges.
 */
export async function withCartLock<T>(
  payload: Payload,
  cartId: number,
  mutator: (context: CartLockContext) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  const activeLocks = asyncLockStorage.getStore();

  // Reentrancy check: If the current async call-chain already holds this cart's lock, execute directly
  if (activeLocks && activeLocks.has(cartId)) {
    const dummyContext: CartLockContext = {
      hasSaved: false,
      markSaved() {},
    };
    return mutator(dummyContext);
  }

  // 1. In-process serialization per cartId across distinct callers within this process
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
    let hasSaved = false;

    const lockContext: CartLockContext = {
      get hasSaved() {
        return hasSaved;
      },
      markSaved() {
        hasSaved = true;
      },
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let client: any = null;
      let lockAcquired = false;

      try {
        client = await pool.connect();
        // Acquire PostgreSQL 64-bit advisory lock for cross-process concurrency
        await client.query('SELECT pg_advisory_lock($1)', [cartId]);
        lockAcquired = true;

        const currentActive = activeLocks ? new Set(activeLocks) : new Set<number>();
        currentActive.add(cartId);

        const result = await asyncLockStorage.run(currentActive, () => mutator(lockContext));
        return result;
      } catch (err: any) {
        lastError = err;

        // RETRY SAFETY: If mutation was ALREADY SAVED to database, do NOT re-execute mutator!
        // Instead, safely recover and return the latest persisted state directly from DB.
        if (hasSaved) {
          try {
            const summary = await getCartSummary(payload, cartId);
            return summary as unknown as T;
          } catch {
            throw err;
          }
        }

        // Only retry if we can PROVE the mutation was NOT saved (hasSaved === false)
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
 * Strictly idempotent when provided an operationKey.
 */
export async function addItemToCart(
  payload: Payload,
  cartId: number,
  item: CartMutationItem
): Promise<CartCalculationSummary> {
  const qty = Number(item.quantity);
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    throw new Error('INVALID_QUANTITY: Quantity must be a positive whole integer.');
  }

  let numericProductId = Number(item.productId);
  let product: any = null;

  if (Number.isSafeInteger(numericProductId) && numericProductId > 0) {
    product = await payload.findByID({
      collection: 'products',
      id: numericProductId,
      depth: 0,
    });
  }

  if (!product && typeof item.productId === 'string' && item.productId.trim()) {
    const found = await payload.find({
      collection: 'products',
      where: { slug: { equals: item.productId.trim() } },
      limit: 1,
      depth: 0,
    });
    if (found.docs?.[0]) {
      product = found.docs[0];
      numericProductId = product.id;
    }
  }

  if (!product || product._status !== 'published') {
    throw new Error(`PRODUCT_UNAVAILABLE: Product ${item.productId} is not available.`);
  }

  let numericVariantId: number | undefined = undefined;
  if (item.variantId !== undefined && item.variantId !== null) {
    const parsedVar = Number(item.variantId);
    if (Number.isSafeInteger(parsedVar) && parsedVar > 0) {
      numericVariantId = parsedVar;
    }
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

  if (!item.operationKey || typeof item.operationKey !== 'string' || !item.operationKey.trim()) {
    throw new Error('MISSING_OPERATION_KEY: A valid operationKey is required for idempotent cart mutation.');
  }
  const opKey = item.operationKey.trim();

  return withCartLock(payload, cartId, async (lockContext) => {
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    const appliedOps = parseAppliedOperations(cart.appliedOperations);
    // IDEMPOTENCY GUARD: If operationKey was already applied, do NOT add again!
    if (appliedOps.includes(opKey)) {
      lockContext.markSaved();
      const hydrated = await hydrateCartLines(cart.items || [], payload);
      return calculateCartSummary(hydrated);
    }

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
        Number(existingProdId) === numericProductId &&
        Number(existingVarId || 0) === Number(numericVariantId || 0) &&
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
      const lineId = `line_${numericProductId}_${numericVariantId || 0}_${Date.now()}`;
      items.push({
        id: lineId,
        product: numericProductId,
        variant: numericVariantId || undefined,
        quantity: qty,
        artworkAssetId: item.artworkAssetId || undefined,
        printingNotes: item.printingNotes || undefined,
      });
    }

    // Hydrate and calculate
    const hydrated = await hydrateCartLines(items, payload);
    const summary = calculateCartSummary(hydrated);

    const updatedOps = appendAppliedOperation(opKey, cart.appliedOperations);

    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items,
        subtotal: summary.subtotal,
        appliedOperations: updatedOps,
      },
      depth: 0,
    });

    // Mark as successfully saved in DB before completing
    lockContext.markSaved();

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
  newQuantity: number,
  operationKey: string
): Promise<CartCalculationSummary> {
  const qty = Number(newQuantity);
  if (!Number.isSafeInteger(qty) || qty < 0) {
    throw new Error('INVALID_QUANTITY: Quantity must be a non-negative whole integer.');
  }

  if (!operationKey || typeof operationKey !== 'string' || !operationKey.trim()) {
    throw new Error('MISSING_OPERATION_KEY: A valid operationKey is required for idempotent cart mutation.');
  }
  const opKey = operationKey.trim();

  return withCartLock(payload, cartId, async (lockContext) => {
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    const appliedOps = parseAppliedOperations(cart.appliedOperations);
    if (appliedOps.includes(opKey)) {
      lockContext.markSaved();
      const hydrated = await hydrateCartLines(cart.items || [], payload);
      return calculateCartSummary(hydrated);
    }

    let items = [...(cart.items || [])];

    if (qty === 0) {
      items = items.filter((it: any, idx: number) => !matchesCartItem(it, idx, itemId));
    } else {
      const targetIndex = items.findIndex((it: any, idx: number) => matchesCartItem(it, idx, itemId));
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

    const updatedOps = appendAppliedOperation(opKey, cart.appliedOperations);

    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items,
        subtotal: summary.subtotal,
        appliedOperations: updatedOps,
      },
      depth: 0,
    });

    lockContext.markSaved();

    return summary;
  });
}

/**
 * Removes a specific line item from the persistent cart in PostgreSQL.
 */
export async function removeItemFromCart(
  payload: Payload,
  cartId: number,
  itemId: string,
  operationKey: string
): Promise<CartCalculationSummary> {
  if (!operationKey || typeof operationKey !== 'string' || !operationKey.trim()) {
    throw new Error('MISSING_OPERATION_KEY: A valid operationKey is required for idempotent cart mutation.');
  }
  const opKey = operationKey.trim();

  return withCartLock(payload, cartId, async (lockContext) => {
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    const appliedOps = parseAppliedOperations(cart.appliedOperations);
    if (appliedOps.includes(opKey)) {
      lockContext.markSaved();
      const hydrated = await hydrateCartLines(cart.items || [], payload);
      return calculateCartSummary(hydrated);
    }

    const items = (cart.items || []).filter((it: any, idx: number) => !matchesCartItem(it, idx, itemId));
    const hydrated = await hydrateCartLines(items, payload);
    const summary = calculateCartSummary(hydrated);

    const updatedOps = appendAppliedOperation(opKey, cart.appliedOperations);

    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items,
        subtotal: summary.subtotal,
        appliedOperations: updatedOps,
      },
      depth: 0,
    });

    lockContext.markSaved();

    return summary;
  });
}

/**
 * Clears all items from the persistent cart in PostgreSQL.
 */
export async function clearPersistentCart(
  payload: Payload,
  cartId: number,
  operationKey: string
): Promise<CartCalculationSummary> {
  if (!operationKey || typeof operationKey !== 'string' || !operationKey.trim()) {
    throw new Error('MISSING_OPERATION_KEY: A valid operationKey is required for idempotent cart mutation.');
  }
  const opKey = operationKey.trim();

  return withCartLock(payload, cartId, async (lockContext) => {
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    });

    const appliedOps = parseAppliedOperations(cart.appliedOperations);
    if (appliedOps.includes(opKey)) {
      lockContext.markSaved();
      return calculateCartSummary([]);
    }

    const updatedOps = appendAppliedOperation(opKey, cart.appliedOperations);

    await payload.update({
      collection: 'carts',
      id: cartId,
      data: {
        items: [],
        subtotal: 0,
        appliedOperations: updatedOps,
      },
      depth: 0,
    });

    lockContext.markSaved();

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
