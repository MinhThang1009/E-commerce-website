import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { DiscountCode } from '@/types/discount.types';

export interface DiscountCodesResponse {
  status: string;
  data: {
    discountCodes: DiscountCode[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface DiscountCodeResponse {
  status: string;
  data: DiscountCode;
}

export interface DiscountCodeFilters {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}

// === Query Keys ===

export const discountCodeKeys = {
  all: ['discount-codes'] as const,
  lists: () => [...discountCodeKeys.all, 'list'] as const,
  list: (filters: any) => [...discountCodeKeys.lists(), filters] as const,
  details: () => [...discountCodeKeys.all, 'detail'] as const,
  detail: (id: string) => [...discountCodeKeys.details(), id] as const,
};

// === Query Hooks ===

export function useGetDiscountCodesQuery(
  filters: DiscountCodeFilters | void = {},
  options?: { enabled?: boolean; skip?: boolean }
) {
  const filterObj = (filters as DiscountCodeFilters) ?? {};
  return useQuery<DiscountCodesResponse>({
    queryKey: discountCodeKeys.list(filterObj),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/discount-codes', { params: filterObj });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetDiscountCodeByIdQuery(
  id: string,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery<DiscountCodeResponse>({
    queryKey: discountCodeKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/admin/discount-codes/${id}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!id,
  });
}

// === Mutation Hooks ===

export function useCreateDiscountCodeMutation() {
  const queryClient = useQueryClient();
  return useMutation<DiscountCodeResponse, Error, Partial<DiscountCode>>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/admin/discount-codes', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discountCodeKeys.all });
    },
  });
}

export function useUpdateDiscountCodeMutation() {
  const queryClient = useQueryClient();
  return useMutation<DiscountCodeResponse, Error, { id: string } & Partial<DiscountCode>>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.put(`/admin/discount-codes/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discountCodeKeys.all });
    },
  });
}

export function useDeleteDiscountCodeMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ status: string; message: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/admin/discount-codes/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discountCodeKeys.all });
    },
  });
}
