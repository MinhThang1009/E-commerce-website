import i18next from 'i18next';
import { store } from '@/store';
import { logout } from '@/features/auth';
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

  // Dispatch action đăng xuất để xóa trạng thái xác thực
  store.dispatch(logout());

  // logout action trong authSlice đã xóa token, refreshToken, user, cartItems
  // Không dùng localStorage.clear() để tránh xóa mất theme, language, và preferences khác

  // Chuyển hướng sau delay ngắn để Redux state cập nhật xong
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
 * Trích xuất thông báo lỗi từ các định dạng lỗi khác nhau
 * @param error - Đối tượng lỗi
 * @returns string - Thông báo lỗi đã định dạng
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

