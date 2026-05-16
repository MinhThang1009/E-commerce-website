import { useMutation } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

/** Tạo URL thanh toán MoMo */
export function useCreateMomoUrlMutation() {
  return useMutation<any, Error, { orderId: string }>({
    mutationFn: async (body) => {
      const res = await apiClient.post('/payments/momo/create-url', body);
      return res.data;
    },
  });
}
