'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  HydratedCartItem,
  CartCalculationSummary,
} from '@/modules/cart-checkout/services/cartCalculator';
import type {
  CartLineItem,
  CartCalculationResult,
  ProductMoqStatus,
} from '@/modules/cart-checkout/logic/moqEngine';
import { executeWithOperationRetry } from '@/modules/cart-checkout/logic/idempotency';

export interface AddItemInput {
  productId: string | number;
  variantId?: string | number;
  variantName?: string;
  quantity: number;
  artworkAssetId?: string;
  printingNotes?: string;
}

export interface CartContextValue {
  cartId: number | null;
  items: HydratedCartItem[];
  rawItems: CartLineItem[];
  calculation: CartCalculationResult;
  summary: CartCalculationSummary | null;
  isLoading: boolean;
  isCartOpen: boolean;
  totalCount: number;
  shippingFee: number;
  error: string | null;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  refreshCart: () => Promise<void>;
  addItem: (item: AddItemInput) => Promise<void>;
  updateQuantity: (id: string, delta: number) => Promise<void>;
  setQuantity: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  setShippingFee: (fee: number) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartId, setCartId] = useState<number | null>(null);
  const [items, setItems] = useState<HydratedCartItem[]>([]);
  const [summary, setSummary] = useState<CartCalculationSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Refreshes the cart state from PostgreSQL via /api/cart/items.
   */
  const refreshCart = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cart/items', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.cartId) {
          setCartId(data.cartId);
        }
        if (data.summary) {
          setSummary(data.summary);
          setItems(data.summary.items || []);
        } else if (data.items) {
          setItems(data.items);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load cart');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch persistent cart on initial mount
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  /**
   * Ensures a signed guest session cookie is established BEFORE executing mutations.
   * If a session/cartId is already tracked, returns it immediately.
   * Otherwise, calls GET /api/cart/items?init=true so the server sets the signed cookie.
   * STOPS immediately with a clear error if session initialization fails.
   */
  const ensureSession = useCallback(async (): Promise<number> => {
    if (cartId) return cartId;
    let res: Response;
    try {
      res = await fetch('/api/cart/items?init=true', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch (err: any) {
      const msg = err?.message || 'Network error initializing cart session';
      setError(msg);
      throw new Error(`Failed to initialize cart session: ${msg}`);
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody.message || errBody.error || `HTTP ${res.status}`;
      setError(msg);
      throw new Error(`Failed to initialize cart session: ${msg}`);
    }

    const data = await res.json();
    if (!data.cartId) {
      const msg = 'Missing cartId in session initialization response';
      setError(msg);
      throw new Error(`Failed to initialize cart session: ${msg}`);
    }

    setCartId(data.cartId);
    if (data.summary) {
      setSummary(data.summary);
      setItems(data.summary.items || []);
    }
    return data.cartId;
  }, [cartId]);

  /**
   * Adds an item to the persistent PostgreSQL cart with retry & idempotency.
   */
  const addItem = useCallback(
    async (item: AddItemInput) => {
      setError(null);
      setIsLoading(true);
      try {
        // Initialize signed session before mutation so subsequent attempts share the same session
        await ensureSession();

        await executeWithOperationRetry(
          async (operationKey) => {
            const res = await fetch('/api/cart/items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
                artworkAssetId: item.artworkAssetId,
                printingNotes: item.printingNotes,
                operationKey,
              }),
            });

            if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              throw new Error(errBody.message || errBody.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (data.cartId) setCartId(data.cartId);
            if (data.summary) {
              setSummary(data.summary);
              setItems(data.summary.items || []);
            }
            return data;
          },
          'add'
        );
        setIsCartOpen(true);
      } catch (err: any) {
        setError(err.message || 'Failed to add item to cart');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [ensureSession]
  );

  /**
   * Updates quantity by delta with idempotent retry.
   */
  const updateQuantity = useCallback(
    async (id: string, delta: number) => {
      const targetItem = items.find((it) => it.id === id);
      if (!targetItem) return;
      const nextQuantity = targetItem.quantity + delta;

      setError(null);
      setIsLoading(true);
      try {
        await ensureSession();

        await executeWithOperationRetry(
          async (operationKey) => {
            let res: Response;
            if (nextQuantity <= 0) {
              res = await fetch('/api/cart/items', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: id, operationKey }),
              });
            } else {
              res = await fetch('/api/cart/items', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: id, quantity: nextQuantity, operationKey }),
              });
            }

            if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              throw new Error(errBody.message || errBody.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (data.summary) {
              setSummary(data.summary);
              setItems(data.summary.items || []);
            }
            return data;
          },
          'update'
        );
      } catch (err: any) {
        setError(err.message || 'Failed to update quantity');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [items, ensureSession]
  );

  /**
   * Sets absolute quantity with idempotent retry.
   */
  const setQuantity = useCallback(
    async (id: string, quantity: number) => {
      const validQty = Math.max(0, quantity);
      const targetItem = items.find((it) => it.id === id);
      if (!targetItem) return;

      setError(null);
      setIsLoading(true);
      try {
        await ensureSession();

        await executeWithOperationRetry(
          async (operationKey) => {
            let res: Response;
            if (validQty === 0) {
              res = await fetch('/api/cart/items', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: id, operationKey }),
              });
            } else {
              res = await fetch('/api/cart/items', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: id, quantity: validQty, operationKey }),
              });
            }

            if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              throw new Error(errBody.message || errBody.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (data.summary) {
              setSummary(data.summary);
              setItems(data.summary.items || []);
            }
            return data;
          },
          'update'
        );
      } catch (err: any) {
        setError(err.message || 'Failed to set quantity');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [items, ensureSession]
  );

  /**
   * Removes a line item with idempotent retry.
   */
  const removeItem = useCallback(
    async (id: string) => {
      setError(null);
      setIsLoading(true);
      try {
        await ensureSession();

        await executeWithOperationRetry(
          async (operationKey) => {
            const res = await fetch('/api/cart/items', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ itemId: id, operationKey }),
            });

            if (!res.ok) {
              const errBody = await res.json().catch(() => ({}));
              throw new Error(errBody.message || errBody.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (data.summary) {
              setSummary(data.summary);
              setItems(data.summary.items || []);
            }
            return data;
          },
          'remove'
        );
      } catch (err: any) {
        setError(err.message || 'Failed to remove item');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [ensureSession]
  );

  /**
   * Clears the persistent cart completely with idempotent retry.
   */
  const clearCart = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      await ensureSession();

      await executeWithOperationRetry(
        async (operationKey) => {
          const res = await fetch('/api/cart/items', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clearAll: true, operationKey }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.message || errBody.error || `HTTP ${res.status}`);
          }

          const data = await res.json();
          if (data.summary) {
            setSummary(data.summary);
            setItems(data.summary.items || []);
          } else {
            setItems([]);
          }
          return data;
        },
        'clear'
      );
    } catch (err: any) {
      setError(err.message || 'Failed to clear cart');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ensureSession]);

  // Map hydrated server items to lightweight CartLineItem format
  const rawItems: CartLineItem[] = useMemo(() => {
    return items.map((it) => ({
      id: it.id,
      productId: String(it.productId),
      variantId: it.variantId ? String(it.variantId) : undefined,
      variantName: it.variantTitle,
      quantity: it.quantity,
      artworkAssetId: it.artworkAssetId,
      printingNotes: it.printingNotes,
    }));
  }, [items]);

  // Reactive calculation result matching moqEngine structure for UI components
  const calculation: CartCalculationResult = useMemo(() => {
    if (!summary) {
      return {
        items: rawItems,
        productStatuses: {},
        subtotal: 0,
        totalCustomizationFees: 0,
        grandTotal: shippingFee,
        canCheckout: false,
        validationErrors: [],
      };
    }

    const productStatuses: Record<string, ProductMoqStatus> = {};
    for (const [pId, grp] of Object.entries(summary.productGroupings || {})) {
      productStatuses[pId] = {
        productId: String(grp.productId),
        productTitle: grp.productTitle,
        totalQuantity: grp.totalQuantity,
        minOrderQuantity: grp.minOrderQuantity,
        isSatisfied: grp.isSatisfied,
        remainingNeeded: grp.remainingNeeded,
      };
    }

    return {
      items: rawItems,
      productStatuses,
      subtotal: summary.subtotal,
      totalCustomizationFees: summary.totalCustomizationFees,
      grandTotal: summary.grandTotal + shippingFee,
      canCheckout: summary.canCheckout,
      validationErrors: summary.validationErrors,
    };
  }, [summary, rawItems, shippingFee]);

  const totalCount = useMemo(() => {
    return summary?.totalItemsCount ?? items.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [summary, items]);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);

  const value: CartContextValue = {
    cartId,
    items,
    rawItems,
    calculation,
    summary,
    isLoading,
    isCartOpen,
    totalCount,
    shippingFee,
    error,
    openCart,
    closeCart,
    toggleCart,
    refreshCart,
    addItem,
    updateQuantity,
    setQuantity,
    removeItem,
    clearCart,
    setShippingFee,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
