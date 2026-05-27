/**
 * @file index.ts
 * @layer Barrel
 * @feature cart
 * @description Public API exports cho feature cart
 */
// Barrel export feature cart — public surface
// Sau Phase 42 (Modular Monolith), code ngoài feature import qua barrel này
// thay vì deep import từ subfolders để giảm coupling.

// Components
export { default as CartItem } from './components/CartItem';

// Trang
export { default as CartPage } from './pages/CartPage';

// API endpoints (TanStack Query)
export {
  useGetCartQuery,
  useGetCartCountQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
  useClearCartMutation,
  useMergeCartMutation,
  useValidateCartQuery,
  cartKeys,
} from './api/cart-api';
export type {
  BackendCartItem,
  BackendCart,
  AddToCartRequest,
  UpdateCartItemRequest,
  SyncCartRequest,
  CartResponse,
  CartCountResponse,
  CartValidationResult,
} from './api/cart-api';

// Hooks
export { useCartMerge } from './hooks/use-cart-merge';

// Zustand store
export { useCartStore } from '@/stores/cart-store';

// Kiểu dữ liệu
export type {
  CartItem as CartItemType,
  CartState,
  ServerCart,
  ServerCartItem,
  UpdateCartItemPayload,
} from './types/cart.types';
