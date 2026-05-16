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
  useSyncCartMutation,
  useMergeCartMutation,
  useValidateCartQuery,
  cartKeys,
} from './api/cartApi';
export type {
  BackendCartItem,
  BackendCart,
  AddToCartRequest,
  UpdateCartItemRequest,
  SyncCartRequest,
  CartResponse,
  CartCountResponse,
  CartValidationResult,
} from './api/cartApi';

// Zustand store
export { useCartStore } from '@/stores/cartStore';

// Kiểu dữ liệu
export type {
  CartItem as CartItemType,
  CartState,
  ServerCart,
  ServerCartItem,
  UpdateCartItemPayload,
} from './types/cart.types';
