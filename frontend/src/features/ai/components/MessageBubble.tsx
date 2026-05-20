/**
 * @file MessageBubble.tsx
 * @layer Component
 * @feature ai
 * @description UI component cho feature ai
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '../types/message.types';
import ProductCard from './AIProductCard';
import { Link } from 'react-router-dom';
import { GridIcon } from './icons/index';

interface MessageBubbleProps {
  message: Message;
  onSuggestionClick: (suggestion: string) => void;
}

/**
 * Component hiển thị một tin nhắn trong chat
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onSuggestionClick }) => {
  const { t } = useTranslation();
  return (
    <div
      className={`max-w-[85%] rounded-2xl p-3.5 chat-bubble animate-in ${
        message.sender === 'user'
          ? 'glass-bubble-user text-white order-1 mr-2 rounded-tr-sm'
          : 'glass-bubble-ai text-neutral-800 dark:text-neutral-100 rounded-tl-sm'
      }`}
    >
      {message.isLoading ? (
        <div className="flex items-center justify-center py-2">
          <div className="flex space-x-1.5">
            <div
              className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            ></div>
            <div
              className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            ></div>
            <div
              className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            ></div>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm whitespace-pre-wrap">{message.text}</p>

          {/* Hiển thị sản phẩm nếu có */}
          {message.products && message.products.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="font-medium text-xs text-neutral-500 dark:text-neutral-400 flex items-center">
                <GridIcon className="mr-1.5" />
                <span>{t('chat.suggestedProducts')}</span>
              </p>
              <div className="grid grid-cols-1 gap-3">
                {message.products
                  .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
                  .map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
              </div>
            </div>
          )}

          {/* Hiển thị actions nếu có */}
          {message.actions && message.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.actions.map((action, index) => (
                <Link
                  key={index}
                  to={action.url || '#'}
                  className="text-xs bg-white/30 hover:bg-white/40 dark:bg-neutral-700 dark:hover:bg-neutral-600 rounded-full px-3 py-1.5 transition-all duration-200 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          )}

          {/* Hiển thị gợi ý */}
          {message.suggestions && message.suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSuggestionClick(suggestion);
                  }}
                  className="chat-suggestion-button text-xs rounded-full px-3 py-1.5 border border-white/20 dark:border-white/10 bg-white/15 dark:bg-white/08 hover:bg-white/25 dark:hover:bg-white/14 transition-all duration-200 text-current backdrop-blur-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MessageBubble;
