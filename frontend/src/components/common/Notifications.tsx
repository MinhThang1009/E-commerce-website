/**
 * @file Notifications.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/ui-store';
import type { Notification as NotificationType } from '@/types/ui.types';

const Notification: React.FC<{ notification: NotificationType }> = ({ notification }) => {
  const removeNotification = useUiStore((s) => s.removeNotification);
  const { t } = useTranslation();

  // Tự động ẩn thông báo sau khoảng thời gian
  useEffect(() => {
    const timer = setTimeout(() => {
      removeNotification(notification.id);
    }, notification.duration || 5000);

    return () => clearTimeout(timer);
  }, [notification, removeNotification]);

  // Lấy icon theo loại thông báo
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'error':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  // Màu accent theo loại — token-based, tự thích nghi dark/light
  const accentColor = (() => {
    switch (notification.type) {
      case 'success':
        return 'var(--accent)';
      case 'error':
        return 'var(--admin-error)';
      case 'warning':
        return 'var(--admin-warning)';
      case 'info':
      default:
        return 'var(--admin-info)';
    }
  })();

  return (
    <div
      className="flex items-center gap-3 p-3.5 mb-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-lg animate-slideInTop"
      style={{ borderLeft: `4px solid ${accentColor}` }}
      role="alert"
    >
      <div className="flex-shrink-0" style={{ color: accentColor }}>
        {getIcon()}
      </div>
      <div className="flex-grow text-sm font-medium text-[var(--text-primary)]">
        {notification.message}
      </div>
      <button
        type="button"
        className="ml-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        onClick={() => removeNotification(notification.id)}
        aria-label={t('common.close')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};

const Notifications: React.FC = () => {
  const notifications = useUiStore((s) => s.notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 w-full max-w-sm">
      {notifications.map((notification) => (
        <Notification key={notification.id} notification={notification} />
      ))}
    </div>
  );
};

export default Notifications;
