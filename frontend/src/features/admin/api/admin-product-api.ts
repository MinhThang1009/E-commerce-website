/**
 * @file adminProductApi.ts
 * @layer API Client
 * @feature admin
 * @description API client functions cho feature admin
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// Kiểu dữ liệu cho quản lý sản phẩm admin
export interface CreateProductRequest {
  name: string;
  baseName?: string;
  description: string;
  shortDescription: string;
  price?: number | string;
  comparePrice?: number | string | null;
  stock?: number;
  sku?: string;
  images: string[];
  status: 'active' | 'inactive' | 'draft';
  featured?: boolean;
  categoryIds: string[];
  condition?: 'new' | 'like-new' | 'used' | 'refurbished';
  warrantyMonths?: number;
  specifications?: Array<{
    name: string;
    value: string;
    category?: string;
  }>;
  attributes?: Array<{
    name: string;
    value: string;
  }>;
  variants?: Array<{
    name: string;
    variantName?: string;
    sku?: string;
    price: number | string;
    compareAtPrice?: number | string | null;
    stockQuantity?: number;
    stock?: number;
    isDefault?: boolean;
    isAvailable?: boolean;
    attributes?: Record<string, string>;
    specifications?: Record<string, string | number | boolean>;
    images?: string[];
  }>;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  warrantyPackageIds?: string[];
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
  id: string;
}

export interface AdminProductsFilter {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  priceMin?: number;
  priceMax?: number;
  stockMin?: number;
  stockMax?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  stock: number;
  sku: string;
  images: string[];
  status: string;
  Categories: Array<{
    id: string;
    name: string;
  }>;
  attributes?: Array<{
    name: string;
    value: string;
  }>;
  variants?: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductsResponse {
  status: string;
  data: {
    products: AdminProduct[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  };
}

export interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

// === Query Keys ===

export const adminProductKeys = {
  all: ['admin-products'] as const,
  lists: () => [...adminProductKeys.all, 'list'] as const,
  list: (filters: unknown) => [...adminProductKeys.lists(), filters] as const,
  details: () => [...adminProductKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminProductKeys.details(), id] as const,
};

// === Query Hooks ===

export function useGetAdminProductsQuery(
  filters: AdminProductsFilter | void = {},
  options?: { enabled?: boolean; skip?: boolean },
) {
  const filterObj = (filters as AdminProductsFilter) ?? {};
  return useQuery<AdminProductsResponse>({
    queryKey: adminProductKeys.list(filterObj),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/products', { params: filterObj });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useLazyGetAdminProductsQuery() {
  const queryClient = useQueryClient();
  return {
    trigger: async (filters: AdminProductsFilter = {}) => {
      return queryClient.fetchQuery({
        queryKey: adminProductKeys.list(filters),
        queryFn: async () => {
          const { data } = await apiClient.get('/admin/products', { params: filters });
          return data;
        },
      });
    },
  };
}

export function useGetAdminProductByIdQuery(
  id: string,
  options?: { enabled?: boolean; skip?: boolean },
) {
  // Ưu tiên enabled nếu có, fallback sang skip (compat), mặc định !!id
  const isEnabled =
    options?.enabled !== undefined
      ? options.enabled
      : options?.skip !== undefined
        ? !options.skip
        : !!id;

  return useQuery<ApiResponse<AdminProduct>>({
    queryKey: adminProductKeys.detail(id),
    queryFn: async () => {
      const { data: response } = await apiClient.get(`/admin/products/${id}`);

      // Hàm trợ giúp: parse JSON nếu value là string
      const parseIfString = (val: unknown) => {
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            return {};
          }
        }
        return val || {};
      };

      if (response?.data?.product) {
        const product = response.data.product;
        if (product.variants) {
          product.variants = product.variants.map((v: Record<string, unknown>) => ({
            ...v,
            attributes: parseIfString(v.attributes),
            attributeValues: parseIfString(v.attributeValues || v.attributes),
          }));
        }
        if (product.attributes) {
          product.attributes = product.attributes.map((attr: Record<string, unknown>) => ({
            ...attr,
            values: typeof attr.values === 'string' ? JSON.parse(attr.values) : attr.values || [],
          }));
        }
      }
      return response;
    },
    enabled: isEnabled,
  });
}

// === Mutation Hooks ===

export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<AdminProduct>, Error, CreateProductRequest>({
    mutationFn: async (productData) => {
      const { data } = await apiClient.post('/admin/products', productData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminProductKeys.lists() });
    },
  });
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<AdminProduct>, Error, UpdateProductRequest>({
    mutationFn: async ({ id, ...productData }) => {
      const { data } = await apiClient.put(`/admin/products/${id}`, productData);
      return data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminProductKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.lists() });
      // Invalidate public product list cache để frontend user thấy thay đổi ngay
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<void>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/admin/products/${id}`);
      return data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: adminProductKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.lists() });
      // Invalidate public product list cache để sản phẩm bị xóa biến mất ngay
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCloneProductMutation() {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<AdminProduct>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.post(`/admin/products/${id}/clone`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminProductKeys.lists() });
    },
  });
}

export function useUpdateProductStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<AdminProduct>, Error, { id: string; status?: string }>({
    mutationFn: async ({ id, status }) => {
      const { data } = await apiClient.patch(`/admin/products/${id}/status`, { status });
      return data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminProductKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: adminProductKeys.lists() });
    },
  });
}

// Service class giữ nguyên cho các call không qua hook
class AdminProductService {
  async createProduct(productData: CreateProductRequest) {
    const response = await apiClient.post('/admin/products', productData);
    return response.data;
  }
}

export const adminProductService = new AdminProductService();
