/**
 * @file message.types.ts
 * @layer Type
 * @feature ai
 * @description TypeScript type definitions cho feature ai
 */
import { ProductRecommendation, ChatAction } from '../services/chatbot-api';

// Định nghĩa kiểu dữ liệu cho tin nhắn
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  isLoading?: boolean;
  suggestions?: string[];
  products?: ProductRecommendation[];
  actions?: ChatAction[];
}
