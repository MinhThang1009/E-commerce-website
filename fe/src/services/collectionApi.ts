import { api } from './api';
import { transformProductsResponse } from '@/utils/productTransform';

export const collectionApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCollections: builder.query<any, { isActive?: boolean } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
        return {
          url: `/collections?${queryParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: ['Product'],
    }),

    getCollectionBySlug: builder.query<any, string>({
      query: (slug) => ({
        url: `/collections/slug/${slug}`,
        method: 'GET',
      }),
      providesTags: (result, error, slug) => [{ type: 'Product', id: `COLLECTION_${slug}` }],
    }),

    getProductsByCollection: builder.query<any, { slug: string; page?: number; limit?: number }>({
      query: ({ slug, page = 1, limit = 12 }) => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        return {
          url: `/collections/slug/${slug}/products?${params.toString()}`,
          method: 'GET',
        };
      },
      transformResponse: transformProductsResponse,
      providesTags: (result, error, { slug }) => [{ type: 'Product', id: `COLLECTION_PRODUCTS_${slug}` }],
    }),

    createCollection: builder.mutation<any, any>({
      query: (body) => ({
        url: '/admin/collections',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Product'],
    }),

    updateCollection: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/admin/collections/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Product'],
    }),

    deleteCollection: builder.mutation<any, string>({
      query: (id) => ({
        url: `/admin/collections/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Product'],
    }),
  }),
});

export const {
  useGetCollectionsQuery,
  useGetCollectionBySlugQuery,
  useGetProductsByCollectionQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
} = collectionApi;
