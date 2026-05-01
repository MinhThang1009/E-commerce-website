import React from 'react';
import { useTranslation } from 'react-i18next';
import { BotIcon, CloseIcon } from './icons';

interface ChatHeaderContentProps {
  onApplyChanges?: () => void;
  onClose: () => void;
}

const ChatHeaderContent: React.FC<ChatHeaderContentProps> = ({
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-gradient-to-r from-primary-600 to-primary-500 text-white p-4 relative z-[100] overflow-hidden rounded-t-3xl shadow-lg border-b border-white/10">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%221%22%20fill%3D%22%23ffffff%22/%3E%3C/svg%3E')]" />
      </div>

      <div className="relative flex items-center justify-between z-10">
        {/* Title Section */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner border border-white/30">
            <BotIcon size={24} className="text-white drop-shadow-sm" />
          </div>
          <div>
            <h3 className="font-bold text-lg tracking-tight leading-tight">
              {t('chat.title')}
            </h3>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <p className="text-[11px] text-white/80 font-medium uppercase tracking-wider">
                Sẵn sàng hỗ trợ
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:rotate-90 group"
            title={t('chat.close')}
          >
            <CloseIcon size={18} className="text-white group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeaderContent;
