import axios from 'axios';
import { mockProducts } from '@/data/mockProducts';
import { mockCategories } from '@/data/mockCategories';

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
    console.log('GeminiService: khởi tạo qua backend (OpenRouter)');
    this.isInitialized = true;
  }

  private getProductsContext(): string {
    // Tạo context từ dữ liệu sản phẩm (để dự phòng)
    const productsInfo = mockProducts.slice(0, 20).map((product) => ({
      id: product.id,
      name: product.name,
      price: `${product.price.toLocaleString('vi-VN')}đ`,
      category: product.categoryName || 'Không xác định',
      description: product.description,
      inStock: product.stock > 0,
    }));

    const categoriesInfo = mockCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
    }));

    return `
DANH MỤC: ${categoriesInfo.map(c => c.name).join(', ')}
SẢN PHẨM: ${productsInfo.map(p => p.name).join(', ')}
`;
  }

  async sendMessage(userMessage: string): Promise<GeminiChatResponse> {
    if (!userMessage || userMessage.trim().length === 0) {
      throw new Error('Vui lòng nhập câu hỏi');
    }

    const cleanMessage = userMessage.trim();

    try {
      console.log('Đang gửi request đến backend AI...');

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
        text: data.response || data.text || 'Xin lỗi, tôi không nhận được phản hồi.',
        suggestions: data.suggestions || this.generateSuggestions(cleanMessage, data.response || ''),
      };
    } catch (error: any) {
      console.error('Lỗi AI Service:', error);

      return {
        text: 'Xin chào! Hệ thống AI đang bận một chút. Bạn có thể thử lại sau hoặc liên hệ hỗ trợ trực tiếp nhé.',
        suggestions: ['Tìm sản phẩm', 'Chính sách đổi trả', 'Hỗ trợ trực tiếp']
      };
    }
  }

  private generateSuggestions(userMessage: string, aiResponse: string): string[] {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('tìm') || lowerMessage.includes('mua')) {
      return ['Xem sản phẩm mới', 'Khuyến mãi hot', 'Hướng dẫn mua hàng'];
    }

    return ['Tìm sản phẩm', 'Xem khuyến mãi', 'Liên hệ hỗ trợ'];
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
