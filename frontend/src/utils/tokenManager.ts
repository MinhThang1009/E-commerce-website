/**
 * @file tokenManager.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */
import i18next from 'i18next';
import { useAuthStore } from '@/stores/authStore';
import { handleAutoLogout, logoutManager } from '@/utils/authUtils';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string | PromiseLike<string | null> | null) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

export const refreshTokenIfNeeded = async (): Promise<string | null> => {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';
    const apiUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;

    // Migration: nếu còn refreshToken cũ trong localStorage, gửi trong body 1 lần rồi xóa
    const legacyRefreshToken = localStorage.getItem('refreshToken');
    const bodyPayload = legacyRefreshToken
      ? JSON.stringify({ refreshToken: legacyRefreshToken })
      : undefined;

    const response = await fetch(`${apiUrl}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: bodyPayload,
    });

    // Xóa legacy tokens sau khi gửi (dù thành công hay thất bại)
    if (legacyRefreshToken) {
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('token');
    }

    if (!response.ok) {
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData?.message ||
          i18next.t('auth.errors.accountLocked');

        handleAutoLogout(errorMessage);
        throw new Error(errorMessage);
      }

      throw new Error('Token refresh failed');
    }

    const data = await response.json();

    if (data.status === 'success') {
      const { token } = data;
      useAuthStore.getState().updateAccessToken(token);
      processQueue(null, token);
      return token;
    } else {
      throw new Error('Token refresh failed');
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    processQueue(error, null);

    if (!logoutManager.isLoggingOut) {
      useAuthStore.getState().logout();
    }

    return null;
  } finally {
    isRefreshing = false;
  }
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    return true;
  }
};

export const getValidToken = async (): Promise<string | null> => {
  const { token } = useAuthStore.getState();

  if (!token) {
    return null;
  }

  if (isTokenExpired(token)) {
    return await refreshTokenIfNeeded();
  }

  return token;
};
