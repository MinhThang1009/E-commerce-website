import React from 'react';
import { useTranslation } from 'react-i18next';


interface QuickAction {
  id: string;
  labelKey: string;
  messageKey: string;
  emoji: string;
  color: {
    from: string;
    to: string;
    text: string;
    border: string;
    hoverFrom: string;
    hoverTo: string;
  };
}

interface ChatQuickActionsProps {
  onSendMessage: (message: string) => void;
}

const QUICK_ACTION_DEFS: QuickAction[] = [
  {
    id: 'search',
    labelKey: 'chat.quickActions.search',
    messageKey: 'chat.quickActions.search',
    emoji: '🔍',
    color: {
      from: 'from-primary-50',
      to: 'to-primary-100',
      text: 'text-primary-700',
      border: 'border-primary-200/50',
      hoverFrom: 'hover:from-primary-100',
      hoverTo: 'hover:to-primary-200',
    },
  },
  {
    id: 'promotion',
    labelKey: 'chat.quickActions.promotion',
    messageKey: 'chat.quickActions.promotion',
    emoji: '🎉',
    color: {
      from: 'from-orange-50',
      to: 'to-orange-100',
      text: 'text-orange-700',
      border: 'border-orange-200/50',
      hoverFrom: 'hover:from-orange-100',
      hoverTo: 'hover:to-orange-200',
    },
  },
  {
    id: 'support',
    labelKey: 'chat.quickActions.support',
    messageKey: 'chat.quickActions.support',
    emoji: '💬',
    color: {
      from: 'from-green-50',
      to: 'to-green-100',
      text: 'text-green-700',
      border: 'border-green-200/50',
      hoverFrom: 'hover:from-green-100',
      hoverTo: 'hover:to-green-200',
    },
  },
];

const ChatQuickActions: React.FC<ChatQuickActionsProps> = ({ onSendMessage }) => {
  const { t } = useTranslation();

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTION_DEFS.map((action) => (
          <button
            key={action.id}
            onClick={() => onSendMessage(t(action.messageKey))}
            className={`text-xs px-4 py-2 bg-gradient-to-r ${action.color.from} ${action.color.to} ${action.color.text} rounded-xl ${action.color.hoverFrom} ${action.color.hoverTo} transition-all duration-300 font-semibold shadow-sm hover:shadow-md transform hover:-translate-y-0.5 border ${action.color.border} active:scale-95`}
          >
            <span className="mr-1.5">{action.emoji}</span>
            {t(action.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChatQuickActions;
