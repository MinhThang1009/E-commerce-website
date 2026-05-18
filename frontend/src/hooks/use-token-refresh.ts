/**
 * @file useTokenRefresh.ts
 * @layer Hook
 * @feature global
 * @description Shared React hook
 */
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { refreshTokenIfNeeded, isTokenExpired } from '@/utils/token-manager';

export const useTokenRefresh = () => {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    // Kiểm tra tính hợp lệ của token mỗi 5 phút
    const checkTokenValidity = async () => {
      if (isTokenExpired(token)) {
        const newToken = await refreshTokenIfNeeded();

        if (!newToken) {
          useAuthStore.getState().logout();
        }
      }
    };

    // Kiểm tra ngay lập tức
    checkTokenValidity();

    // Đặt interval kiểm tra mỗi 5 phút
    const interval = setInterval(checkTokenValidity, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [token, isAuthenticated]);

  // Cũng kiểm tra khi trang được hiển thị lại
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isAuthenticated && token) {
        if (isTokenExpired(token)) {
          await refreshTokenIfNeeded();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [token, isAuthenticated]);
};
