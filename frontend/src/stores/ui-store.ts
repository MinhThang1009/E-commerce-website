/**
 * @file uiStore.ts
 * @layer Store
 * @feature global
 * @description Zustand global state store
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { UIState, AddNotificationPayload } from '@/types/ui.types';

// Lấy theme từ localStorage; nếu chưa có → detect theo tuỳ chọn hệ thống (OS)
const INITIAL_THEME: 'light' | 'dark' = /* istanbul ignore next */ (() => {
  /* istanbul ignore next */
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme');
  /* istanbul ignore next */
  if (stored === 'dark' || stored === 'light') return stored as 'dark' | 'light';
  // Chưa có preference được lưu → dùng OS preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? /* istanbul ignore next */ 'dark'
    : 'light';
})();

interface UiActions {
  addNotification: (payload: AddNotificationPayload) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  toggleSearch: () => void;
  toggleMobileMenu: () => void;
  setLoading: (isLoading: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUiStore = create<UIState & UiActions>()(
  immer((set) => ({
    notifications: [],
    isSearchOpen: false,
    isMobileMenuOpen: false,
    isLoading: false,
    theme: INITIAL_THEME,

    addNotification: (payload) =>
      set((state) => {
        const id = Date.now().toString();
        state.notifications.push({
          id,
          ...payload,
        });
      }),

    removeNotification: (id) =>
      set((state) => {
        state.notifications = state.notifications.filter((notification) => notification.id !== id);
      }),

    clearNotifications: () =>
      set((state) => {
        state.notifications = [];
      }),

    toggleSearch: () =>
      set((state) => {
        state.isSearchOpen = !state.isSearchOpen;
      }),

    toggleMobileMenu: () =>
      set((state) => {
        state.isMobileMenuOpen = !state.isMobileMenuOpen;
      }),

    setLoading: (isLoading) =>
      set((state) => {
        state.isLoading = isLoading;
      }),

    setTheme: (theme) =>
      set((state) => {
        state.theme = theme;
        localStorage.setItem('theme', theme);
      }),
  })),
);
