import { api } from './api';

export const momoApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createMomoUrl: builder.mutation<any, { orderId: string }>({
      query: (body) => ({
        url: '/payments/momo/create-url',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const { useCreateMomoUrlMutation } = momoApi;

