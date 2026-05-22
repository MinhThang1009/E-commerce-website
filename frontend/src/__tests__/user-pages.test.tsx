/// <reference types="jest" />
// @ts-nocheck — mock factories dùng loose types, IDE sẽ không báo lỗi trong test files
/**
 * User pages tests — WishlistPage (empty state, loading, title), ProfilePage (render, email, form).
 * Dùng @testing-library/react + jsdom + ts-jest.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock react-i18next ───────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
  Trans: ({ children }: { children: unknown }) => children,
}));

// ── Mock react-router-dom ───────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: '', pathname: '/', state: null }),
    useParams: () => ({ slug: 'test-slug', id: '1' }),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    Link: ({ to, children, className }: { to: string; children: unknown; className?: string }) =>
      R.createElement('a', { href: to, className }, children),
    MemoryRouter: ({ children }: { children: unknown }) => children,
  };
});

// ── Mock @heroicons ─────────────────────────────────────────────
jest.mock('@heroicons/react/24/outline', () => {
  const R = require('react');
  return {
    HeartIcon: ({ className }: { className?: string }) =>
      R.createElement('svg', { 'data-testid': 'heart-icon', className }),
    ShoppingCartIcon: () => R.createElement('svg', { 'data-testid': 'cart-icon' }),
  };
});

// ── Mock stores ─────────────────────────────────────────────────
jest.mock('@/stores/wishlist-store', () => ({
  useWishlistStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      items: [] as string[],
      loading: false,
      setWishlist: jest.fn(),
      clearWishlistLocal: jest.fn(),
      addToWishlistLocal: jest.fn(),
      removeFromWishlistLocal: jest.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

let mockAuthState = {
  user: {
    id: '1',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@t.com',
    role: 'customer',
  } as Record<string, unknown> | null,
  isAuthenticated: true,
  updateUser: jest.fn(),
};

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    return selector ? selector(mockAuthState) : mockAuthState;
  },
}));

jest.mock('@/stores/ui-store', () => ({
  useUiStore: (selector?: (s: unknown) => unknown) => {
    const state = { addNotification: jest.fn() };
    return selector ? selector(state) : state;
  },
}));

// ── Mock wishlist API ───────────────────────────────────────────
// Mock toàn bộ wishlist API module để tránh api-client load import.meta.env
// Dùng object wrapper để factory function đọc được giá trị mới nhất qua closure
const wishlistMockState = { data: null as { data: unknown[] } | null };
jest.mock('@/features/wishlist/api/wishlist-api', () => ({
  useGetWishlistQuery: () => ({ data: wishlistMockState.data, isLoading: false }),
  useClearWishlistMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useAddToWishlistMutation: () => ({ mutateAsync: jest.fn() }),
  useRemoveFromWishlistMutation: () => ({ mutateAsync: jest.fn() }),
  useCheckWishlistQuery: () => ({ data: null }),
}));

// ── Mock @/features/wishlist barrel ────────────────────────────
jest.mock('@/features/wishlist', () => ({
  useGetWishlistQuery: () => ({ data: wishlistMockState.data, isLoading: false }),
  useClearWishlistMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useAddToWishlistMutation: () => ({ mutateAsync: jest.fn() }),
  useRemoveFromWishlistMutation: () => ({ mutateAsync: jest.fn() }),
  useCheckWishlistQuery: () => ({ data: null }),
  WishlistPage: () => null,
}));

// ── Mock @/features/catalog barrel ─────────────────────────────
jest.mock('@/features/catalog', () => {
  const R = require('react');
  return {
    ProductCard: () => R.createElement('div', { 'data-testid': 'product-card' }),
    ProductListCard: () => R.createElement('div', { 'data-testid': 'product-list-card' }),
    FilterPanel: () => null,
  };
});

// ── Mock @/features/auth barrel ─────────────────────────────────
jest.mock('@/features/auth', () => ({
  useGetCurrentUserQuery: () => ({ data: null, isLoading: false }),
}));

// ── Mock @/features/users barrel ────────────────────────────────
jest.mock('@/features/users', () => ({
  useUpdateProfileMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useChangePasswordMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useGetAddressesQuery: () => ({ data: null, isLoading: false }),
  useAddAddressMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateAddressMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteAddressMutation: () => ({ mutateAsync: jest.fn() }),
  useSetDefaultAddressMutation: () => ({ mutateAsync: jest.fn() }),
}));

// ── Mock @/components/common barrel (chứa EnhancedRichTextEditor dùng import.meta) ────
jest.mock('@/components/common', () => {
  const R = require('react');
  const btn = ({ children, onClick, disabled }: any) =>
    R.createElement('button', { onClick, disabled, 'data-testid': 'btn' }, children);
  return {
    PremiumButton: btn,
    Button: btn,
    LoadingSpinner: () => R.createElement('div', { 'data-testid': 'loading' }),
    Badge: ({ children }: any) => R.createElement('span', null, children),
    Input: ({ value, onChange, placeholder }: any) =>
      R.createElement('input', { value, onChange, placeholder }),
    Modal: ({ children, isOpen }: any) => (isOpen ? R.createElement('div', null, children) : null),
    ImageUpload: () => null,
    RichTextEditor: () => null,
    EnhancedRichTextEditor: () => null,
    Select: () => null,
    Pagination: () => null,
  };
});

// ── Mock LoadingSpinner ─────────────────────────────────────────
jest.mock('@/components/common/LoadingSpinner', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: ({ fullScreen }: { fullScreen?: boolean }) =>
      R.createElement('div', { 'data-testid': 'loading-spinner', 'data-fullscreen': fullScreen }),
  };
});

// ── Mock utils ──────────────────────────────────────────────────
jest.mock('@/utils/error-utils', () => ({
  getErrorMsg: (_err: unknown, fallback: string) => fallback,
  ErrorType: {},
}));

jest.mock('@/utils/localize', () => ({
  localizeField: (_field: unknown, key: string) => key,
}));

jest.mock('@/utils/format', () => ({
  formatPrice: (p: number) => `${p}đ`,
  parsePrice: (p: unknown) => Number(p) || 0,
  getLocale: () => 'vi-VN',
}));

// ── Mock routes ─────────────────────────────────────────────────
jest.mock('@/routes/paths', () => ({
  ROUTES: {
    SHOP: '/shop',
    ORDERS: '/orders',
    LOGIN: '/login',
    HOME: '/',
  },
  buildRoute: {
    productDetail: (id: string) => `/products/${id}`,
  },
}));

// ── Mock @/components/common/Button ────────────────────────────
// Cần mock để tránh import Link thật khi render as={Link}
jest.mock('@/components/common/Button', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: ({
      children,
      onClick,
      as: _as,
      to,
    }: {
      children: unknown;
      onClick?: () => void;
      as?: unknown;
      to?: string;
    }) => {
      if (to) {
        return R.createElement('a', { href: to, onClick }, children);
      }
      return R.createElement('button', { onClick }, children);
    },
  };
});

// ── Import pages sau mock ───────────────────────────────────────
import WishlistPage from '@/features/wishlist/pages/WishlistPage';
import ProfilePage from '@/features/users/pages/ProfilePage';

// ═══════════════════════════════════════════════════════════════
// WishlistPage
// ═══════════════════════════════════════════════════════════════
describe('WishlistPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wishlistMockState.data = null;
  });

  it('render tiêu đề wishlist không bị crash', () => {
    render(<WishlistPage />);
    expect(screen.getByText('header.dropdown.wishlist')).toBeInTheDocument();
  });

  it('empty state — hiển thị tiêu đề danh sách trống', () => {
    render(<WishlistPage />);
    expect(screen.getByText('wishlist.emptyTitle')).toBeInTheDocument();
  });

  it('empty state — hiển thị mô tả danh sách trống', () => {
    render(<WishlistPage />);
    expect(screen.getByText('wishlist.emptyDesc')).toBeInTheDocument();
  });

  it('empty state — hiển thị nút tiếp tục mua sắm', () => {
    render(<WishlistPage />);
    const shopBtn = screen.getByText('wishlist.continueShopping');
    expect(shopBtn).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// ProfilePage
// ═══════════════════════════════════════════════════════════════
describe('ProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      user: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@t.com', role: 'customer' },
      isAuthenticated: true,
      updateUser: jest.fn(),
    };
  });

  it('render trang profile không bị crash', () => {
    const { container } = render(<ProfilePage />);
    expect(container).toBeInTheDocument();
  });

  it('hiển thị email người dùng trong profile card', () => {
    render(<ProfilePage />);
    expect(screen.getByText('test@t.com')).toBeInTheDocument();
  });

  it('hiển thị tab thông tin cá nhân mặc định', () => {
    render(<ProfilePage />);
    // Tab 'info' được chọn mặc định — nội dung tab info hiển thị
    expect(screen.getByText('profile.info.title')).toBeInTheDocument();
  });

  it('hiển thị role customer của người dùng', () => {
    render(<ProfilePage />);
    expect(screen.getByText('profile.roleCustomer')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// ProfilePage — interaction tests
// ═══════════════════════════════════════════════════════════════
describe('ProfilePage: interaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wishlistMockState.data = null;
    mockAuthState = {
      user: { id: '1', firstName: 'Test', lastName: 'User', email: 'test@t.com', role: 'customer' },
      isAuthenticated: true,
      updateUser: jest.fn(),
    };
  });

  it("click tab 'Đổi mật khẩu' → hiển thị form đổi mật khẩu", () => {
    render(<ProfilePage />);
    // Tab password có label 'profile.tabs.password'
    const passwordTab = screen.getByText('profile.tabs.password');
    fireEvent.click(passwordTab);
    // Sau khi click — nội dung tab password xuất hiện
    expect(screen.getByText('profile.password.title')).toBeInTheDocument();
  });

  it('submit form cập nhật không thay đổi → không crash', () => {
    render(<ProfilePage />);
    // Click nút chỉnh sửa để mở form
    const editBtn = screen.getByText('profile.info.edit');
    fireEvent.click(editBtn);
    // Submit form — không có thay đổi, validateInfoForm sẽ pass vì fields đã có giá trị từ user
    const saveBtn = screen.getByText('profile.info.save');
    expect(() => fireEvent.click(saveBtn)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// WishlistPage — interaction tests
// ═══════════════════════════════════════════════════════════════
describe('WishlistPage: interaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wishlistMockState.data = null;
  });

  it('render khi có wishlist items → hiển thị danh sách', () => {
    // Arrange — 2 sản phẩm trong wishlist
    wishlistMockState.data = {
      data: [
        { id: 'prod-1', name: 'iPhone 15', slug: 'iphone-15', price: 20_000_000, thumbnail: '' },
        { id: 'prod-2', name: 'iPad Pro', slug: 'ipad-pro', price: 25_000_000, thumbnail: '' },
      ],
    };
    // Act
    render(<WishlistPage />);
    // Assert — ProductCard mock render cho từng item
    const cards = screen.getAllByTestId('product-card');
    expect(cards).toHaveLength(2);
  });

  it('"Tiếp tục mua sắm" button render đúng', () => {
    wishlistMockState.data = null;
    render(<WishlistPage />);
    expect(screen.getByText('wishlist.continueShopping')).toBeInTheDocument();
  });
});
