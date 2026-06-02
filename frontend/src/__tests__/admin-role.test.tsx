/// <reference types="jest" />
/**
 * Tests phân quyền role staff (frontend):
 *  - useAuth().isStaff() / isAdmin()
 *  - AdminRoute với allowedRoles (mặc định admin+staff; ['admin'] chặn staff)
 *  - ViewOnlyBanner render đúng nội dung chế độ xem
 */
import React from 'react';
import { render, screen, renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock i18n ───────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
}));

// ── auth-store: hỗ trợ cả gọi không tham số (useAuth) lẫn selector (AdminRoute) ──
let mockAuthState: Record<string, unknown> = {
  user: null,
  token: null,
  isAuthenticated: false,
};
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      typeof selector === 'function' ? selector(mockAuthState) : mockAuthState,
    { getState: () => mockAuthState },
  ),
}));

// ── auth-api: logout (useAuth) + getCurrentUser (AdminRoute) ──────
let mockCurrentUser: { data: unknown; isLoading: boolean; error: unknown } = {
  data: undefined,
  isLoading: false,
  error: null,
};
jest.mock('@features/auth/api/auth-api', () => ({
  useLogoutMutation: () => ({ mutateAsync: jest.fn() }),
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
});

// ── ViewOnlyBanner ──────────────────────────────────────────────
describe('ViewOnlyBanner', () => {
  it('render tiêu đề + mô tả chế độ xem', () => {
    render(<ViewOnlyBanner />);
    expect(screen.getByText('admin.viewOnly.title')).toBeInTheDocument();
    expect(screen.getByText('admin.viewOnly.description')).toBeInTheDocument();
  });
});
