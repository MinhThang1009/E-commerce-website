import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

export interface ChatResponse {
  text: string;
  suggestions?: string[];
}

export interface ProductRecommendation {
  id: string | number;
  name: string;
  slug?: string;
  price: number;
  compareAtPrice?: number;
  thumbnail?: string;
  rating: number | null;
  inStock: boolean;
  discount: number;
  stockQuantity?: number;
}

export interface ChatAction {
  type: string;
  label: string;
  url?: string;
  data?: Record<string, any>;
}

export interface ChatbotResponse {
  response: string;
  suggestions?: string[];
  products?: ProductRecommendation[];
  actions?: ChatAction[];
  sessionId?: string;
}

export interface SendChatbotMessageRequest {
  message: string;
  userId?: number | string;
  sessionId: string;
  context?: Record<string, any>;
}

export interface TrackAnalyticsRequest {
  event: string;
  userId?: number | string;
  sessionId: string;
  productId?: string | number;
  value?: number;
  metadata?: Record<string, any>;
}

export interface AddToCartViaChatbotRequest {
  productId: string | number;
  quantity: number;
  sessionId: string;
  variantId?: number;
}

// === Mutation Hooks ===

export function useSendChatbotMessageMutation() {
  return useMutation<ChatbotResponse, Error, SendChatbotMessageRequest>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/chatbot/message', body);
      return data;
    },
  });
}

export function useTrackChatbotAnalyticsMutation() {
  return useMutation<any, Error, TrackAnalyticsRequest>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post('/chatbot/analytics', body);
      return data;
    },
  });
}

export function useAddToCartViaChatbotMutation() {
  const queryClient = useQueryClient();
  return useMutation<any, Error, AddToCartViaChatbotRequest>({
    mutationFn: async ({ productId, quantity, sessionId, variantId }) => {
      const { data } = await apiClient.post('/chatbot/cart/add', {
        productId, quantity, sessionId, variantId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}
