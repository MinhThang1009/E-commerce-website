/**
 * @file index.ts
 * @layer Barrel
 * @feature orders
 * @description Public API exports cho feature orders
 */
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
  useGetAvailableDiscountCodesQuery,
  useConfirmReceivedMutation,
} from './api/order-api';

// Kiểu dữ liệu từ orderApi
export type {
  Order,
  OrderItem,
  OrdersResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  ApplyDiscountRequest,
  ApplyDiscountResponse,
  AvailableDiscountCode,
} from './api/order-api';

export { default as OrderDetails } from './components/OrderDetails';
