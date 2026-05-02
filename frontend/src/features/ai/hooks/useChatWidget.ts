import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CHAT_WIDGET_CONFIG, getGreetingMessage } from '../constants/chatWidget';
import { Message } from '../components/ChatWidget';

export const useChatWidget = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(CHAT_WIDGET_CONFIG.DEFAULT_SIZE);
  const [messages, setMessages] = useState<Message[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWidgetRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);

  // Tải kích thước đã lưu từ localStorage
  useEffect(() => {
    try {
      const savedSize = localStorage.getItem(
        CHAT_WIDGET_CONFIG.STORAGE_KEYS.SIZE
      );
      if (savedSize) {
        setSize(JSON.parse(savedSize));
      }
    } catch (error) {
      console.error('Lỗi khi tải kích thước chat widget đã lưu:', error);
    }
  }, []);

  // Khởi tạo tin nhắn chào mừng
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = {
        ...getGreetingMessage(),
        id: Date.now().toString(),
      };
      setMessages([greeting]);
    }
  }, [messages.length]);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Xử lý thay đổi trạng thái mở/đóng
  useEffect(() => {
    isOpenRef.current = isOpen;

    if (isOpen) {
      document.body.classList.add('chat-widget-open');

      return () => {
        document.body.classList.remove('chat-widget-open');
      };
    } else {
      document.body.classList.remove('chat-widget-open');
    }
  }, [isOpen]);

  const toggleChat = useCallback(
    (event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }

      if (isOpen) return; // Chỉ cho phép mở, không cho phép đóng qua toggle

      setIsOpen(true);
      isOpenRef.current = true;
    },
    [isOpen]
  );

  const closeChat = useCallback((event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setIsOpen(false);
    isOpenRef.current = false;
    document.body.classList.remove('chat-widget-open');
  }, []);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  }, []);

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
      );
    },
    []
  );

  const applyChanges = useCallback(() => {
    localStorage.setItem(
      CHAT_WIDGET_CONFIG.STORAGE_KEYS.SIZE,
      JSON.stringify(size)
    );

    const confirmMessage: Message = {
      id: Date.now().toString(),
      text: t('chat.sizeApplied'),
      sender: 'ai',
      suggestions: [t('chat.suggestions.thanks'), t('chat.suggestions.customizeMore')],
    };

    addMessage(confirmMessage);
  }, [size, addMessage]);

  return {
    // State (trạng thái)
    isOpen,
    position,
    size,
    messages,

    // Refs
    messagesEndRef,
    chatWidgetRef,
    isOpenRef,

    // Actions (hành động)
    toggleChat,
    closeChat,
    addMessage,
    removeMessage,
    updateMessage,
    applyChanges,
    setSize,
    setPosition,
    setMessages,
  };
};
