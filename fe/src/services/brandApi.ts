import { api } from './api';
import { transformProductsResponse } from '@/utils/productTransform';

export const brandApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getBrands: builder.query<any, { isActive?: boolean; categoryId?: string } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.isActive !== undefined) {
          queryParams.append('isActive', params.isActive.toString());
        }
        if (params?.categoryId) {
          queryParams.append('categoryId', params.categoryId);
        }
        return {
          url: `/brands?${queryParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: ['Product'],
    }),

    getBrandBySlug: builder.query<any, string>({
      query: (slug) => ({
        url: `/brands/slug/${slug}`,
        method: 'GET',
      }),
      providesTags: (result, error, slug) => [{ type: 'Product', id: `BRAND_${slug}` }],
    }),

    getProductsByBrand: builder.query<any, { slug: string; page?: number; limit?: number }>({
      query: ({ slug, page = 1, limit = 12 }) => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        return {
          url: `/brands/slug/${slug}/products?${params.toString()}`,
          method: 'GET',
        };
      },
      transformResponse: transformProductsResponse,
      providesTags: (result, error, { slug }) => [{ type: 'Product', id: `BRAND_PRODUCTS_${slug}` }],
    }),

    createBrand: builder.mutation<any, any>({
      query: (body) => ({
        url: '/admin/brands',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Product'],
    }),

    updateBrand: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/admin/brands/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Product'],
    }),

    deleteBrand: builder.mutation<any, string>({
      query: (id) => ({
        url: `/admin/brands/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Product'],
    }),
  }),
});

export const {
  useGetBrandsQuery,
  useGetBrandBySlugQuery,
  useGetProductsByBrandQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
} = brandApi;
