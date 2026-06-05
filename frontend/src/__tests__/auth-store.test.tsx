/// <reference types="jest" />
/**
 * Frontend unit tests — Auth Store.
 * Test Zustand auth state management, không cần DOM, không cần API thật.
 */
import { act, renderHook } from '@testing-library/react';
import { useAuthStore } from '@stores/auth-store';

// ── Helpers tạo dữ liệu test ──────────────────────────────────────────────────

/**
 * Tạo JWT token hợp lệ với exp tùy chỉnh (mặc định 1 giờ nữa).
 * Payload được base64url-encode để decode trong isSessionTokenValid.
 */
const makeToken = (expOffsetSeconds: number = 3600): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ sub: '1', exp: now + expOffsetSeconds }));
  return `${header}.${payload}.signature`;
};

const makeUser = (overrides = {}) => ({
  id: '1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'customer' as const,
  ...overrides,
});

// ── Mock sessionStorage ───────────────────────────────────────────────────────

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// ── Reset state giữa tests ────────────────────────────────────────────────────

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    justLoggedIn: false,
  });
  jest.clearAllMocks();
});

// ── Initial state ─────────────────────────────────────────────────────────────

describe('authStore — initial state', () => {
  test('initial state đúng format', () => {
    const { result } = renderHook(() => useAuthStore());
    // Sau khi reset: không có user, không xác thực
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.justLoggedIn).toBe(false);
  });
});

// ── loginSuccess ──────────────────────────────────────────────────────────────

describe('authStore — loginSuccess', () => {
  test('set user, isAuthenticated=true, token và justLoggedIn=true', () => {
    const { result } = renderHook(() => useAuthStore());
    const user = makeUser();
    const token = makeToken();

    act(() => {
      result.current.loginSuccess({ user, token });
    });

    expect(result.current.user).toEqual(user);
    expect(result.current.token).toBe(token);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.justLoggedIn).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  test('lưu user vào localStorage', () => {
    const { result } = renderHook(() => useAuthStore());
    const user = makeUser();

    act(() => {
      result.current.loginSuccess({ user, token: makeToken() });
    });

    expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(user));
  });

  test('lưu token vào sessionStorage', () => {
    const { result } = renderHook(() => useAuthStore());
    const token = makeToken();

    act(() => {
      result.current.loginSuccess({ user: makeUser(), token });
    });

    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('access_token', token);
  });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe('authStore — logout', () => {
  test('xóa toàn bộ state xác thực', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.loginSuccess({ user: makeUser(), token: makeToken() });
    });
    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.justLoggedIn).toBe(false);
  });

  test('xóa user, cartItems, token, refreshToken khỏi localStorage', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.logout();
    });

    expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    expect(localStorage.removeItem).toHaveBeenCalledWith('cartItems');
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('refreshToken');
  });

  test('xóa access_token khỏi sessionStorage', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.logout();
    });

    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('access_token');
  });
});

// ── updateAccessToken ─────────────────────────────────────────────────────────

describe('authStore — updateAccessToken', () => {
  test('chỉ update token và đặt isAuthenticated=true', () => {
    const { result } = renderHook(() => useAuthStore());
    const newToken = makeToken(7200);

    act(() => {
      result.current.updateAccessToken(newToken);
    });

    expect(result.current.token).toBe(newToken);
    expect(result.current.isAuthenticated).toBe(true);
    // user vẫn null — updateAccessToken không chạm user
    expect(result.current.user).toBeNull();
  });

  test('lưu token mới vào sessionStorage', () => {
    const { result } = renderHook(() => useAuthStore());
    const newToken = makeToken(7200);

    act(() => {
      result.current.updateAccessToken(newToken);
    });

    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('access_token', newToken);
  });
});

// ── updateUser (setUser) ──────────────────────────────────────────────────────

