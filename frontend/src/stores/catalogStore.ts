/**
 * @file catalogStore.ts
 * @layer Store
 * @feature global
 * @description Zustand global state store
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Product } from '@/features/catalog/types/product.types';

const MAX_RECENTLY_VIEWED = 10;

interface CatalogFilters {
  priceRange: [number, number];
  categories: string[];
  attributes: Record<string, string[]>;
  sortBy: string;
}

interface CatalogState {
  recentlyViewed: Product[];
  compareList: Product[];
  filters: CatalogFilters;
}

interface CatalogActions {
  addToRecentlyViewed: (product: Product) => void;
  clearRecentlyViewed: () => void;
  addToCompareList: (product: Product) => void;
  removeFromCompareList: (productId: string) => void;
  clearCompareList: () => void;
  setPriceRange: (range: [number, number]) => void;
  setCategories: (categories: string[]) => void;
  setAttributes: (attributes: Record<string, string[]>) => void;
  setSortBy: (sortBy: string) => void;
  clearFilters: () => void;
  loadRecentlyViewed: () => void;
}

const initialFilters: CatalogFilters = {
  priceRange: [0, 10000000], // Khoảng giá mặc định tính bằng VNĐ
  categories: [],
  attributes: {},
  sortBy: 'newest',
};

export const useCatalogStore = create<CatalogState & CatalogActions>()(
  immer((set) => ({
    recentlyViewed: [],
    compareList: [],
    filters: { ...initialFilters },

    addToRecentlyViewed: (product) =>
      set((state) => {
        // Xóa nếu đã tồn tại
        state.recentlyViewed = state.recentlyViewed.filter(
          (p) => p.id !== product.id
        );
        // Thêm vào đầu danh sách
        state.recentlyViewed.unshift(product);
        // Giới hạn số lượng theo MAX_RECENTLY_VIEWED
        if (state.recentlyViewed.length > MAX_RECENTLY_VIEWED) {
          state.recentlyViewed = state.recentlyViewed.slice(
            0,
            MAX_RECENTLY_VIEWED
          );
        }
        // Lưu vào localStorage
        localStorage.setItem(
          'recentlyViewed',
          JSON.stringify(state.recentlyViewed)
        );
      }),

    clearRecentlyViewed: () =>
      set((state) => {
        state.recentlyViewed = [];
        localStorage.removeItem('recentlyViewed');
      }),

    addToCompareList: (product) =>
      set((state) => {
        // Kiểm tra xem sản phẩm đã có trong danh sách so sánh chưa
        if (!state.compareList.some((p) => p.id === product.id)) {
          // Giới hạn tối đa 4 sản phẩm để so sánh
          if (state.compareList.length < 4) {
            state.compareList.push(product);
          }
        }
      }),

    removeFromCompareList: (productId) =>
      set((state) => {
        state.compareList = state.compareList.filter(
          (p) => p.id !== productId
        );
      }),

    clearCompareList: () =>
      set((state) => {
        state.compareList = [];
      }),

    setPriceRange: (range) =>
      set((state) => {
        state.filters.priceRange = range;
      }),

    setCategories: (categories) =>
      set((state) => {
        state.filters.categories = categories;
      }),

    setAttributes: (attributes) =>
      set((state) => {
        state.filters.attributes = attributes;
      }),

    setSortBy: (sortBy) =>
      set((state) => {
        state.filters.sortBy = sortBy;
      }),

    clearFilters: () =>
      set((state) => {
        state.filters = { ...initialFilters };
      }),

    // Tải danh sách đã xem gần đây từ localStorage khi khởi động app
    loadRecentlyViewed: () =>
      set((state) => {
        const saved = localStorage.getItem('recentlyViewed');
        if (saved) {
          try {
            state.recentlyViewed = JSON.parse(saved);
          } catch (e) {
            console.error(
              'Không thể parse danh sách sản phẩm đã xem gần đây',
              e
            );
            state.recentlyViewed = [];
          }
        }
      }),
  }))
);
