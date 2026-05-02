import { api } from './api';

export const loyaltyApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLoyaltyInfo: builder.query<any, { page?: number; limit?: number } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params && typeof params === 'object') {
          if ('page' in params && params.page) queryParams.append('page', params.page.toString());
          if ('limit' in params && params.limit) queryParams.append('limit', params.limit.toString());
        }

        return {
          url: `/loyalty?${queryParams.toString()}`,
          method: 'GET',
        };
      },
      providesTags: ['User'],
    }),
  }),
});

export const { useGetLoyaltyInfoQuery } = loyaltyApi;
