import { api } from './api';
import { Product } from '@/types/product.types';

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

export const wishlistApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get user wishlist
    getWishlist: builder.query<WishlistResponse, void>({
      query: () => ({
        url: '/wishlist',
        method: 'GET',
      }),
      providesTags: ['Wishlist'],
    }),

    // Add product to wishlist
    addToWishlist: builder.mutation<any, { productId: string }>({
      query: (body) => ({
        url: '/wishlist',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Wishlist'],
    }),

    // Check if product is in wishlist
    checkWishlist: builder.query<CheckWishlistResponse, string>({
      query: (productId) => ({
        url: `/wishlist/check/${productId}`,
        method: 'GET',
      }),
      providesTags: (result, error, productId) => [
        { type: 'Wishlist', id: `CHECK-${productId}` },
      ],
    }),

    // Remove product from wishlist
    removeFromWishlist: builder.mutation<any, string>({
      query: (productId) => ({
        url: `/wishlist/${productId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, productId) => [
        'Wishlist',
        { type: 'Wishlist', id: `CHECK-${productId}` },
      ],
    }),

    // Clear wishlist
    clearWishlist: builder.mutation<any, void>({
      query: () => ({
        url: '/wishlist',
        method: 'DELETE',
      }),
      invalidatesTags: ['Wishlist'],
    }),
  }),
});

export const {
  useGetWishlistQuery,
  useAddToWishlistMutation,
  useCheckWishlistQuery,
  useRemoveFromWishlistMutation,
  useClearWishlistMutation,
} = wishlistApi;
