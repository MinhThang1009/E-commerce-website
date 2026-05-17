/**
 * @file authUtils.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */
import i18next from 'i18next';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/utils/toast';

// Hàm điều hướng - sẽ được thiết lập bởi component App
let navigateToLogin: (() => void) | null = null;

export const setNavigateFunction = (navigate: () => void) => {
  navigateToLogin = navigate;
};

// Singleton quản lý trạng thái đăng xuất
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
 * Xử lý đăng xuất tự động khi tài khoản người dùng bị vô hiệu hóa hoặc không được phép
 * @param errorMessage - Thông báo lỗi tùy chọn để hiển thị
 * @param redirectDelay - Thời gian chờ trước khi chuyển hướng về trang đăng nhập (mili giây)
 */
export const handleAutoLogout = (
  errorMessage?: string,
  redirectDelay: number = 1000
) => {
  const resolvedMessage = errorMessage ?? i18next.t('auth.errors.sessionExpired');

  // Ngăn chặn đăng xuất trùng lặp
  if (logoutManager.isLoggingOut) return;

  logoutManager.setLoggingOut(true);

  // Hiển thị thông báo cho người dùng
  toast.warning(resolvedMessage, 4);

  // Đăng xuất để xóa trạng thái xác thực
  useAuthStore.getState().logout();

  // Chuyển hướng sau delay ngắn để state cập nhật xong
  setTimeout(() => {
    logoutManager.setLoggingOut(false);

    // Dùng React Router navigate để tránh full page reload, giữ nguyên app state
    // Fallback về window.location.href nếu navigateToLogin chưa được inject (edge case: App chưa mount)
    if (navigateToLogin) {
      navigateToLogin();
    } else {
      window.location.href = '/login';
    }
  }, redirectDelay);
};

// Export logout manager để dùng ở các module khác
export { logoutManager };

/**
 * Kiểm tra lỗi có phải 401 Unauthorized và xử lý tự động đăng xuất
 * @param error - Đối tượng lỗi từ response API
 * @returns boolean - true nếu lỗi 401 đã được xử lý
 */
export const handleUnauthorizedError = (error: unknown): boolean => {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    (error as Record<string, unknown>).status === 401
  ) {
    const e = error as Record<string, unknown>;
    const data = e.data as Record<string, unknown> | undefined;
    const errorMessage =
      (typeof data?.message === 'string' ? data.message : undefined) ||
      i18next.t('auth.errors.accountLocked');

    handleAutoLogout(errorMessage);
    return true;
  }
  return false;
};

/**
 * Trích xuất thông báo lỗi từ các định dạng lỗi khác nhau
 * @param error - Đối tượng lỗi
 * @returns string - Thông báo lỗi đã định dạng
 */
export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = e.data as Record<string, unknown> | undefined;
    if (typeof data?.message === 'string') return data.message;
    if (typeof e.message === 'string') return e.message;
  }

  return i18next.t('errors.unknown');
};

