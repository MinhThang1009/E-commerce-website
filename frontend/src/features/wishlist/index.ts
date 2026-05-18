/**
 * @file index.ts
 * @layer Barrel
 * @feature wishlist
 * @description Public API exports cho feature wishlist
 */
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
} from './api/wishlist-api';
export type { WishlistResponse, CheckWishlistResponse } from './api/wishlist-api';
