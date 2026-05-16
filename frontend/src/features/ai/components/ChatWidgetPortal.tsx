import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore, saveMessagesToStorage, saveSessionIdToStorage, createSessionId } from '@/stores/chatStore';
import { Message } from '../types/Message';
import { useSendChatbotMessageMutation, ChatbotResponse } from '../services/chatbotApi';

type ChatbotApiEnvelope = { status: string; data: ChatbotResponse; message?: string };
import { geminiService } from '../services/geminiApi';
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
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    saveMessagesToStorage(messages);
  }, [messages]);

  useEffect(() => {
    saveSessionIdToStorage(sessionId);
  }, [sessionId]);

  const { mutateAsync: sendChatbotMessage, isPending: isLoading } = useSendChatbotMessageMutation();

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greetingText = isAuthenticated && user
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
        setTimeout(() => reject(new Error('Request timeout')), 10000);
      });

      const response = await Promise.race([
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
      ]) as ChatbotApiEnvelope;

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
      const status = error && typeof error === 'object' && 'status' in error
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
      <button
        onClick={toggleChat}
        className="group relative bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 hover:from-primary-600 hover:via-primary-700 hover:to-primary-800 text-white rounded-full p-4 shadow-[0_8px_25px_rgba(59,130,246,0.35)] hover:shadow-[0_12px_30px_rgba(59,130,246,0.45)] transform hover:scale-110 transition-all duration-300 flex items-center justify-center ring-4 ring-primary-500/20 hover:ring-primary-500/40"
        aria-label={isOpen ? t('chat.closeChat') : t('chat.openChat')}
      >
        {!isOpen && (
          <>
            <div
              className="absolute inset-0 rounded-full bg-primary-400 animate-ping opacity-25"
              style={{ animationDuration: '2s' }}
            ></div>
            <div
              className="absolute inset-0 rounded-full bg-primary-300 animate-ping opacity-15 animation-delay-75"
              style={{ animationDuration: '2.5s' }}
            ></div>
          </>
        )}

        <div
          className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white shadow-lg ${
            geminiService.isReady()
              ? 'bg-gradient-to-r from-green-400 to-green-500'
              : 'bg-gradient-to-r from-yellow-400 to-orange-500'
          }`}
        >
          <div
            className={`absolute inset-0.5 rounded-full ${
              geminiService.isReady()
                ? 'bg-green-300 animate-pulse'
                : 'bg-yellow-300 animate-pulse'
            }`}
            style={{ animationDuration: '1.5s' }}
          ></div>
        </div>

        {isOpen ? (
          <CloseIcon className="h-7 w-7 transform transition-transform duration-300 rotate-0 hover:rotate-90" />
        ) : (
          <div className="relative">
            <ChatIcon className="transform transition-transform duration-300 group-hover:scale-110" />
          </div>
        )}
      </button>

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
            className="fixed inset-x-4 bottom-20 sm:absolute sm:bottom-20 sm:right-0 sm:inset-x-auto w-auto sm:w-96 md:max-w-md lg:max-w-lg xl:max-w-xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col border border-white/20 dark:border-neutral-700/30 transform animate-in slide-in-from-bottom-4 duration-500 max-h-[85vh] sm:max-h-[75vh] md:max-h-[70vh] chat-widget-active z-[9999] hover:shadow-[0_10px_40px_rgba(0,0,0,0.18)] transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatHeader onClose={toggleChat} geminiService={geminiService} />

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
