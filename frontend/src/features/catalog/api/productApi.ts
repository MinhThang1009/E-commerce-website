import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import {
  ProductFilters,
  ProductListApiResponse,
  ProductDetailApiResponse,
  ProductArrayApiResponse,
} from '../types/product.types';
import { createProductFiltersParams, transformProductsResponse } from '../utils/productTransform';

// === Query Keys ===

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: unknown) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
  slug: (slug: string) => [...productKeys.all, 'slug', slug] as const,
  featured: (params?: unknown) => [...productKeys.all, 'featured', params] as const,
  newArrivals: (params?: unknown) => [...productKeys.all, 'new-arrivals', params] as const,
  bestSellers: (params?: unknown) => [...productKeys.all, 'best-sellers', params] as const,
  deals: (params?: unknown) => [...productKeys.all, 'deals', params] as const,
  related: (id: string) => [...productKeys.all, 'related', id] as const,
  variants: (id: string) => [...productKeys.all, 'variants', id] as const,
  reviewsSummary: (id: string) => [...productKeys.all, 'reviews-summary', id] as const,
  search: (params: unknown) => [...productKeys.all, 'search', params] as const,
  filters: (params?: unknown) => [...productKeys.all, 'filters', params] as const,
  recentlyViewed: (params?: unknown) => [...productKeys.all, 'recently-viewed', params] as const,
};

// === Query Hooks ===

