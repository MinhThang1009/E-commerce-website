/**
 * @file newsApi.ts
 * @layer API Client
 * @feature content
 * @description API client functions cho feature content
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api-client';
import { NewsFilters, NewsResponse, SingleNewsResponse } from '../types/news.types';

// === Query Keys ===

export const newsKeys = {
  all: ['news'] as const,
  lists: () => [...newsKeys.all, 'list'] as const,
  list: (filters: unknown) => [...newsKeys.lists(), filters] as const,
  details: () => [...newsKeys.all, 'detail'] as const,
  detail: (id: string) => [...newsKeys.details(), id] as const,
  slug: (slug: string) => [...newsKeys.all, 'slug', slug] as const,
  related: (slug: string) => [...newsKeys.all, 'related', slug] as const,
};

// === Query Hooks ===

export function useGetNewsQuery(
  params?: NewsFilters | void,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<NewsResponse>({
    queryKey: newsKeys.list(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params) {
        if (params.page) queryParams.append('page', params.page.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());
        if (params.search) queryParams.append('search', params.search);
        if (params.isPublished !== undefined)
          queryParams.append('isPublished', params.isPublished.toString());
        if (params.category && params.category !== 'Tất cả')
          queryParams.append('category', params.category);
      }
      const { data } = await apiClient.get(`/news?${queryParams.toString()}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetNewsByIdQuery(id: string, options?: { enabled?: boolean; skip?: boolean }) {
  return useQuery<SingleNewsResponse>({
    queryKey: newsKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/news/${id}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!id,
  });
}

export function useGetNewsBySlugQuery(
  slug: string,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<SingleNewsResponse>({
    queryKey: newsKeys.slug(slug),
    queryFn: async () => {
      const { data } = await apiClient.get(`/news/slug/${slug}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!slug,
  });
}

export function useGetRelatedNewsQuery(
  slug: string,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<NewsResponse>({
    queryKey: newsKeys.related(slug),
    queryFn: async () => {
      const { data } = await apiClient.get(`/news/slug/${slug}/related`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!slug,
  });
}

// === Mutation Hooks ===

export function useCreateNewsMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/news', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsKeys.all });
    },
  });
}

export function useUpdateNewsMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { id: string; data: unknown }>({
    mutationFn: async ({ id, data: body }) => {
      const { data } = await apiClient.put(`/news/${id}`, body);
      return data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: newsKeys.all });
      queryClient.invalidateQueries({ queryKey: newsKeys.detail(id) });
    },
  });
}

export function useDeleteNewsMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/news/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsKeys.all });
    },
  });
}
