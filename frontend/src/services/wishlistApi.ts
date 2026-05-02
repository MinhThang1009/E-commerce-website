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
    // Lấy danh sách yêu thích của người dùng
    getWishlist: builder.query<WishlistResponse, void>({
      query: () => ({
        url: '/wishlist',
        method: 'GET',
      }),
      providesTags: ['Wishlist'],
    }),

    // Thêm sản phẩm vào danh sách yêu thích
    addToWishlist: builder.mutation<any, { productId: string }>({
      query: (body) => ({
        url: '/wishlist',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Wishlist'],
    }),

    // Kiểm tra sản phẩm có trong danh sách yêu thích không
    checkWishlist: builder.query<CheckWishlistResponse, string>({
      query: (productId) => ({
        url: `/wishlist/check/${productId}`,
        method: 'GET',
      }),
      providesTags: (result, error, productId) => [
        { type: 'Wishlist', id: `CHECK-${productId}` },
      ],
    }),

    // Xóa sản phẩm khỏi danh sách yêu thích
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

    // Xóa toàn bộ danh sách yêu thích
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
