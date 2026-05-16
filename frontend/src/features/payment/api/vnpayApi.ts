import { useMutation } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

/** Tạo URL thanh toán VNPay */
export function useCreateVNPayUrlMutation() {
  return useMutation<
    any,
    Error,
    { orderId: string; amount?: number; bankCode?: string }
  >({
    mutationFn: async (body) => {
      const res = await apiClient.post('/payments/vnpay/create-url', body);
      return res.data;
    },
  });
}
