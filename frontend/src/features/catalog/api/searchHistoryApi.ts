import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

// === Query Keys ===

export const searchHistoryKeys = {
  all: ['search-history'] as const,
  list: (params: unknown) => [...searchHistoryKeys.all, 'list', params] as const,
};

// === Query Hooks ===

export function useGetSearchHistoryQuery(
  params?: { limit?: number } | void,
  options?: { enabled?: boolean; skip?: boolean }
) {
  // Ưu tiên enabled nếu có, fallback sang skip (compat), mặc định true
  const isEnabled = options?.enabled !== undefined
    ? options.enabled
    : options?.skip !== undefined ? !options.skip : true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useQuery<any>({
    queryKey: searchHistoryKeys.list(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      const { data } = await apiClient.get(`/search-histories?${queryParams.toString()}`);
      return data;
    },
    enabled: isEnabled,
  });
}

// === Mutation Hooks ===

export function useSaveSearchMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { keyword: string; resultsCount?: number; sessionId?: string }>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/search-histories', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: searchHistoryKeys.all });
    },
  });
}

export function useDeleteSearchHistoryMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/search-histories/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: searchHistoryKeys.all });
    },
  });
}

export function useClearAllSearchHistoryMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const { data } = await apiClient.delete('/search-histories');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: searchHistoryKeys.all });
    },
  });
}
