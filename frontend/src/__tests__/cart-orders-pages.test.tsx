/// <reference types="jest" />
// @ts-nocheck — mock factories dùng loose types, IDE sẽ không báo lỗi trong test files
/**
 * Cart & Orders pages tests — CartPage (empty state, loading), OrdersPage (loading, error, no-auth).
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
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '', pathname: '/cart', state: null }),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
  Link: ({ to, children }: { to: string; children: unknown }) =>
    React.createElement('a', { href: to }, children),
  MemoryRouter: ({ children }: { children: unknown }) => children,
}));

// ── Mock framer-motion ──────────────────────────────────────────
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className }: Record<string, unknown>) =>
      React.createElement('div', { className }, children),
  },
  AnimatePresence: ({ children }: { children: unknown }) => children,
}));

// ── Mock react-helmet-async ─────────────────────────────────────
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: unknown }) => children,
}));

// ── Mock TanStack Query ─────────────────────────────────────────
const mockInvalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

// ── Mock cart stores ────────────────────────────────────────────
// Mỗi test sẽ override lại selector state qua mockCartState
let mockCartState = {
  items: [] as unknown[],
  subtotal: 0,
  totalItems: 0,
  isLoading: false,
  setServerCart: jest.fn(),
  initializeCart: jest.fn(),
  clearLocalCart: jest.fn(),
};

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (selector?: (s: unknown) => unknown) => {
    return selector ? selector(mockCartState) : mockCartState;
  },
}));

let mockAuthState = {
  isAuthenticated: true,
  user: { id: '1', role: 'user' },
  loginSuccess: jest.fn(),
};

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    return selector ? selector(mockAuthState) : mockAuthState;
  },
}));

// ── Mock cart API hooks ─────────────────────────────────────────
let mockGetCartQuery = { data: null, error: null, isLoading: false };
let mockValidateCartQuery = { data: null };
let mockClearCartMutation = { mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false };

jest.mock('@/features/cart/api/cart-api', () => ({
  useGetCartQuery: () => mockGetCartQuery,
  useValidateCartQuery: () => mockValidateCartQuery,
  useClearCartMutation: () => mockClearCartMutation,
  cartKeys: { all: ['cart'], count: ['cart', 'count'] },
  useGetCartCountQuery: () => ({ data: 0 }),
  useUpdateCartItemMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRemoveCartItemMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

// ── Mock cart feature barrel ────────────────────────────────────
jest.mock('@/features/cart', () => ({
  useGetCartCountQuery: () => ({ data: 0 }),
  useClearCartMutation: () => mockClearCartMutation,
  cartKeys: { all: ['cart'], count: ['cart', 'count'] },
  useAddToCartMutation: () => ({ mutateAsync: jest.fn() }),
}));

// ── Mock orders feature ─────────────────────────────────────────
let mockGetUserOrdersQuery = {
  data: null,
  isLoading: true,
  isError: false,
  error: null,
  refetch: jest.fn(),
};

jest.mock('@/features/orders/api/order-api', () => ({
  useGetUserOrdersQuery: () => mockGetUserOrdersQuery,
  useCancelOrderMutation: () => ({ mutateAsync: jest.fn() }),
  useRepayOrderMutation: () => ({ mutateAsync: jest.fn() }),
  useConfirmReceivedMutation: () => ({ mutateAsync: jest.fn() }),
  useApplyDiscountCodeMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/features/orders', () => ({
  OrderDetails: () => null,
  useApplyDiscountCodeMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useGetUserOrdersQuery: () => mockGetUserOrdersQuery,
  useCancelOrderMutation: () => ({ mutateAsync: jest.fn() }),
  useRepayOrderMutation: () => ({ mutateAsync: jest.fn() }),
  useConfirmReceivedMutation: () => ({ mutateAsync: jest.fn() }),
}));

// ── Mock reviews feature ────────────────────────────────────────
jest.mock('@/features/reviews', () => ({
  ReviewModal: () => null,
}));

// ── Mock common components ──────────────────────────────────────
jest.mock('@/components/common', () => ({
  PremiumButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: unknown;
    onClick?: () => void;
    disabled?: boolean;
  }) =>
    React.createElement('button', { onClick, disabled, 'data-testid': 'premium-btn' }, children),
  BannerDisplay: () => null,
}));

jest.mock('@/components/common/Button', () => ({
  __esModule: true,
  default: ({
    children,
    onClick,
    disabled,
    isLoading,
  }: {
    children: unknown;
    onClick?: () => void;
    disabled?: boolean;
    isLoading?: boolean;
    type?: string;
    variant?: string;
    size?: string;
    fullWidth?: boolean;
    className?: string;
  }) =>
    React.createElement(
      'button',
      { onClick, disabled, 'data-testid': 'btn' },
      isLoading ? '...' : children,
    ),
}));

jest.mock('@/components/common/Badge', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) =>
    React.createElement('span', { 'data-testid': 'badge' }, children),
}));

jest.mock('@/components/common/PremiumButton', () => ({
  __esModule: true,
  default: ({
    children,
    onClick,
    disabled,
  }: {
    children: unknown;
    onClick?: () => void;
    disabled?: boolean;
    isProcessing?: boolean;
    processingText?: string;
    iconType?: string;
    variant?: string;
    size?: string;
    className?: string;
  }) =>
    React.createElement('button', { onClick, disabled, 'data-testid': 'premium-btn' }, children),
}));

// ── Mock icons ──────────────────────────────────────────────────
jest.mock('@/components/icons/CheckCircleIcon', () => ({
  __esModule: true,
  default: () => React.createElement('svg', { 'data-testid': 'check-circle' }),
}));

jest.mock('@/components/icons/PlusCircleIcon', () => ({
  __esModule: true,
  default: () => React.createElement('svg', { 'data-testid': 'plus-circle' }),
}));

// ── Mock cart feature CartItem component ────────────────────────
jest.mock('@/features/cart/components/CartItem', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'cart-item' }),
}));

// ── Mock utilities ──────────────────────────────────────────────
jest.mock('@/utils/format', () => ({
  formatPrice: (p: number) => `${p}đ`,
  parsePrice: (p: unknown) => Number(p) || 0,
  getLocale: () => 'vi-VN',
}));

jest.mock('@/utils/toast', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

jest.mock('@/utils/error-utils', () => ({
  getErrorMsg: (_err: unknown, fallback: string) => fallback,
  ErrorType: {},
}));

jest.mock('@/utils/localize', () => ({
  localizeField: (_field: unknown, key: string) => key,
}));

// ── Mock routes ─────────────────────────────────────────────────
jest.mock('@/routes/paths', () => ({
  ROUTES: {
    SHOP: '/shop',
    CART: '/cart',
    CHECKOUT: '/checkout',
    ORDERS: '/orders',
    LOGIN: '/login',
  },
  buildRoute: {
    productDetail: (id: string) => `/products/${id}`,
    paymentQr: (id: string, total: number, number: string) =>
      `/payment-qr/${id}?total=${total}&number=${number}`,
  },
}));

// ── Import pages sau mock ───────────────────────────────────────
import CartPage from '@/features/cart/pages/CartPage';
import OrdersPage from '@/features/orders/pages/OrdersPage';

// ═══════════════════════════════════════════════════════════════
// CartPage
// ═══════════════════════════════════════════════════════════════
describe('CartPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Trạng thái mặc định: giỏ hàng rỗng, đã xác thực, không loading
    mockCartState = {
      items: [],
      subtotal: 0,
      totalItems: 0,
      isLoading: false,
      setServerCart: jest.fn(),
      initializeCart: jest.fn(),
      clearLocalCart: jest.fn(),
    };
    mockAuthState = {
      isAuthenticated: true,
      user: { id: '1', role: 'user' },
      loginSuccess: jest.fn(),
    };
    mockGetCartQuery = { data: null, error: null, isLoading: false };
    mockValidateCartQuery = { data: null };
    mockClearCartMutation = { mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false };
  });

  it('empty state — hiển thị tiêu đề giỏ hàng trống', () => {
    render(<CartPage />);
    expect(screen.getByText('cart.emptyCart.title')).toBeInTheDocument();
  });

  it('empty state — hiển thị thông điệp giỏ hàng rỗng', () => {
    render(<CartPage />);
    expect(screen.getByText('cart.emptyCart.message')).toBeInTheDocument();
  });

  it('loading state — hiển thị spinner khi cart đang tải', () => {
    mockGetCartQuery = { data: null, error: null, isLoading: true };
    render(<CartPage />);
    // CartPage kiểm tra (isAuthenticated && cartLoading) || isLoading
    // khi cartLoading=true → spinner xuất hiện
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('có items trong giỏ hàng — hiển thị tiêu đề cart.cartItems', () => {
    mockCartState = {
      ...mockCartState,
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          name: 'iPhone 15',
          price: 25_000_000,
          quantity: 1,
          image: '',
          inStock: true,
          stockQuantity: 10,
        },
      ],
      totalItems: 1,
      subtotal: 25_000_000,
    };
    render(<CartPage />);
    expect(screen.getByText(/cart\.cartItems/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// OrdersPage
// ═══════════════════════════════════════════════════════════════
describe('OrdersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      isAuthenticated: true,
      user: { id: '1', role: 'user' },
      loginSuccess: jest.fn(),
    };
    mockGetUserOrdersQuery = {
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    mockClearCartMutation = { mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false };
  });

  it('loading state — hiển thị tiêu đề trang đơn hàng khi đang tải', () => {
    render(<OrdersPage />);
    expect(screen.getByText('orders.title')).toBeInTheDocument();
  });

  it('loading state — hiển thị skeleton (animate-pulse)', () => {
    render(<OrdersPage />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('error state — hiển thị thông báo lỗi', () => {
    mockGetUserOrdersQuery = {
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Server error'),
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    expect(screen.getByText('orders.error.title')).toBeInTheDocument();
  });

  it('error state — hiển thị thông điệp lỗi chi tiết', () => {
    mockGetUserOrdersQuery = {
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Server error'),
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    expect(screen.getByText('orders.error.message')).toBeInTheDocument();
  });

  it('không auth (user=null) — hiển thị thông báo yêu cầu đăng nhập', () => {
    // OrdersPage: nếu !user → render "loginRequired" (auth guard ở component level)
    mockAuthState = {
      isAuthenticated: false,
      user: null as unknown as { id: string; role: string },
      loginSuccess: jest.fn(),
    };
    render(<OrdersPage />);
    expect(screen.getByText('orders.loginRequired')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// CartPage — interaction tests
// ═══════════════════════════════════════════════════════════════
describe('CartPage: interaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCartState = {
      items: [],
      subtotal: 0,
      totalItems: 0,
      isLoading: false,
      setServerCart: jest.fn(),
      initializeCart: jest.fn(),
      clearLocalCart: jest.fn(),
    };
    mockAuthState = {
      isAuthenticated: true,
      user: { id: '1', role: 'user' },
      loginSuccess: jest.fn(),
    };
    mockGetCartQuery = { data: null, error: null, isLoading: false };
    mockValidateCartQuery = { data: null };
    mockClearCartMutation = { mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false };
  });

  it('click "Bắt Đầu Mua Sắm" trên empty state → navigate /shop', () => {
    render(<CartPage />);
    // Arrange — button xuất hiện trên empty state
    const startShoppingBtn = screen.getByText('cart.emptyCart.startShopping');
    // Act
    fireEvent.click(startShoppingBtn);
    // Assert — navigate được gọi với /shop
    expect(mockNavigate).toHaveBeenCalledWith('/shop');
  });
});

// ═══════════════════════════════════════════════════════════════
// OrdersPage — interaction tests
// ═══════════════════════════════════════════════════════════════
describe('OrdersPage: interaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      isAuthenticated: true,
      user: { id: '1', role: 'user' },
      loginSuccess: jest.fn(),
    };
    mockClearCartMutation = { mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false };
  });

  it('render với danh sách orders → hiển thị orders', () => {
    // Arrange — 1 đơn hàng trong response
    mockGetUserOrdersQuery = {
      data: {
        data: [
          {
            id: 'ord-1',
            number: 'ORD-2024-001',
            status: 'pending',
            paymentStatus: 'pending',
            paymentMethod: 'cod',
            total: 5_000_000,
            createdAt: new Date().toISOString(),
            items: [],
          },
        ],
        total: 1,
        limit: 10,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    // Act
    render(<OrdersPage />);
    // Assert — tiêu đề trang hiển thị và order card được render (có nút hủy đơn)
    expect(screen.getByText('orders.title')).toBeInTheDocument();
    // Khi có order, nút "Hủy đơn" hiển thị (order status = pending nên có thể hủy)
    expect(screen.getByText('orders.cancelOrder')).toBeInTheDocument();
  });
});
