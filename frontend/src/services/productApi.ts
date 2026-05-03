import {
  ProductFilters,
  ProductListApiResponse,
  ProductDetailApiResponse,
  ProductArrayApiResponse,
} from '@/types/product.types';
import { api } from './api';
import {
  createProductFiltersParams,
  transformProductsResponse,
  generateProductTags,
} from '@/utils/productTransform';

export const productApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<ProductListApiResponse, ProductFilters | void>({
      query: (filters = {}) => {
        const params = createProductFiltersParams(filters);
        return {
          url: `/products?${params.toString()}`,
          method: 'GET',
        };
      },
      transformResponse: transformProductsResponse,
      providesTags: (result) => generateProductTags(result, 'LIST'),
    }),

    getProductById: builder.query<ProductDetailApiResponse, string | { id: string; skuId?: string; color?: string }>(
      {
        query: (arg) => {
          const id = typeof arg === 'string' ? arg : arg.id;
          const skuId = typeof arg === 'object' ? arg.skuId : undefined;
          const color = typeof arg === 'object' ? arg.color : undefined;

          const params = new URLSearchParams();
          if (skuId) params.append('skuId', skuId);
          if (color) params.append('color', color);

          return {
            url: `/products/${id}${params.toString() ? `?${params.toString()}` : ''}`,
            method: 'GET',
          };
        },
        transformResponse: transformProductsResponse,
        providesTags: (result, error, arg) => {
          const id = typeof arg === 'string' ? arg : arg.id;
          return [{ type: 'Product', id }];
        },
      }
    ),

    getProductBySlug: builder.query<ProductDetailApiResponse, { slug: string; skuId?: string; color?: string }>({
      query: ({ slug, skuId, color }) => {
        const params = new URLSearchParams();
        if (skuId) params.append('skuId', skuId);
        if (color) params.append('color', color);

        return {
          url: `/products/slug/${slug}${params.toString() ? `?${params.toString()}` : ''}`,
          method: 'GET',
        };
      },
      transformResponse: transformProductsResponse,
      providesTags: (result) => generateProductTags(result, 'SLUG'),
    }),

    getFeaturedProducts: builder.query<ProductArrayApiResponse, { limit?: number } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params && typeof params === 'object' && 'limit' in params && params.limit) {
          queryParams.append('limit', params.limit.toString());
        }

        return {
          url: `/products/featured?${queryParams.toString()}`,
          method: 'GET',
        };
      },
      transformResponse: transformProductsResponse,
      providesTags: (result) => generateProductTags(result, 'FEATURED'),
    }),

    getNewArrivals: builder.query<ProductArrayApiResponse, { limit?: number } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params && typeof params === 'object' && 'limit' in params && params.limit) {
          queryParams.append('limit', params.limit.toString());
        }

        return {
          url: `/products/new-arrivals?${queryParams.toString()}`,
          method: 'GET',
        };
      },
      transformResponse: transformProductsResponse,
      providesTags: (result) => generateProductTags(result, 'NEW_ARRIVALS'),
    }),

    getBestSellers: builder.query<
      ProductArrayApiResponse,
      { limit?: number; period?: string } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.period) queryParams.append('period', params.period);

        return {
          url: `/products/best-sellers?${queryParams.toString()}`,
          method: 'GET',
        };
      },
      transformResponse: transformProductsResponse,
      providesTags: (result) => generateProductTags(result, 'BEST_SELLERS'),
    }),

    getDeals: builder.query<
      ProductArrayApiResponse,
      { minDiscount?: number; limit?: number; sort?: string } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.minDiscount)
          queryParams.append('minDiscount', params.minDiscount.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.sort) queryParams.append('sort', params.sort);

        return {
          url: `/products/deals?${queryParams.toString()}`,
          method: 'GET',
        };
      },
      transformResponse: transformProductsResponse,
      providesTags: (result) => generateProductTags(result, 'DEALS'),
    }),

    getRelatedProducts: builder.query<ProductArrayApiResponse, string>({
      query: (productId) => ({
        url: `/products/${productId}/related`,
        method: 'GET',
      }),
      transformResponse: transformProductsResponse,
      providesTags: (result) => generateProductTags(result, 'RELATED'),
    }),

    getProductVariants: builder.query<any, string>({
      query: (productId) => ({
        url: `/products/${productId}/variants`,
        method: 'GET',
      }),
      providesTags: (result, error, productId) => [
        { type: 'Product', id: `${productId}_VARIANTS` },
      ],
    }),

    getProductReviewsSummary: builder.query<any, string>({
      query: (productId) => ({
        url: `/products/${productId}/reviews-summary`,
        method: 'GET',
      }),
      providesTags: (result, error, productId) => [
        { type: 'Product', id: `${productId}_REVIEWS` },
      ],
    }),

    searchProducts: builder.query<
      ProductListApiResponse,
      { q: string; page?: number; limit?: number }
    >({
      query: ({ q, page = 1, limit = 10 }) => {
        const params = new URLSearchParams();
        params.append('q', q);
        params.append('page', page.toString());
        params.append('limit', limit.toString());

        return {
          url: `/products/search?${params.toString()}`,
          method: 'GET',
        };
      },
      transformResponse: transformProductsResponse,
      providesTags: (result) => generateProductTags(result, 'SEARCH'),
    }),

    getProductFilters: builder.query<any, { categoryId?: string }>({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.categoryId)
          queryParams.append('categoryId', params.categoryId);

        return {
          url: `/products/filters?${queryParams.toString()}`,
          method: 'GET',
        };
      },
      transformResponse: (response: any) => {
        return response.data;
      },
      providesTags: ['Product'],
    }),
    getRecentlyViewed: builder.query<ProductArrayApiResponse, { limit?: number } | void>({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params && 'limit' in params && params.limit) {
          queryParams.append('limit', params.limit.toString());
        }

        return {
          url: `/products/recently-viewed?${queryParams.toString()}`,
          method: 'GET',
        };
      },
      transformResponse: transformProductsResponse,
      providesTags: (result) => generateProductTags(result, 'RECENTLY_VIEWED'),
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductByIdQuery,
  useGetProductBySlugQuery,
  useGetFeaturedProductsQuery,
  useGetNewArrivalsQuery,
  useGetBestSellersQuery,
  useGetDealsQuery,
  useGetRelatedProductsQuery,
  useGetProductVariantsQuery,
  useGetProductReviewsSummaryQuery,
  useSearchProductsQuery,
  useGetProductFiltersQuery,
  useGetRecentlyViewedQuery,
} = productApi;

export type { Product } from '@/types/product.types';

