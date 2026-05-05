import { api } from './api';

export const vnpayApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createVNPayUrl: builder.mutation<any, { orderId: string; amount?: number; bankCode?: string }>({
      query: (body) => ({
        url: '/payments/vnpay/create-url',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const { useCreateVNPayUrlMutation } = vnpayApi;

