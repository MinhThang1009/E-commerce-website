import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { transformProductsResponse } from '../utils/productTransform';

// === Query Keys ===

export const collectionKeys = {
  all: ['collections'] as const,
  list: (params?: unknown) => [...collectionKeys.all, 'list', params] as const,
  slug: (slug: string) => [...collectionKeys.all, 'slug', slug] as const,
  products: (slug: string, params?: Record<string, unknown>) => [...collectionKeys.all, 'products', slug, params] as const,
};

// === Query Hooks ===

export function useGetCollectionsQuery(
  params?: { isActive?: boolean } | void,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery({
    queryKey: collectionKeys.list(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.isActive !== undefined)
        queryParams.append('isActive', params.isActive.toString());
      const { data } = await apiClient.get(`/collections?${queryParams.toString()}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetCollectionBySlugQuery(
  slug: string,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery({
    queryKey: collectionKeys.slug(slug),
    queryFn: async () => {
      const { data } = await apiClient.get(`/collections/slug/${slug}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!slug,
  });
}

export function useGetProductsByCollectionQuery(
  params: { slug: string; page?: number; limit?: number },
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery({
    queryKey: collectionKeys.products(params.slug, params),
    queryFn: async () => {
      const urlParams = new URLSearchParams();
      urlParams.append('page', (params.page || 1).toString());
      urlParams.append('limit', (params.limit || 12).toString());
      const { data } = await apiClient.get(
        `/collections/slug/${params.slug}/products?${urlParams.toString()}`
      );
      return transformProductsResponse(data);
    },
    enabled: options?.skip !== undefined ? !options.skip : !!params.slug,
  });
}

export function useCreateCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: object) => {
      const { data } = await apiClient.post('/admin/collections', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    },
  });
}

export function useUpdateCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: object }) => {
      const { data } = await apiClient.put(`/admin/collections/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    },
  });
}

export function useDeleteCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/admin/collections/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    },
  });
}
