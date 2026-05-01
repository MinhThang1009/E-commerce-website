import React, { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HelpIcon,
  LoadingIcon,
  SendIcon,
  TrashIcon,
  VerifiedIcon,
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
  onClearChat,
}) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleClearChat = () => {
    if (
      onClearChat &&
      window.confirm('Bạn có chắc muốn xóa toàn bộ cuộc trò chuyện này?')
    ) {
      onClearChat();
    }
  };

  const handleHelpClick = () => {
    onSendMessage('Tôi cần trợ giúp về cách sử dụng chatbot');
  };

  return (
    <div className="p-4 bg-white dark:bg-neutral-900 backdrop-blur-lg">
      {/* Typing status indicator */}
      {isLoading && (
        <div className="flex items-center mb-3 text-[11px] text-neutral-500 dark:text-neutral-400 font-medium animate-pulse">
          <div className="flex space-x-1 mr-2">
            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          <span>Trợ lý đang soạn câu trả lời...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <div className="relative flex-1 group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chat.placeholder') || 'Bạn cần hỗ trợ gì không?'}
            className="w-full bg-neutral-100 dark:bg-neutral-800 border-2 border-transparent focus:border-primary-500/20 rounded-2xl pl-4 pr-12 py-3 text-sm focus:ring-4 focus:ring-primary-500/10 focus:outline-none text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 transition-all duration-300 shadow-sm group-hover:bg-neutral-200/50 dark:group-hover:bg-neutral-700/50"
            disabled={isLoading}
            autoComplete="off"
          />

          {/* Character count */}
          {input.length > 0 && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 bg-white dark:bg-neutral-900 px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 shadow-sm">
              {input.length}
            </div>
          )}
        </div>

        <button
          type="submit"
          className={`bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl p-3 shadow-lg shadow-primary-500/30 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center ${
            !input.trim() || isLoading ? 'opacity-40 grayscale pointer-events-none' : 'hover:shadow-primary-500/50'
          }`}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? <LoadingIcon className="animate-spin" /> : <SendIcon size={20} />}
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
