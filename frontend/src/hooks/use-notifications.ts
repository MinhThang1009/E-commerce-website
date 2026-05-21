/**
 * @file useNotifications.ts
 * @layer Hook
 * @feature auth
 * @description Custom React hook cho feature auth
 */
import { useCallback } from 'react';
import { useUiStore } from '@/stores/ui-store';
import { AddNotificationPayload } from '@/types/ui.types';

export const useNotifications = () => {
  const addNotification = useUiStore((s) => s.addNotification);
  const removeNotification = useUiStore((s) => s.removeNotification);
  const clearNotifications = useUiStore((s) => s.clearNotifications);

  const showNotification = useCallback(
    (notification: AddNotificationPayload) => {
      addNotification(notification);
    },
    [addNotification],
  );

  const hideNotification = useCallback(
    (id: string) => {
      removeNotification(id);
    },
    [removeNotification],
  );

  const clearAllNotifications = useCallback(() => {
    clearNotifications();
  }, [clearNotifications]);

  return {
    showNotification,
    hideNotification,
    clearAllNotifications,
  };
};
