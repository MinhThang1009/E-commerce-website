/**
 * @file ChatInput.tsx
 * @layer Component
 * @feature ai
 * @description UI component cho feature ai
 */
import React, { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LoadingIcon,
  SendIcon,
} from './icons/index';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onClearChat?: () => void;
}

/**
 * Component hiển thị phần nhập liệu của chat widget
 */
const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  onClearChat: _onClearChat,
}) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  const MAX_LENGTH = 2000;
  const WARN_LENGTH = 1800;
  const isOverLimit = input.length > MAX_LENGTH;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Không gửi khi vượt giới hạn — backend cũng validate 400 khi > 2000 ký tự
    if (input.trim() && !isLoading && !isOverLimit) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-neutral-900 backdrop-blur-lg">
      {/* Chỉ báo đang soạn tin */}
      {isLoading && (
        <div className="flex items-center mb-3 text-[11px] text-neutral-500 dark:text-neutral-400 font-medium animate-pulse">
          <div className="flex space-x-1 mr-2">
            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          <span>{t('chat.assistantTyping')}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chat.placeholder')}
            maxLength={MAX_LENGTH + 100} /* Cho phép gõ vượt để thấy cảnh báo, không cắt ngầm */
            className={`w-full bg-neutral-100 dark:bg-neutral-800 border-2 rounded-2xl pl-4 pr-12 py-3 text-sm focus:ring-4 focus:outline-none text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 transition-all duration-300 shadow-sm group-hover:bg-neutral-200/50 dark:group-hover:bg-neutral-700/50 ${
              isOverLimit
                ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/10'
                : 'border-transparent focus:border-primary-500/20 focus:ring-primary-500/10'
            }`}
            disabled={isLoading}
            autoComplete="off"
          />

          {/* Số ký tự đã nhập — đỏ khi vượt ngưỡng cảnh báo */}
          {input.length > 0 && (
            <div className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm ${
              isOverLimit
                ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700'
                : input.length > WARN_LENGTH
                ? 'text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700'
                : 'text-neutral-400 dark:text-neutral-500 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
            }`}>
              {input.length}/{MAX_LENGTH}
            </div>
          )}
        </div>

        <button
          type="submit"
          className={`bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl p-3 shadow-lg shadow-primary-500/30 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center ${
            !input.trim() || isLoading || isOverLimit ? 'opacity-40 grayscale pointer-events-none' : 'hover:shadow-primary-500/50'
          }`}
          disabled={!input.trim() || isLoading || isOverLimit}
        >
          {isLoading ? <LoadingIcon className="animate-spin" /> : <SendIcon size={20} />}
        </button>
      </form>
    </div>
  );
};

export default ChatInput;

