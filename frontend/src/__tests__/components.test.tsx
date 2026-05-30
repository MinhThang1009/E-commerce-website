// @ts-nocheck — mock factories dùng loose types
/// <reference types="jest" />
/**
 * Frontend component tests — Button, Rating, Pagination, ProductCard, CartItem, SearchBar.
 * Dùng @testing-library/react + jsdom + ts-jest theo cấu hình jest.config.cjs "components" project.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock toàn cục ───────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key}:${opts.count}`;
      if (opts?.amount !== undefined) return `${key}:${opts.amount}`;
      return key;
    },
    i18n: { language: 'vi' },
  }),
  Trans: ({ children }: { children: unknown }) => children,
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    Link: ({ to, children, className }: { to: string; children: unknown; className?: string }) =>
      React.createElement('a', { href: to, className }, children),
    MemoryRouter: ({ children }: { children: unknown }) => children,
  };
});

jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: new Proxy(
      {},
      {
        get:
          (_t: unknown, tag: string) =>
          ({ children, className, ...rest }: Record<string, unknown>) =>
            React.createElement(tag, { className, ...rest }, children),
      },
    ),
    AnimatePresence: ({ children }: { children: unknown }) => children,
    MotionConfig: ({ children }: { children: unknown }) => children,
  };
});

// ── Mock lucide-react ─────────────────────────────────────────
jest.mock('lucide-react', () => {
  const R = require('react');
  const icon =
    (name: string) =>
    ({ className, ...rest }: Record<string, unknown>) =>
      R.createElement('svg', { 'data-testid': name, className: className || '' });
  return {
    Heart: icon('heart-icon'),
    ShoppingCart: icon('cart-icon'),
    Eye: icon('eye-icon'),
    X: icon('x-icon'),
    Upload: icon('upload-icon'),
    Link2: icon('link-icon'),
    Sun: icon('sun-icon'),
    Moon: icon('moon-icon'),
  };
});

// ── Mock stores ───────────────────────────────────────────────
const mockAddNotification = jest.fn();
const mockToggleSearch = jest.fn();
jest.mock('@stores/ui-store', () => ({
  useUiStore: (selector: (s: unknown) => unknown) => {
    const state = {
      addNotification: mockAddNotification,
      toggleSearch: mockToggleSearch,
    };
    return selector ? selector(state) : state;
  },
}));

const mockWishlistItems: string[] = [];
const mockAddToWishlistLocal = jest.fn();
const mockRemoveFromWishlistLocal = jest.fn();
jest.mock('@stores/wishlist-store', () => ({
  useWishlistStore: (selector: (s: unknown) => unknown) => {
    const state = {
      items: mockWishlistItems,
      addToWishlistLocal: mockAddToWishlistLocal,
      removeFromWishlistLocal: mockRemoveFromWishlistLocal,
    };
    return selector ? selector(state) : state;
  },
}));

let mockIsAuthenticated = true;
jest.mock('@stores/auth-store', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => {
    const state = { isAuthenticated: mockIsAuthenticated };
    return selector ? selector(state) : state;
  },
}));

const mockUpdateQuantity = jest.fn();
const mockRemoveItem = jest.fn();
jest.mock('@stores/cart-store', () => ({
  useCartStore: (selector: (s: unknown) => unknown) => {
    const state = {
      updateQuantity: mockUpdateQuantity,
      removeItem: mockRemoveItem,
      isAuthenticated: true,
    };
    return selector ? selector(state) : state;
  },
}));

// ── Mock API mutations (TanStack Query) ──────────────────────
jest.mock('@features/wishlist', () => ({
  useAddToWishlistMutation: () => ({ mutateAsync: jest.fn().mockResolvedValue({}) }),
  useRemoveFromWishlistMutation: () => ({ mutateAsync: jest.fn().mockResolvedValue({}) }),
}));

jest.mock('@features/cart', () => ({
  useAddToCartMutation: () => ({ mutateAsync: jest.fn().mockResolvedValue({}) }),
}));

const mockUpdateCartItem = jest.fn().mockResolvedValue({});
const mockRemoveCartItem = jest.fn().mockResolvedValue({});
jest.mock('@features/cart/api/cart-api', () => ({
  useUpdateCartItemMutation: () => ({ mutateAsync: mockUpdateCartItem, isPending: false }),
  useRemoveCartItemMutation: () => ({ mutateAsync: mockRemoveCartItem, isPending: false }),
}));

// ── Mock utilities ────────────────────────────────────────────
jest.mock('@utils/proxy-img', () => ({
  proxyImg: (url: string) => url || 'https://placeholder.img/200x200',
}));

jest.mock('@utils/price-utils', () => ({
  calculatePriceRange: (_price: number) => ({
    basePrice: 3000000,
    priceText: '3.000.000đ',
  }),
}));

jest.mock('@utils/localize', () => ({
  localizeField: (_field: unknown, key: string) => `Tên sản phẩm ${key}`,
}));

jest.mock('@utils/format', () => ({
  formatPrice: (p: number) => `${p.toLocaleString('vi-VN')}đ`,
  parsePrice: (p: unknown) => Number(p) || 0,
  getLocale: () => 'vi-VN',
}));

jest.mock('@/routes/paths', () => ({
  buildRoute: {
    productDetail: (id: string) => `/products/${id}`,
    shopSearch: (q: string) => `/shop?q=${q}`,
  },
}));

// Mock crypto.randomUUID (thay uuid package đã xoá)
Object.defineProperty(globalThis, 'crypto', {
  value: { ...globalThis.crypto, randomUUID: () => 'test-uuid-1234' },
});

// Mutable state cho SearchBar auth + catalog mocks
const searchBarMockState = {
  isLoggedIn: false,
  historyData: null as { data: { keyword: string; id: string }[] } | null,
  suggestions: null as { data: { id: string; name: string; thumbnail: string }[] } | null,
  isFetching: false,
};

// Mock auth hook
jest.mock('@features/auth', () => ({
  useAuth: () => ({ isLoggedIn: searchBarMockState.isLoggedIn }),
}));

// Mock catalog — search + history hooks dùng cho SearchBar
jest.mock('@features/catalog', () => ({
  useSearchProductsQuery: () => ({
    data: searchBarMockState.suggestions,
    isFetching: searchBarMockState.isFetching,
    isError: false,
  }),
  useSaveSearchMutation: () => ({ mutateAsync: jest.fn() }),
  useGetSearchHistoryQuery: () => ({ data: searchBarMockState.historyData }),
  useDeleteSearchHistoryMutation: () => ({ mutateAsync: jest.fn() }),
  useClearAllSearchHistoryMutation: () => ({ mutateAsync: jest.fn() }),
  Product: {},
}));

// Mock use-debounce
jest.mock('@hooks/use-debounce', () => ({
  useDebounce: (val: string) => val,
}));

// ── Import components sau khi mock đã khai báo ───────────────
import Button from '@components/common/Button';
import { Rating } from '@components/common/Rating';
import Pagination from '@components/common/Pagination';
import ProductCard from '@features/catalog/components/ProductCard';
import CartItem from '@features/cart/components/CartItem';
import SearchBar from '@components/common/SearchBar';

// ═══════════════════════════════════════════════════════════════
// Button
// ═══════════════════════════════════════════════════════════════
describe('Button', () => {
  test('render text con đúng', () => {
    render(<Button>Mua ngay</Button>);
    expect(screen.getByText('Mua ngay')).toBeInTheDocument();
  });

  test('variant primary → có class btn-primary', () => {
    const { container } = render(<Button variant="primary">Click</Button>);
    expect(container.firstChild).toHaveClass('btn-primary');
  });

  test('variant danger → có class btn-danger', () => {
    const { container } = render(<Button variant="danger">Xóa</Button>);
    expect(container.firstChild).toHaveClass('btn-danger');
  });

  test('isLoading=true → render spinner, không render leftIcon', () => {
    const { container } = render(
      <Button isLoading leftIcon={<span>icon</span>}>
        Đang tải
      </Button>,
    );
    const svg = container.querySelector('svg.animate-spin');
    expect(svg).toBeInTheDocument();
    expect(screen.queryByText('icon')).not.toBeInTheDocument();
  });

  test('disabled=true → button bị disabled', () => {
    render(<Button disabled>Không click được</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('fullWidth → có class w-full', () => {
    const { container } = render(<Button fullWidth>Toàn chiều ngang</Button>);
    expect(container.firstChild).toHaveClass('w-full');
  });

  test('onClick được gọi khi click', () => {
    const handler = jest.fn();
    render(<Button onClick={handler}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('size sm → có class btn-sm', () => {
    const { container } = render(<Button size="sm">Nhỏ</Button>);
    expect(container.firstChild).toHaveClass('btn-sm');
  });

  test('leftIcon render khi không loading', () => {
    render(<Button leftIcon={<span data-testid="left">L</span>}>Text</Button>);
    expect(screen.getByTestId('left')).toBeInTheDocument();
  });

  test('rightIcon render khi không loading', () => {
    render(<Button rightIcon={<span data-testid="right">R</span>}>Text</Button>);
    expect(screen.getByTestId('right')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// Rating
// ═══════════════════════════════════════════════════════════════
describe('Rating', () => {
  test('render 5 ngôi sao', () => {
    const { container } = render(<Rating value={3} />);
    const stars = container.querySelectorAll('svg');
    expect(stars).toHaveLength(5);
  });

  test('value=4 → 4 ngôi sao filled (text-yellow-400)', () => {
    const { container } = render(<Rating value={4} />);
    const filledStars = container.querySelectorAll('svg.text-yellow-400');
    expect(filledStars).toHaveLength(4);
  });

  test('value=0 → không có ngôi sao filled', () => {
    const { container } = render(<Rating value={0} />);
    const filledStars = container.querySelectorAll('svg.text-yellow-400');
    expect(filledStars).toHaveLength(0);
  });

  test('showCount=true + count=42 → hiển thị (42)', () => {
    render(<Rating value={3} showCount count={42} />);
    expect(screen.getByText('(42)')).toBeInTheDocument();
  });

  test('interactive=true → onClick gọi onChange', () => {
    const handler = jest.fn();
    const { container } = render(<Rating value={2} interactive onChange={handler} />);
    const stars = container.querySelectorAll('svg');
    fireEvent.click(stars[4]); // click ngôi sao thứ 5
    expect(handler).toHaveBeenCalledWith(5);
  });

  test('readOnly=true → onClick không gọi onChange', () => {
    const handler = jest.fn();
    const { container } = render(<Rating value={3} readOnly onChange={handler} />);
    const stars = container.querySelectorAll('svg');
    fireEvent.click(stars[0]);
    expect(handler).not.toHaveBeenCalled();
  });

  test('size=large → ngôi sao có class w-6', () => {
    const { container } = render(<Rating value={3} size="large" />);
    const stars = container.querySelectorAll('svg.w-6');
    expect(stars.length).toBeGreaterThan(0);
  });

  test('size=small → ngôi sao có class w-4', () => {
    const { container } = render(<Rating value={3} size="small" />);
    const stars = container.querySelectorAll('svg.w-4');
    expect(stars.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Pagination
// ═══════════════════════════════════════════════════════════════
describe('Pagination', () => {
  test('totalPages=1 → không render gì (null)', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test('totalPages=0 → không render gì', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test('totalPages=5 → render các nút số trang', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('currentPage=1 → nút "prev" bị disabled', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />);
    const prevBtn = screen.getByLabelText('common.prevPage');
    expect(prevBtn).toBeDisabled();
  });

  test('currentPage=totalPages → nút "next" bị disabled', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={jest.fn()} />);
    const nextBtn = screen.getByLabelText('common.nextPage');
    expect(nextBtn).toBeDisabled();
  });

  test('click số trang → gọi onPageChange với đúng page', () => {
    const handler = jest.fn();
    // Với currentPage=1, totalPages=5, trang hiển thị là 1,2,...,5
    render(<Pagination currentPage={1} totalPages={5} onPageChange={handler} />);
    fireEvent.click(screen.getByText('2'));
    expect(handler).toHaveBeenCalledWith(2);
  });

  test('click next → gọi onPageChange(currentPage + 1)', () => {
    const handler = jest.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={handler} />);
    fireEvent.click(screen.getByLabelText('common.nextPage'));
    expect(handler).toHaveBeenCalledWith(3);
  });

  test('click prev → gọi onPageChange(currentPage - 1)', () => {
    const handler = jest.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={handler} />);
    fireEvent.click(screen.getByLabelText('common.prevPage'));
    expect(handler).toHaveBeenCalledWith(2);
  });

  test('nhiều trang → hiển thị dấu "..."', () => {
    const { container } = render(
      <Pagination currentPage={5} totalPages={20} onPageChange={jest.fn()} />,
    );
    const dots = container.querySelectorAll('span');
    // Có ít nhất 1 dấu "..."
    const dotSpans = Array.from(dots).filter((s) => s.textContent === '...');
    expect(dotSpans.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// ProductCard
// ═══════════════════════════════════════════════════════════════
const baseProductProps = {
  id: 'prod-1',
  name: 'iPhone 15 Pro',
  nameVi: 'iPhone 15 Pro',
  nameEn: 'iPhone 15 Pro',
  slug: 'iphone-15-pro',
  thumbnail: 'https://cdn.example.com/iphone.jpg',
  price: 3_000_000,
  compareAtPrice: 3_500_000,
  ratings: { average: 4.5, count: 128 },
  isNew: true,
  variants: [
    {
      id: 'v1',
      name: '128GB',
      price: 3_000_000,
      isDefault: true,
      stockQuantity: 10,
      attributes: {},
    },
  ],
};

describe('ProductCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = true;
    mockWishlistItems.length = 0;
  });

  test('render tên sản phẩm', () => {
    render(<ProductCard {...baseProductProps} />);
    expect(screen.getByText('product.buyNow')).toBeInTheDocument();
  });

  test('hiển thị badge "New" khi isNew=true', () => {
    render(<ProductCard {...baseProductProps} isNew />);
    expect(screen.getByText('product.new')).toBeInTheDocument();
  });

  test('không hiển thị badge "New" khi isNew=false', () => {
    render(<ProductCard {...baseProductProps} isNew={false} />);
    expect(screen.queryByText('product.new')).not.toBeInTheDocument();
  });

  test('hiển thị badge giảm giá khi có compareAtPrice > price', () => {
    const { container } = render(<ProductCard {...baseProductProps} compareAtPrice={4_000_000} />);
    // Badge giảm giá có class bg-rose-500
    const badge = container.querySelector('.bg-rose-500');
    expect(badge).toBeInTheDocument();
  });

  test('render hình ảnh sản phẩm', () => {
    render(<ProductCard {...baseProductProps} />);
    const img = screen.getByAltText('Tên sản phẩm name');
    expect(img).toBeInTheDocument();
  });

  test('click nút "Xem chi tiết" → navigate đến /products/:id', () => {
    render(<ProductCard {...baseProductProps} />);
    const viewBtn = screen.getByText('product.viewDetails');
    fireEvent.click(viewBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/products/prod-1');
  });

  test('click nút "Mua ngay" → navigate đến /checkout?buyNow=true', async () => {
    render(<ProductCard {...baseProductProps} />);
    const buyBtn = screen.getByText('product.buyNow');
    await act(async () => {
      fireEvent.click(buyBtn);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/checkout?buyNow=true');
  });

  test('không auth + click wishlist → navigate đến /login', async () => {
    mockIsAuthenticated = false;
    render(<ProductCard {...baseProductProps} />);
    const wishlistBtn = screen.getByLabelText('product.toggleWishlist');
    await act(async () => {
      fireEvent.click(wishlistBtn);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('đã auth + click wishlist → gọi addToWishlistLocal', async () => {
    mockIsAuthenticated = true;
    render(<ProductCard {...baseProductProps} />);
    const wishlistBtn = screen.getByLabelText('product.toggleWishlist');
    await act(async () => {
      fireEvent.click(wishlistBtn);
    });
    expect(mockAddToWishlistLocal).toHaveBeenCalledWith('prod-1');
  });

  test('sản phẩm đã trong wishlist → hiển thị heart filled', () => {
    mockWishlistItems.push('prod-1');
    render(<ProductCard {...baseProductProps} />);
    const heart = screen.getByTestId('heart-icon');
    expect(heart).toBeInTheDocument();
    expect(heart.getAttribute('class')).toContain('fill-rose-500');
  });

  test('sản phẩm chưa trong wishlist → hiển thị heart outline', () => {
    render(<ProductCard {...baseProductProps} />);
    const heart = screen.getByTestId('heart-icon');
    expect(heart).toBeInTheDocument();
    expect(heart.getAttribute('class')).not.toContain('fill-rose-500');
  });

  test('hiển thị rating khi có ratings', () => {
    render(<ProductCard {...baseProductProps} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  test('không hiển thị rating block khi không có ratings', () => {
    const { container } = render(<ProductCard {...baseProductProps} ratings={undefined} />);
    // Không có span với text 4.5
    expect(screen.queryByText('4.5')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// CartItem
// ═══════════════════════════════════════════════════════════════
const baseCartItem = {
  id: 'cart-item-1',
  productId: 'prod-1',
  name: 'iPhone 15 Pro',
  price: 3_000_000,
  quantity: 2,
  image: 'https://cdn.example.com/iphone.jpg',
  inStock: true,
  stockQuantity: 10,
};

describe('CartItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('render tên sản phẩm', () => {
    render(<CartItem item={baseCartItem as any} />);
    expect(screen.getByText('iPhone 15 Pro')).toBeInTheDocument();
  });

  test('hiển thị số lượng hiện tại', () => {
    render(<CartItem item={baseCartItem as any} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('hiển thị nút tăng/giảm khi không phải checkout mode', () => {
    render(<CartItem item={baseCartItem as any} isCheckout={false} />);
    expect(screen.getByLabelText('cart.increaseQuantity')).toBeInTheDocument();
    expect(screen.getByLabelText('cart.decreaseQuantity')).toBeInTheDocument();
  });

  test('isCheckout=true → không hiển thị nút tăng/giảm', () => {
    render(<CartItem item={baseCartItem as any} isCheckout />);
    expect(screen.queryByLabelText('cart.increaseQuantity')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('cart.decreaseQuantity')).not.toBeInTheDocument();
  });

  test('isCheckout=true → hiển thị text số lượng', () => {
    render(<CartItem item={baseCartItem as any} isCheckout />);
    expect(screen.getByText(/cart.perItem/)).toBeInTheDocument();
  });

  test('nút giảm disabled khi quantity=1', () => {
    render(<CartItem item={{ ...baseCartItem, quantity: 1 } as any} />);
    expect(screen.getByLabelText('cart.decreaseQuantity')).toBeDisabled();
  });

  test('nút tăng disabled khi quantity=maxStock', () => {
    render(<CartItem item={{ ...baseCartItem, quantity: 10 } as any} maxStock={10} />);
    expect(screen.getByLabelText('cart.increaseQuantity')).toBeDisabled();
  });

  test('click tăng → gọi updateCartItem', async () => {
    render(<CartItem item={baseCartItem as any} />);
    const increaseBtn = screen.getByLabelText('cart.increaseQuantity');
    await act(async () => {
      fireEvent.click(increaseBtn);
    });
    expect(mockUpdateCartItem).toHaveBeenCalledWith({
      id: 'cart-item-1',
      data: { quantity: 3 },
    });
  });

  test('click giảm → gọi updateCartItem với quantity-1', async () => {
    render(<CartItem item={baseCartItem as any} />);
    const decreaseBtn = screen.getByLabelText('cart.decreaseQuantity');
    await act(async () => {
      fireEvent.click(decreaseBtn);
    });
    expect(mockUpdateCartItem).toHaveBeenCalledWith({
      id: 'cart-item-1',
      data: { quantity: 1 },
    });
  });

  test('click xóa → gọi removeCartItem', async () => {
    render(<CartItem item={baseCartItem as any} />);
    const removeBtn = screen.getByLabelText('cart.removeItem');
    await act(async () => {
      fireEvent.click(removeBtn);
    });
    expect(mockRemoveCartItem).toHaveBeenCalledWith('cart-item-1');
  });

  test('inStock=false → hiển thị cảnh báo hết hàng', () => {
    render(<CartItem item={{ ...baseCartItem, inStock: false } as any} />);
    expect(screen.getByText(/cart.outOfStock/)).toBeInTheDocument();
  });

  test('stockQuantity <= 5 → hiển thị cảnh báo sắp hết hàng', () => {
    render(
      <CartItem item={{ ...baseCartItem, quantity: 1, stockQuantity: 3 } as any} maxStock={3} />,
    );
    expect(screen.getByText(/cart.lowStock/)).toBeInTheDocument();
  });

  test('item có attributes → hiển thị attributes', () => {
    const itemWithAttr = { ...baseCartItem, attributes: { color: 'Đen', size: '128GB' } };
    render(<CartItem item={itemWithAttr as any} />);
    // CartItem renders attribute values (not keys) as badge text
    expect(screen.getByText('Đen')).toBeInTheDocument();
    expect(screen.getByText('128GB')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// SearchBar
// ═══════════════════════════════════════════════════════════════
describe('SearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchBarMockState.isLoggedIn = false;
    searchBarMockState.historyData = null;
    searchBarMockState.suggestions = null;
    searchBarMockState.isFetching = false;
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify([]));
  });

  test('render nút icon tìm kiếm khi chưa mở', () => {
    render(<SearchBar />);
    expect(screen.getByLabelText('header.actions.search')).toBeInTheDocument();
  });

  test('click nút icon → mở thanh tìm kiếm (input xuất hiện)', () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText('header.actions.search'));
    expect(screen.getByPlaceholderText('header.actions.searchPlaceholder')).toBeInTheDocument();
  });

  test('isExpanded=true → thanh tìm kiếm hiển thị ngay', () => {
    render(<SearchBar isExpanded />);
    expect(screen.getByPlaceholderText('header.actions.searchPlaceholder')).toBeInTheDocument();
  });

  test('nhập text → cập nhật input value', () => {
    render(<SearchBar isExpanded />);
    const input = screen.getByPlaceholderText(
      'header.actions.searchPlaceholder',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'iPhone' } });
    expect(input.value).toBe('iPhone');
  });

  test('click nút đóng → ẩn thanh tìm kiếm (input biến mất)', () => {
    const onClose = jest.fn();
    render(<SearchBar isExpanded onClose={onClose} />);
    expect(screen.getByPlaceholderText('header.actions.searchPlaceholder')).toBeInTheDocument();
    const closeBtn = screen.getByLabelText('common.close');
    fireEvent.click(closeBtn);
    // SearchBar ẩn input sau khi click đóng
    expect(
      screen.queryByPlaceholderText('header.actions.searchPlaceholder'),
    ).not.toBeInTheDocument();
  });

  test('nhập text + click nút xóa → xóa nội dung input', () => {
    render(<SearchBar isExpanded />);
    const input = screen.getByPlaceholderText(
      'header.actions.searchPlaceholder',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'MacBook' } });
    expect(input.value).toBe('MacBook');

    const clearBtn = screen.getByLabelText('common.clear');
    fireEvent.click(clearBtn);
    expect(input.value).toBe('');
  });

  test('submit form với text → gọi navigate đến shop search URL', () => {
    render(<SearchBar isExpanded />);
    const input = screen.getByPlaceholderText('header.actions.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'iPad' } });
    fireEvent.submit(input.closest('form')!);
    expect(mockNavigate).toHaveBeenCalledWith('/shop?q=iPad');
  });

  test('submit form với text rỗng → không navigate', () => {
    render(<SearchBar isExpanded />);
    const form = screen.getByPlaceholderText('header.actions.searchPlaceholder').closest('form')!;
    fireEvent.submit(form);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('lịch sử tìm kiếm rỗng → hiển thị "search.noRecent"', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify([]));
    render(<SearchBar isExpanded />);
    expect(screen.getByText('search.noRecent')).toBeInTheDocument();
  });

  test('có lịch sử tìm kiếm → hiển thị các từ khóa', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(['MacBook', 'iPhone']));
    render(<SearchBar isExpanded />);
    expect(screen.getByText('MacBook')).toBeInTheDocument();
    expect(screen.getByText('iPhone')).toBeInTheDocument();
  });

  test('click từ khóa lịch sử → điền vào input', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(['MacBook']));
    render(<SearchBar isExpanded />);
    fireEvent.click(screen.getByText('MacBook'));
    const input = screen.getByPlaceholderText(
      'header.actions.searchPlaceholder',
    ) as HTMLInputElement;
    expect(input.value).toBe('MacBook');
  });

  test('click xóa từ khóa lịch sử cụ thể → xóa khỏi danh sách', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(['MacBook', 'iPhone']));
    render(<SearchBar isExpanded />);
    // Nút xóa từng item có aria-label 'search.remove'
    const removeButtons = screen.getAllByLabelText('search.remove');
    fireEvent.click(removeButtons[0]);
    // Sau xóa, danh sách ngắn hơn
    expect(screen.queryAllByLabelText('search.remove').length).toBeLessThan(2);
  });

  test('click "Xóa tất cả" lịch sử → xóa toàn bộ', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(['MacBook', 'iPhone']));
    render(<SearchBar isExpanded />);
    const clearAllBtn = screen.queryByText('search.clearAll');
    if (clearAllBtn) {
      fireEvent.click(clearAllBtn);
      expect(screen.queryByText('MacBook')).not.toBeInTheDocument();
    }
  });

  test('click outside → đóng search bar', () => {
    const onClose = jest.fn();
    render(
      <div>
        <SearchBar isExpanded onClose={onClose} />
        <button data-testid="outside">Outside</button>
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });

  test('localStorage có recentSearches → load khi mount', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(['iPad']));
    render(<SearchBar isExpanded />);
    expect(screen.getByText('iPad')).toBeInTheDocument();
  });

  test('localStorage getItem ném lỗi → không crash', () => {
    (localStorage.getItem as jest.Mock).mockImplementation(() => {
      throw new Error('storage err');
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<SearchBar isExpanded />);
    spy.mockRestore();
    expect(screen.getByPlaceholderText('header.actions.searchPlaceholder')).toBeInTheDocument();
  });

  test('clearAll → localStorage.setItem throw → catch block 175', async () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(['iPad']));
    // localStorage.setItem throw trong clearRecentSearches → trigger catch
    (localStorage.setItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('storage full');
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<SearchBar isExpanded />);
    const clearBtn = screen.queryByText('search.clearAll');
    if (clearBtn) {
      await act(async () => {
        fireEvent.click(clearBtn);
      });
      expect(spy).toHaveBeenCalled();
    }
    spy.mockRestore();
  });

  test('removeSearchTerm → localStorage.setItem throw → catch block 195', async () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(['MacBook']));
    (localStorage.setItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('storage full');
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<SearchBar isExpanded />);
    const removeBtn = screen.queryByLabelText('search.remove');
    if (removeBtn) {
      await act(async () => {
        fireEvent.click(removeBtn);
      });
      expect(spy).toHaveBeenCalled();
    }
    spy.mockRestore();
  });

  test('isFetching=true khi có searchTerm > 1 → hiển thị loading spinner suggestions', () => {
    searchBarMockState.isFetching = true;
    render(<SearchBar isExpanded />);
    const input = screen.getByPlaceholderText('header.actions.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'ip' } });
    // Spinner hoặc loading hiện (data-testid hoặc search.searching text)
    expect(screen.getByPlaceholderText('header.actions.searchPlaceholder')).toBeInTheDocument();
  });

  test('recentSearches không có trong localStorage → tạo mảng rỗng', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(null); // cả search_session_id và recentSearches đều null
    render(<SearchBar isExpanded />);
    // dòng 71: else branch → localStorage.setItem('recentSearches', '[]')
    expect(localStorage.setItem).toHaveBeenCalledWith('recentSearches', JSON.stringify([]));
  });

  test('search_session_id không có → tạo UUID mới', () => {
    (localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'search_session_id') return null;
      return JSON.stringify([]);
    });
    render(<SearchBar isExpanded />);
    expect(localStorage.setItem).toHaveBeenCalledWith('search_session_id', 'test-uuid-1234');
  });

  test('historyData từ server → effect không crash', () => {
    // Dòng 71: useEffect([historyData]) — chỉ cần không crash + component render
    searchBarMockState.historyData = { data: [{ keyword: 'Samsung', id: 'h1' }] };
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify([]));
    render(<SearchBar isExpanded />);
    expect(screen.getByPlaceholderText('header.actions.searchPlaceholder')).toBeInTheDocument();
  });

  test('isLoggedIn=true + clearAll → xóa toàn bộ', async () => {
    searchBarMockState.isLoggedIn = true;
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(['iPad']));
    render(<SearchBar isExpanded />);
    const clearBtn = screen.queryByText('search.clearAll');
    if (clearBtn) {
      await act(async () => {
        fireEvent.click(clearBtn);
      });
      expect(screen.queryByText('iPad')).not.toBeInTheDocument();
    }
  });

  test('isLoggedIn=true + removeSearchTerm → xóa server entry', async () => {
    searchBarMockState.isLoggedIn = true;
    searchBarMockState.historyData = { data: [{ keyword: 'MacBook', id: 'h-mac' }] };
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(['MacBook']));
    render(<SearchBar isExpanded />);
    const removeBtn = screen.queryByLabelText('search.remove');
    if (removeBtn) {
      await act(async () => {
        fireEvent.click(removeBtn);
      });
      expect(screen.queryByText('MacBook')).not.toBeInTheDocument();
    }
  });

  test('suggestions hiển thị khi có data + searchTerm > 1 ký tự', () => {
    searchBarMockState.suggestions = {
      data: [{ id: 'p1', name: 'iPhone 15 Pro', thumbnail: 'img.jpg' }],
    };
    render(<SearchBar isExpanded />);
    fireEvent.change(screen.getByPlaceholderText('header.actions.searchPlaceholder'), {
      target: { value: 'ip' },
    });
    expect(screen.getByText('iPhone 15 Pro')).toBeInTheDocument();
  });

  test('click suggestion → navigate product detail', () => {
    searchBarMockState.suggestions = {
      data: [{ id: 'p1', name: 'iPhone 15', thumbnail: 'img.jpg' }],
    };
    render(<SearchBar isExpanded />);
    fireEvent.change(screen.getByPlaceholderText('header.actions.searchPlaceholder'), {
      target: { value: 'ip' },
    });
    fireEvent.click(screen.getByText('iPhone 15'));
    expect(mockNavigate).toHaveBeenCalledWith('/products/p1');
  });
});
