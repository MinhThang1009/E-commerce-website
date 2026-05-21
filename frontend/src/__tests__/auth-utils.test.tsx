/// <reference types="jest" />
/**
 * Frontend unit tests — auth-utils.ts
 * Test handleAutoLogout, handleUnauthorizedError, getErrorMessage (auth-utils),
 * setNavigateFunction, logoutManager.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@stores/auth-store', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({ logout: jest.fn() })),
  },
}));

jest.mock('@utils/toast', () => ({
  toast: {
    warning: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('i18next', () => ({
  default: { t: (k: string) => k },
}));

import {
  handleAutoLogout,
  handleUnauthorizedError,
  getErrorMessage,
  setNavigateFunction,
  logoutManager,
} from '@utils/auth-utils';
import { useAuthStore } from '@stores/auth-store';
import { toast } from '@utils/toast';

// ── Reset state giữa tests ────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Reset logoutManager về trạng thái không đăng xuất
  logoutManager.setLoggingOut(false);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ── logoutManager ─────────────────────────────────────────────────────────────

describe('logoutManager', () => {
  test('singleton — isLoggingOut mặc định false', () => {
    expect(logoutManager.isLoggingOut).toBe(false);
  });

  test('setLoggingOut thay đổi trạng thái', () => {
    logoutManager.setLoggingOut(true);
    expect(logoutManager.isLoggingOut).toBe(true);
    logoutManager.setLoggingOut(false);
    expect(logoutManager.isLoggingOut).toBe(false);
  });
});

// ── handleAutoLogout ──────────────────────────────────────────────────────────

describe('handleAutoLogout', () => {
  test('hiển thị toast.warning với errorMessage', () => {
    handleAutoLogout('Phiên đăng nhập đã hết hạn');

    expect(toast.warning).toHaveBeenCalledWith('Phiên đăng nhập đã hết hạn', 4);
  });

  test('gọi logout() trên authStore', () => {
    const logout = jest.fn();
    (useAuthStore.getState as jest.Mock).mockReturnValue({ logout });

    handleAutoLogout('Lỗi xác thực');

    expect(logout).toHaveBeenCalledTimes(1);
  });

  test('không có errorMessage → dùng i18n key auth.errors.sessionExpired', () => {
    handleAutoLogout(); // không truyền message

    // i18n mock trả về key → 'auth.errors.sessionExpired'
    expect(toast.warning).toHaveBeenCalledWith('auth.errors.sessionExpired', 4);
  });

  test('không có navigateToLogin → không throw khi timeout chạy (window.location.href fallback)', () => {
    // jsdom không cho phép verify window.location.href trực tiếp — chỉ đảm bảo code không throw
    setNavigateFunction(null as any);

    expect(() => {
      handleAutoLogout('test', 50);
      jest.advanceTimersByTime(50);
    }).not.toThrow();
  });

  test('ngăn chặn đăng xuất trùng lặp (logoutManager.isLoggingOut=true → return sớm)', () => {
    logoutManager.setLoggingOut(true);

    handleAutoLogout('test');

    // toast không được gọi vì đã đang trong quá trình logout
    expect(toast.warning).not.toHaveBeenCalled();
  });

  test('gọi navigateToLogin nếu đã set', () => {
    const navigate = jest.fn();
    setNavigateFunction(navigate);

    handleAutoLogout('lỗi', 0);
    jest.advanceTimersByTime(0);

    expect(navigate).toHaveBeenCalled();

    // Reset để không ảnh hưởng test khác
    setNavigateFunction(null as any);
  });

  test('sau setTimeout, logoutManager.isLoggingOut reset về false', () => {
    handleAutoLogout('test', 500);

    expect(logoutManager.isLoggingOut).toBe(true);

    jest.advanceTimersByTime(500);

    expect(logoutManager.isLoggingOut).toBe(false);
  });
});

// ── handleUnauthorizedError ───────────────────────────────────────────────────

describe('handleUnauthorizedError', () => {
  test('error có status=401 → gọi handleAutoLogout và trả về true', () => {
    const result = handleUnauthorizedError({ status: 401, data: { message: 'Bị khóa' } });

    expect(result).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith('Bị khóa', 4);
  });

  test('error status=401, không có message → dùng i18n key', () => {
    const result = handleUnauthorizedError({ status: 401, data: {} });

    expect(result).toBe(true);
    // i18n mock → 'auth.errors.accountLocked'
    expect(toast.warning).toHaveBeenCalledWith('auth.errors.accountLocked', 4);
  });

  test('error không phải 401 → trả về false, không logout', () => {
    const result = handleUnauthorizedError({ status: 403, data: { message: 'Forbidden' } });

    expect(result).toBe(false);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  test('error không có status → trả về false', () => {
    expect(handleUnauthorizedError({ message: 'some error' })).toBe(false);
  });

  test('error là string → trả về false', () => {
    expect(handleUnauthorizedError('lỗi string')).toBe(false);
  });

  test('error là null → trả về false', () => {
    expect(handleUnauthorizedError(null)).toBe(false);
  });

  test('error là undefined → trả về false', () => {
    expect(handleUnauthorizedError(undefined)).toBe(false);
  });
});

// ── getErrorMessage (auth-utils) ──────────────────────────────────────────────

describe('getErrorMessage (auth-utils)', () => {
  test('error là string → trả về string đó', () => {
    expect(getErrorMessage('Đây là lỗi')).toBe('Đây là lỗi');
  });

  test('error có data.message → trả về data.message', () => {
    const result = getErrorMessage({ data: { message: 'Lỗi từ data' } });
    expect(result).toBe('Lỗi từ data');
  });

  test('error có .message → trả về .message', () => {
    const result = getErrorMessage({ message: 'Lỗi direct' });
    expect(result).toBe('Lỗi direct');
  });

  test('error không có message → dùng i18n key errors.unknown', () => {
    const result = getErrorMessage({});
    expect(result).toBe('errors.unknown');
  });

  test('error là null → dùng i18n key errors.unknown', () => {
    const result = getErrorMessage(null);
    expect(result).toBe('errors.unknown');
  });

  test('error là undefined → dùng i18n key errors.unknown', () => {
    const result = getErrorMessage(undefined);
    expect(result).toBe('errors.unknown');
  });

  test('ưu tiên data.message hơn .message', () => {
    const result = getErrorMessage({ data: { message: 'Từ data' }, message: 'Từ root' });
    expect(result).toBe('Từ data');
  });
});

// ── setNavigateFunction ───────────────────────────────────────────────────────

describe('setNavigateFunction', () => {
  test('hàm navigate được gọi sau khi set', () => {
    const navigate = jest.fn();
    setNavigateFunction(navigate);

    handleAutoLogout('test', 0);
    jest.advanceTimersByTime(0);

    expect(navigate).toHaveBeenCalledTimes(1);

    // Reset
    setNavigateFunction(null as any);
  });
});
