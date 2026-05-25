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
    // Register session với server để terminal --watch biết session hiện tại ngay lập tức
    if (sessionId) {
      fetch('/api/chatbot/session/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {}); // fire-and-forget
    }
  }, [sessionId]);

  const { mutateAsync: sendChatbotMessage, isPending: isLoading, reset: resetMutation } = useSendChatbotMessageMutation();

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
    resetMutation();           // reset isLoading → ẩn typing indicator ngay
    clearMessagesAction(createSessionId());
  };

  // Persist demo mode trong sessionStorage — tính 1 lần khi mount, không tính lại mỗi render
  // ?demo=true  → bật, ghi sessionStorage (navigate sang trang khác vẫn giữ)
  // ?demo=false → tắt, xóa sessionStorage
  const [isDemoMode] = useState<boolean>(() => {
    const param = new URLSearchParams(window.location.search).get('demo');
    if (param === 'true')  { sessionStorage.setItem('demo_mode', 'true');  return true; }
    if (param === 'false') { sessionStorage.removeItem('demo_mode');        return false; }
    return sessionStorage.getItem('demo_mode') === 'true';
  });
  // Patch window.history để inject ?demo=true vào MỌI navigation (kể cả <Link>)
  // Cleanup khi component unmount hoặc isDemoMode = false
  useEffect(() => {
    if (!isDemoMode) return;

    const injectDemo = (url: string | URL | null | undefined): string | URL | null | undefined => {
      if (!url) return url;
      const s = url.toString();
      const [path, qs] = s.split('?');
      const params = new URLSearchParams(qs || '');
      if (params.get('demo') === 'true') return url; // đã có, không thay đổi
      params.set('demo', 'true');
      return `${path}?${params.toString()}`;
    };

    const origPush    = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);

    window.history.pushState = (state, title, url) =>
      origPush(state, title, injectDemo(url) as string);
    window.history.replaceState = (state, title, url) =>
      origReplace(state, title, injectDemo(url) as string);

    return () => {
      window.history.pushState    = origPush;
      window.history.replaceState = origReplace;
    };
  }, [isDemoMode]);

  // Auto-poll khi demo mode bật — cứ 3s fetch DB, cập nhật khi DB có TIN MỚI
  const lastDbCountRef = useRef(0);
  useEffect(() => {
    if (!isDemoMode || !sessionId) return;
    // Khởi tạo lastDbCountRef với số messages hiện tại để không reload ngay
    lastDbCountRef.current = messagesRef.current.filter(m => !m.isLoading).length;

    const poll = async () => {
      // Bỏ qua poll khi đang chờ response — tránh setMessagesAction 2 lần → flicker
      if (messagesRef.current.some(m => m.isLoading)) return;
      try {
        const res = await fetch(`/api/chatbot/session/${sessionId}/messages`);
        const json = await res.json();
        const dbMsgs = json?.data?.messages ?? [];
        if (dbMsgs.length > lastDbCountRef.current) {
          lastDbCountRef.current = dbMsgs.length;
          setMessagesAction(dbMsgs.map(dbMsgToMessage));
        }
      } catch { /* silent */ }
    };
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [isDemoMode, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper: chuyển DB message → Message (bao gồm products/suggestions từ metadata)
  const dbMsgToMessage = (m: { role: string; content: string; metadata?: string; createdAt: string }, idx: number): Message => {
    const meta = m.metadata ? (() => { try { return JSON.parse(m.metadata!); } catch { return null; } })() : null;
    return {
      id: `${new Date(m.createdAt).getTime()}_${idx}`,
      text: m.content,
      sender: m.role === 'user' ? ('user' as const) : ('ai' as const),
      ...(meta?.products?.length    ? { products: meta.products }       : {}),
      ...(meta?.suggestions?.length ? { suggestions: meta.suggestions } : {}),
    };
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const handleLoadHistory = async () => {
    if (isSyncing) return;

    // Hỏi session ID — mặc định là session hiện tại của UI
    const input = window.prompt('Session ID cần đồng bộ:', sessionId ?? '');
    if (!input?.trim()) return;

    const targetSession = input.trim();
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/chatbot/session/${targetSession}/messages`);
      const json = await res.json();
      if (json.status === 'success' && json.data.messages.length > 0) {
        const loaded: Message[] = json.data.messages.map(dbMsgToMessage);
        setMessagesAction(loaded);
      } else {
        window.alert('Không tìm thấy lịch sử cho session này.');
      }
    } catch { /* silent */ } finally {
      setIsSyncing(false);
    }
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
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white/80 shadow-md backdrop-blur-sm bg-gradient-to-br from-emerald-400 to-green-500">
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
            <ChatHeader
              onClose={toggleChat}
              onClearChat={handleClearChat}
              onLoadHistory={isDemoMode ? handleLoadHistory : undefined}
              isSyncing={isSyncing}
            />

            <ChatMessages
              messages={messages}
              onSuggestionClick={handleSuggestionClick}
              messagesEndRef={messagesEndRef}
              user={user}
              isLoading={isLoading}
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