export function useGetProductsQuery(
  filters: ProductFilters | void = {},
  options?: { enabled?: boolean; skip?: boolean },
) {
  const filterObj = filters || {};
  return useQuery<ProductListApiResponse>({
    queryKey: productKeys.list(filterObj),
    queryFn: async () => {
      const params = createProductFiltersParams(filterObj);
      const { data } = await apiClient.get(`/products?${params.toString()}`);
      return transformProductsResponse(data);
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetProductByIdQuery(
  arg: string | { id: string; skuId?: string; color?: string },
  options?: { enabled?: boolean; skip?: boolean; placeholderData?: (prev: unknown) => unknown },
) {
  const id = typeof arg === 'string' ? arg : arg.id;
  const skuId = typeof arg === 'object' ? arg.skuId : undefined;
  const color = typeof arg === 'object' ? arg.color : undefined;

  return useQuery<ProductDetailApiResponse>({
    queryKey: productKeys.detail(JSON.stringify({ id, skuId, color })),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (skuId) params.append('skuId', skuId);
      if (color) params.append('color', color);

      const url = `/products/${id}${params.toString() ? `?${params.toString()}` : ''}`;
      const { data } = await apiClient.get(url);
      return transformProductsResponse(data);
    },
    placeholderData: options?.placeholderData as never,
    enabled:
      options?.enabled !== undefined
        ? options.enabled
        : options?.skip !== undefined
          ? !options.skip
          : !!id,
  });
}

export function useGetProductBySlugQuery(
  params: { slug: string; skuId?: string; color?: string },
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<ProductDetailApiResponse>({
    queryKey: productKeys.slug(JSON.stringify(params)),
    queryFn: async () => {
      const urlParams = new URLSearchParams();
      if (params.skuId) urlParams.append('skuId', params.skuId);
      if (params.color) urlParams.append('color', params.color);

      const url = `/products/slug/${params.slug}${urlParams.toString() ? `?${urlParams.toString()}` : ''}`;
      const { data } = await apiClient.get(url);
      return transformProductsResponse(data);
    },
    enabled: options?.skip !== undefined ? !options.skip : !!params.slug,
  });
}

export function useGetFeaturedProductsQuery(
  params?: { limit?: number } | void,
  options?: { enabled?: boolean; skip?: boolean },
) {
  const resolvedParams = params && typeof params === 'object' ? params : {};
  return useQuery<ProductArrayApiResponse>({
    queryKey: productKeys.featured(resolvedParams),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (resolvedParams.limit) {
        queryParams.append('limit', resolvedParams.limit.toString());
      }
      const { data } = await apiClient.get(`/products/featured?${queryParams.toString()}`);
      return transformProductsResponse(data);
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetNewArrivalsQuery(
  params?: { limit?: number } | void,
  options?: { enabled?: boolean; skip?: boolean },
) {
  const resolvedParams = params && typeof params === 'object' ? params : {};
  return useQuery<ProductArrayApiResponse>({
    queryKey: productKeys.newArrivals(resolvedParams),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (resolvedParams.limit) {
        queryParams.append('limit', resolvedParams.limit.toString());
      }
      const { data } = await apiClient.get(`/products/new-arrivals?${queryParams.toString()}`);
      return transformProductsResponse(data);
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetBestSellersQuery(
  params?: { limit?: number; period?: string } | void,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<ProductArrayApiResponse>({
    queryKey: productKeys.bestSellers(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.period) queryParams.append('period', params.period);
      const { data } = await apiClient.get(`/products/best-sellers?${queryParams.toString()}`);
      return transformProductsResponse(data);
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetDealsQuery(
  params?: { minDiscount?: number; limit?: number; sort?: string } | void,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<ProductArrayApiResponse>({
    queryKey: productKeys.deals(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.minDiscount) queryParams.append('minDiscount', params.minDiscount.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.sort) queryParams.append('sort', params.sort);
      const { data } = await apiClient.get(`/products/deals?${queryParams.toString()}`);
      return transformProductsResponse(data);
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetRelatedProductsQuery(
  productId: string,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<ProductArrayApiResponse>({
    queryKey: productKeys.related(productId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/products/${productId}/related`);
      return transformProductsResponse(data);
    },
    enabled: options?.skip !== undefined ? !options.skip : !!productId,
  });
}

export function useGetProductVariantsQuery(
  productId: string,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery({
    queryKey: productKeys.variants(productId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/products/${productId}/variants`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!productId,
  });
}

export function useGetProductReviewsSummaryQuery(
  productId: string,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery({
    queryKey: productKeys.reviewsSummary(productId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/products/${productId}/reviews-summary`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!productId,
  });
}

export function useSearchProductsQuery(
  params: { q: string; page?: number; limit?: number },
  options?: { enabled?: boolean; skip?: boolean; staleTime?: number },
) {
  // Ưu tiên enabled nếu có, fallback sang skip (compat), mặc định true
  const isEnabled =
    options?.enabled !== undefined
      ? options.enabled
      : options?.skip !== undefined
        ? !options.skip
        : true;

  return useQuery<ProductListApiResponse>({
    queryKey: productKeys.search(params),
    queryFn: async () => {
      const urlParams = new URLSearchParams();
      urlParams.append('q', params.q);
      urlParams.append('page', (params.page || 1).toString());
      urlParams.append('limit', (params.limit || 10).toString());
      const { data } = await apiClient.get(`/products/search?${urlParams.toString()}`);
      return transformProductsResponse(data);
    },
    enabled: isEnabled,
    staleTime: options?.staleTime,
  });
}

export function useGetProductFiltersQuery(
  params: { categoryId?: string } = {},
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery({
    queryKey: productKeys.filters(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.categoryId) queryParams.append('categoryId', params.categoryId);
      const { data } = await apiClient.get(`/products/filters?${queryParams.toString()}`);
      // transformResponse: response.data — extract .data từ backend wrapper
      return data.data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetRecentlyViewedQuery(
  params?: { limit?: number } | void,
  options?: { enabled?: boolean; skip?: boolean },
) {
  const resolvedParams = params && typeof params === 'object' ? params : {};
  return useQuery<ProductArrayApiResponse>({
    queryKey: productKeys.recentlyViewed(resolvedParams),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (resolvedParams.limit) {
        queryParams.append('limit', resolvedParams.limit.toString());
      }
      const { data } = await apiClient.get(`/products/recently-viewed?${queryParams.toString()}`);
      return transformProductsResponse(data);
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

// Re-export cho backward compatibility — barrel import dùng tên này
export const productApi = {
  useGetProductByIdQuery,
  useGetRelatedProductsQuery,
};

export type { Product } from '../types/product.types';
