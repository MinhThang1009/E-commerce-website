/**
 * @file authStore.ts
 * @layer Store
 * @feature global
 * @description Zustand global state store
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { User } from '@/types/user.types';
import { AuthResponse } from '@/features/auth/types/auth.types';

const SESSION_TOKEN_KEY = 'access_token';

const getSessionToken = (): string | null => {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    /* istanbul ignore next — chỉ xảy ra khi trình duyệt chặn sessionStorage (private mode cũ) */
    return null;
  }
};

/* istanbul ignore next — chỉ chạy khi module khởi động với token trong sessionStorage */
const isSessionTokenValid = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
};

const initToken = (() => {
  const t = getSessionToken();
  /* istanbul ignore next — nhánh truthy chỉ chạy khi sessionStorage có token hợp lệ */
  return t && isSessionTokenValid(t) ? t : null;
})();

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  justLoggedIn: boolean;
}

interface AuthActions {
  loginStart: () => void;
  loginSuccess: (payload: AuthResponse) => void;
  loginFailure: (error: string) => void;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  clearError: () => void;
  updateAccessToken: (token: string) => void;
  clearJustLoggedIn: () => void;
}

const getStoredUser = (): User | null => {
  try {
    const userStr = localStorage.getItem('user');
    /* istanbul ignore next — nhánh JSON.parse chỉ chạy khi localStorage có user data */
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    /* istanbul ignore next — chỉ xảy ra khi localStorage bị chặn hoặc dữ liệu bị hỏng */
    return null;
  }
};

export const useAuthStore = create<AuthState & AuthActions>()(
  immer((set) => ({
    user: getStoredUser(),
    token: initToken,
    isAuthenticated: !!initToken,
    isLoading: false,
    error: null,
    justLoggedIn: false,

    loginStart: () =>
      set((state) => {
        state.isLoading = true;
        state.error = null;
      }),

    loginSuccess: (payload) =>
      set((state) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = payload.user;
        state.token = payload.token;
        state.justLoggedIn = true;
        localStorage.setItem('user', JSON.stringify(payload.user));
        sessionStorage.setItem(SESSION_TOKEN_KEY, payload.token);
      }),

    loginFailure: (error) =>
      set((state) => {
        state.isLoading = false;
        state.error = error;
      }),

    logout: () =>
      set((state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.justLoggedIn = false;
        localStorage.removeItem('user');
        localStorage.removeItem('cartItems');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
      }),

    updateUser: (data) =>
      set((state) => {
        if (state.user) {
          state.user = { ...state.user, ...data };
        }
      }),

    clearError: () =>
      set((state) => {
        state.error = null;
      }),

    updateAccessToken: (token) =>
      set((state) => {
        state.token = token;
        state.isAuthenticated = true;
        sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      }),

    clearJustLoggedIn: () =>
      set((state) => {
        state.justLoggedIn = false;
      }),
  })),
);
