/**
 * @file ChatInput.tsx
 * @layer Component
 * @feature ai
 * @description UI component cho feature ai
 */
import React, { FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingIcon, SendIcon } from './icons/index';

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

  const MAX_LENGTH = 500;
  const WARN_LENGTH = 450;
  const isOverLimit = input.length > MAX_LENGTH;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Không gửi khi vượt giới hạn — backend cũng validate 400 khi > 500 ký tự
    if (input.trim() && !isLoading && !isOverLimit) {
      onSendMessage(input);
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize: reset rồi set theo scrollHeight để textarea tự co giãn
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = gửi, Shift+Enter = xuống dòng
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  return (
    <div className="glass-input-area p-4">
      {/* Chỉ báo đang soạn tin */}
      {isLoading && (
        <div className="flex items-center mb-3 text-[11px] text-neutral-500 dark:text-neutral-400 font-medium animate-pulse">
          <div className="flex space-x-1 mr-2">
            <span
              className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            ></span>
            <span
              className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            ></span>
            <span
              className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            ></span>
          </div>
          <span>{t('chat.assistantTyping')}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end space-x-2">
        <div className="relative flex-1 group">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            maxLength={MAX_LENGTH + 50} /* Cho phép gõ vượt để thấy cảnh báo, không cắt ngầm */
            className={`glass-input-field w-full rounded-2xl pl-4 pr-14 py-3 text-sm text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 resize-none overflow-y-auto ${
              isOverLimit ? 'border-red-400/60 !ring-red-400/20' : ''
            }`}
            style={{ maxHeight: '8rem' }}
            disabled={isLoading}
            autoComplete="off"
          ></textarea>

          {/* Số ký tự đã nhập — đỏ khi vượt ngưỡng cảnh báo */}
          {input.length > 0 && (
            <div
              className={`absolute right-3 bottom-3 text-[10px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm ${
                isOverLimit
                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700'
                  : input.length > WARN_LENGTH
                    ? 'text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700'
                    : 'text-neutral-400 dark:text-neutral-500 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              {input.length}/{MAX_LENGTH}
            </div>
          )}
        </div>

        <button
          type="submit"
          className={`glass-send-btn text-white rounded-2xl p-3 flex items-center justify-center ${
            !input.trim() || isLoading || isOverLimit
              ? 'opacity-40 grayscale pointer-events-none'
              : ''
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
