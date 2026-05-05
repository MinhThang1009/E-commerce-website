// Barrel export feature wishlist — public surface

// Trang
export { default as WishlistPage } from './pages/WishlistPage';

// API endpoints (RTK Query)
export {
  wishlistApi,
  useGetWishlistQuery,
  useAddToWishlistMutation,
  useCheckWishlistQuery,
  useRemoveFromWishlistMutation,
  useClearWishlistMutation,
} from './api/wishlistApi';
export type { WishlistResponse, CheckWishlistResponse } from './api/wishlistApi';

// Redux store (slice + actions)
export {
  default as wishlistReducer,
  setWishlist,
  addToWishlistLocal,
  removeFromWishlistLocal,
  clearWishlistLocal,
} from './store/wishlistSlice';
export type { WishlistState } from './store/wishlistSlice';
