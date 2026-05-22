/**
 * @file cartApi.ts
 * @layer API Client
 * @feature cart
 * @description API client functions cho feature cart
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// Kiểu dữ liệu giỏ hàng từ backend
export interface BackendCartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  Product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    thumbnail: string;
    inStock: boolean;
    stockQuantity: number;
  };
  ProductVariant?: {
    id: string;
    name: string;
    price: number;
    stockQuantity: number;
  };
}

export interface BackendCart {
  id: string | null;
  items: BackendCartItem[];
  totalItems: number;
  subtotal: number;
}

export interface AddToCartRequest {
  productId: string;
  variantId?: string;
  quantity?: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface SyncCartRequest {
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    name: string;
    price: number;
    image: string;
    attributes?: Record<string, string>;
  }[];
}

export interface CartResponse {
  status: string;
  data: BackendCart;
}

export interface CartCountResponse {
  status: string;
  data: {
    count: number;
  };
}

// Kiểu dữ liệu kết quả kiểm tra giỏ hàng
export interface CartValidationResult {
  hasIssues: boolean;
  items: {
    id: string;
    productId: string;
    variantId?: string;
    name: string;
    savedPrice: number;
    currentPrice: number;
    quantity: number;
    maxStock: number;
    priceChanged: boolean;
    outOfStock: boolean;
    quantityExceedsStock: boolean;
    hasIssue: boolean;
  }[];
}

// Query keys tập trung
export const cartKeys = {
  all: ['cart'] as const,
  count: ['cart', 'count'] as const,
  validate: ['cart', 'validate'] as const,
};

// --- Query hooks ---

export function useGetCartQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: cartKeys.all,
    queryFn: async () => {
      const res = await apiClient.get<CartResponse>('/cart');
      return res.data.data;
    },
    ...options,
  });
}

export function useGetCartCountQuery(options?: {
  enabled?: boolean;
  refetchOnFocus?: boolean;
  refetchOnReconnect?: boolean;
}) {
  const { refetchOnFocus, refetchOnReconnect, ...rest } = options || {};
  return useQuery({
    queryKey: cartKeys.count,
    queryFn: async () => {
      const res = await apiClient.get<CartCountResponse>('/cart/count');
      return res.data.data.count;
    },
    refetchOnWindowFocus: refetchOnFocus,
    refetchOnReconnect: refetchOnReconnect,
    ...rest,
  });
}

export function useValidateCartQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: cartKeys.validate,
    queryFn: async () => {
      const res = await apiClient.get<{ status: string; data: CartValidationResult }>(
        '/cart/validate',
      );
      return res.data.data;
    },
    ...options,
  });
}

// --- Mutation hooks ---

export function useAddToCartMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddToCartRequest) => {
      const res = await apiClient.post<CartResponse>('/cart', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      queryClient.invalidateQueries({ queryKey: cartKeys.count });
    },
  });
}

export function useUpdateCartItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCartItemRequest }) => {
      const res = await apiClient.put<CartResponse>(`/cart/items/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      queryClient.invalidateQueries({ queryKey: cartKeys.count });
    },
  });
}

export function useRemoveCartItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<CartResponse>(`/cart/items/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      queryClient.invalidateQueries({ queryKey: cartKeys.count });
    },
  });
}

export function useClearCartMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<CartResponse>('/cart');
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      queryClient.invalidateQueries({ queryKey: cartKeys.count });
    },
  });
}

export function useSyncCartMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SyncCartRequest) => {
      const res = await apiClient.post<CartResponse>('/cart/sync', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      queryClient.invalidateQueries({ queryKey: cartKeys.count });
    },
  });
}

export function useMergeCartMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<CartResponse>('/cart/merge');
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      queryClient.invalidateQueries({ queryKey: cartKeys.count });
    },
  });
}
