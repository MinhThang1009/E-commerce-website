/**
 * @file contactApi.ts
 * @layer API Client
 * @feature content
 * @description API client functions cho feature content
 */
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface FeedbackRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  content: string;
}

export interface ContactResponse {
  status: string;
  message: string;
  data?: unknown;
}

// === Mutation Hooks ===

export function useSendFeedbackMutation() {
  return useMutation<ContactResponse, Error, FeedbackRequest>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/contact/feedback', body);
      return data;
    },
  });
}
