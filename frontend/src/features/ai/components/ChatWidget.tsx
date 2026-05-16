import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { Rnd } from 'react-rnd';

import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ChatSuggestions from './ChatSuggestions';
import ChatProductList from './ChatProductList';
import ChatToggleButton from './ChatToggleButton';
import ChatHeaderContent from './ChatHeaderContent';
import ChatQuickActions from './ChatQuickActions';
import ChatEmptyState from './ChatEmptyState';
import ChatResizeIndicator from './ChatResizeIndicator';

import { VerifiedIcon, TrashIcon, HelpIcon } from './icons';

import {
  useSendChatbotMessageMutation,
  useTrackChatbotAnalyticsMutation,
  ChatbotResponse,
  ProductRecommendation,
} from '../services/chatbotApi';

import { useChatWidget } from '../hooks/useChatWidget';
import {
  CHAT_WIDGET_CONFIG,
  RESIZE_HANDLE_STYLES,
  RESIZE_HANDLE_CLASSES,
} from '../constants/chatWidget';

import './ChatWidget.css';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  isLoading?: boolean;
  suggestions?: string[];
  products?: ProductRecommendation[];
  actions?: Array<{
    type: string;
    label: string;
    url?: string;
    data?: Record<string, unknown>;
  }>;
}

const ChatWidget: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const {
    isOpen,
    size,
    messages,
    messagesEndRef,
    chatWidgetRef,
    toggleChat,
    closeChat,
    addMessage,
    removeMessage,
    applyChanges,
    setSize,
    setMessages,
  } = useChatWidget();

  const { mutateAsync: sendMessage, isPending: isLoading } = useSendChatbotMessageMutation();
  const { mutateAsync: trackAnalytics } = useTrackChatbotAnalyticsMutation();

  const [sessionId] = useState(
    () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
    };

    addMessage(userMessage);

    const loadingId = (Date.now() + 1).toString();
    addMessage({
      id: loadingId,
      text: '',
      sender: 'ai',
      isLoading: true,
    });

    try {
      await trackAnalytics({
        event: 'message_sent',
        userId: user?.id,
        sessionId,
        metadata: { message: text },
      });

      const context = {
        currentUrl: window.location.href,
        currentPage: window.location.pathname,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      };

      const apiResponse = await sendMessage({
        message: text,
        userId: user?.id,
        sessionId,
        context,
      });

      let response: ChatbotResponse;
      const apiResult = apiResponse as unknown as Record<string, unknown>;
      if (apiResult.status === 'success' && apiResult.data) {
        const responseData = apiResult.data as Record<string, unknown>;
        response = {
          response: responseData.response as string,
          suggestions: responseData.suggestions as string[] | undefined,
          products: responseData.products as ProductRecommendation[] | undefined,
          actions: responseData.actions as ChatbotResponse['actions'],
          sessionId: responseData.sessionId as string | undefined,
        };
      } else {
        response = apiResponse as unknown as ChatbotResponse;
      }

      removeMessage(loadingId);
      addMessage({
        id: (Date.now() + 2).toString(),
        text: response.response,
        sender: 'ai',
        suggestions: response.suggestions,
        products: response.products,
        actions: response.actions,
      });
    } catch (error) {
      console.error('Lỗi khi gửi tin nhắn:', error);

      let errorMessage = t('chat.errors.general');
      const status = error && typeof error === 'object' && 'status' in error
        ? (error as Record<string, unknown>).status
        : undefined;

      if (status === 404) {
        errorMessage = t('chat.errors.notFound');
      } else if (status === 429) {
        errorMessage = t('chat.errors.tooManyRequests');
      } else if (typeof status === 'number' && status >= 500) {
        errorMessage = t('chat.errors.serverError');
      }

      removeMessage(loadingId);
      addMessage({
        id: (Date.now() + 2).toString(),
        text: errorMessage,
        sender: 'ai' as const,
        suggestions: [
          t('chat.suggestions.tryAgain'),
          t('chat.suggestions.findProducts'),
          t('chat.suggestions.contactSupport'),
        ],
      });
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleResizeStop = (
    _e: MouseEvent | TouchEvent,
    _direction: unknown,
    ref: HTMLElement,
    _delta: unknown,
    _position: unknown
  ) => {
    setSize({
      width: ref.offsetWidth as 384,
      height: ref.offsetHeight as 600,
    });
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 select-none">
      <ChatToggleButton isOpen={isOpen} onClick={toggleChat} />

      {isOpen && (
        <Rnd
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-rnd ref type không tương thích trực tiếp
          ref={chatWidgetRef as any}
          default={{
            x: window.innerWidth - size.width - 24,
            y: window.innerHeight - size.height - 100,
            width: size.width,
            height: size.height,
          }}
          minWidth={CHAT_WIDGET_CONFIG.MIN_SIZE.width}
          minHeight={CHAT_WIDGET_CONFIG.MIN_SIZE.height}
          maxWidth={CHAT_WIDGET_CONFIG.MAX_SIZE.width}
          maxHeight={CHAT_WIDGET_CONFIG.MAX_SIZE.height}
          disableDragging={false}
          dragHandleClassName="chat-header-drag"
          enableUserSelectHack={false}
          bounds="window"
          onResizeStop={handleResizeStop}
          style={{ zIndex: 9999 }}
          className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-800 transition-all chat-widget-active"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-rnd HandleStyles type quá strict
          resizeHandleStyles={RESIZE_HANDLE_STYLES as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-rnd HandleClasses type quá strict
          resizeHandleClasses={RESIZE_HANDLE_CLASSES as any}
        >
          <div className="chat-header-drag flex-shrink-0 sticky top-0 z-[100] shadow-xl">
            <ChatHeaderContent
              onApplyChanges={applyChanges}
              onClose={closeChat}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-neutral-50 dark:bg-neutral-950/50 custom-scrollbar">
            {messages.length === 0 && <ChatEmptyState onSuggestionClick={handleSendMessage} />}

            {messages.map((message) => (
              <div key={message.id} className="animate-in fade-in duration-300">
                <ChatMessage message={message} />
                {message.sender === 'ai' && (
                  <>
                    {message.products && message.products.length > 0 && (
                      <div className="ml-10 mt-3 mb-2">
                        <ChatProductList
                          products={message.products}
                          sessionId={sessionId}
                        />
                      </div>
                    )}

                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="ml-10 mt-3 mb-2">
                        <ChatSuggestions
                          suggestions={message.suggestions}
                          onSuggestionClick={handleSuggestionClick}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex-shrink-0 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 z-10">
            <div className="px-4 pt-3">
              <ChatQuickActions onSendMessage={handleSendMessage} />
            </div>

            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />

            <div className="px-5 pb-3 flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 font-bold border-t border-neutral-50 dark:border-neutral-800/50 pt-2 bg-neutral-50/30 dark:bg-neutral-800/20">
              <div className="flex items-center group">
                <VerifiedIcon className="mr-1.5 text-primary-500/70" size={12} />
                <span className="uppercase tracking-widest">
                  {t('chat.poweredByLabel')}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  className="hover:text-red-500 transition-colors flex items-center gap-1"
                  onClick={() => {
                    if (window.confirm(t('chat.clearConfirm'))) setMessages([]);
                  }}
                >
                  <TrashIcon size={12} />
                  <span>{t('chat.clearButton')}</span>
                </button>
                <button
                  type="button"
                  className="hover:text-primary-500 transition-colors flex items-center gap-1"
                  onClick={() => handleSendMessage(t('chat.helpMessage'))}
                >
                  <HelpIcon size={12} />
                  <span>{t('chat.supportButton')}</span>
                </button>
              </div>
            </div>
          </div>

          <ChatResizeIndicator />
        </Rnd>
      )}
    </div>
  );
};

export default ChatWidget;
