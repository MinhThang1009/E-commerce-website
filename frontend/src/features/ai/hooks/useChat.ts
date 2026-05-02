import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '../types/Message';
import { useSendMessageMutation } from '../services/chatbotApi';

export const useChat = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sendMessageMutation, { isLoading }] = useSendMessageMutation();

  // Thêm tin nhắn chào mừng ban đầu
  const initChat = useCallback((userName?: string) => {
    const greeting: Message = {
      id: Date.now().toString(),
      text: userName
        ? t('chat.greetingWithName', { name: userName })
        : t('chat.greeting'),
      sender: 'ai',
      suggestions: [
        t('chat.suggestions.findProducts'),
        t('chat.suggestions.viewPromotions'),
        t('chat.suggestions.howToOrder'),
        t('chat.suggestions.returnPolicy'),
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
          text: t('chat.errors.general'),
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
