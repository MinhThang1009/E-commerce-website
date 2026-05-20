/**
 * @file vnpayApi.ts
 * @layer API Client
 * @feature payment
 * @description API client functions cho feature payment
 */
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

/** Tạo URL thanh toán VNPay */
export function useCreateVNPayUrlMutation() {
  return useMutation<
    { data?: { paymentUrl?: string } },
    Error,
    { orderId: string; amount?: number; bankCode?: string }
  >({
    mutationFn: async (body) => {
      const res = await apiClient.post('/payments/vnpay/create-url', body);
      return res.data;
    },
  });
}
