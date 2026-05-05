// Barrel export feature cart — public surface
// Sau Phase 42 (Modular Monolith), code ngoài feature import qua barrel này
// thay vì deep import từ subfolders để giảm coupling.

// Components
export { default as CartItem } from './components/CartItem';

// Trang
export { default as CartPage } from './pages/CartPage';

// API endpoints (RTK Query)
export {
  cartApi,
  useGetCartQuery,
  useGetCartCountQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
  useClearCartMutation,
  useSyncCartMutation,
  useMergeCartMutation,
  useValidateCartQuery,
} from './api/cartApi';
export type {
  BackendCartItem,
  BackendCart,
  AddToCartRequest,
  UpdateCartItemRequest,
  SyncCartRequest,
  CartResponse,
  CartCountResponse,
} from './api/cartApi';

// Redux store (slice + actions)
export {
  default as cartReducer,
  setServerCart,
  addItem,
  removeItem,
  updateQuantity,
  clearCart,
  toggleCart,
  closeCart,
  openCart,
  setLoading,
  initializeCart,
  mergeWithLocalCart,
} from './store/cartSlice';

// Kiểu dữ liệu
export type {
  CartItem as CartItemType,
  CartState,
  ServerCart,
  ServerCartItem,
  UpdateCartItemPayload,
} from './types/cart.types';
