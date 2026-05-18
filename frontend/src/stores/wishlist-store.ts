/**
 * @file wishlistStore.ts
 * @layer Store
 * @feature global
 * @description Zustand global state store
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface WishlistState {
  items: string[]; // Mảng các product ID
}

interface WishlistActions {
  setWishlist: (items: string[]) => void;
  addToWishlistLocal: (productId: string) => void;
  removeFromWishlistLocal: (productId: string) => void;
  clearWishlistLocal: () => void;
}

export const useWishlistStore = create<WishlistState & WishlistActions>()(
  immer((set) => ({
    items: [],

    setWishlist: (items) =>
      set((state) => {
        state.items = items;
      }),

    addToWishlistLocal: (productId) =>
      set((state) => {
        if (!state.items.includes(productId)) {
          state.items.push(productId);
        }
      }),

    removeFromWishlistLocal: (productId) =>
      set((state) => {
        state.items = state.items.filter((id) => id !== productId);
      }),

    clearWishlistLocal: () =>
      set((state) => {
        state.items = [];
      }),
  })),
);
