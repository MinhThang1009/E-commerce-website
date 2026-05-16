import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { User } from '@/types/user.types';
import { AuthResponse } from '@/features/auth/types/auth.types';

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
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState & AuthActions>()(
  immer((set) => ({
    user: getStoredUser(),
    token: null,
    isAuthenticated: false,
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
      }),

    clearJustLoggedIn: () =>
      set((state) => {
        state.justLoggedIn = false;
      }),
  }))
);
