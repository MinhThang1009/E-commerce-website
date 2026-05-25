/**
 * @file MessageBubble.tsx
 * @layer Component
 * @feature ai
 * @description UI component cho feature ai
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '../types/message.types';
import ProductCard from './AIProductCard';
import { Link } from 'react-router-dom';
import { GridIcon } from './icons/index';

interface MessageBubbleProps {
  message: Message;
  onSuggestionClick: (suggestion: string) => void;
  isLoading?: boolean;
}

/**
 * Component hiển thị một tin nhắn trong chat
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onSuggestionClick, isLoading = false }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
          <p className="text-sm whitespace-pre-wrap select-text cursor-text">{message.text}</p>

          {/* Nút copy — chỉ hiện trên AI messages, không hiện khi đang loading */}
          {message.sender === 'ai' && !message.isLoading && (
            <button
              onClick={handleCopy}
              title={copied ? t('chat.copied') : t('chat.copy')}
              className="mt-2 flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-green-500">{t('chat.copied')}</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  <span>{t('chat.copy')}</span>
                </>
              )}
            </button>
          )}

          {/* Hiển thị sản phẩm nếu có */}
          {message.products && message.products.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="font-medium text-xs text-neutral-500 dark:text-neutral-400 flex items-center">
                <GridIcon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
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
                  disabled={isLoading}
                  className="chat-suggestion-button text-xs rounded-full px-3 py-1.5 border border-white/20 dark:border-white/10 bg-white/15 dark:bg-white/08 hover:bg-white/25 dark:hover:bg-white/14 transition-all duration-200 text-current backdrop-blur-sm disabled:opacity-40 disabled:pointer-events-none"
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
