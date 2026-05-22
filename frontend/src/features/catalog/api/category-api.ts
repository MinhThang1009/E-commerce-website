/**
 * @file categoryApi.ts
 * @layer API Client
 * @feature catalog
 * @description API client functions cho feature catalog
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Category } from '../types/category.types';

export interface CategoryResponse {
  status: string;
  data: Category[] | Category;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateCategoryRequest extends CreateCategoryRequest {
  id: string;
}

// === Query Keys ===

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  tree: () => [...categoryKeys.all, 'tree'] as const,
  detail: (id: string) => [...categoryKeys.all, 'detail', id] as const,
  slug: (slug: string) => [...categoryKeys.all, 'slug', slug] as const,
  products: (id: string, params?: unknown) =>
    [...categoryKeys.all, 'products', id, params] as const,
  featured: () => [...categoryKeys.all, 'featured'] as const,
  flat: () => [...categoryKeys.all, 'flat'] as const,
};

// === Query Hooks ===

export function useGetAllCategoriesQuery(options?: { enabled?: boolean; skip?: boolean }) {
  return useQuery<CategoryResponse>({
    queryKey: categoryKeys.lists(),
    queryFn: async () => {
      const { data } = await apiClient.get('/categories', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetCategoryTreeQuery(options?: { enabled?: boolean; skip?: boolean }) {
  return useQuery<CategoryResponse>({
    queryKey: categoryKeys.tree(),
    queryFn: async () => {
      const { data } = await apiClient.get('/categories/tree');
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetCategoryByIdQuery(
  id: string,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<CategoryResponse>({
    queryKey: categoryKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/categories/${id}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!id,
  });
}

export function useGetCategoryBySlugQuery(
  slug: string,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<CategoryResponse>({
    queryKey: categoryKeys.slug(slug),
    queryFn: async () => {
      const { data } = await apiClient.get(`/categories/slug/${slug}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!slug,
  });
}

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (category: CreateCategoryRequest) => {
      const { data } = await apiClient.post('/categories', category);
      return data as CategoryResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...category }: UpdateCategoryRequest) => {
      const { data } = await apiClient.put(`/categories/${id}`, category);
      return data as CategoryResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/categories/${id}`);
      return data as { status: string; message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useGetProductsByCategoryQuery(
  params: {
    id: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'ASC' | 'DESC';
  },
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery({
    queryKey: categoryKeys.products(params.id, params),
    queryFn: async () => {
      const { id, page = 1, limit = 10, sort = 'createdAt', order = 'DESC' } = params;
      const { data } = await apiClient.get(
        `/categories/${id}/products?page=${page}&limit=${limit}&sort=${sort}&order=${order}`,
      );
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!params.id,
  });
}

export function useGetFeaturedCategoriesQuery(options?: { enabled?: boolean; skip?: boolean }) {
  return useQuery<CategoryResponse>({
    queryKey: categoryKeys.featured(),
    queryFn: async () => {
      const { data } = await apiClient.get('/categories/featured');
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

// Giữ lại hook cũ để tương thích — transform response thành Category[]
export function useGetCategoriesQuery(options?: { enabled?: boolean; skip?: boolean }) {
  return useQuery<Category[]>({
    queryKey: categoryKeys.flat(),
    queryFn: async () => {
      const { data } = await apiClient.get('/categories');
      const response = data as CategoryResponse;
      return Array.isArray(response.data) ? response.data : [response.data];
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export type { Category } from '../types/category.types';
