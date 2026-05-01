import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface WishlistState {
  items: string[]; // Array of product IDs
}

const initialState: WishlistState = {
  items: [],
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    setWishlist: (state, action: PayloadAction<string[]>) => {
      state.items = action.payload;
    },
    addToWishlistLocal: (state, action: PayloadAction<string>) => {
      if (!state.items.includes(action.payload)) {
        state.items.push(action.payload);
      }
    },
    removeFromWishlistLocal: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((id) => id !== action.payload);
    },
    clearWishlistLocal: (state) => {
      state.items = [];
    },
  },
});

export const {
  setWishlist,
  addToWishlistLocal,
  removeFromWishlistLocal,
  clearWishlistLocal,
} = wishlistSlice.actions;

export default wishlistSlice.reducer;
