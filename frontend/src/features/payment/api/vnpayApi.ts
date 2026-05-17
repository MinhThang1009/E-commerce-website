/**
 * @file vnpayApi.ts
 * @layer API Client
 * @feature payment
 * @description API client functions cho feature payment
 */
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

/** Tạo URL thanh toán VNPay */
export function useCreateVNPayUrlMutation() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Response shape phụ thuộc backend payment gateway
  return useMutation<{ data?: any }, Error, { orderId: string; amount?: number; bankCode?: string }>({
    mutationFn: async (body) => {
      const res = await apiClient.post('/payments/vnpay/create-url', body);
      return res.data;
    },
  });
}
