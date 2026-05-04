import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  Notification,
  UIState,
  AddNotificationPayload,
} from '@/types/ui.types';

// Lấy theme từ localStorage; nếu chưa có → detect theo tuỳ chọn hệ thống (OS)
const savedTheme: 'light' | 'dark' = (() => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  // Chưa có preference được lưu → dùng OS preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
})();

const initialState: UIState = {
  notifications: [],
  isSearchOpen: false,
  isMobileMenuOpen: false,
  isLoading: false,
  theme: savedTheme,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<AddNotificationPayload>) => {
      const id = Date.now().toString();
      state.notifications.push({
        id,
        ...action.payload,
      });
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    toggleSearch: (state) => {
      state.isSearchOpen = !state.isSearchOpen;
    },
    toggleMobileMenu: (state) => {
      state.isMobileMenuOpen = !state.isMobileMenuOpen;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
    },
  },
});

export const {
  addNotification,
  removeNotification,
  clearNotifications,
  toggleSearch,
  toggleMobileMenu,
  setLoading,
  setTheme,
} = uiSlice.actions;

export default uiSlice.reducer;

