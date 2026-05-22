/**
 * @file ChatHeader.tsx
 * @layer Component
 * @feature ai
 * @description UI component cho feature ai
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon, LightningIcon } from './icons/index';

interface ChatHeaderProps {
  onClose: () => void;
}

/**
 * Component hiển thị header của chat widget
 */
const ChatHeader: React.FC<ChatHeaderProps> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="glass-header chat-header-drag text-white p-5 relative">
      {/* Second ambient orb — smaller, left side */}
      <div
        className="absolute bottom-0 left-0 w-24 h-24 rounded-full translate-y-12 -translate-x-8 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.14) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex items-center justify-between" style={{ zIndex: 2 }}>
        <div className="flex items-center space-x-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-white/20"
            style={{
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(12px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), 0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <LightningIcon className="w-5 h-5 drop-shadow-sm" />
          </div>
          <div>
            <h3 className="font-bold text-[17px] tracking-tight leading-tight">
              {t('chat.title')}
            </h3>
            <p className="text-[12px] text-white/80 font-medium mt-0.5">{t('chat.subtitle')}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-90"
          style={{
            background: 'rgba(255,255,255,0.16)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.22)',
          }}
          aria-label={t('chat.closeChat')}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Status badges */}
      <div className="relative mt-3 flex items-center gap-2" style={{ zIndex: 2 }}>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{
            background: 'rgba(255,255,255,0.14)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          <div className="w-2 h-2 rounded-full animate-pulse shadow-sm bg-emerald-400" />
          <span className="text-[11px] font-semibold tracking-wide">{t('ai.chatbotName')}</span>
        </div>
        <div
          className="flex items-center rounded-full px-3 py-1.5"
          style={{
            background: 'rgba(255,255,255,0.09)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <span className="text-[11px] text-white/80">{t('ai.smartMode')}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
