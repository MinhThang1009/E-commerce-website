/**
 * @file ChatWidgetPortal.tsx
 * @layer Component
 * @feature ai
 * @description UI component cho feature ai
 */
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth-store';
import {
  useChatStore,
  saveMessagesToStorage,
  saveSessionIdToStorage,
  createSessionId,
} from '@/stores/chat-store';
import { Message } from '../types/message.types';
import { useSendChatbotMessageMutation, ChatbotResponse } from '../api/chatbot-api';

type ChatbotApiEnvelope = { status: string; data: ChatbotResponse; message?: string };
import { chatbotService } from '../api/chatbot-service';
import ChatHeader from './ChatHeader';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import ChatIcon from './icons/ChatIcon';
import CloseIcon from './icons/CloseIcon';
import './ChatWidget.css';

const ChatWidgetPortal: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user } = useAuthStore();

  // Lấy messages và sessionId từ Zustand
  const messages = useChatStore((s) => s.messages);
  const sessionId = useChatStore((s) => s.sessionId);
  const addMessageAction = useChatStore((s) => s.addMessage);
  const setMessagesAction = useChatStore((s) => s.setMessages);
  const clearMessagesAction = useChatStore((s) => s.clearMessages);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    saveMessagesToStorage(messages);
  }, [messages]);

  useEffect(() => {
    saveSessionIdToStorage(sessionId);
  }, [sessionId]);

  const { mutateAsync: sendChatbotMessage, isPending: isLoading } = useSendChatbotMessageMutation();

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greetingText =
        isAuthenticated && user
          ? t('chat.greetingWithName', { name: user.name })
          : t('chat.greeting');

      const greeting = {
        id: Date.now().toString(),
        text: greetingText,
        sender: 'ai' as const,
        suggestions: [
          t('chat.suggestions.hotProducts'),
          t('chat.suggestions.viewPromotions'),
          t('chat.suggestions.howToOrder'),
          t('chat.suggestions.returnPolicy'),
        ],
      };
      setMessagesAction([greeting]);
    }
  }, [isOpen, messages.length, isAuthenticated, user, t, setMessagesAction]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('chat-widget-open');
    } else {
      document.body.classList.remove('chat-widget-open');
    }

    return () => {
      document.body.classList.remove('chat-widget-open');
    };
  }, [isOpen]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
    };

    addMessageAction(userMessage);

    const loadingId = (Date.now() + 1).toString();
    addMessageAction({
      id: loadingId,
      text: '',
      sender: 'ai',
      isLoading: true,
    });

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 25000);
      });

      const response = (await Promise.race([
        sendChatbotMessage({
          message: text,
          userId: user?.id,
          sessionId,
          context: {
            isAuthenticated,
            currentPage: window.location.pathname,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        }),
        timeoutPromise,
      ])) as ChatbotApiEnvelope;

      if (response.status === 'success' && response.data) {
        const nextMessages = messagesRef.current
          .filter((msg) => msg.id !== loadingId)
          .concat({
            id: (Date.now() + 2).toString(),
            text: response.data.response,
            sender: 'ai' as const,
            suggestions: response.data.suggestions || [
              t('chat.suggestions.findMore'),
              t('chat.suggestions.viewCart'),
              t('chat.suggestions.askMore'),
            ],
            products: response.data.products,
            actions: response.data.actions,
          });
        setMessagesAction(nextMessages);
      } else {
        throw new Error(response.message || t('errors.unknown'));
      }
    } catch (error) {
      let errorMessage = t('chat.errors.general');
      const errMsg = error instanceof Error ? error.message : undefined;
      const status =
        error && typeof error === 'object' && 'status' in error
          ? (error as Record<string, unknown>).status
          : undefined;

      if (errMsg === 'Request timeout') {
        errorMessage = t('chat.errors.timeout');
      } else if (status === 404) {
        errorMessage = t('chat.errors.notFound');
      } else if (status === 429) {
        errorMessage = t('chat.errors.tooManyRequests');
      } else if (typeof status === 'number' && status >= 500) {
        errorMessage = t('chat.errors.serverError');
      }

      const errorMessages = messagesRef.current
        .filter((msg) => msg.id !== loadingId)
        .concat({
          id: (Date.now() + 2).toString(),
          text: errorMessage,
          sender: 'ai' as const,
          suggestions: [
            t('chat.suggestions.tryAgain'),
            t('chat.suggestions.findProducts'),
            t('chat.suggestions.contactSupport'),
          ],
        });
      setMessagesAction(errorMessages);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleClearChat = () => {
    clearMessagesAction(createSessionId());
  };

  const toggleChat = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 select-none">
      <div className="relative">
        {!isOpen && (
          <>
            <div
              className="absolute inset-0 rounded-full bg-primary-500 animate-ping opacity-40"
              style={{ animationDuration: '1.4s' }}
            />
            <div
              className="absolute inset-0 rounded-full bg-primary-400 animate-ping opacity-25"
              style={{ animationDuration: '1.8s', animationDelay: '0.3s' }}
            />
            <div
              className="absolute inset-0 rounded-full bg-primary-300 animate-ping opacity-15"
              style={{ animationDuration: '2.2s', animationDelay: '0.7s' }}
            />
          </>
        )}
        <button
          onClick={toggleChat}
          className="relative glass-toggle text-white rounded-full p-4 flex items-center justify-center"
          aria-label={isOpen ? t('chat.closeChat') : t('chat.openChat')}
        >
          <div
            className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white/80 shadow-md backdrop-blur-sm ${
              chatbotService.isReady()
                ? 'bg-gradient-to-br from-emerald-400 to-green-500'
                : 'bg-gradient-to-br from-amber-400 to-orange-500'
            }`}
          >
            <div className="absolute inset-0.5 rounded-full bg-white/30 animate-pulse" />
          </div>

          <div
            className={`relative transition-all duration-300 ${isOpen ? 'rotate-90 scale-90' : 'rotate-0 scale-100'}`}
          >
            {isOpen ? (
              <CloseIcon className="h-6 w-6" />
            ) : (
              <ChatIcon className="transition-transform duration-300" />
            )}
          </div>
        </button>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/5 z-[9998]"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                toggleChat();
              }
            }}
          />

          <div
            ref={chatContainerRef}
            className="glass-widget fixed inset-x-4 bottom-20 sm:absolute sm:bottom-20 sm:right-0 sm:inset-x-auto w-auto sm:w-96 md:max-w-md rounded-3xl overflow-hidden flex flex-col chat-widget-active z-[9999] h-[75vh] max-h-[680px] min-h-[480px] sm:h-[680px] sm:max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatHeader onClose={toggleChat} chatbotService={chatbotService} />

            <ChatMessages
              messages={messages}
              onSuggestionClick={handleSuggestionClick}
              messagesEndRef={messagesEndRef}
              user={user}
            />

            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onClearChat={handleClearChat}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ChatWidgetPortal;
