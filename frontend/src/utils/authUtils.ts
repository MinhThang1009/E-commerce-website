import i18next from 'i18next';
import { store } from '@/store';
import { logout } from '@/features/auth/authSlice';
import { toast } from '@/utils/toast';

// Hàm di?u hu?ng - s? du?c thi?t l?p b?i component App
let navigateToLogin: (() => void) | null = null;

export const setNavigateFunction = (navigate: () => void) => {
  navigateToLogin = navigate;
};

// Singleton qu?n lý tr?ng thái dang xu?t
class LogoutManager {
  private static instance: LogoutManager;
  private _isLoggingOut = false;

  static getInstance(): LogoutManager {
    if (!LogoutManager.instance) {
      LogoutManager.instance = new LogoutManager();
    }
    return LogoutManager.instance;
  }

  get isLoggingOut(): boolean {
    return this._isLoggingOut;
  }

  setLoggingOut(value: boolean): void {
    this._isLoggingOut = value;
  }
}

const logoutManager = LogoutManager.getInstance();

/**
 * X? lý dang xu?t t? d?ng khi tài kho?n ngu?i dùng b? vô hi?u hóa ho?c không du?c phép
 * @param errorMessage - Thông báo l?i tùy ch?nh d? hi?n th?
 * @param redirectDelay - Th?i gian ch? tru?c khi chuy?n hu?ng v? trang dang nh?p (mili giây)
 */
export const handleAutoLogout = (
  errorMessage?: string,
  redirectDelay: number = 1000
) => {
  const resolvedMessage = errorMessage ?? i18next.t('auth.errors.sessionExpired');

  // Ngan ch?n dang xu?t trùng l?p
  if (logoutManager.isLoggingOut) return;

  logoutManager.setLoggingOut(true);

  // Hi?n th? thông báo cho ngu?i dùng
  toast.warning(resolvedMessage, 4);

  // Dispatch action dang xu?t d? xóa tr?ng thái xác th?c
  store.dispatch(logout());

  // logout action trong authSlice dã xóa token, refreshToken, user, cartItems
  // Không dùng localStorage.clear() d? tránh xóa m?t theme, language, và preferences khác

  // Chuy?n hu?ng sau delay ng?n d? Redux state c?p nh?t xong
  setTimeout(() => {
    logoutManager.setLoggingOut(false);

    // Dùng React Router navigate d? tránh full page reload, gi? nguyên app state
    // Fallback v? window.location.href n?u navigateToLogin chua du?c inject (edge case: App chua mount)
    if (navigateToLogin) {
      navigateToLogin();
    } else {
      window.location.href = '/login';
    }
  }, redirectDelay);
};

// Export logout manager d? dùng ? các module khác
export { logoutManager };

/**
 * Ki?m tra l?i có ph?i 401 Unauthorized và x? lý t? d?ng dang xu?t
 * @param error - Ð?i tu?ng l?i t? response API
 * @returns boolean - true n?u l?i 401 dã du?c x? lý
 */
export const handleUnauthorizedError = (error: any): boolean => {
  if (error?.status === 401) {
    const errorMessage =
      error?.data?.message ||
      i18next.t('auth.errors.accountLocked');

    handleAutoLogout(errorMessage);
    return true;
  }
  return false;
};

/**
 * Trích xu?t thông báo l?i t? các d?nh d?ng l?i khác nhau
 * @param error - Ð?i tu?ng l?i
 * @returns string - Thông báo l?i dã d?nh d?ng
 */
export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.data?.message) {
    return error.data.message;
  }

  if (error?.message) {
    return error.message;
  }

  return i18next.t('errors.unknown');
};