describe('authStore — updateUser', () => {
  test('merge partial user vào user hiện tại', () => {
    const { result } = renderHook(() => useAuthStore());
    const user = makeUser({ firstName: 'Minh' });

    act(() => {
      result.current.loginSuccess({ user, token: makeToken() });
    });
    act(() => {
      result.current.updateUser({ firstName: 'Quan', phone: '0901234567' });
    });

    expect(result.current.user?.firstName).toBe('Quan');
    expect(result.current.user?.phone).toBe('0901234567');
    // email không thay đổi
    expect(result.current.user?.email).toBe('test@example.com');
  });

  test('không làm gì khi user là null', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.updateUser({ firstName: 'Ghost' });
    });

    expect(result.current.user).toBeNull();
  });
});

// ── loginStart / loginFailure ─────────────────────────────────────────────────

describe('authStore — loginStart và loginFailure', () => {
  test('loginStart đặt isLoading=true và xóa error', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      useAuthStore.setState({ error: 'lỗi cũ' });
      result.current.loginStart();
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  test('loginFailure đặt error và isLoading=false', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.loginStart();
      result.current.loginFailure('Sai mật khẩu');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Sai mật khẩu');
  });
});

// ── clearError ────────────────────────────────────────────────────────────────

describe('authStore — clearError', () => {
  test('xóa error về null', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      useAuthStore.setState({ error: 'lỗi nào đó' });
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});

// ── clearJustLoggedIn ─────────────────────────────────────────────────────────

describe('authStore — clearJustLoggedIn', () => {
  test('đặt justLoggedIn = false', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.loginSuccess({ user: makeUser(), token: makeToken() });
    });
    expect(result.current.justLoggedIn).toBe(true);

    act(() => {
      result.current.clearJustLoggedIn();
    });
    expect(result.current.justLoggedIn).toBe(false);
  });
});

// ── Module init: startup state restoration ────────────────────────────────────
// Dùng jest.isolateModules để load module tươi sau khi đã pre-populate storage

describe('authStore — module init state restoration', () => {
  afterEach(() => {
    localStorage.removeItem('user');
    // Đảm bảo sessionStorageMock store sạch cho test kế
    sessionStorageMock.clear();
  });

  test('token hợp lệ trong sessionStorage → isSessionTokenValid + initToken → isAuthenticated=true', () => {
    // Pre-populate sessionStorage TRƯỚC khi module load
    sessionStorageMock.setItem('access_token', makeToken(3600));
    jest.isolateModules(() => {
      const freshStore = (require('@stores/auth-store') as any).useAuthStore;
      expect(freshStore.getState().isAuthenticated).toBe(true);
      expect(freshStore.getState().token).toBeTruthy();
    });
  });

  test('token malformed → isSessionTokenValid catch → initToken=null', () => {
    // middle segment rỗng → atob('')='' → JSON.parse('') throw → catch → return false
    sessionStorageMock.setItem('access_token', 'header..signature');
    jest.isolateModules(() => {
      const freshStore = (require('@stores/auth-store') as any).useAuthStore;
      expect(freshStore.getState().isAuthenticated).toBe(false);
      expect(freshStore.getState().token).toBeNull();
    });
  });

  test('token hết hạn → isSessionTokenValid → false → initToken=null', () => {
    sessionStorageMock.setItem('access_token', makeToken(-60)); // hết hạn 60s trước
    jest.isolateModules(() => {
      const freshStore = (require('@stores/auth-store') as any).useAuthStore;
      expect(freshStore.getState().isAuthenticated).toBe(false);
    });
  });

  test('user trong localStorage → getStoredUser JSON.parse → user được restore', () => {
    const user = { id: '1', email: 'a@a.com', firstName: 'A', lastName: 'B', role: 'customer' };
    // Spy localStorage.getItem (mock thật sự trả dữ liệu — setItem là mock không lưu thật)
    const getItemSpy = jest
      .spyOn(localStorage, 'getItem')
      .mockImplementation((key: string) => (key === 'user' ? JSON.stringify(user) : null));
    jest.isolateModules(() => {
      const freshStore = (require('@stores/auth-store') as any).useAuthStore;
      expect(freshStore.getState().user).toEqual(user);
    });
    getItemSpy.mockRestore();
  });
});
