import { api } from './api';
import { News, NewsFilters, NewsResponse, SingleNewsResponse } from '@/types/news.types';

export const newsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getNews: builder.query<NewsResponse, NewsFilters | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params) {
          if (params.page) queryParams.append('page', params.page.toString());
          if (params.limit) queryParams.append('limit', params.limit.toString());
          if (params.search) queryParams.append('search', params.search);
          if (params.isPublished !== undefined) queryParams.append('isPublished', params.isPublished.toString());
          if (params.category && params.category !== 'Tất cả') queryParams.append('category', params.category);
        }

        return {
          url: `/news?${queryParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: ['News'],
    }),

    getNewsById: builder.query<SingleNewsResponse, string>({
      query: (id) => `/news/${id}`,
      providesTags: (result, error, id) => [{ type: 'News', id }],
    }),

    getNewsBySlug: builder.query<SingleNewsResponse, string>({
      query: (slug) => `/news/slug/${slug}`,
      providesTags: (result, error, slug) => [{ type: 'News', id: slug }],
    }),

    getRelatedNews: builder.query<NewsResponse, string>({
      query: (slug) => `/news/slug/${slug}/related`,
      providesTags: ['News'],
    }),

    createNews: builder.mutation<any, any>({
      query: (data) => ({
        url: '/news',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['News'],
    }),

    updateNews: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `/news/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => ['News', { type: 'News', id }],
    }),

    deleteNews: builder.mutation<any, string>({
      query: (id) => ({
        url: `/news/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['News'],
    }),
  }),
});

export const {
  useGetNewsQuery,
  useGetNewsByIdQuery,
  useGetNewsBySlugQuery,
  useGetRelatedNewsQuery,
  useCreateNewsMutation,
  useUpdateNewsMutation,
  useDeleteNewsMutation,
} = newsApi;
