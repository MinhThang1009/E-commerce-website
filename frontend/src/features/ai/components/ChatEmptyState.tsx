/**
 * @file ChatEmptyState.tsx
 * @layer Component
 * @feature ai
 * @description UI component cho feature ai
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BotIcon } from './icons';

const ChatEmptyState: React.FC<{ onSuggestionClick?: (text: string) => void }> = ({ onSuggestionClick }) => {
  const { t } = useTranslation();

  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary-100 via-primary-50 to-primary-200 dark:from-primary-900/40 dark:via-primary-800/30 dark:to-primary-700/40 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-primary-100/50 dark:ring-primary-800/30">
        <BotIcon size={40} className="text-primary-600 dark:text-primary-400" />
      </div>
      <h4 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
        {t('chat.emptyState.title')}
      </h4>
      <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto mb-8">
        {t('chat.emptyState.description')}
      </p>

      <div className="flex flex-col gap-2 max-w-[200px] mx-auto">
        <button
          onClick={() => onSuggestionClick && onSuggestionClick(t('chat.emptyState.newProducts'))}
          className="text-sm bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 py-2 px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors text-left flex items-center gap-2"
        >
          <span>🆕</span> {t('chat.emptyState.newProducts')}
        </button>
        <button
          onClick={() => onSuggestionClick && onSuggestionClick(t('chat.emptyState.promotions'))}
          className="text-sm bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 py-2 px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors text-left flex items-center gap-2"
        >
          <span>🔥</span> {t('chat.emptyState.promotions')}
        </button>
        <button
          onClick={() => onSuggestionClick && onSuggestionClick(t('chat.emptyState.support'))}
          className="text-sm bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 py-2 px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 transition-colors text-left flex items-center gap-2"
        >
          <span>💬</span> {t('chat.emptyState.support')}
        </button>
      </div>
    </div>
  );
};

export default ChatEmptyState;
