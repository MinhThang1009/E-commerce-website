import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { cartKeys } from '@/features/cart';

// Kiểu dữ liệu đơn hàng dựa theo backend API
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  subtotal: number;
  image?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- attributes chứa nhiều dạng dữ liệu (string, array, object) tùy context
  attributes?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  Product?: {
    id: string;
    name: string;
    images: string[];
    price: number;
    thumbnail?: string;
  };
}

export interface Order {
  id: string;
  number: string;
  userId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingFirstName: string;
  shippingLastName: string;
  shippingCompany?: string;
  shippingAddress1: string;
  shippingAddress2?: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  shippingCountry: string;
  shippingPhone?: string;
  billingFirstName: string;
  billingLastName: string;
  billingCompany?: string;
  billingAddress1: string;
  billingAddress2?: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
  billingPhone?: string;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentTransactionId?: string;
  paymentProvider?: string;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  warrantyCost?: number;
  notes?: string;
  trackingNumber?: string;
  shippingProvider?: string;
  estimatedDelivery?: string;
  pointsEarned?: number;
  pointsUsed?: number;
  pointsDiscount?: number;
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrdersResponse {
  status: string;
  data: Order[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateOrderRequest {
  shippingFirstName: string;
  shippingLastName: string;
  shippingCompany?: string;
  shippingAddress1: string;
  shippingAddress2?: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  shippingCountry: string;
  shippingPhone?: string;
  billingFirstName: string;
  billingLastName: string;
  billingCompany?: string;
  billingAddress1: string;
  billingAddress2?: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
  billingPhone?: string;
  paymentMethod: string;
  notes?: string;
  discountCode?: string;
  items?: {
    productId: string;
    variantId?: string;
    quantity: number;
    warrantyPackageIds?: string[];
  }[];
}

export interface ApplyDiscountRequest {
  code: string;
  orderAmount: number;
}

export interface ApplyDiscountResponse {
  status: string;
  message: string;
  data: {
    discountAmount: number;
    discountCodeId: string;
    code: string;
  };
}

export interface CreateOrderResponse {
  status: string;
  data: {
    order: {
      id: string;
      number: string;
      status: string;
      total: number;
      createdAt: string;
    };
  };
}

// Query keys tập trung
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (params: { page?: number; limit?: number }) =>
    [...orderKeys.lists(), params] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  byNumber: (number: string) => [...orderKeys.all, 'number', number] as const,
};

// --- Query hooks ---

/** Lấy danh sách đơn hàng của người dùng có phân trang */
export function useGetUserOrdersQuery(
  params: { page?: number; limit?: number } = {},
  options?: { enabled?: boolean },
) {
  const { page = 1, limit = 10 } = params;
  return useQuery<OrdersResponse>({
    queryKey: orderKeys.list({ page, limit }),
    queryFn: async () => {
      const res = await apiClient.get<OrdersResponse>('/orders', {
        params: { page, limit },
      });
      return res.data;
    },
    ...options,
  });
}

/** Lấy đơn hàng theo ID */
export function useGetOrderByIdQuery(
  id: string,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  return useQuery<{ status: string; data: Order }>({
    queryKey: orderKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<{ status: string; data: Order }>(
        `/orders/${id}`,
      );
      return res.data;
    },
    enabled: !!id,
    ...options,
  });
}

/** Lấy đơn hàng theo số đơn hàng */
export function useGetOrderByNumberQuery(
  number: string,
  options?: { enabled?: boolean },
) {
  return useQuery<{ status: string; data: Order }>({
    queryKey: orderKeys.byNumber(number),
    queryFn: async () => {
      const res = await apiClient.get<{ status: string; data: Order }>(
        `/orders/number/${number}`,
      );
      return res.data;
    },
    enabled: !!number,
    ...options,
  });
}

// --- Mutation hooks ---

/** Tạo đơn hàng */
export function useCreateOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation<CreateOrderResponse, Error, CreateOrderRequest>({
    mutationFn: async (orderData) => {
      const res = await apiClient.post<CreateOrderResponse>(
        '/orders',
        orderData,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      // Invalidate giỏ hàng để reset ngay sau khi đặt hàng
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      queryClient.invalidateQueries({ queryKey: cartKeys.count });
    },
  });
}

/** Hủy đơn hàng */
export function useCancelOrderMutation() {
  const queryClient = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response shape phụ thuộc backend, chưa có shared type
  return useMutation<{ status: string; message: string; data: any }, Error, string>({
    mutationFn: async (id) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await apiClient.post<{ status: string; message: string; data: any }>(`/orders/${id}/cancel`);
      return res.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

/** Thanh toán lại đơn hàng */
export function useRepayOrderMutation() {
  const queryClient = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response shape phụ thuộc backend, chưa có shared type
  return useMutation<{ status: string; message: string; data: any }, Error, string>({
    mutationFn: async (id) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await apiClient.post<{ status: string; message: string; data: any }>(`/orders/${id}/repay`);
      return res.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

/** Áp dụng mã giảm giá */
export function useApplyDiscountCodeMutation() {
  return useMutation<ApplyDiscountResponse, Error, ApplyDiscountRequest>({
    mutationFn: async (data) => {
      const res = await apiClient.post<ApplyDiscountResponse>(
        '/discount-codes/apply',
        data,
      );
      return res.data;
    },
  });
}

/** Xác nhận đã nhận đơn hàng */
export function useConfirmReceivedMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response shape phụ thuộc backend
    { status: string; message: string; pointsEarned: number; data: any },
    Error,
    string
  >({
    mutationFn: async (id) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await apiClient.post<{ status: string; message: string; pointsEarned: number; data: any }>(`/orders/${id}/receive`);
      return res.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}
