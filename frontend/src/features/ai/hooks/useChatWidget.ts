import { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { CHAT_WIDGET_CONFIG, getGreetingMessage } from '../constants/chatWidget';
import { Message } from '../components/ChatWidget';
import {
  addMessage as addMessageAction,
  setMessages as setMessagesAction,
} from '../store/chatSlice';
import type { RootState } from '@/store';

export const useChatWidget = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(CHAT_WIDGET_CONFIG.DEFAULT_SIZE);

  // Messages từ Redux — single source of truth, persist qua navigation
  const messages = useSelector((state: RootState) => state.chat.messages) as Message[];

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
    } catch {
      // Bỏ qua lỗi parse localStorage
    }
  }, []);

  // Khởi tạo tin nhắn chào mừng nếu chưa có lịch sử
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = {
        ...getGreetingMessage(),
        id: Date.now().toString(),
      };
      dispatch(setMessagesAction([greeting]));
    }
  }, [messages.length, dispatch]);

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
    dispatch(addMessageAction(message));
  }, [dispatch]);

  const removeMessage = useCallback((messageId: string) => {
    dispatch(setMessagesAction(messages.filter((msg) => msg.id !== messageId)));
  }, [dispatch, messages]);

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<Message>) => {
      dispatch(setMessagesAction(
        messages.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
      ));
    },
    [dispatch, messages]
  );

  const setMessages = useCallback((newMessages: Message[]) => {
    dispatch(setMessagesAction(newMessages));
  }, [dispatch]);

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
  }, [size, addMessage, t]);

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
