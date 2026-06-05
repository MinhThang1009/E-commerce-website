/// <reference types="jest" />
/**
 * Tests phân quyền role staff (frontend):
 *  - useAuth().isStaff() / isAdmin()
 *  - AdminRoute với allowedRoles (mặc định admin+staff; ['admin'] chặn staff)
 *  - ViewOnlyBanner render đúng nội dung chế độ xem
 */
import React from 'react';
import { render, screen, renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock i18n ───────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
}));

// ── auth-store: hỗ trợ cả gọi không tham số (useAuth) lẫn selector (AdminRoute) ──
const mockStoreLogout = jest.fn();
let mockAuthState: Record<string, unknown> = {
  user: null,
  token: null,
  isAuthenticated: false,
};
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      typeof selector === 'function' ? selector(mockAuthState) : mockAuthState,
    { getState: () => ({ ...mockAuthState, logout: mockStoreLogout }) },
  ),
}));

// ── auth-api: logout (useAuth) + getCurrentUser (AdminRoute) ──────
const mockLogoutMutation = jest.fn().mockResolvedValue({});
let mockCurrentUser: { data: unknown; isLoading: boolean; error: unknown } = {
  data: undefined,
  isLoading: false,
  error: null,
};
jest.mock('@features/auth/api/auth-api', () => ({
  useLogoutMutation: () => ({ mutateAsync: (...a: unknown[]) => mockLogoutMutation(...a) }),
  useGetCurrentUserQuery: () => mockCurrentUser,
}));

// ── Stores phụ chỉ dùng trong logout() — mock tối thiểu ──────────
jest.mock('@/stores/cart-store', () => ({
  useCartStore: { getState: () => ({ initializeCart: jest.fn() }) },
}));
jest.mock('@/stores/chat-store', () => ({
  useChatStore: { getState: () => ({ clearMessages: jest.fn() }) },
}));
jest.mock('@/stores/wishlist-store', () => ({
  useWishlistStore: { getState: () => ({ clearWishlistLocal: jest.fn() }) },
}));
jest.mock('@/lib/query-client', () => ({ queryClient: { clear: jest.fn() } }));

// ── react-router-dom: Navigate -> marker, useLocation tối giản ───
jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    Navigate: ({ to }: { to: string }) =>
      R.createElement('div', { 'data-testid': 'navigate', 'data-to': to }),
    useLocation: () => ({ pathname: '/admin' }),
  };
});

import useAuth from '@features/auth/hooks/use-auth';
import AdminRoute from '@/components/routing/AdminRoute';
import ViewOnlyBanner from '@/features/admin/components/ViewOnlyBanner';
import { ROUTES } from '@/routes/paths';

beforeEach(() => {
  jest.clearAllMocks();
  mockLogoutMutation.mockResolvedValue({});
  mockAuthState = { user: null, token: null, isAuthenticated: false };
  mockCurrentUser = { data: undefined, isLoading: false, error: null };
});

// ── useAuth roles ───────────────────────────────────────────────
describe('useAuth — phân biệt role', () => {
  it('isStaff() = true và isAdmin() = false khi role là staff', () => {
    mockAuthState = { user: { role: 'staff' }, token: 'tok', isAuthenticated: true };
    const { result } = renderHook(() => useAuth());
    expect(result.current.isStaff()).toBe(true);
    expect(result.current.isAdmin()).toBe(false);
  });

  it('isAdmin() = true và isStaff() = false khi role là admin', () => {
    mockAuthState = { user: { role: 'admin' }, token: 'tok', isAuthenticated: true };
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAdmin()).toBe(true);
    expect(result.current.isStaff()).toBe(false);
  });

  it('cả hai = false khi role là customer', () => {
    mockAuthState = { user: { role: 'customer' }, token: 'tok', isAuthenticated: true };
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAdmin()).toBe(false);
    expect(result.current.isStaff()).toBe(false);
  });
});

// ── useAuth — logout + getUserFullName + computed flags ──────────
describe('useAuth — logout', () => {
  it('logout thành công → gọi mutation rồi clear store + localStorage (lines 24-37)', async () => {
    mockAuthState = { user: { role: 'admin' }, token: 'tok', isAuthenticated: true };
    const removeItemSpy = jest.spyOn(window.localStorage, 'removeItem');
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.logout();
    });
    expect(mockLogoutMutation).toHaveBeenCalledTimes(1);
    expect(mockStoreLogout).toHaveBeenCalledTimes(1);
    expect(removeItemSpy).toHaveBeenCalledWith('wishlist');
    expect(removeItemSpy).toHaveBeenCalledWith('recentSearches');
    expect(removeItemSpy).toHaveBeenCalledWith('cartItems');
    removeItemSpy.mockRestore();
  });

  it('logout thất bại (mutation throw) → vẫn gọi store.logout trong catch', async () => {
    mockAuthState = { user: { role: 'admin' }, token: 'tok', isAuthenticated: true };
    mockLogoutMutation.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.logout();
    });
    // Catch branch: chỉ gọi store.logout (không clear stores phụ)
    expect(mockStoreLogout).toHaveBeenCalledTimes(1);
  });
});

