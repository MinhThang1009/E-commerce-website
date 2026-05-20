/**
 * @file bannerApi.ts
 * @layer API Client
 * @feature content
 * @description API client functions cho feature content
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  position: 'home_hero' | 'home_middle' | 'sidebar';
  isActive: boolean;
  priority: number;
}

interface BannersResponse {
  status: string;
  data: Banner[];
}
interface BannerResponse {
  status: string;
  data: Banner;
}

interface BannerPayload {
  title: string;
  imageUrl: string;
  linkUrl?: string;
  position: 'home_hero' | 'home_middle' | 'sidebar';
  isActive: boolean;
  priority: number;
}

// === Query Keys ===

export const bannerKeys = {
  all: ['banners'] as const,
  lists: () => [...bannerKeys.all, 'list'] as const,
  list: (params: unknown) => [...bannerKeys.lists(), params] as const,
};

// === Query Hooks ===

export function useGetBannersQuery(
  params?: { position?: string; isActive?: boolean } | void,
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<BannersResponse>({
    queryKey: bannerKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/banners', { params: params ?? {} });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

// === Mutation Hooks ===

export function useCreateBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation<BannerResponse, Error, BannerPayload>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/banners', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.all });
    },
  });
}

export function useUpdateBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation<BannerResponse, Error, { id: string } & Partial<BannerPayload>>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.patch(`/banners/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.all });
    },
  });
}

export function useDeleteBannerMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ status: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/banners/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.all });
    },
  });
}
