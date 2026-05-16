import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useGetCurrentUserQuery } from '../api/authApi';
import { refreshTokenIfNeeded } from '@/utils/tokenManager';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [isHydrating, setIsHydrating] = useState(true);

  // Silent refresh khi app mount — access token mất khi reload, dùng httpOnly cookie để lấy lại
  useEffect(() => {
    const silentRefresh = async () => {
      if (token) {
        setIsHydrating(false);
        return;
      }

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const newToken = await refreshTokenIfNeeded();
          if (newToken) {
            useAuthStore.getState().loginSuccess({
              user: JSON.parse(storedUser),
              token: newToken,
            });
          }
        } catch {
          localStorage.removeItem('user');
        }
      }
      setIsHydrating(false);
    };

    silentRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Silent refresh chỉ chạy một lần khi app mount
  }, []);

  const shouldFetchUser = token && !user && isAuthenticated;

  const {
    data: currentUser,
    error,
    isLoading,
    isSuccess,
    isError,
  } = useGetCurrentUserQuery({
    enabled: !!shouldFetchUser,
  });

  useEffect(() => {
    if (isSuccess && currentUser && token) {
      useAuthStore.getState().loginSuccess({
        user: currentUser,
        token: token,
      });
    }
  }, [isSuccess, currentUser, token]);

  useEffect(() => {
    if (isError && error) {
      useAuthStore.getState().logout();
    }
  }, [isError, error]);

  if (isHydrating || (shouldFetchUser && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">
            {t('auth.loading')}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthProvider;
