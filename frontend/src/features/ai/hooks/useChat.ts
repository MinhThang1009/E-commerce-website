import { useState, useCallback } from 'react';
import { Message } from '../types/Message';
import { useSendMessageMutation } from '../services/chatbotApi';

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sendMessageMutation, { isLoading }] = useSendMessageMutation();

  // Thêm tin nhắn chào mừng ban đầu
  const initChat = useCallback((userName?: string) => {
    const greeting: Message = {
      id: Date.now().toString(),
      text: `Xin chào${userName ? ` ${userName}` : ''}! Tôi là trợ lý mua sắm AI. Tôi có thể giúp gì cho bạn hôm nay?`,
      sender: 'ai',
      suggestions: [
        'Tìm sản phẩm mới',
        'Xem khuyến mãi',
        'Cách đặt hàng',
        'Chính sách đổi trả',
      ],
    };

    setMessages([greeting]);
  }, []);

  // Gửi tin nhắn
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Thêm tin nhắn của người dùng
      const userMessage: Message = {
        id: Date.now().toString(),
        text,
        sender: 'user',
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        // Gọi API
        const response = await sendMessageMutation(text).unwrap();

        // Thêm phản hồi từ AI
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: response.text,
          sender: 'ai',
          suggestions: response.suggestions,
        };

        setMessages((prev) => [...prev, aiMessage]);
        return true;
      } catch (error) {
        console.error('Lỗi khi gửi tin nhắn:', error);

        // Thêm tin nhắn lỗi
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.',
          sender: 'ai',
        };

        setMessages((prev) => [...prev, errorMessage]);
        return false;
      }
    },
    [sendMessageMutation]
  );

  // Xóa lịch sử chat
  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    initChat,
  };
};

export default useChat;
