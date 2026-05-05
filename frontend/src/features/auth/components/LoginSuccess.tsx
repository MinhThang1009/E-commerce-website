import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { useNotifications } from '@/hooks/useNotifications';
import { useTranslation } from 'react-i18next';
import { clearJustLoggedIn } from '../store/authSlice';

const LoginSuccess: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { user, isAuthenticated, justLoggedIn } = useSelector(
    (state: RootState) => state.auth
  );
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
      dispatch(clearJustLoggedIn());
    }
  }, [isAuthenticated, user, justLoggedIn, showNotification, t, dispatch]);

  return null;
};

export default LoginSuccess;

