/**
 * @file loyaltyApi.ts
 * @layer API Client
 * @feature loyalty
 * @description API client functions cho feature loyalty
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

// === Query Keys ===

export const loyaltyKeys = {
  all: ['loyalty'] as const,
  info: (params: unknown) => [...loyaltyKeys.all, 'info', params] as const,
};

// === Query Hooks ===

export function useGetLoyaltyInfoQuery(
  params?: { page?: number; limit?: number } | void,
  options?: { enabled?: boolean; skip?: boolean }
) {
  // Ưu tiên enabled nếu có, fallback sang skip (compat), mặc định true
  const isEnabled = options?.enabled !== undefined
    ? options.enabled
    : options?.skip !== undefined ? !options.skip : true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useQuery<any>({
    queryKey: loyaltyKeys.info(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params && typeof params === 'object') {
        if ('page' in params && params.page) queryParams.append('page', params.page.toString());
        if ('limit' in params && params.limit) queryParams.append('limit', params.limit.toString());
      }
      const { data } = await apiClient.get(`/loyalty?${queryParams.toString()}`);
      return data;
    },
    enabled: isEnabled,
  });
}
