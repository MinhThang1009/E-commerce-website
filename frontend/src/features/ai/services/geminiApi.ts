import axios from 'axios';
import i18n from '@/config/i18n';
// Cấu hình API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888/api';

export interface GeminiChatResponse {
  text: string;
  suggestions?: string[];
}

class GeminiService {
  private isInitialized = false;

  constructor() {
    this.initializeModel();
  }

  private async initializeModel() {
    // Hiện dùng chat qua backend (OpenRouter)
    this.isInitialized = true;
  }

  async sendMessage(userMessage: string): Promise<GeminiChatResponse> {
    if (!userMessage || userMessage.trim().length === 0) {
      throw new Error(i18n.t('chat.errors.emptyMessage'));
    }

    const cleanMessage = userMessage.trim();

    try {

      const response = await axios.post(`${API_BASE_URL}/chatbot/message`, {
        message: cleanMessage
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = response.data.data;

      return {
        text: data.response || data.text || i18n.t('chat.errors.noResponse'),
        suggestions: data.suggestions || this.generateSuggestions(cleanMessage, data.response || ''),
      };
    } catch (error: any) {
      console.error('Lỗi AI Service:', error);

      return {
        text: i18n.t('chat.errors.busy'),
        suggestions: [
          i18n.t('chat.suggestions.findProducts'),
          i18n.t('chat.suggestions.returnPolicy'),
          i18n.t('chat.suggestions.directSupport'),
        ],
      };
    }
  }

  private generateSuggestions(userMessage: string, aiResponse: string): string[] {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('tìm') || lowerMessage.includes('mua')) {
      return [
        i18n.t('chat.suggestions.newProducts'),
        i18n.t('chat.suggestions.hotPromo'),
        i18n.t('chat.suggestions.buyingGuide'),
      ];
    }

    return [
      i18n.t('chat.suggestions.findProducts'),
      i18n.t('chat.suggestions.viewPromotions'),
      i18n.t('chat.suggestions.contactSupport'),
    ];
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getStatus(): { ready: boolean; hasApiKey: boolean; error?: string } {
    return {
      ready: this.isInitialized,
      hasApiKey: true, // Luôn true vì xác thực qua backend
    };
  }
}

// Export instance duy nhất (singleton)
export const geminiService = new GeminiService();
export default geminiService;

