import { api } from '@/services/api';
import i18n from '@/config/i18n';
import { geminiService } from './geminiApi';
import {
  getProductSuggestionPrompt,
  getGeneralHelpPrompt,
} from './promptTemplates';

export interface ChatResponse {
  text: string;
  suggestions?: string[];
}

export interface ProductRecommendation {
  id: string | number;
  name: string;
  price: number;
  compareAtPrice?: number;
  thumbnail?: string;
  rating: number;
  inStock: boolean;
  discount: number;
}

export interface ChatbotResponse {
  response: string;
  suggestions?: string[];
  products?: ProductRecommendation[];
  actions?: Array<{ type: string; label: string; url?: string; data?: Record<string, any> }>;
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
}

// Phát hiện ý định đơn giản từ tin nhắn người dùng
function determineIntent(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('tìm') ||
    lowerMessage.includes('kiếm') ||
    lowerMessage.includes('mua') ||
    lowerMessage.includes('sản phẩm') ||
    lowerMessage.includes('hàng')
  ) {
    return 'product_search';
  }

  if (
    lowerMessage.includes('đơn hàng') ||
    lowerMessage.includes('đặt hàng') ||
    lowerMessage.includes('mua hàng') ||
    lowerMessage.includes('thanh toán')
  ) {
    return 'order_help';
  }

  if (
    lowerMessage.includes('trả lại') ||
    lowerMessage.includes('đổi') ||
    lowerMessage.includes('hoàn tiền') ||
    lowerMessage.includes('bảo hành')
  ) {
    return 'return_policy';
  }

  return 'general';
}

// Mock chat service - không cần backend API
const enhancedChatService = {
  async sendMessage(message: string): Promise<ChatResponse> {
    console.log('Đang xử lý tin nhắn với enhanced chat service:', message);

    // Kiểm tra xem Gemini AI có sẵn sàng không
    const geminiStatus = geminiService.getStatus();
    console.log('Trạng thái Gemini AI:', geminiStatus);

    if (geminiStatus.ready && geminiStatus.hasApiKey) {
      try {
        console.log('Đang dùng Gemini AI để tạo phản hồi...');
        const geminiResponse = await geminiService.sendMessage(message);

        return {
          text: geminiResponse.text,
          suggestions: geminiResponse.suggestions,
        };
      } catch (error: any) {
        console.error('Lỗi Gemini AI, chuyển sang chế độ mock:', error);

        // Nếu lỗi API key hoặc quota, thông báo cho user
        if (
          error.message?.includes('API key') ||
          error.message?.includes('quota')
        ) {
          return {
            text: `⚠️ ${error.message}\n\n${i18n.t('chat.errors.demoMode')}`,
            suggestions: [
              i18n.t('chat.suggestions.demoMode'),
              i18n.t('chat.suggestions.findProducts'),
              i18n.t('chat.suggestions.askPolicy'),
              i18n.t('chat.suggestions.contactSupport'),
            ],
          };
        }

        // Dự phòng dùng mock service cho các lỗi khác
        return this.getMockResponse(message);
      }
    } else {
      console.log('Gemini AI chưa sẵn sàng, dùng phản hồi mock...');

      if (!geminiStatus.hasApiKey) {
        console.log('Chưa cấu hình Gemini API key, dùng chế độ demo');
      }

      return this.getMockResponse(message);
    }
  },

  getMockResponse(message: string): ChatResponse {
    console.log('Dùng phản hồi mock cho tin nhắn:', message);

    // Thêm delay để mô phỏng thời gian xử lý thực tế
    // await new Promise((resolve) =>
    //   setTimeout(resolve, 1000 + Math.random() * 1000)
    // );

    // Tạo phản hồi mock dựa trên nội dung tin nhắn
    const intent = determineIntent(message);
    let mockResponse: ChatResponse;

    switch (intent) {
      case 'product_search':
        mockResponse = {
          text: i18n.t('chat.responses.productSearch', { query: message }),
          suggestions: [
            i18n.t('chat.suggestions.viewTshirts'),
            i18n.t('chat.suggestions.viewJeans'),
            i18n.t('chat.suggestions.viewSneakers'),
            i18n.t('chat.suggestions.findOther'),
          ],
        };
        break;
      case 'order_help':
        mockResponse = {
          text: i18n.t('chat.responses.orderHelp'),
          suggestions: [
            i18n.t('chat.suggestions.paymentMethods'),
            i18n.t('chat.suggestions.shippingFee'),
            i18n.t('chat.suggestions.deliveryTime'),
            i18n.t('chat.suggestions.discountCode'),
          ],
        };
        break;
      case 'return_policy':
        mockResponse = {
          text: i18n.t('chat.responses.returnPolicy'),
          suggestions: [
            i18n.t('chat.suggestions.returnProcess'),
            i18n.t('chat.suggestions.refund'),
            i18n.t('chat.suggestions.defectiveProduct'),
            i18n.t('chat.suggestions.customerService'),
          ],
        };
        break;
      default:
        mockResponse = {
          text: i18n.t('chat.responses.general'),
          suggestions: [
            i18n.t('chat.suggestions.findProducts'),
            i18n.t('chat.suggestions.howToOrder'),
            i18n.t('chat.suggestions.returnPolicy'),
            i18n.t('chat.suggestions.currentPromo'),
          ],
        };
    }

    return mockResponse;
  },
};

export const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    sendMessage: builder.mutation<ChatResponse, string>({
      query: (message) => ({
        url: '/chatbot/message',
        method: 'POST',
        body: { message },
      }),
      transformResponse: (response: any) => {
        return {
          text: response.data.response,
          suggestions: response.data.suggestions || [],
        };
      },
    }),
    sendChatbotMessage: builder.mutation<any, SendChatbotMessageRequest>({
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
      query: ({ productId, quantity }) => ({
        url: '/cart',
        method: 'POST',
        body: { productId, quantity },
      }),
    }),
  }),
});

export const {
  useSendMessageMutation,
  useSendChatbotMessageMutation,
  useTrackChatbotAnalyticsMutation,
  useAddToCartViaChatbotMutation,
} = chatApi;
