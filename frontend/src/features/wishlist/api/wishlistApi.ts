/**
 * @file wishlistApi.ts
 * @layer API Client
 * @feature wishlist
 * @description API client functions cho feature wishlist
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { Product } from '@/features/catalog';

export interface WishlistResponse {
  status: string;
  data: Product[];
}

export interface CheckWishlistResponse {
  status: string;
  data: {
    inWishlist: boolean;
  };
}

// === Query Keys ===

export const wishlistKeys = {
  all: ['wishlist'] as const,
  list: () => [...wishlistKeys.all, 'list'] as const,
  check: (productId: string) => [...wishlistKeys.all, 'check', productId] as const,
};

// === Query Hooks ===

export function useGetWishlistQuery(
  _arg?: undefined,
  options?: { enabled?: boolean; skip?: boolean; refetchOnFocus?: boolean; refetchOnReconnect?: boolean }
) {
  // Ưu tiên enabled nếu có, fallback sang skip (compat), mặc định true
  const isEnabled = options?.enabled !== undefined
    ? options.enabled
    : options?.skip !== undefined ? !options.skip : true;

  return useQuery<WishlistResponse>({
    queryKey: wishlistKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get('/wishlists');
      return data;
    },
    enabled: isEnabled,
    refetchOnWindowFocus: options?.refetchOnFocus,
    refetchOnReconnect: options?.refetchOnReconnect,
  });
}

export function useCheckWishlistQuery(
  productId: string,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery<CheckWishlistResponse>({
    queryKey: wishlistKeys.check(productId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/wishlists/check/${productId}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!productId,
  });
}

// === Mutation Hooks ===

export function useAddToWishlistMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { productId: string }>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/wishlists', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wishlistKeys.all });
    },
  });
}

export function useRemoveFromWishlistMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (productId) => {
      const { data } = await apiClient.delete(`/wishlists/${productId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wishlistKeys.all });
    },
  });
}

export function useClearWishlistMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const { data } = await apiClient.delete('/wishlists');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wishlistKeys.all });
    },
  });
}
