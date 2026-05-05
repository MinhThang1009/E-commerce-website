import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product } from '../api/productApi';

interface ProductsState {
  recentlyViewed: Product[];
  compareList: Product[];
  filters: {
    priceRange: [number, number];
    categories: string[];
    attributes: Record<string, string[]>;
    sortBy: string;
  };
}

const MAX_RECENTLY_VIEWED = 10;

const initialState: ProductsState = {
  recentlyViewed: [],
  compareList: [],
  filters: {
    priceRange: [0, 10000000], // Khoảng giá mặc định tính bằng VNĐ
    categories: [],
    attributes: {},
    sortBy: 'newest',
  },
};

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    addToRecentlyViewed: (state, action: PayloadAction<Product>) => {
      // Xóa nếu đã tồn tại
      state.recentlyViewed = state.recentlyViewed.filter(
        (product) => product.id !== action.payload.id
      );

      // Thêm vào đầu danh sách
      state.recentlyViewed.unshift(action.payload);

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
    },

    clearRecentlyViewed: (state) => {
      state.recentlyViewed = [];
      localStorage.removeItem('recentlyViewed');
    },

    addToCompareList: (state, action: PayloadAction<Product>) => {
      // Kiểm tra xem sản phẩm đã có trong danh sách so sánh chưa
      if (
        !state.compareList.some((product) => product.id === action.payload.id)
      ) {
        // Giới hạn tối đa 4 sản phẩm để so sánh
        if (state.compareList.length < 4) {
          state.compareList.push(action.payload);
        }
      }
    },

    removeFromCompareList: (state, action: PayloadAction<string>) => {
      state.compareList = state.compareList.filter(
        (product) => product.id !== action.payload
      );
    },

    clearCompareList: (state) => {
      state.compareList = [];
    },

    setPriceRange: (state, action: PayloadAction<[number, number]>) => {
      state.filters.priceRange = action.payload;
    },

    setCategories: (state, action: PayloadAction<string[]>) => {
      state.filters.categories = action.payload;
    },

    setAttributes: (state, action: PayloadAction<Record<string, string[]>>) => {
      state.filters.attributes = action.payload;
    },

    setSortBy: (state, action: PayloadAction<string>) => {
      state.filters.sortBy = action.payload;
    },

    clearFilters: (state) => {
      state.filters = initialState.filters;
    },

    // Tải danh sách đã xem gần đây từ localStorage khi khởi động app
    loadRecentlyViewed: (state) => {
      const saved = localStorage.getItem('recentlyViewed');
      if (saved) {
        try {
          state.recentlyViewed = JSON.parse(saved);
        } catch (e) {
          console.error('Không thể parse danh sách sản phẩm đã xem gần đây', e);
          state.recentlyViewed = [];
        }
      }
    },
  },
});

export const {
  addToRecentlyViewed,
  clearRecentlyViewed,
  addToCompareList,
  removeFromCompareList,
  clearCompareList,
  setPriceRange,
  setCategories,
  setAttributes,
  setSortBy,
  clearFilters,
  loadRecentlyViewed,
} = productsSlice.actions;

export default productsSlice.reducer;

