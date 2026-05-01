import { api } from './api';

export const vnpayApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createVNPayUrl: builder.mutation<any, { orderId: string }>({
      query: (body) => ({
        url: '/payment/vnpay/create-url',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const { useCreateVNPayUrlMutation } = vnpayApi;
