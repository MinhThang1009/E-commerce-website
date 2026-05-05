// Barrel export feature orders — public surface
// Sau Phase 42 (Modular Monolith), code ngoài feature import qua barrel này
// thay vì deep import từ subfolders để giảm coupling.

// Kiểu dữ liệu — re-export trước, orderApi.ts cũng có một số interface trùng tên
export * from './types/order.types';

// API endpoints (RTK Query) — orderApi định nghĩa Order/OrderItem riêng dùng cho RTK
// (khác type backend trong order.types — orderApi có thể alias sau nếu cần)
export {
  orderApi,
  useGetUserOrdersQuery,
  useGetOrderByIdQuery,
  useGetOrderByNumberQuery,
  useCreateOrderMutation,
  useCancelOrderMutation,
  useRepayOrderMutation,
  useApplyDiscountCodeMutation,
  useConfirmReceivedMutation,
} from './api/orderApi';
