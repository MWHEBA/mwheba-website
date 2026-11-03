'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  type CartLineItem,
  type CartCalculationResult,
  calculateCartState,
} from '@/modules/cart-checkout/logic/moqEngine';
import { sampleProducts } from '@/modules/catalog/data/sampleProducts';

interface CartContextValue {
  items: CartLineItem[];
  calculation: CartCalculationResult;
  isCartOpen: boolean;
  totalCount: number;
  shippingFee: number;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartLineItem, 'id'>) => void;
  updateQuantity: (id: string, delta: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  setShippingFee: (fee: number) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'mwheba_cart_v2';

export function CartProvider({ children }: { children: ReactNode }) {
  // Pre-seed with one sample item for immediate realistic demonstration
  const [items, setItems] = useState<CartLineItem[]>([
    {
      id: 'initial-line-1',
      productId: 'flask-01',
      variantId: 'v-blue',
      variantName: 'أزرق بترولي مؤسسي',
      quantity: 10,
      artworkAssetId: 'mock-logo-01',
      printingNotes: 'حفر ليزر دقيق على الوجهين للشعار الرسمي',
    },
  ]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [shippingFee, setShippingFee] = useState(0); // 0 for pickup, 150 for courier
  const [isLoaded, setIsLoaded] = useState(false);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
        }
      }
    } catch {
      // Ignore storage errors
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to sessionStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore
    }
  }, [items, isLoaded]);

  // Reactive calculations using moqEngine
  const calculation = useMemo(() => {
    return calculateCartState(items, sampleProducts, shippingFee);
  }, [items, shippingFee]);

  const totalCount = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [items]);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const toggleCart = () => setIsCartOpen((prev) => !prev);

  const addItem = (item: Omit<CartLineItem, 'id'>) => {
    setItems((prev) => {
      // Check if identical item already exists (same product, variant, and notes)
      const existingIdx = prev.findIndex(
        (p) =>
          p.productId === item.productId &&
          p.variantId === item.variantId &&
          p.artworkAssetId === item.artworkAssetId &&
          p.printingNotes === item.printingNotes
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + item.quantity,
        };
        return updated;
      }

      const newLine: CartLineItem = {
        ...item,
        id: `cart-line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      };
      return [...prev, newLine];
    });

    setIsCartOpen(true);
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const nextQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const setQuantity = (id: string, quantity: number) => {
    const validQty = Math.max(1, quantity);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: validQty } : item))
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setItems([]);
  };

  const value: CartContextValue = {
    items,
    calculation,
    isCartOpen,
    totalCount,
    shippingFee,
    openCart,
    closeCart,
    toggleCart,
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
