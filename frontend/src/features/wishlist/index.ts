// Barrel export feature wishlist — public surface

// Trang
export { default as WishlistPage } from './pages/WishlistPage';

// API endpoints (TanStack Query)
export {
  useGetWishlistQuery,
  useAddToWishlistMutation,
  useCheckWishlistQuery,
  useRemoveFromWishlistMutation,
  useClearWishlistMutation,
} from './api/wishlistApi';
export type { WishlistResponse, CheckWishlistResponse } from './api/wishlistApi';
