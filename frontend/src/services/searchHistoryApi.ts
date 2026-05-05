import { api } from './api';

export const searchHistoryApi = api.injectEndpoints({
  endpoints: (builder) => ({
    saveSearch: builder.mutation<any, { keyword: string; resultsCount?: number; sessionId?: string }>({
      query: (body) => ({
        url: '/search-histories',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),

    getSearchHistory: builder.query<any, { limit?: number } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        return {
          url: `/search-histories?${queryParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: ['User'],
    }),

    deleteSearchHistory: builder.mutation<any, string>({
      query: (id) => ({
        url: `/search-histories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['User'],
    }),

    clearAllSearchHistory: builder.mutation<any, void>({
      query: () => ({
        url: '/search-histories',
        method: 'DELETE',
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useSaveSearchMutation,
  useGetSearchHistoryQuery,
  useDeleteSearchHistoryMutation,
  useClearAllSearchHistoryMutation,
} = searchHistoryApi;

