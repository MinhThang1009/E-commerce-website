import { store } from '@/store';
import { logout } from '@/features/auth/authSlice';
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
 * @param errorMessage - Thông báo lỗi tùy chỉnh để hiển thị
 * @param redirectDelay - Thời gian chờ trước khi chuyển hướng về trang đăng nhập (mili giây)
 */
export const handleAutoLogout = (
  errorMessage: string = 'Phiên đăng nhập đã hết hạn',
  redirectDelay: number = 1000
) => {
  console.log('🚪 handleAutoLogout được gọi với:', errorMessage);

  // Ngăn chặn đăng xuất trùng lặp
  if (logoutManager.isLoggingOut) {
    console.log('⏸️ Đang trong quá trình đăng xuất, bỏ qua');
    return;
  }

  console.log('🔄 Bắt đầu quá trình đăng xuất');
  logoutManager.setLoggingOut(true);

  // Hiển thị thông báo cho người dùng
  toast.warning(errorMessage, 4);

  // Dispatch action đăng xuất để xóa trạng thái xác thực
  store.dispatch(logout());

  // logout action trong authSlice đã xóa token, refreshToken, user, cartItems
  // Không dùng localStorage.clear() để tránh xóa mất theme, language, và preferences khác

  // Chuyển hướng sau một khoảng trễ ngắn để đảm bảo Redux state đã được cập nhật
  setTimeout(() => {
    // Đặt lại cờ trạng thái
    logoutManager.setLoggingOut(false);

    // Buộc tải lại trang về login để tránh vấn đề trạng thái React Router
    window.location.href = '/login';
  }, 100); // Delay ngắn để đảm bảo Redux state đã cập nhật
};

// Export logout manager để dùng ở các module khác
export { logoutManager };

/**
 * Kiểm tra lỗi có phải 401 Unauthorized và xử lý tự động đăng xuất
 * @param error - Đối tượng lỗi từ response API
 * @returns boolean - true nếu lỗi 401 đã được xử lý
 */
export const handleUnauthorizedError = (error: any): boolean => {
  console.log('🔍 handleUnauthorizedError được gọi với:', error);

  if (error?.status === 401) {
    console.log('✅ Xác nhận 401, đang gọi handleAutoLogout');
    const errorMessage =
      error?.data?.message ||
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên';

    handleAutoLogout(errorMessage);
    return true;
  }

  console.log('❌ Không phải 401, status:', error?.status);
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

  return 'Đã xảy ra lỗi không xác định';
};
