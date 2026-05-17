import { useUiStore } from '@/stores/uiStore';
import { AddNotificationPayload } from '@/types/ui.types';

export const useNotifications = () => {
  const addNotification = useUiStore((s) => s.addNotification);
  const removeNotification = useUiStore((s) => s.removeNotification);
  const clearNotifications = useUiStore((s) => s.clearNotifications);

  const showNotification = (notification: AddNotificationPayload) => {
    addNotification(notification);
  };

  const hideNotification = (id: string) => {
    removeNotification(id);
  };

  const clearAllNotifications = () => {
    clearNotifications();
  };

  return {
    showNotification,
    hideNotification,
    clearAllNotifications,
  };
};
