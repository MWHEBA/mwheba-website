'use client';

import { useSyncExternalStore } from 'react';

export interface ShortlistItem {
  name: string;
  nameAr?: string;
  quantity: number;
}

interface ShortlistState {
  items: Record<string, number>;
  isDrawerOpen: boolean;
  toastMessage: string | null;
}

let state: ShortlistState = {
  items: {},
  isDrawerOpen: false,
  toastMessage: null,
};

const listeners = new Set<() => void>();

const initialServerSnapshot: ShortlistState = Object.freeze({
  items: {},
  isDrawerOpen: false,
  toastMessage: null,
});

const getServerSnapshot = () => initialServerSnapshot;

function notify() {
  listeners.forEach((listener) => listener());
}

export const shortlistStore = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  addItem: (name: string, quantity: number, isArabic = false) => {
    const current = state.items[name] || 0;
    state = {
      ...state,
      items: {
        ...state.items,
        [name]: current + quantity,
      },
      toastMessage: isArabic
        ? `تمت إضافة ${quantity} وحدة إلى قائمة طلباتك`
        : `${quantity} units added to your shortlist`,
    };
    notify();

    setTimeout(() => {
      if (state.toastMessage) {
        state = { ...state, toastMessage: null };
        notify();
      }
    }, 3200);
  },
  removeItem: (name: string) => {
    const newItems = { ...state.items };
    delete newItems[name];
    state = { ...state, items: newItems };
    notify();
  },
  updateQuantity: (name: string, quantity: number) => {
    if (quantity <= 0) {
      shortlistStore.removeItem(name);
      return;
    }
    state = {
      ...state,
      items: {
        ...state.items,
        [name]: quantity,
      },
    };
    notify();
  },
  openDrawer: () => {
    state = { ...state, isDrawerOpen: true };
    notify();
  },
  closeDrawer: () => {
    state = { ...state, isDrawerOpen: false };
    notify();
  },
  showToast: (message: string) => {
    state = { ...state, toastMessage: message };
    notify();
    setTimeout(() => {
      if (state.toastMessage === message) {
        state = { ...state, toastMessage: null };
        notify();
      }
    }, 3200);
  },
};

export function useShortlist() {
  const current = useSyncExternalStore(
    shortlistStore.subscribe,
    shortlistStore.getSnapshot,
    getServerSnapshot
  );

  const totalCount = Object.values(current.items).reduce((sum, qty) => sum + qty, 0);
  const totalKinds = Object.keys(current.items).length;

  return {
    ...current,
    totalCount,
    totalKinds,
    addItem: shortlistStore.addItem,
    removeItem: shortlistStore.removeItem,
    updateQuantity: shortlistStore.updateQuantity,
    openDrawer: shortlistStore.openDrawer,
    closeDrawer: shortlistStore.closeDrawer,
    showToast: shortlistStore.showToast,
  };
}
