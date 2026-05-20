/**
 * @file adminOrderApi.ts
 * @layer API Client
 * @feature admin
 * @description API client functions cho feature admin
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface AdminOrder {
  id: string;
  number: string;
  userId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod: string;
  paymentTransactionId?: string;
  paymentProvider?: string;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  notes?: string;
  trackingNumber?: string;
  shippingProvider?: string;
  estimatedDelivery?: string;
  shippingFirstName: string;
  shippingLastName: string;
  shippingAddress1: string;
  shippingAddress2?: string;
  shippingCity: string;
  shippingState: string;
  shippingPhone?: string;
  createdAt: string;
  updatedAt: string;
  User: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    price: number;
    Product: {
      id: string;
      name: string;
      images: string[];
      price: number;
    };
  }>;
}

export interface AdminOrdersResponse {
  status: string;
  data: {
    orders: AdminOrder[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  };
}

export interface AdminOrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  startDate?: string;
  endDate?: string;
}

export interface UpdateOrderStatusRequest {
  status?: string;
  paymentStatus?: string;
  note?: string;
}

// === Query Keys ===

export const adminOrderKeys = {
  all: ['admin-orders'] as const,
  lists: () => [...adminOrderKeys.all, 'list'] as const,
  list: (params: unknown) => [...adminOrderKeys.lists(), params] as const,
};

// === Query Hooks ===

export function useGetAdminOrdersQuery(
  params: AdminOrdersParams,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<AdminOrdersResponse>({
    queryKey: adminOrderKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/orders', { params });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

// === Mutation Hooks ===

export function useUpdateOrderStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    { status: string; data: { order: AdminOrder } },
    Error,
    { id: string; data: UpdateOrderStatusRequest }
  >({
    mutationFn: async ({ id, data: body }) => {
      const { data } = await apiClient.put(`/admin/orders/${id}/status`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminOrderKeys.all });
    },
  });
}
