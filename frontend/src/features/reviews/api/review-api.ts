/**
 * @file reviewApi.ts
 * @layer API Client
 * @feature reviews
 * @description API client functions cho feature reviews
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api-client';

export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title: string;
  content: string;
  images?: string[];
  isVerified: boolean;
  likes: number;
  dislikes: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

export interface ReviewFilters {
  page?: number;
  limit?: number;
  rating?: number;
  verified?: boolean;
  withImages?: boolean;
  sort?: 'newest' | 'oldest' | 'highest_rating' | 'lowest_rating' | 'most_helpful';
}

export interface CreateReviewData {
  productId: string;
  rating: number;
  title: string;
  comment: string;
  images?: string[];
}

export interface ReviewsResponse {
  status: string;
  data: {
    reviews: Review[];
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

// Query keys tập trung
export const reviewKeys = {
  all: ['reviews'] as const,
  product: (productId: string) => [...reviewKeys.all, 'product', productId] as const,
  productFiltered: (productId: string, filters: ReviewFilters) =>
    [...reviewKeys.product(productId), filters] as const,
  user: (params?: { page?: number; limit?: number }) =>
    [...reviewKeys.all, 'user', params] as const,
};

// --- Query hooks ---

/** Lấy danh sách đánh giá của sản phẩm */
export function useGetProductReviewsQuery(
  args: { productId: string } & ReviewFilters,
  options?: { enabled?: boolean },
) {
  const { productId, ...filters } = args;
  return useQuery<ReviewsResponse>({
    queryKey: reviewKeys.productFiltered(productId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.rating) params.append('rating', filters.rating.toString());
      if (filters.verified !== undefined) params.append('verified', filters.verified.toString());
      if (filters.withImages !== undefined)
        params.append('withImages', filters.withImages.toString());
      if (filters.sort) params.append('sort', filters.sort);

      const res = await apiClient.get(`/reviews/product/${productId}?${params.toString()}`);
      return res.data;
    },
    enabled: !!productId && productId !== 'undefined',
    ...options,
  });
}

/** Lấy danh sách đánh giá của người dùng */
export function useGetUserReviewsQuery(
  params: { page?: number; limit?: number } = {},
  options?: { enabled?: boolean },
) {
  return useQuery<ReviewsResponse>({
    queryKey: reviewKeys.user(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());

      const res = await apiClient.get(`/reviews/user?${queryParams.toString()}`);
      return res.data;
    },
    ...options,
  });
}

// --- Mutation hooks ---

/** Tạo đánh giá mới */
export function useCreateReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, CreateReviewData>({
    mutationFn: async (reviewData) => {
      const res = await apiClient.post('/reviews', reviewData);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.product(variables.productId),
      });
      // Invalidate product detail để cập nhật rating trung bình
      queryClient.invalidateQueries({
        queryKey: ['products', 'detail', variables.productId],
      });
    },
  });
}

/** Cập nhật đánh giá */
export function useUpdateReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { id: string } & Partial<CreateReviewData>>({
    mutationFn: async ({ id, ...reviewData }) => {
      const res = await apiClient.put(`/reviews/${id}`, reviewData);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      if (variables.productId) {
        queryClient.invalidateQueries({
          queryKey: reviewKeys.product(variables.productId),
        });
        queryClient.invalidateQueries({
          queryKey: ['products', 'detail', variables.productId],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: reviewKeys.all });
      }
    },
  });
}

/** Xóa đánh giá */
export function useDeleteReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (id) => {
      const res = await apiClient.delete(`/reviews/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    },
  });
}

/** Đánh dấu đánh giá là hữu ích */
export function useMarkReviewHelpfulMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { id: string; helpful: boolean; productId?: string }>({
    mutationFn: async ({ id, helpful }) => {
      const res = await apiClient.put(`/reviews/${id}/helpful`, { helpful });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      if (variables.productId) {
        queryClient.invalidateQueries({
          queryKey: reviewKeys.product(variables.productId),
        });
      }
    },
  });
}
