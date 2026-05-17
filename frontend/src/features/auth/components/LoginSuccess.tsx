/**
 * @file LoginSuccess.tsx
 * @layer Component
 * @feature auth
 * @description UI component cho feature auth
 */
import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNotifications } from '../hooks/useNotifications';
import { useTranslation } from 'react-i18next';

const LoginSuccess: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const justLoggedIn = useAuthStore((s) => s.justLoggedIn);
  const { showNotification } = useNotifications();

  useEffect(() => {
    if (isAuthenticated && user && justLoggedIn) {
      const userName =
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.name || user.email;

      showNotification({
        type: 'success',
        title: t('auth.welcome.title'),
        message: t('auth.welcome.message', { name: userName }),
        duration: 5000,
      });

      // Xóa cờ justLoggedIn sau khi hiển thị thông báo
      useAuthStore.getState().clearJustLoggedIn();
    }
  }, [isAuthenticated, user, justLoggedIn, showNotification, t]);

  return null;
};

export default LoginSuccess;
