import { api } from '@/services/api';

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

export const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    sendChatbotMessage: builder.mutation<ChatbotResponse, SendChatbotMessageRequest>({
      query: (body) => ({
        url: '/chatbot/message',
        method: 'POST',
        body,
      }),
    }),
    trackChatbotAnalytics: builder.mutation<any, TrackAnalyticsRequest>({
      query: (body) => ({
        url: '/chatbot/analytics',
        method: 'POST',
        body,
      }),
    }),
    addToCartViaChatbot: builder.mutation<any, AddToCartViaChatbotRequest>({
      query: ({ productId, quantity, sessionId, variantId }) => ({
        url: '/chatbot/cart/add',
        method: 'POST',
        body: { productId, quantity, sessionId, variantId },
      }),
      invalidatesTags: ['Cart', 'CartCount'],
    }),
  }),
});

export const {
  useSendChatbotMessageMutation,
  useTrackChatbotAnalyticsMutation,
  useAddToCartViaChatbotMutation,
} = chatApi;