describe('useAuth — getUserFullName + flags', () => {
  it('có firstName + lastName → ghép full name (lines 57-58)', () => {
    mockAuthState = {
      user: { firstName: 'Nguyễn', lastName: 'An', role: 'customer' },
      token: 'tok',
      isAuthenticated: true,
    };
    const { result } = renderHook(() => useAuth());
    expect(result.current.getUserFullName()).toBe('Nguyễn An');
  });

  it('không có first/last → fallback về name (line 60)', () => {
    mockAuthState = {
      user: { name: 'Biệt danh', role: 'customer' },
      token: 'tok',
      isAuthenticated: true,
    };
    const { result } = renderHook(() => useAuth());
    expect(result.current.getUserFullName()).toBe('Biệt danh');
  });

  it('không có name → fallback về email', () => {
    mockAuthState = {
      user: { email: 'a@b.com', role: 'customer' },
      token: 'tok',
      isAuthenticated: true,
    };
    const { result } = renderHook(() => useAuth());
    expect(result.current.getUserFullName()).toBe('a@b.com');
  });

  it('user null → fallback "User"', () => {
    mockAuthState = { user: null, token: null, isAuthenticated: false };
    const { result } = renderHook(() => useAuth());
    expect(result.current.getUserFullName()).toBe('User');
  });

  it('isLoggedIn=true khi authenticated + có user; hasToken/needsUserInfo đúng', () => {
    mockAuthState = { user: { role: 'admin' }, token: 'tok', isAuthenticated: true };
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.hasToken).toBe(true);
    expect(result.current.needsUserInfo).toBe(false);
  });

  it('needsUserInfo=true khi authenticated nhưng chưa có user', () => {
    mockAuthState = { user: null, token: 'tok', isAuthenticated: true };
    const { result } = renderHook(() => useAuth());
    expect(result.current.needsUserInfo).toBe(true);
    expect(result.current.isLoggedIn).toBe(false);
  });

  it('hasRole trả về true/false đúng', () => {
    mockAuthState = { user: { role: 'staff' }, token: 'tok', isAuthenticated: true };
    const { result } = renderHook(() => useAuth());
    expect(result.current.hasRole('staff')).toBe(true);
    expect(result.current.hasRole('admin')).toBe(false);
  });
});

// ── AdminRoute allowedRoles ─────────────────────────────────────
describe('AdminRoute — allowedRoles', () => {
  const Child = () => <div>nội-dung-bí-mật</div>;

  it('cho staff vào khi allowedRoles mặc định (admin + staff)', () => {
    mockAuthState = { user: { role: 'staff' }, token: 'tok', isAuthenticated: true };
    render(
      <AdminRoute>
        <Child />
      </AdminRoute>,
    );
    expect(screen.getByText('nội-dung-bí-mật')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('chặn staff (redirect UNAUTHORIZED) khi allowedRoles=[admin]', () => {
    mockAuthState = { user: { role: 'staff' }, token: 'tok', isAuthenticated: true };
    render(
      <AdminRoute allowedRoles={['admin']}>
        <Child />
      </AdminRoute>,
    );
    expect(screen.queryByText('nội-dung-bí-mật')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', ROUTES.UNAUTHORIZED);
  });

  it('cho admin vào khi allowedRoles=[admin]', () => {
    mockAuthState = { user: { role: 'admin' }, token: 'tok', isAuthenticated: true };
    render(
      <AdminRoute allowedRoles={['admin']}>
        <Child />
      </AdminRoute>,
    );
    expect(screen.getByText('nội-dung-bí-mật')).toBeInTheDocument();
  });

  it('redirect LOGIN khi không có token', () => {
    mockAuthState = { user: null, token: null, isAuthenticated: false };
    render(
      <AdminRoute>
        <Child />
      </AdminRoute>,
    );
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', ROUTES.LOGIN);
  });

  it('có token nhưng chưa có user + đang fetch → hiển thị spinner verifyingAccess (line 49)', () => {
    mockAuthState = { user: null, token: 'tok', isAuthenticated: true };
    mockCurrentUser = { data: undefined, isLoading: true, error: null };
    render(
      <AdminRoute>
        <Child />
      </AdminRoute>,
    );
    // Đang loading → chưa render children, hiển thị text verifying
    expect(screen.queryByText('nội-dung-bí-mật')).not.toBeInTheDocument();
    expect(screen.getByText('admin.verifyingAccess')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('fetch user thất bại (error) → redirect LOGIN (line 63)', () => {
    mockAuthState = { user: null, token: 'tok', isAuthenticated: true };
    mockCurrentUser = { data: undefined, isLoading: false, error: new Error('401') };
    render(
      <AdminRoute>
        <Child />
      </AdminRoute>,
    );
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', ROUTES.LOGIN);
  });

  it('có token, không loading/error nhưng chưa authenticated + không có currentUser → redirect LOGIN (line 70)', () => {
    // token tồn tại nhưng user đã có sẵn (shouldFetchUser=false) → bỏ qua loading
    // isAuthenticated=false và API không trả currentUser
    mockAuthState = { user: { role: 'admin' }, token: 'tok', isAuthenticated: false };
    mockCurrentUser = { data: undefined, isLoading: false, error: null };
    render(
      <AdminRoute>
        <Child />
      </AdminRoute>,
    );
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', ROUTES.LOGIN);
  });

  it('currentUser từ API ưu tiên hơn user store khi check role', () => {
    // user store không có role hợp lệ, nhưng API trả admin → cho vào
    mockAuthState = { user: null, token: 'tok', isAuthenticated: true };
    mockCurrentUser = { data: { role: 'admin' }, isLoading: false, error: null };
    render(
      <AdminRoute>
        <Child />
      </AdminRoute>,
    );
    expect(screen.getByText('nội-dung-bí-mật')).toBeInTheDocument();
  });
});

// ── ViewOnlyBanner ──────────────────────────────────────────────
describe('ViewOnlyBanner', () => {
  it('render tiêu đề + mô tả chế độ xem', () => {
    render(<ViewOnlyBanner />);
    expect(screen.getByText('admin.viewOnly.title')).toBeInTheDocument();
    expect(screen.getByText('admin.viewOnly.description')).toBeInTheDocument();
  });
});
