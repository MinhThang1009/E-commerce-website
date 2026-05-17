/**
 * @file useChatWidget.ts
 * @layer Hook
 * @feature ai
 * @description Custom React hook cho feature ai
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CHAT_WIDGET_CONFIG, getGreetingMessage } from '../constants/chatWidget';
import { Message } from '../components/ChatWidget';
import { useChatStore } from '@/stores/chatStore';

export const useChatWidget = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(CHAT_WIDGET_CONFIG.DEFAULT_SIZE);

  // Messages từ Zustand — single source of truth, persist qua navigation
  const messages = useChatStore((s) => s.messages) as Message[];
  const storeAddMessage = useChatStore((s) => s.addMessage);
  const storeSetMessages = useChatStore((s) => s.setMessages);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWidgetRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    try {
      const savedSize = localStorage.getItem(CHAT_WIDGET_CONFIG.STORAGE_KEYS.SIZE);
      if (savedSize) {
        setSize(JSON.parse(savedSize));
      }
    } catch {
      // Bỏ qua lỗi parse localStorage
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      const greeting = {
        ...getGreetingMessage(),
        id: Date.now().toString(),
      };
      storeSetMessages([greeting]);
    }
  }, [messages.length, storeSetMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

      if (isOpen) return;

      setIsOpen(true);
      isOpenRef.current = true;
    },
    [isOpen],
  );

  const closeChat = useCallback((event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setIsOpen(false);
    isOpenRef.current = false;
    document.body.classList.remove('chat-widget-open');
  }, []);

  const addMessage = useCallback(
    (message: Message) => {
      storeAddMessage(message);
    },
    [storeAddMessage],
  );

  const removeMessage = useCallback(
    (messageId: string) => {
      storeSetMessages(messages.filter((msg) => msg.id !== messageId));
    },
    [storeSetMessages, messages],
  );

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<Message>) => {
      storeSetMessages(
        messages.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg)),
      );
    },
    [storeSetMessages, messages],
  );

  const setMessages = useCallback(
    (newMessages: Message[]) => {
      storeSetMessages(newMessages);
    },
    [storeSetMessages],
  );

  const applyChanges = useCallback(() => {
    localStorage.setItem(CHAT_WIDGET_CONFIG.STORAGE_KEYS.SIZE, JSON.stringify(size));

    const confirmMessage: Message = {
      id: Date.now().toString(),
      text: t('chat.sizeApplied'),
      sender: 'ai',
      suggestions: [t('chat.suggestions.thanks'), t('chat.suggestions.customizeMore')],
    };

    addMessage(confirmMessage);
  }, [size, addMessage, t]);

  return {
    isOpen,
    position,
    size,
    messages,

    messagesEndRef,
    chatWidgetRef,
    isOpenRef,

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
