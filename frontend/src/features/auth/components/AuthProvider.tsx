/**
 * @file AuthProvider.tsx
 * @layer Component
 * @feature auth
 * @description UI component cho feature auth
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth-store';
import { useGetCurrentUserQuery } from '../api/auth-api';
import { refreshTokenIfNeeded } from '@/utils/token-manager';
import LoadingSpinner from '@/components/common/LoadingSpinner';

// Preload page bundle cho route hiện tại song song với auth network call
// — tránh Suspense fallback xuất hiện ngay sau khi auth xong (double-load)
function preloadCurrentRoute() {
  const path = window.location.pathname;
  if (path === '/' || path === '') {
    void import('@/pages/HomePage');
  } else if (path.startsWith('/shop')) {
    void import('@/features/catalog/pages/ShopPage');
  } else if (path.startsWith('/products')) {
    void import('@/features/catalog/pages/ProductDetailPage');
  } else if (path.startsWith('/cart')) {
    void import('@/features/cart/pages/CartPage');
  } else if (path.startsWith('/profile')) {
    void import('@/features/users/pages/ProfilePage');
  } else if (path.startsWith('/orders')) {
    void import('@/features/orders/pages/OrdersPage');
  } else {
    void import('@/pages/HomePage');
  }
}

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  // Không hydrate nếu đã có token hợp lệ trong sessionStorage (reload trong cùng tab)
  const [isHydrating, setIsHydrating] = useState(
    () => !useAuthStore.getState().token && !!localStorage.getItem('user'),
  );

  // Silent refresh khi app mount — access token mất khi reload, dùng httpOnly cookie để lấy lại
  useEffect(() => {
    const silentRefresh = async () => {
      if (token) {
        setIsHydrating(false);
        return;
      }

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        // Preload page bundle song song với network call — tránh double-load spinner
        preloadCurrentRoute();
        try {
          const newToken = await refreshTokenIfNeeded();
          if (newToken) {
            // Dùng updateAccessToken thay loginSuccess — không trigger justLoggedIn toast khi refresh
            const store = useAuthStore.getState();
            store.updateAccessToken(newToken);
            if (!store.user) {
              store.updateUser(JSON.parse(storedUser));
            }
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
      // Restore user data sau refresh — không trigger justLoggedIn toast
      useAuthStore.getState().updateUser(currentUser);
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
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">{t('auth.loading')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthProvider;
