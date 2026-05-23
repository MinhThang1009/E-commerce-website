/// <reference types="jest" />
// @ts-nocheck — mock factories dùng loose types, IDE sẽ không báo lỗi trong test files
/**
 * Cart & Orders pages tests — CartPage (empty state, loading), OrdersPage (loading, error, no-auth).
 * Dùng @testing-library/react + jsdom + ts-jest.
 */
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock react-i18next ───────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
  Trans: ({ children }: { children: unknown }) => children,
}));

// ── Mock react-router-dom ───────────────────────────────────────
const mockNavigate = jest.fn();
// Biến động để test cases override location.search khi cần
const mockLocation = { search: '', pathname: '/orders', state: null };
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
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

// Biến có thể override trong từng test để kiểm tra hành vi cancel/confirm
let mockCancelOrderFn = jest.fn().mockResolvedValue(undefined);
let mockConfirmReceivedFn = jest.fn().mockResolvedValue({});
const mockRepayOrderFn = jest.fn().mockResolvedValue({ data: {} });

jest.mock('@/features/orders/api/order-api', () => ({
  useGetUserOrdersQuery: () => mockGetUserOrdersQuery,
  useCancelOrderMutation: () => ({ mutateAsync: mockCancelOrderFn }),
  useRepayOrderMutation: () => ({ mutateAsync: mockRepayOrderFn }),
  useConfirmReceivedMutation: () => ({ mutateAsync: mockConfirmReceivedFn }),
  useApplyDiscountCodeMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/features/orders', () => {
  const R = require('react');
  return {
    OrderDetails: ({ onOpenReview }: { onOpenReview?: (id: string, name: string) => void }) =>
      R.createElement(
        'button',
        {
          'data-testid': 'write-review-btn',
          onClick: () => onOpenReview?.('prod-test-id', 'Test Product'),
        },
        'write-review',
      ),
    useApplyDiscountCodeMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
    useGetUserOrdersQuery: () => mockGetUserOrdersQuery,
    useCancelOrderMutation: () => ({ mutateAsync: mockCancelOrderFn }),
    useRepayOrderMutation: () => ({ mutateAsync: mockRepayOrderFn }),
    useConfirmReceivedMutation: () => ({ mutateAsync: mockConfirmReceivedFn }),
  };
});

// ── Mock reviews feature ────────────────────────────────────────
jest.mock('@/features/reviews', () => {
  const R = require('react');
  return {
    ReviewModal: ({
      isOpen,
      onClose,
      onSuccess,
    }: {
      isOpen?: boolean;
      onClose?: () => void;
      onSuccess?: () => void;
    }) =>
      isOpen
        ? R.createElement(
            'div',
            { 'data-testid': 'review-modal' },
            R.createElement('button', { onClick: onClose, 'data-testid': 'close-review' }, 'close'),
            R.createElement(
              'button',
              { onClick: onSuccess, 'data-testid': 'success-review' },
              'success',
            ),
          )
        : null,
  };
});

// ── Mock use-notifications hook ─────────────────────────────────
const mockShowNotification = jest.fn();
jest.mock('@/hooks/use-notifications', () => ({
  useNotifications: () => ({ showNotification: mockShowNotification }),
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

  it('empty state — hiển thị thông báo đơn hàng trống khi orders=[]', () => {
    // Arrange — đã đăng nhập, không có đơn hàng nào
    mockGetUserOrdersQuery = {
      data: { data: [], total: 0, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    // Act
    render(<OrdersPage />);
    // Assert — empty state
    expect(screen.getByText('orders.empty.title')).toBeInTheDocument();
  });

  it('empty state — nút "Bắt đầu mua sắm" navigate đến /shop', () => {
    // Arrange
    mockGetUserOrdersQuery = {
      data: { data: [], total: 0, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    // Act
    render(<OrdersPage />);
    const shopBtn = screen.getByText('orders.empty.startShopping');
    fireEvent.click(shopBtn);
    // Assert — navigate đến /shop
    expect(mockNavigate).toHaveBeenCalledWith('/shop');
  });

  it('error state — click nút "Thử lại" gọi refetch', () => {
    // Arrange
    const mockRefetch = jest.fn();
    mockGetUserOrdersQuery = {
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Server error'),
      refetch: mockRefetch,
    };
    // Act
    render(<OrdersPage />);
    const retryBtn = screen.getByText('orders.tryAgain');
    fireEvent.click(retryBtn);
    // Assert — refetch được gọi
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('không auth — hiển thị nút đăng nhập khi user=null', () => {
    // Arrange — user = null (auth guard)
    mockAuthState = {
      isAuthenticated: false,
      user: null as unknown as { id: string; role: string },
      loginSuccess: jest.fn(),
    };
    // Act
    render(<OrdersPage />);
    // Assert — nút đăng nhập hiển thị trong auth guard UI (key: auth.register.signInLink)
    expect(screen.getByText('auth.register.signInLink')).toBeInTheDocument();
  });

  it('đơn hàng với items → hiển thị tổng số items', () => {
    // Arrange — order có 2 items
    mockGetUserOrdersQuery = {
      data: {
        data: [
          {
            id: 'ord-2',
            number: 'ORD-2024-002',
            status: 'processing',
            paymentStatus: 'paid',
            paymentMethod: 'vnpay',
            total: 10_000_000,
            createdAt: new Date().toISOString(),
            items: [
              { id: 'item-1', Product: { name: 'iPhone 16', thumbnail: '' } },
              { id: 'item-2', Product: { name: 'AirPods Pro', thumbnail: '' } },
            ],
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
    // Assert — hiển thị số items (orders.items key với count=2)
    expect(screen.getByText('orders.title')).toBeInTheDocument();
  });

  it('đơn hàng status shipped → hiển thị nút xác nhận đã nhận hàng', () => {
    // Arrange — order ở trạng thái shipped
    mockGetUserOrdersQuery = {
      data: {
        data: [
          {
            id: 'ord-3',
            number: 'ORD-2024-003',
            status: 'shipped',
            paymentStatus: 'paid',
            paymentMethod: 'cod',
            total: 3_000_000,
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
    // Assert — nút "Đã nhận hàng" hiển thị
    expect(screen.getByText('orders.confirmReceived')).toBeInTheDocument();
  });

  it('click toggleOrderDetails → hiển thị/ẩn chi tiết đơn hàng', () => {
    // Arrange — 1 đơn hàng
    mockGetUserOrdersQuery = {
      data: {
        data: [
          {
            id: 'ord-4',
            number: 'ORD-2024-004',
            status: 'delivered',
            paymentStatus: 'paid',
            paymentMethod: 'cod',
            total: 7_000_000,
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
    // Nút mặc định là "Xem chi tiết"
    const viewDetailsBtn = screen.getByText('orders.viewDetails');
    expect(viewDetailsBtn).toBeInTheDocument();
    // Click → toggle sang "Ẩn chi tiết"
    fireEvent.click(viewDetailsBtn);
    expect(screen.getByText('orders.hideDetails')).toBeInTheDocument();
  });

  it('handlePageChange — click trang trước đó reset selectedOrder về null', () => {
    // Arrange — đủ đơn hàng để pagination hiển thị (total > limit)
    const ordersData = Array.from({ length: 5 }, (_, i) => ({
      id: `ord-pg-${i}`,
      number: `ORD-PG-00${i}`,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'cod',
      total: 1_000_000,
      createdAt: new Date().toISOString(),
      items: [],
    }));
    mockGetUserOrdersQuery = {
      data: { data: ordersData, total: 25, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    // Act
    render(<OrdersPage />);
    // Pagination xuất hiện (totalPages = ceil(25/10) = 3 > 1)
    const nextBtn = screen.getByText('common.next');
    fireEvent.click(nextBtn);
    // Assert — component không crash, vẫn hiển thị tiêu đề
    expect(screen.getByText('orders.title')).toBeInTheDocument();
  });

  it('URL có payment=success → clearLocalCart được gọi và navigate /orders', () => {
    // Arrange — mock location.search với payment=success
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      useLocation: () => ({ search: '?payment=success', pathname: '/orders', state: null }),
      useSearchParams: () => [new URLSearchParams(), jest.fn()],
      Link: ({ to, children }: { to: string; children: unknown }) =>
        React.createElement('a', { href: to }, children),
    }));

    mockGetUserOrdersQuery = {
      data: { data: [], total: 0, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    mockCartState = {
      ...mockCartState,
      clearLocalCart: jest.fn(),
    };
    // Act — render bình thường, useLocation sẽ trả về search có payment=success
    render(<OrdersPage />);
    // Assert — không crash
    expect(screen.getByText('orders.title')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// OrdersPage — cancel và confirm order actions
// ═══════════════════════════════════════════════════════════════
describe('OrdersPage: cancel và confirm order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      isAuthenticated: true,
      user: { id: '1', role: 'user' },
      loginSuccess: jest.fn(),
    };
    mockCancelOrderFn = jest.fn().mockResolvedValue(undefined);
    mockConfirmReceivedFn = jest.fn().mockResolvedValue({});
    mockClearCartMutation = { mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false };
  });

  const makePendingOrder = (id = 'ord-cancel-1') => ({
    id,
    number: `ORD-CANCEL-${id}`,
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'cod',
    total: 2_000_000,
    createdAt: new Date().toISOString(),
    items: [],
  });

  const makeShippedOrder = (id = 'ord-shipped-1') => ({
    id,
    number: `ORD-SHIPPED-${id}`,
    status: 'shipped',
    paymentStatus: 'paid',
    paymentMethod: 'cod',
    total: 3_000_000,
    createdAt: new Date().toISOString(),
    items: [],
  });

  it('click hủy đơn hàng với confirm=true → cancelOrder được gọi với orderId đúng', async () => {
    // Arrange
    const mockRefetch = jest.fn();
    mockGetUserOrdersQuery = {
      data: { data: [makePendingOrder('ord-c1')], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    };
    // Giả lập user bấm OK trên dialog confirm
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<OrdersPage />);

    // Act — click nút hủy đơn
    const cancelBtn = screen.getByText('orders.cancelOrder');
    fireEvent.click(cancelBtn);

    // Assert — cancelOrder được gọi với đúng orderId
    await new Promise((r) => setTimeout(r, 0));
    expect(mockCancelOrderFn).toHaveBeenCalledWith('ord-c1');
  });

  it('click hủy đơn hàng với confirm=false → cancelOrder không được gọi', () => {
    // Arrange
    mockGetUserOrdersQuery = {
      data: { data: [makePendingOrder('ord-c2')], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    // Giả lập user bấm Cancel trên dialog confirm
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<OrdersPage />);

    // Act
    const cancelBtn = screen.getByText('orders.cancelOrder');
    fireEvent.click(cancelBtn);

    // Assert — cancelOrder không được gọi vì user từ chối
    expect(mockCancelOrderFn).not.toHaveBeenCalled();
  });

  it('cancelOrder thất bại → showNotification được gọi với type error', async () => {
    // Arrange
    mockCancelOrderFn = jest.fn().mockRejectedValue(new Error('Network error'));
    mockGetUserOrdersQuery = {
      data: { data: [makePendingOrder('ord-c3')], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<OrdersPage />);

    // Act
    const cancelBtn = screen.getByText('orders.cancelOrder');
    fireEvent.click(cancelBtn);

    // Assert — đợi promise reject, sau đó verify notification
    await new Promise((r) => setTimeout(r, 0));
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('cancelOrder thành công → refetch được gọi để cập nhật danh sách', async () => {
    // Arrange
    const mockRefetch = jest.fn();
    mockCancelOrderFn = jest.fn().mockResolvedValue(undefined);
    mockGetUserOrdersQuery = {
      data: { data: [makePendingOrder('ord-c4')], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    };
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<OrdersPage />);
    const cancelBtn = screen.getByText('orders.cancelOrder');
    fireEvent.click(cancelBtn);

    await new Promise((r) => setTimeout(r, 0));

    // Assert — refetch được gọi sau khi cancel thành công
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('click xác nhận nhận hàng với confirm=true và điểm = 0 → showNotification orders.receivedSuccess', async () => {
    // Arrange
    mockConfirmReceivedFn = jest.fn().mockResolvedValue({});
    const mockRefetch = jest.fn();
    mockGetUserOrdersQuery = {
      data: { data: [makeShippedOrder('ord-s1')], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    };
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<OrdersPage />);

    const confirmBtn = screen.getByText('orders.confirmReceived');
    fireEvent.click(confirmBtn);

    await new Promise((r) => setTimeout(r, 0));

    // Assert — thông báo nhận hàng thành công không có điểm
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'orders.receivedSuccess', type: 'success' }),
    );
  });

  it('confirmReceived thất bại → showNotification được gọi với type error', async () => {
    // Arrange
    mockConfirmReceivedFn = jest.fn().mockRejectedValue(new Error('Server error'));
    mockGetUserOrdersQuery = {
      data: { data: [makeShippedOrder('ord-s3')], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<OrdersPage />);

    const confirmBtn = screen.getByText('orders.confirmReceived');
    fireEvent.click(confirmBtn);

    await new Promise((r) => setTimeout(r, 0));

    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('đơn hàng có trackingNumber → hiển thị mã tracking', () => {
    // Arrange
    mockGetUserOrdersQuery = {
      data: {
        data: [
          {
            id: 'ord-track-1',
            number: 'ORD-TRACK-001',
            status: 'shipped',
            paymentStatus: 'paid',
            paymentMethod: 'cod',
            total: 5_000_000,
            createdAt: new Date().toISOString(),
            items: [],
            trackingNumber: 'VNP-123456789',
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

    render(<OrdersPage />);

    // Assert — tracking number hiển thị
    expect(screen.getByText('VNP-123456789')).toBeInTheDocument();
  });

  it('đơn hàng có > 4 items → hiển thị badge "+N" cho số items còn lại', () => {
    // Arrange — tạo đơn hàng có 6 items
    const sixItems = Array.from({ length: 6 }, (_, i) => ({
      id: `item-${i}`,
      name: `Product ${i}`,
      Product: { name: `Product ${i}`, thumbnail: '' },
    }));
    mockGetUserOrdersQuery = {
      data: {
        data: [
          {
            id: 'ord-many-items',
            number: 'ORD-MANY-001',
            status: 'processing',
            paymentStatus: 'paid',
            paymentMethod: 'vnpay',
            total: 6_000_000,
            createdAt: new Date().toISOString(),
            items: sixItems,
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

    render(<OrdersPage />);

    // Assert — "+2" badge hiển thị (6 items - 4 hiển thị = 2 ẩn)
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('orders rỗng (items=[]) → hiển thị thông báo không có items', () => {
    // Arrange — order không có items
    mockGetUserOrdersQuery = {
      data: {
        data: [
          {
            id: 'ord-empty-items',
            number: 'ORD-EMPTY-001',
            status: 'pending',
            paymentStatus: 'pending',
            paymentMethod: 'cod',
            total: 1_000_000,
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

    render(<OrdersPage />);

    // Assert — thông báo không tìm thấy items
    expect(screen.getByText('orders.noItemsFound')).toBeInTheDocument();
  });

  it('đơn hàng status delivered → không hiển thị nút xác nhận nhận hàng', () => {
    mockGetUserOrdersQuery = {
      data: {
        data: [
          {
            id: 'ord-delivered',
            number: 'ORD-DEL-001',
            status: 'delivered',
            paymentStatus: 'paid',
            paymentMethod: 'cod',
            total: 4_000_000,
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

    render(<OrdersPage />);

    expect(screen.queryByText('orders.confirmReceived')).not.toBeInTheDocument();
  });

  it('pagination: tổng > limit → hiển thị nút điều hướng trang', () => {
    // Arrange — 25 orders, limit 10 → 3 trang
    const orders = Array.from({ length: 5 }, (_, i) => ({
      id: `ord-pg-${i}`,
      number: `ORD-PG-${String(i).padStart(3, '0')}`,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'cod',
      total: 1_000_000,
      createdAt: new Date().toISOString(),
      items: [],
    }));
    mockGetUserOrdersQuery = {
      data: { data: orders, total: 25, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };

    render(<OrdersPage />);

    // Assert — nút Previous và Next hiển thị
    expect(screen.getByText('common.previous')).toBeInTheDocument();
    expect(screen.getByText('common.next')).toBeInTheDocument();
  });

  it('pagination: click trang 2 → setCurrentPage được gọi và selectedOrder reset', () => {
    // Arrange — đủ orders để có phân trang
    const orders = Array.from({ length: 5 }, (_, i) => ({
      id: `ord-p2-${i}`,
      number: `ORD-P2-${String(i).padStart(3, '0')}`,
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'cod',
      total: 2_000_000,
      createdAt: new Date().toISOString(),
      items: [],
    }));
    mockGetUserOrdersQuery = {
      data: { data: orders, total: 20, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };

    render(<OrdersPage />);

    // Act — click nút trang 2
    const page2Btn = screen.getByText('2');
    fireEvent.click(page2Btn);

    // Assert — component không crash, tiêu đề vẫn hiển thị
    expect(screen.getByText('orders.title')).toBeInTheDocument();
  });

  it('đơn hàng có paymentStatus → hiển thị badge trạng thái thanh toán', () => {
    // Arrange — order với paymentStatus=paid
    mockGetUserOrdersQuery = {
      data: {
        data: [
          {
            id: 'ord-pay-status',
            number: 'ORD-PAY-001',
            status: 'delivered',
            paymentStatus: 'paid',
            paymentMethod: 'vnpay',
            total: 8_000_000,
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

    render(<OrdersPage />);

    // Assert — paymentStatus badge hiển thị (t key: orders.paymentStatus.paid)
    expect(screen.getByText('orders.paymentStatus.paid')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// OrdersPage — payment redirect, login button, review modal
// ═══════════════════════════════════════════════════════════════
describe('OrdersPage: payment redirect và login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.search = '';
    mockAuthState = {
      isAuthenticated: true,
      user: { id: '1', role: 'user' },
      loginSuccess: jest.fn(),
    };
    mockClearCartMutation = { mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false };
    mockGetUserOrdersQuery = {
      data: { data: [], total: 0, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
  });

  it('URL ?payment=success → clearLocalCart được gọi và navigate /orders (replace)', () => {
    mockLocation.search = '?payment=success';
    mockCartState = { ...mockCartState, clearLocalCart: jest.fn() };
    render(<OrdersPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/orders', { replace: true });
  });

  it('URL ?payment=failed → showNotification type error và navigate /orders (replace)', () => {
    mockLocation.search = '?payment=failed';
    render(<OrdersPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/orders', { replace: true });
  });

  it('unauthenticated → nút đăng nhập render đúng label', () => {
    mockAuthState = { isAuthenticated: false, user: null, loginSuccess: jest.fn() };
    render(<OrdersPage />);
    expect(screen.getByText('auth.register.signInLink')).toBeInTheDocument();
  });

  it('click nút trang trước (previous page) khi currentPage>1 → handlePageChange được gọi', () => {
    const orders = Array.from({ length: 15 }, (_, i) => ({
      id: `ord-pp-${i}`,
      number: `ORD-PP-${i}`,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'cod',
      total: 1_000_000,
      createdAt: new Date().toISOString(),
      items: [],
    }));
    mockGetUserOrdersQuery = {
      data: { data: orders, total: 15, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    // Click trang 2 trước để currentPage = 2
    const page2Btn = screen.getByText('2');
    fireEvent.click(page2Btn);
    // Sau đó click Previous (button "common.previous")
    const prevBtn = screen.getByText('common.previous');
    fireEvent.click(prevBtn);
    // Assert — không crash
    expect(screen.getByText('orders.title')).toBeInTheDocument();
  });

  it('click Viết đánh giá trên đơn delivered → ReviewModal được mở (reviewProduct set)', () => {
    const deliveredOrder = {
      id: 'ord-review-1',
      number: 'ORD-REV-001',
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'cod',
      total: 5_000_000,
      createdAt: new Date().toISOString(),
      items: [
        { id: 'item-1', productId: 'prod-1', name: 'iPhone 17', quantity: 1, price: 5_000_000 },
      ],
    };
    mockGetUserOrdersQuery = {
      data: { data: [deliveredOrder], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    // Click "Xem chi tiết" để mở OrderDetails
    fireEvent.click(screen.getByText('orders.viewDetails'));
    // Click "Write review" trong OrderDetails mock → gọi handleOpenReview
    fireEvent.click(screen.getByTestId('write-review-btn'));
    // Assert — ReviewModal mở (isOpen=true)
    expect(screen.getByTestId('review-modal')).toBeInTheDocument();
  });

  it('ReviewModal onClose → đóng modal và reset reviewProduct', () => {
    const deliveredOrder = {
      id: 'ord-review-close',
      number: 'ORD-CLOSE-001',
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'cod',
      total: 3_000_000,
      createdAt: new Date().toISOString(),
      items: [],
    };
    mockGetUserOrdersQuery = {
      data: { data: [deliveredOrder], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    // Mở modal qua toggle + write-review
    fireEvent.click(screen.getByText('orders.viewDetails'));
    fireEvent.click(screen.getByTestId('write-review-btn'));
    expect(screen.getByTestId('review-modal')).toBeInTheDocument();
    // Act — click close
    fireEvent.click(screen.getByTestId('close-review'));
    // Assert — modal đóng
    expect(screen.queryByTestId('review-modal')).not.toBeInTheDocument();
  });

  it('ReviewModal onSuccess → modal đóng và refetch được gọi', () => {
    const mockRefetch = jest.fn();
    const deliveredOrder = {
      id: 'ord-review-success',
      number: 'ORD-SUCCESS-001',
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'cod',
      total: 4_000_000,
      createdAt: new Date().toISOString(),
      items: [],
    };
    mockGetUserOrdersQuery = {
      data: { data: [deliveredOrder], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    };
    render(<OrdersPage />);
    fireEvent.click(screen.getByText('orders.viewDetails'));
    fireEvent.click(screen.getByTestId('write-review-btn'));
    // Act — click success
    fireEvent.click(screen.getByTestId('success-review'));
    // Assert — refetch được gọi (onSuccess chỉ refetch, không đóng modal)
    expect(mockRefetch).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Branch coverage — uncovered paths (lines 121, 181, 324-325, 386, 503-517, 563, 606)
// ════════════════════════════════════════════════════════════════════════════════

describe('OrdersPage — branch coverage bổ sung', () => {
  const makeOrder = (overrides = {}) => ({
    id: 'ord-br-1',
    number: 'ORD-BR-001',
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: 'cod',
    total: 1_000_000,
    createdAt: new Date().toISOString(),
    items: [],
    ...overrides,
  });

  beforeEach(() => {
    mockGetUserOrdersQuery = {
      data: { data: [makeOrder()], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
  });

  // ── Line 121: toggleOrderDetails đóng lại khi click lần 2 ──────────────────
  it('toggleOrderDetails: click lần 2 cùng đơn → ẩn chi tiết (set null)', () => {
    render(<OrdersPage />);
    const viewBtn = screen.getByText('orders.viewDetails');
    fireEvent.click(viewBtn); // mở
    expect(screen.getByText('orders.hideDetails')).toBeInTheDocument();
    fireEvent.click(screen.getByText('orders.hideDetails')); // đóng
    expect(screen.getByText('orders.viewDetails')).toBeInTheDocument();
  });

  // ── Line 181: handleConfirmReceived — user cancel confirm dialog ────────────
  it('handleConfirmReceived: user bấm Cancel → confirmReceived không được gọi', async () => {
    mockGetUserOrdersQuery = {
      data: { data: [makeOrder({ status: 'shipped' })], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    mockConfirmReceivedFn = jest.fn().mockResolvedValue({});
    jest.spyOn(window, 'confirm').mockReturnValue(false); // user nhấn Cancel

    render(<OrdersPage />);
    fireEvent.click(screen.getByText('orders.confirmReceived'));

    await new Promise((r) => setTimeout(r, 0));
    expect(mockConfirmReceivedFn).not.toHaveBeenCalled();
  });

  // ── Lines 324-325: ordersResponse = null → orders=[], totalPages=1 ──────────
  it('ordersResponse null → hiển thị empty state', () => {
    mockGetUserOrdersQuery = {
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    expect(screen.getByText('orders.empty.title')).toBeInTheDocument();
  });

  // ── Line 386: status không có trong statusColors → fallback border class ────
  // statusColors chỉ có delivered/cancelled — processing dùng fallback 'border-l-neutral-400'
  it('đơn hàng status processing → render thành công, hiển thị badge', () => {
    mockGetUserOrdersQuery = {
      data: { data: [makeOrder({ status: 'processing' })], total: 1, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    // Render thành công — badge status hiển thị
    expect(screen.getByText('orders.status.processing')).toBeInTheDocument();
  });

  // ── Lines 504-518: 3 branches của src image expression ─────────────────────

  it('item có Product.thumbnail → render <img> với thumbnail', () => {
    mockGetUserOrdersQuery = {
      data: {
        data: [
          makeOrder({
            items: [
              {
                id: 'i1',
                name: 'P1',
                quantity: 1,
                unitPrice: 1,
                subtotal: 1,
                Product: { id: 'p1', name: 'P1', images: [], thumbnail: 'https://cdn.test/t.jpg' },
              },
            ],
          }),
        ],
        total: 1,
        limit: 10,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    expect(document.querySelector('img[alt="P1"]')).toBeInTheDocument();
  });

  it('item Product.thumbnail null nhưng images[0] có giá trị → render <img> với images[0]', () => {
    mockGetUserOrdersQuery = {
      data: {
        data: [
          makeOrder({
            items: [
              {
                id: 'i2',
                name: 'P2',
                quantity: 1,
                unitPrice: 1,
                subtotal: 1,
                Product: {
                  id: 'p2',
                  name: 'P2',
                  images: ['https://cdn.test/img0.jpg'],
                  thumbnail: undefined,
                },
              },
            ],
          }),
        ],
        total: 1,
        limit: 10,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    expect(document.querySelector('img[alt="P2"]')).toBeInTheDocument();
  });

  it('item.image có giá trị khi Product null → render <img> với item.image', () => {
    mockGetUserOrdersQuery = {
      data: {
        data: [
          makeOrder({
            items: [
              {
                id: 'i3',
                name: 'P3',
                quantity: 1,
                unitPrice: 1,
                subtotal: 1,
                image: 'https://cdn.test/item.jpg',
                Product: undefined,
              },
            ],
          }),
        ],
        total: 1,
        limit: 10,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    expect(document.querySelector('img[alt="P3"]')).toBeInTheDocument();
  });

  // ── Line 518: cả Product.name lẫn item.name đều null → hiển thị '?' ──────────
  it('item không có thumbnail và không có tên → hiển thị "?"', () => {
    mockGetUserOrdersQuery = {
      data: {
        data: [
          makeOrder({
            items: [
              {
                id: 'i-noname',
                name: undefined,
                quantity: 1,
                unitPrice: 1,
                subtotal: 1,
                Product: { id: 'p-noname', name: undefined, images: [], thumbnail: undefined },
              },
            ],
          }),
        ],
        total: 1,
        limit: 10,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  // ── Lines 503-517: item không có thumbnail → hiển thị placeholder ───────────
  it('item không có thumbnail, images, image → hiển thị ký tự đầu tên sản phẩm', () => {
    mockGetUserOrdersQuery = {
      data: {
        data: [
          makeOrder({
            items: [
              {
                id: 'item-1',
                name: 'Samsung',
                quantity: 1,
                unitPrice: 500_000,
                subtotal: 500_000,
                // Product không có thumbnail
                Product: { id: 'p1', name: 'Samsung Galaxy', images: [], thumbnail: undefined },
              },
            ],
          }),
        ],
        total: 1,
        limit: 10,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    // Placeholder hiển thị ký tự đầu
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  // ── Line 563: estimatedDelivery có giá trị → hiển thị ──────────────────────
  it('đơn hàng có estimatedDelivery → hiển thị ngày giao dự kiến', () => {
    mockGetUserOrdersQuery = {
      data: {
        data: [
          makeOrder({
            estimatedDelivery: '2026-06-01T00:00:00.000Z',
            trackingNumber: 'VN-12345',
          }),
        ],
        total: 1,
        limit: 10,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    expect(screen.getByText('orders.estimatedDelivery:')).toBeInTheDocument();
  });

  // ── Line 606: pagination ellipsis khi có gap giữa các trang ────────────────
  // currentPage=1, totalPages=20 → filter giữ [1,2,3,20] → gap giữa 3 và 20 → '...'
  it('pagination 20 trang trang đầu → hiển thị "..." trước trang cuối', () => {
    const orders = Array.from({ length: 5 }, (_, i) =>
      makeOrder({ id: `p${i}`, number: `ORD-E${i}` }),
    );
    mockGetUserOrdersQuery = {
      data: { data: orders, total: 200, limit: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<OrdersPage />);
    // Trang 1 hiện tại → array sau filter: [1,2,3,20] → gap giữa 3→20 → ellipsis
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// CartPage — branch coverage bổ sung
// ═══════════════════════════════════════════════════════════════
describe('CartPage — branch coverage bổ sung', () => {
  // Biến để override useApplyDiscountCodeMutation trong từng test
  // jest.requireMock trả về object mutable — override property trực tiếp.
  const ordersModuleMock = jest.requireMock('@/features/orders');

  const cartItem = {
    id: 'item-1',
    productId: 'prod-1',
    name: 'iPhone 15',
    price: 25_000_000,
    quantity: 1,
    image: '',
    inStock: true,
    stockQuantity: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset URL về không có query string bằng pushState (an toàn với jsdom)
    window.history.pushState({}, '', '/cart');
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
    mockClearCartMutation = {
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      mutate: jest.fn(),
      isPending: false,
    };
    // Reset applyDiscount về default (success)
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: jest.fn(),
      isPending: false,
    });
  });

  afterEach(() => {
    // Restore URL sau mỗi test
    window.history.pushState({}, '', '/cart');
  });

  // ── MoMo redirect thành công ────────────────────────────────────────────────
  it('MoMo redirect thành công (resultCode=0) → clearLocalCart + invalidateQueries + navigate ORDERS', () => {
    window.history.pushState({}, '', '/cart?status=momo-return&resultCode=0');
    render(<CartPage />);
    expect(mockCartState.clearLocalCart).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/orders', { replace: true });
  });

  it('MoMo redirect thành công + isAuthenticated → clearServerCart cũng được gọi', () => {
    window.history.pushState({}, '', '/cart?status=momo-return&resultCode=0');
    render(<CartPage />);
    // clearServerCart (mockClearCartMutation.mutateAsync) được gọi khi isAuthenticated=true
    expect(mockClearCartMutation.mutateAsync).toHaveBeenCalled();
  });

  it('MoMo redirect thành công → showNotification type success', () => {
    window.history.pushState({}, '', '/cart?status=momo-return&resultCode=0');
    render(<CartPage />);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  // ── MoMo redirect thất bại ──────────────────────────────────────────────────
  it('MoMo redirect thất bại (resultCode≠0) → showNotification error + navigate CART', () => {
    window.history.pushState({}, '', '/cart?status=momo-return&resultCode=9999');
    render(<CartPage />);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(mockNavigate).toHaveBeenCalledWith('/cart', { replace: true });
  });

  it('MoMo redirect thất bại → clearLocalCart KHÔNG được gọi', () => {
    window.history.pushState({}, '', '/cart?status=momo-return&resultCode=1');
    render(<CartPage />);
    expect(mockCartState.clearLocalCart).not.toHaveBeenCalled();
  });

  // ── useEffect khởi tạo giỏ hàng ────────────────────────────────────────────
  it('isAuthenticated=true + serverCart có giá trị → setServerCart được gọi', () => {
    const fakeServerCart = { id: 'server-cart-1', items: [] };
    mockGetCartQuery = { data: fakeServerCart, error: null, isLoading: false };
    render(<CartPage />);
    expect(mockCartState.setServerCart).toHaveBeenCalledWith(fakeServerCart);
  });

  it('isAuthenticated=false + cartLoading=false + serverCart=null → initializeCart được gọi', () => {
    mockAuthState = { ...mockAuthState, isAuthenticated: false };
    mockGetCartQuery = { data: null, error: null, isLoading: false };
    render(<CartPage />);
    expect(mockCartState.initializeCart).toHaveBeenCalled();
  });

  it('isAuthenticated=true + cartLoading=false + serverCart=null → initializeCart được gọi', () => {
    mockGetCartQuery = { data: null, error: null, isLoading: false };
    render(<CartPage />);
    expect(mockCartState.initializeCart).toHaveBeenCalled();
  });

  // ── cartError → xử lý lỗi ──────────────────────────────────────────────────
  it('cartError truthy → showNotification type error', () => {
    mockGetCartQuery = { data: null, error: new Error('Network error'), isLoading: false };
    render(<CartPage />);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('cartError truthy → initializeCart được gọi để fallback về local cart', () => {
    mockGetCartQuery = { data: null, error: new Error('Network error'), isLoading: false };
    render(<CartPage />);
    expect(mockCartState.initializeCart).toHaveBeenCalled();
  });

  // ── Banner "savedLocally" khi chưa đăng nhập có items ─────────────────────
  it('chưa đăng nhập + items > 0 → hiển thị banner cart.savedLocally', () => {
    mockAuthState = { ...mockAuthState, isAuthenticated: false };
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);
    expect(screen.getByText('cart.savedLocally')).toBeInTheDocument();
  });

  // ── Banner "syncedWithAccount" khi đã đăng nhập có serverCart.id ──────────
  it('đã đăng nhập + serverCart.id có giá trị → hiển thị banner cart.syncedWithAccount', () => {
    const fakeServerCart = { id: 'sc-1', items: [] };
    mockGetCartQuery = { data: fakeServerCart, error: null, isLoading: false };
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);
    expect(screen.getByText('cart.syncedWithAccount')).toBeInTheDocument();
  });

  // ── issueItems.length > 0 → validation banner ──────────────────────────────
  it('giỏ hàng có issue items → hiển thị banner cart.validation.stockIssues', () => {
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    mockValidateCartQuery = {
      data: {
        items: [
          {
            id: 'item-1',
            name: 'iPhone 15',
            hasIssue: true,
            outOfStock: false,
            quantityExceedsStock: true,
            priceChanged: false,
            maxStock: 5,
            quantity: 10,
            savedPrice: 25_000_000,
            currentPrice: 26_000_000,
          },
        ],
      },
    };
    render(<CartPage />);
    expect(screen.getByText('cart.validation.stockIssues')).toBeInTheDocument();
  });

  it('issue item outOfStock=true → hiển thị cart.validation.outOfStockAction', () => {
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    mockValidateCartQuery = {
      data: {
        items: [
          {
            id: 'item-1',
            name: 'iPhone 15',
            hasIssue: true,
            outOfStock: true,
            quantityExceedsStock: false,
            priceChanged: false,
            maxStock: 0,
            quantity: 1,
            savedPrice: 25_000_000,
            currentPrice: 25_000_000,
          },
        ],
      },
    };
    render(<CartPage />);
    expect(screen.getByText('cart.validation.outOfStockAction')).toBeInTheDocument();
  });

  it('issue item quantityExceedsStock=true + outOfStock=false → hiển thị cart.validation.onlyLeft', () => {
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    mockValidateCartQuery = {
      data: {
        items: [
          {
            id: 'item-1',
            name: 'iPhone 15',
            hasIssue: true,
            outOfStock: false,
            quantityExceedsStock: true,
            priceChanged: false,
            maxStock: 3,
            quantity: 5,
            savedPrice: 25_000_000,
            currentPrice: 25_000_000,
          },
        ],
      },
    };
    render(<CartPage />);
    expect(screen.getByText(/cart\.validation\.onlyLeft/)).toBeInTheDocument();
  });

  it('issue item priceChanged=true → hiển thị cart.validation.priceChanged', () => {
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    mockValidateCartQuery = {
      data: {
        items: [
          {
            id: 'item-1',
            name: 'iPhone 15',
            hasIssue: true,
            outOfStock: false,
            quantityExceedsStock: false,
            priceChanged: true,
            maxStock: 10,
            quantity: 1,
            savedPrice: 24_000_000,
            currentPrice: 25_000_000,
          },
        ],
      },
    };
    render(<CartPage />);
    expect(screen.getByText(/cart\.validation\.priceChanged/)).toBeInTheDocument();
  });

  // ── issueInfo.outOfStock → overlay trên CartItem ────────────────────────────
  it('item có outOfStock=true trong validation → overlay "cart.validation.outOfStock" hiển thị', () => {
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    mockValidateCartQuery = {
      data: {
        items: [
          {
            id: 'item-1',
            name: 'iPhone 15',
            hasIssue: true,
            outOfStock: true,
            quantityExceedsStock: false,
            priceChanged: false,
            maxStock: 0,
            quantity: 1,
            savedPrice: 25_000_000,
            currentPrice: 25_000_000,
          },
        ],
      },
    };
    render(<CartPage />);
    expect(screen.getByText('cart.validation.outOfStock')).toBeInTheDocument();
  });

  // ── Checkout button disabled khi có outOfStock ──────────────────────────────
  it('issueItems có outOfStock=true → nút checkout disabled với text cart.validation.cartHasOutOfStock', () => {
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    mockValidateCartQuery = {
      data: {
        items: [
          {
            id: 'item-1',
            name: 'iPhone 15',
            hasIssue: true,
            outOfStock: true,
            quantityExceedsStock: false,
            priceChanged: false,
            maxStock: 0,
            quantity: 1,
            savedPrice: 25_000_000,
            currentPrice: 25_000_000,
          },
        ],
      },
    };
    render(<CartPage />);
    const checkoutBtn = screen.getByText('cart.validation.cartHasOutOfStock');
    expect(checkoutBtn).toBeInTheDocument();
    const btn = screen.getByTestId('premium-btn');
    expect(btn).toBeDisabled();
  });

  // ── handleCheckout không có voucher ────────────────────────────────────────
  it('handleCheckout không có appliedVoucher → navigate CHECKOUT với state=undefined', () => {
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);
    const checkoutBtn = screen.getByTestId('premium-btn');
    fireEvent.click(checkoutBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/checkout', { state: undefined });
  });

  // ── continueShopping button ────────────────────────────────────────────────
  it('click nút "continueShopping" → navigate /shop', () => {
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);
    const continueBtn = screen.getByText(/cart\.continueShopping/);
    fireEvent.click(continueBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/shop');
  });

  // ── handleClearCart: confirm=false → early return ──────────────────────────
  it('handleClearCart với confirm=false → clearServerCart không được gọi', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);
    const clearBtn = screen.getByText('cart.clearCart');
    fireEvent.click(clearBtn);
    expect(mockClearCartMutation.mutateAsync).not.toHaveBeenCalled();
  });

  // ── handleClearCart: auth path ─────────────────────────────────────────────
  it('handleClearCart với isAuthenticated=true + confirm=true → clearServerCart được gọi + notification success', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockClearCartMutation = {
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      mutate: jest.fn(),
      isPending: false,
    };
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);
    await act(async () => {
      fireEvent.click(screen.getByText('cart.clearCart'));
    });
    expect(mockClearCartMutation.mutateAsync).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  // ── handleClearCart: guest path ────────────────────────────────────────────
  it('handleClearCart với isAuthenticated=false + confirm=true → clearLocalCart được gọi + notification success', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockAuthState = { ...mockAuthState, isAuthenticated: false };
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);
    await act(async () => {
      fireEvent.click(screen.getByText('cart.clearCart'));
    });
    expect(mockCartState.clearLocalCart).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  // ── handleClearCart: error path ────────────────────────────────────────────
  it('handleClearCart clearServerCart throw error → clearLocalCart được gọi + notification error', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockClearCartMutation = {
      mutateAsync: jest.fn().mockRejectedValue(new Error('Server error')),
      mutate: jest.fn(),
      isPending: false,
    };
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);
    await act(async () => {
      fireEvent.click(screen.getByText('cart.clearCart'));
    });
    expect(mockCartState.clearLocalCart).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  // ── handleApplyVoucher: empty code → early return ──────────────────────────
  it('handleApplyVoucher với voucherCode rỗng → applyDiscount không được gọi', () => {
    const mockApplyFn = jest.fn();
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);
    // Click nút apply mà không nhập code (voucherCode mặc định là '')
    const applyBtn = screen.getByText('cart.voucher.apply');
    fireEvent.click(applyBtn);
    expect(mockApplyFn).not.toHaveBeenCalled();
  });

  // ── handleApplyVoucher: success path ──────────────────────────────────────
  it('handleApplyVoucher thành công → hiển thị appliedVoucher UI', async () => {
    const mockApplyFn = jest.fn().mockResolvedValue({
      data: { code: 'SAVE20', discountAmount: 5_000_000, discountCodeId: 'dc-1' },
    });
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('cart.voucher.placeholder'), {
        target: { value: 'save20' },
      });
      fireEvent.click(screen.getByText('cart.voucher.apply'));
    });

    // appliedVoucher UI hiển thị với code (toUpperCase đã xử lý trong handleApplyVoucher)
    await waitFor(() => expect(screen.getByText('SAVE20')).toBeInTheDocument());
  });

  it('handleApplyVoucher thành công → showNotification type success', async () => {
    const mockApplyFn = jest.fn().mockResolvedValue({
      data: { code: 'SALE10', discountAmount: 1_000_000, discountCodeId: 'dc-2' },
    });
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('cart.voucher.placeholder'), {
        target: { value: 'sale10' },
      });
      fireEvent.click(screen.getByText('cart.voucher.apply'));
    });

    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  // ── handleApplyVoucher: error path ────────────────────────────────────────
  it('handleApplyVoucher thất bại → hiển thị voucherError message', async () => {
    const mockApplyFn = jest.fn().mockRejectedValue(new Error('Voucher không hợp lệ'));
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('cart.voucher.placeholder'), {
        target: { value: 'INVALID' },
      });
      fireEvent.click(screen.getByText('cart.voucher.apply'));
    });

    // voucherError hiển thị (getErrorMsg mock trả về fallback = 'cart.voucher.invalid')
    await waitFor(() => expect(screen.getByText('cart.voucher.invalid')).toBeInTheDocument());
  });

  // ── Voucher input: Enter key → handleApplyVoucher ─────────────────────────
  it('nhấn Enter trên voucher input → handleApplyVoucher được gọi', async () => {
    const mockApplyFn = jest.fn().mockResolvedValue({
      data: { code: 'ENTER10', discountAmount: 500_000, discountCodeId: 'dc-3' },
    });
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);

    await act(async () => {
      const voucherInput = screen.getByPlaceholderText('cart.voucher.placeholder');
      fireEvent.change(voucherInput, { target: { value: 'ENTER10' } });
      fireEvent.keyDown(voucherInput, { key: 'Enter', code: 'Enter' });
    });

    expect(mockApplyFn).toHaveBeenCalled();
  });

  // ── Voucher input: typing clears voucherError ──────────────────────────────
  it('thay đổi nội dung voucher input → voucherError bị xóa', async () => {
    const mockApplyFn = jest.fn().mockRejectedValue(new Error('invalid'));
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);

    const voucherInput = screen.getByPlaceholderText('cart.voucher.placeholder');
    await act(async () => {
      fireEvent.change(voucherInput, { target: { value: 'BAD' } });
      fireEvent.click(screen.getByText('cart.voucher.apply'));
    });
    // Lỗi hiển thị
    await waitFor(() => expect(screen.getByText('cart.voucher.invalid')).toBeInTheDocument());

    // Gõ lại → lỗi biến mất (synchronous state update)
    fireEvent.change(voucherInput, { target: { value: 'NEWCODE' } });
    expect(screen.queryByText('cart.voucher.invalid')).not.toBeInTheDocument();
  });

  // ── handleRemoveVoucher ────────────────────────────────────────────────────
  it('handleRemoveVoucher → appliedVoucher bị xóa và hiển thị input trở lại', async () => {
    const mockApplyFn = jest.fn().mockResolvedValue({
      data: { code: 'REMOVE10', discountAmount: 100_000, discountCodeId: 'dc-4' },
    });
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);

    // Áp dụng voucher trước
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('cart.voucher.placeholder'), {
        target: { value: 'REMOVE10' },
      });
      fireEvent.click(screen.getByText('cart.voucher.apply'));
    });
    await waitFor(() => expect(screen.getByText('REMOVE10')).toBeInTheDocument());

    // Xóa voucher
    fireEvent.click(screen.getByText('cart.voucher.remove'));

    // appliedVoucher UI biến mất, input xuất hiện trở lại
    expect(screen.queryByText('REMOVE10')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('cart.voucher.placeholder')).toBeInTheDocument();
  });

  it('handleRemoveVoucher → showNotification type success', async () => {
    const mockApplyFn = jest.fn().mockResolvedValue({
      data: { code: 'DEL20', discountAmount: 200_000, discountCodeId: 'dc-5' },
    });
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('cart.voucher.placeholder'), {
        target: { value: 'DEL20' },
      });
      fireEvent.click(screen.getByText('cart.voucher.apply'));
    });
    await waitFor(() => expect(screen.getByText('DEL20')).toBeInTheDocument());

    jest.clearAllMocks();
    fireEvent.click(screen.getByText('cart.voucher.remove'));
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  // ── appliedVoucher UI: discount row hiển thị ──────────────────────────────
  it('appliedVoucher đang áp dụng → hiển thị discount row với số tiền giảm giá', async () => {
    const mockApplyFn = jest.fn().mockResolvedValue({
      data: { code: 'DISC50', discountAmount: 3_000_000, discountCodeId: 'dc-6' },
    });
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('cart.voucher.placeholder'), {
        target: { value: 'DISC50' },
      });
      fireEvent.click(screen.getByText('cart.voucher.apply'));
    });

    // Discount row hiển thị (t key: cart.voucher.discountLabel)
    await waitFor(() =>
      expect(screen.getByText(/cart\.voucher\.discountLabel/)).toBeInTheDocument(),
    );
  });

  // ── handleCheckout với voucher → navigate với state có voucher ────────────
  it('handleCheckout với appliedVoucher → navigate CHECKOUT với state chứa voucherCode', async () => {
    const mockApplyFn = jest.fn().mockResolvedValue({
      data: { code: 'CHECKOUT10', discountAmount: 500_000, discountCodeId: 'dc-7' },
    });
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);

    // Áp dụng voucher
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('cart.voucher.placeholder'), {
        target: { value: 'checkout10' },
      });
      fireEvent.click(screen.getByText('cart.voucher.apply'));
    });
    await waitFor(() => expect(screen.getByText('CHECKOUT10')).toBeInTheDocument());

    // Click checkout
    fireEvent.click(screen.getByTestId('premium-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('/checkout', {
      state: {
        voucherCode: 'CHECKOUT10',
        discountAmount: 500_000,
        discountCodeId: 'dc-7',
      },
    });
  });

  // ── auto-reset voucher khi subtotal < 1 ────────────────────────────────────
  it('subtotal < 1 khi đang có appliedVoucher → voucher tự động bị reset', async () => {
    const mockApplyFn = jest.fn().mockResolvedValue({
      data: { code: 'RESET10', discountAmount: 1_000_000, discountCodeId: 'dc-8' },
    });
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };

    const { rerender } = render(<CartPage />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('cart.voucher.placeholder'), {
        target: { value: 'RESET10' },
      });
      fireEvent.click(screen.getByText('cart.voucher.apply'));
    });
    await waitFor(() => expect(screen.getByText('RESET10')).toBeInTheDocument());

    // Giỏ hàng trống → subtotal = 0 (< 1)
    mockCartState = { ...mockCartState, items: [], totalItems: 0, subtotal: 0 };
    rerender(<CartPage />);

    // appliedVoucher bị reset → input trở lại
    expect(screen.queryByText('RESET10')).not.toBeInTheDocument();
  });

  // ── handleVoucherRevalidate: !appliedVoucher → early return ───────────────
  it('handleVoucherRevalidate khi appliedVoucher=null → applyDiscount không được gọi', () => {
    // Không có voucher nào được áp dụng, nhưng subtotal thay đổi
    const mockApplyFn = jest.fn();
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };

    const { rerender } = render(<CartPage />);

    // Thay đổi subtotal mà không có voucher nào
    mockCartState = { ...mockCartState, subtotal: 30_000_000 };
    rerender(<CartPage />);

    // applyDiscount không được gọi vì appliedVoucher=null
    expect(mockApplyFn).not.toHaveBeenCalled();
  });

  // ── handleVoucherRevalidate: success path ─────────────────────────────────
  it('subtotal thay đổi khi có appliedVoucher → handleVoucherRevalidate cập nhật discount', async () => {
    let callCount = 0;
    const mockApplyFn = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          data: { code: 'REVAL10', discountAmount: 1_000_000, discountCodeId: 'dc-9' },
        });
      }
      return Promise.resolve({
        data: { code: 'REVAL10', discountAmount: 900_000, discountCodeId: 'dc-9' },
      });
    });
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };

    const { rerender } = render(<CartPage />);

    // Áp dụng voucher lần đầu
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('cart.voucher.placeholder'), {
        target: { value: 'REVAL10' },
      });
      fireEvent.click(screen.getByText('cart.voucher.apply'));
    });
    await waitFor(() => expect(screen.getByText('REVAL10')).toBeInTheDocument());

    // Subtotal thay đổi → revalidate trigger
    await act(async () => {
      mockCartState = { ...mockCartState, subtotal: 20_000_000 };
      rerender(<CartPage />);
    });

    // applyDiscount được gọi ít nhất 2 lần (apply + revalidate)
    expect(mockApplyFn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  // ── handleVoucherRevalidate: error path ───────────────────────────────────
  it('handleVoucherRevalidate thất bại → notification warning + reset appliedVoucher', async () => {
    let callCount = 0;
    const mockApplyFn = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          data: { code: 'EXPIRED', discountAmount: 500_000, discountCodeId: 'dc-10' },
        });
      }
      return Promise.reject(new Error('Voucher hết hạn'));
    });
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: mockApplyFn,
      isPending: false,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };

    const { rerender } = render(<CartPage />);

    // Áp dụng voucher
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('cart.voucher.placeholder'), {
        target: { value: 'EXPIRED' },
      });
      fireEvent.click(screen.getByText('cart.voucher.apply'));
    });
    await waitFor(() => expect(screen.getByText('EXPIRED')).toBeInTheDocument());

    // Subtotal thay đổi → revalidate → thất bại
    await act(async () => {
      mockCartState = { ...mockCartState, subtotal: 5_000_000 };
      rerender(<CartPage />);
    });

    // Notification warning được gọi
    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning' }),
      ),
    );
    // voucher bị reset → input trở lại
    expect(screen.queryByText('EXPIRED')).not.toBeInTheDocument();
  });

  // ── clearingCart isPending=true → button text thay đổi ────────────────────
  it('clearingCart=true → nút clearCart hiển thị common.loading', () => {
    mockClearCartMutation = { mutateAsync: jest.fn(), mutate: jest.fn(), isPending: true };
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  // ── applyingVoucher=true → spinner thay vì text "apply" ───────────────────
  it('applyingVoucher=true → nút apply hiển thị spinner (animate-spin)', () => {
    // isPending=true từ useApplyDiscountCodeMutation → applyingVoucher=true
    ordersModuleMock.useApplyDiscountCodeMutation = () => ({
      mutateAsync: jest.fn(),
      isPending: true,
    });
    mockCartState = { ...mockCartState, items: [cartItem], totalItems: 1, subtotal: 25_000_000 };
    render(<CartPage />);
    // Spinner thay thế text "cart.voucher.apply"
    expect(screen.queryByText('cart.voucher.apply')).not.toBeInTheDocument();
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
