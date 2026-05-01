import { api } from './api';
import { DiscountCode } from '@/types/discount.types';

export interface DiscountCodesResponse {
  status: string;
  data: {
    discountCodes: DiscountCode[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface DiscountCodeResponse {
  status: string;
  data: DiscountCode;
}

export interface DiscountCodeFilters {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}

export const discountCodeApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDiscountCodes: builder.query<DiscountCodesResponse, DiscountCodeFilters | void>({
      query: (filters = {}) => ({
        url: '/admin/discount-codes',
        params: filters || {},
      }),
      providesTags: ['DiscountCodes'],
    }),

    getDiscountCodeById: builder.query<DiscountCodeResponse, string>({
      query: (id) => `/admin/discount-codes/${id}`,
      providesTags: (result, error, id) => [{ type: 'DiscountCodes', id }],
    }),

    createDiscountCode: builder.mutation<DiscountCodeResponse, Partial<DiscountCode>>({
      query: (data) => ({
        url: '/admin/discount-codes',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['DiscountCodes'],
    }),

    updateDiscountCode: builder.mutation<DiscountCodeResponse, { id: string } & Partial<DiscountCode>>({
      query: ({ id, ...data }) => ({
        url: `/admin/discount-codes/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        'DiscountCodes',
        { type: 'DiscountCodes', id },
      ],
    }),

    deleteDiscountCode: builder.mutation<{ status: string; message: string }, string>({
      query: (id) => ({
        url: `/admin/discount-codes/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        'DiscountCodes',
        { type: 'DiscountCodes', id },
      ],
    }),
  }),
});

export const {
  useGetDiscountCodesQuery,
  useGetDiscountCodeByIdQuery,
  useCreateDiscountCodeMutation,
  useUpdateDiscountCodeMutation,
  useDeleteDiscountCodeMutation,
} = discountCodeApi;
