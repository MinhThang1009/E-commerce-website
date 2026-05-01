import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '@/store';
import { Rnd } from 'react-rnd';

// Components
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ChatSuggestions from './ChatSuggestions';
import ChatProductList from './ChatProductList';
import ChatToggleButton from './ChatToggleButton';
import ChatHeaderContent from './ChatHeaderContent';
import ChatQuickActions from './ChatQuickActions';
import ChatEmptyState from './ChatEmptyState';
import ChatResizeIndicator from './ChatResizeIndicator';

// Icons
import { VerifiedIcon, TrashIcon, HelpIcon } from './icons';

// Services & API
import {
  useSendChatbotMessageMutation,
  useTrackChatbotAnalyticsMutation,
  ChatbotResponse,
  ProductRecommendation,
} from '../services/chatbotApi';

// Hooks & Constants
import { useChatWidget } from '../hooks/useChatWidget';
import {
  CHAT_WIDGET_CONFIG,
  RESIZE_HANDLE_STYLES,
  RESIZE_HANDLE_CLASSES,
} from '../constants/chatWidget';

// Styles
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
    data?: Record<string, any>;
  }>;
}

const ChatWidget: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useSelector(
    (state: RootState) => state.auth
  );

  // Custom hook for chat widget state management
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

  // API hooks
  const [sendMessage, { isLoading }] = useSendChatbotMessageMutation();
  const [trackAnalytics] = useTrackChatbotAnalyticsMutation();

  // Session ID
  const [sessionId] = useState(
    () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
    };

    addMessage(userMessage);

    // Add loading message
    const loadingId = (Date.now() + 1).toString();
    addMessage({
      id: loadingId,
      text: '',
      sender: 'ai',
      isLoading: true,
    });

    try {
      // Track analytics
      await trackAnalytics({
        event: 'message_sent',
        userId: user?.id,
        sessionId,
        metadata: { message: text },
      });

      // Get current page context for better responses
      const context = {
        currentUrl: window.location.href,
        currentPage: window.location.pathname,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      };

      // Call enhanced chatbot API
      const apiResponse = await sendMessage({
        message: text,
        userId: user?.id,
        sessionId,
        context,
      }).unwrap();

      // Handle different response structures
      let response: ChatbotResponse;
      if (
        (apiResponse as any).status === 'success' &&
        (apiResponse as any).data
      ) {
        const newApiResponse = apiResponse as any;
        response = {
          response: newApiResponse.data.response,
          suggestions: newApiResponse.data.suggestions,
          products: newApiResponse.data.products,
          actions: newApiResponse.data.actions,
          sessionId: newApiResponse.data.sessionId,
        };
      } else {
        response = apiResponse as any as ChatbotResponse;
      }

      // Remove loading message and add AI response
      removeMessage(loadingId);
      addMessage({
        id: (Date.now() + 2).toString(),
        text: response.response,
        sender: 'ai',
        suggestions: response.suggestions,
        products: response.products,
        actions: response.actions,
      });
    } catch (error: any) {
      console.error('Error sending message:', error);

      let errorMessage = t('chat.errors.general');

      if (error.status === 404) {
        errorMessage = t('chat.errors.notFound');
      } else if (error.status === 429) {
        errorMessage = t('chat.errors.tooManyRequests');
      } else if (error.status >= 500) {
        errorMessage = t('chat.errors.serverError');
      }

      // Remove loading message and add error message
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
    e: MouseEvent | TouchEvent,
    direction: any,
    ref: HTMLElement,
    delta: any,
    position: any
  ) => {
    setSize({
      width: ref.offsetWidth,
      height: ref.offsetHeight,
    });
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 select-none">
      {/* Chat toggle button */}
      <ChatToggleButton isOpen={isOpen} onClick={toggleChat} />

      {/* Chat widget window */}
      {isOpen && (
        <Rnd
          ref={chatWidgetRef as any}
          default={{
            x: window.innerWidth - size.width - 24,
            y: window.innerHeight - size.height - 100,
            width: size.width as any,
            height: size.height as any,
          }}
          minWidth={CHAT_WIDGET_CONFIG.MIN_SIZE.width}
          minHeight={CHAT_WIDGET_CONFIG.MIN_SIZE.height}
          maxWidth={CHAT_WIDGET_CONFIG.MAX_SIZE.width}
          maxHeight={CHAT_WIDGET_CONFIG.MAX_SIZE.height}
          disableDragging={false} /* Allow dragging for better UX */
          dragHandleClassName="chat-header-drag"
          enableUserSelectHack={false}
          bounds="window"
          onResizeStop={handleResizeStop}
          style={{ zIndex: 9999 }}
          className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-800 transition-all chat-widget-active"
          resizeHandleStyles={RESIZE_HANDLE_STYLES as any}
          resizeHandleClasses={RESIZE_HANDLE_CLASSES as any}
        >
          {/* Header Area - Fixed at top with high z-index */}
          <div className="chat-header-drag flex-shrink-0 sticky top-0 z-[100] shadow-xl">
            <ChatHeaderContent
              onApplyChanges={applyChanges}
              onClose={closeChat}
            />
          </div>

          {/* Messages Area - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-neutral-50 dark:bg-neutral-950/50 custom-scrollbar">
            {messages.length === 0 && <ChatEmptyState onSuggestionClick={handleSendMessage} />}

            {messages.map((message) => (
              <div key={message.id} className="animate-in fade-in duration-300">
                <ChatMessage message={message} />
                {message.sender === 'ai' && (
                  <>
                    {/* Show products if available */}
                    {message.products && message.products.length > 0 && (
                      <div className="ml-10 mt-3 mb-2">
                        <ChatProductList
                          products={message.products}
                          sessionId={sessionId}
                        />
                      </div>
                    )}

                    {/* Show suggestions if available */}
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

          {/* Bottom Area: Quick Actions + Input + Footer */}
          <div className="flex-shrink-0 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 z-10">
            {/* 1. Quick actions */}
            <div className="px-4 pt-3">
              <ChatQuickActions onSendMessage={handleSendMessage} />
            </div>

            {/* 2. Chat input component */}
            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />

            {/* 3. Global Branding Footer */}
            <div className="px-5 pb-3 flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 font-bold border-t border-neutral-50 dark:border-neutral-800/50 pt-2 bg-neutral-50/30 dark:bg-neutral-800/20">
              <div className="flex items-center group">
                <VerifiedIcon className="mr-1.5 text-primary-500/70" size={12} />
                <span className="uppercase tracking-widest">
                  Powered by <span className="text-primary-600 dark:text-primary-400">Shopmini AI</span>
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  className="hover:text-red-500 transition-colors flex items-center gap-1"
                  onClick={() => {
                    if (window.confirm('Xóa hội thoại?')) setMessages([]);
                  }}
                >
                  <TrashIcon size={12} />
                  <span>Xóa</span>
                </button>
                <button
                  type="button"
                  className="hover:text-primary-500 transition-colors flex items-center gap-1"
                  onClick={() => handleSendMessage('Hướng dẫn sử dụng')}
                >
                  <HelpIcon size={12} />
                  <span>Hỗ trợ</span>
                </button>
              </div>
            </div>
          </div>

          {/* Resize indicator */}
          <ChatResizeIndicator />
        </Rnd>
      )}
    </div>
  );
};

export default ChatWidget;
