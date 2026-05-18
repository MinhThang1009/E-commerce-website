/**
 * @file warrantyApi.ts
 * @layer API Client
 * @feature admin
 * @description API client functions cho feature admin
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api-client';
import { WarrantyPackage } from '@/features/catalog';

// Kiểu dữ liệu phản hồi
export interface WarrantyPackagesResponse {
  status: string;
  data: {
    warrantyPackages: WarrantyPackage[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface WarrantyPackageResponse {
  status: string;
  data: WarrantyPackage;
}

// Kiểu dữ liệu yêu cầu
export interface CreateWarrantyPackageRequest {
  name: string;
  description?: string;
  durationMonths: number;
  price: number;
  terms?: Record<string, string | number | boolean>;
  coverage?: string[];
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateWarrantyPackageRequest extends CreateWarrantyPackageRequest {
  id: string;
}

export interface WarrantyPackageFilters {
  page?: number;
  limit?: number;
  isActive?: boolean;
}

// === Query Keys ===

export const warrantyKeys = {
  all: ['warranty-packages'] as const,
  lists: () => [...warrantyKeys.all, 'list'] as const,
  list: (filters: unknown) => [...warrantyKeys.lists(), filters] as const,
  details: () => [...warrantyKeys.all, 'detail'] as const,
  detail: (id: string) => [...warrantyKeys.details(), id] as const,
};

// === Query Hooks ===

export function useGetWarrantyPackagesQuery(
  filters: WarrantyPackageFilters | void = {},
  options?: { enabled?: boolean; skip?: boolean },
) {
  const filterObj = (filters as WarrantyPackageFilters) ?? {};
  return useQuery<WarrantyPackagesResponse>({
    queryKey: warrantyKeys.list(filterObj),
    queryFn: async () => {
      const { data } = await apiClient.get('/warranty-packages', { params: filterObj });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetWarrantyPackageByIdQuery(
  id: string,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<WarrantyPackageResponse>({
    queryKey: warrantyKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/warranty-packages/${id}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!id,
  });
}

// === Mutation Hooks ===

export function useCreateWarrantyPackageMutation() {
  const queryClient = useQueryClient();
  return useMutation<WarrantyPackageResponse, Error, CreateWarrantyPackageRequest>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/warranty-packages', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
    },
  });
}

export function useUpdateWarrantyPackageMutation() {
  const queryClient = useQueryClient();
  return useMutation<WarrantyPackageResponse, Error, UpdateWarrantyPackageRequest>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.put(`/warranty-packages/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
    },
  });
}

export function useDeleteWarrantyPackageMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ status: string; message: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/warranty-packages/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
    },
  });
}
