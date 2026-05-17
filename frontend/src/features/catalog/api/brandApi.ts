/**
 * @file brandApi.ts
 * @layer API Client
 * @feature catalog
 * @description API client functions cho feature catalog
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { transformProductsResponse } from '../utils/productTransform';

// === Query Keys ===

export const brandKeys = {
  all: ['brands'] as const,
  list: (params?: unknown) => [...brandKeys.all, 'list', params] as const,
  slug: (slug: string) => [...brandKeys.all, 'slug', slug] as const,
  products: (slug: string, params?: unknown) =>
    [...brandKeys.all, 'products', slug, params] as const,
};

// === Query Hooks ===

export function useGetBrandsQuery(
  params?: { isActive?: boolean; categoryId?: string } | void,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery({
    queryKey: brandKeys.list(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.isActive !== undefined) {
        queryParams.append('isActive', params.isActive.toString());
      }
      if (params?.categoryId) {
        queryParams.append('categoryId', params.categoryId);
      }
      const { data } = await apiClient.get(`/brands?${queryParams.toString()}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetBrandBySlugQuery(
  slug: string,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery({
    queryKey: brandKeys.slug(slug),
    queryFn: async () => {
      const { data } = await apiClient.get(`/brands/slug/${slug}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!slug,
  });
}

export function useGetProductsByBrandQuery(
  params: { slug: string; page?: number; limit?: number },
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery({
    queryKey: brandKeys.products(params.slug, params),
    queryFn: async () => {
      const urlParams = new URLSearchParams();
      urlParams.append('page', (params.page || 1).toString());
      urlParams.append('limit', (params.limit || 12).toString());
      const { data } = await apiClient.get(
        `/brands/slug/${params.slug}/products?${urlParams.toString()}`,
      );
      return transformProductsResponse(data);
    },
    enabled: options?.skip !== undefined ? !options.skip : !!params.slug,
  });
}

export function useCreateBrandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: object) => {
      const { data } = await apiClient.post('/brands', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.all });
    },
  });
}

export function useUpdateBrandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: object }) => {
      const { data } = await apiClient.put(`/brands/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.all });
    },
  });
}

export function useDeleteBrandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/brands/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.all });
    },
  });
}
