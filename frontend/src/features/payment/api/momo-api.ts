/**
 * @file momoApi.ts
 * @layer API Client
 * @feature payment
 * @description API client functions cho feature payment
 */
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

/** Tạo URL thanh toán MoMo */
export function useCreateMomoUrlMutation() {
  return useMutation<{ data?: { payUrl?: string } }, Error, { orderId: string }>({
    mutationFn: async (body) => {
      const res = await apiClient.post('/payments/momo/create-url', body);
      return res.data;
    },
  });
}
