// Barrel export feature orders — public surface
// Sau Phase 42 (Modular Monolith), code ngoài feature import qua barrel này
// thay vì deep import từ subfolders để giảm coupling.

// Kiểu dữ liệu — re-export trước
export * from './types/order.types';

// API hooks (TanStack Query) + query keys
export {
  orderKeys,
  useGetUserOrdersQuery,
  useGetOrderByIdQuery,
  useGetOrderByNumberQuery,
  useCreateOrderMutation,
  useCancelOrderMutation,
  useRepayOrderMutation,
  useApplyDiscountCodeMutation,
  useConfirmReceivedMutation,
} from './api/orderApi';

// Kiểu dữ liệu từ orderApi
export type {
  Order,
  OrderItem,
  OrdersResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  ApplyDiscountRequest,
  ApplyDiscountResponse,
} from './api/orderApi';
