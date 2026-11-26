'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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
import type { Locale } from '@/shared/lib/i18n';

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
  ensureSession: () => Promise<number>;
  addItem: (item: AddItemInput) => Promise<void>;
  updateQuantity: (id: string, delta: number) => Promise<void>;
  setQuantity: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  /** Drops local session state after a completed order so the next add starts a fresh server session. */
  resetSession: () => void;
  setShippingFee: (fee: number) => void;
}

interface CartSnapshot {
  cartId: number | null;
  summary: CartCalculationSummary | null;
}

const CartContext = createContext<CartContextValue | null>(null);
const emptyCart: CartSnapshot = { cartId: null, summary: null };
const emptyItems: HydratedCartItem[] = [];

async function readCartResponse(response: Response, mutation = false): Promise<CartSnapshot> {
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || error?.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  if ((mutation && data?.success !== true) || !Array.isArray(data?.summary?.items)) {
    throw new Error('The cart update could not be confirmed.');
  }
  return { cartId: data.cartId ?? null, summary: data.summary };
}

export function CartProvider({ children, locale }: { children: ReactNode; locale?: Locale }) {
  const [snapshot, setSnapshot] = useState(emptyCart);
  const [initialized, setInitialized] = useState(false);
  const [pending, setPending] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const currentCart = useRef(emptyCart);
  const pendingRequests = useRef(Promise.resolve());
  const itemsUrl = locale ? `/api/cart/items?locale=${locale}` : '/api/cart/items';
  const items = snapshot.summary?.items ?? emptyItems;
  const { cartId, summary } = snapshot;

  const applySnapshot = useCallback((next: CartSnapshot) => {
    if (currentCart.current.cartId !== next.cartId) setShippingFee(0);
    currentCart.current = next;
    setSnapshot(next);
  }, []);

  // Serialize browser requests so bootstrap cookies and cart snapshots are applied in order.
  const runCartRequest = useCallback(<T,>(request: () => Promise<T>): Promise<T> => {
    setPending((count) => count + 1);
    const result = pendingRequests.current.then(async () => {
      setError(null);
      try {
        return await request();
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Cart request failed.');
        throw failure;
      } finally {
        setInitialized(true);
        setPending((count) => count - 1);
      }
    });
    pendingRequests.current = result.then(() => undefined, () => undefined);
    return result;
  }, []);

  const loadCart = useCallback(async (initialize = false) => {
    const url = initialize ? `${itemsUrl}${locale ? '&' : '?'}init=true` : itemsUrl;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const next = await readCartResponse(response);
    applySnapshot(next);
    return next;
  }, [itemsUrl, locale, applySnapshot]);

  const refreshCart = useCallback(async () => {
    await runCartRequest(() => loadCart()).catch(() => undefined);
  }, [loadCart, runCartRequest]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  const initializeCart = useCallback(async (): Promise<number> => {
    const { cartId: activeCartId } = await loadCart(true);
    if (!activeCartId) throw new Error('The cart session could not be initialized.');
    return activeCartId;
  }, [loadCart]);

  // Upload callers need the current server cart ID before sending private artwork.
  const ensureSession = useCallback(() => runCartRequest(initializeCart), [initializeCart, runCartRequest]);

  const mutate = useCallback(async (
    method: 'POST' | 'PATCH' | 'DELETE',
    body: object,
    operation: 'add' | 'update' | 'remove' | 'clear',
  ) => {
    await executeWithOperationRetry(async (operationKey) => {
      const response = await fetch(itemsUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, operationKey }),
      });
      applySnapshot(await readCartResponse(response, true));
    }, operation);
  }, [itemsUrl, applySnapshot]);

  const addItem = useCallback((item: AddItemInput) => runCartRequest(async () => {
    if (!currentCart.current.cartId) await initializeCart();
    const { productId, variantId, quantity, artworkAssetId, printingNotes } = item;
    await mutate('POST', { productId, variantId, quantity, artworkAssetId, printingNotes }, 'add');
    setIsCartOpen(true);
  }), [initializeCart, mutate, runCartRequest]);

  const editQuantity = useCallback((id: string, getQuantity: (current: number) => number) =>
    runCartRequest(async () => {
      const target = currentCart.current.summary?.items.find((item) => item.id === id);
      if (!target) return;
      const quantity = getQuantity(target.quantity);
      if (quantity <= 0) {
        await mutate('DELETE', { itemId: id }, 'update');
      } else {
        await mutate('PATCH', { itemId: id, quantity }, 'update');
      }
    }), [mutate, runCartRequest]);

  const updateQuantity = useCallback((id: string, delta: number) =>
    editQuantity(id, (quantity) => quantity + delta), [editQuantity]);

  const setQuantity = useCallback((id: string, quantity: number) =>
    editQuantity(id, () => quantity), [editQuantity]);

  const removeItem = useCallback((id: string) =>
    runCartRequest(() => mutate('DELETE', { itemId: id }, 'remove')), [mutate, runCartRequest]);

  const clearCart = useCallback(() => runCartRequest(async () => {
    if (!currentCart.current.cartId) return;
    await mutate('DELETE', { clearAll: true }, 'clear');
  }), [mutate, runCartRequest]);

  const resetSession = useCallback(() => {
    applySnapshot(emptyCart);
    setShippingFee(0);
    setError(null);
  }, [applySnapshot]);

  const rawItems: CartLineItem[] = useMemo(() => items.map((item) => ({
    id: item.id,
    productId: String(item.productId),
    variantId: item.variantId ? String(item.variantId) : undefined,
    variantName: item.variantTitle,
    quantity: item.quantity,
    artworkAssetId: item.artworkAssetId,
    printingNotes: item.printingNotes,
  })), [items]);

  const isLoading = !initialized || pending > 0;
  const calculation: CartCalculationResult = useMemo(() => {
    const productStatuses: Record<string, ProductMoqStatus> = {};
    for (const [productId, group] of Object.entries(summary?.productGroupings ?? {})) {
      productStatuses[productId] = {
        productId: String(group.productId),
        productTitle: group.productTitle,
        totalQuantity: group.totalQuantity,
        minOrderQuantity: group.minOrderQuantity,
        isSatisfied: group.isSatisfied,
        remainingNeeded: group.remainingNeeded,
      };
    }

    return {
      items: rawItems,
      productStatuses,
      subtotal: summary?.subtotal ?? 0,
      totalCustomizationFees: summary?.totalCustomizationFees ?? 0,
      grandTotal: summary?.grandTotal ?? 0,
      canCheckout: Boolean(summary?.canCheckout && !isLoading && !error),
      validationErrors: summary?.validationErrors ?? [],
    };
  }, [summary, rawItems, isLoading, error]);

  const openCart = useCallback(() => {
    setIsCartOpen(true);
    if (initialized && !pending) void refreshCart();
  }, [initialized, pending, refreshCart]);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => {
    if (isCartOpen) closeCart();
    else openCart();
  }, [isCartOpen, closeCart, openCart]);

  const value: CartContextValue = {
    cartId,
    items,
    rawItems,
    calculation,
    summary,
    isLoading,
    isCartOpen,
    totalCount: summary?.totalItemsCount ?? 0,
    shippingFee,
    error,
    openCart,
    closeCart,
    toggleCart,
    refreshCart,
    ensureSession,
    addItem,
    updateQuantity,
    setQuantity,
    removeItem,
    clearCart,
    resetSession,
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
