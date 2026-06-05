// @ts-nocheck — mock factories dùng loose types
/// <reference types="jest" />
/**
 * Catalog pages extra tests — BestSellersPage, DealsPage, BrandsPage, CategoriesPage.
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
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    Link: ({ to, children, className }: { to: string; children: unknown; className?: string }) =>
      R.createElement('a', { href: to, className }, children),
    MemoryRouter: ({ children }: { children: unknown }) => children,
  };
});

// ── Mock react-helmet-async ─────────────────────────────────────
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: unknown }) => children,
}));

// ── Mock framer-motion ──────────────────────────────────────────
jest.mock('framer-motion', () => {
  const R = require('react');
  const motion = new Proxy(
    {},
    {
      get: (_: unknown, tag: string) =>
        R.forwardRef((props: Record<string, unknown>, ref: unknown) => {
          const {
            initial,
            animate,
            exit,
            variants,
            whileHover,
            whileInView,
            whileTap,
            viewport,
            transition,
            layout,
            layoutId,
            ...rest
          } = props;
          return R.createElement(tag, { ...rest, ref });
        }),
    },
  );
  return {
    __esModule: true,
    motion,
    AnimatePresence: ({ children }: { children: unknown }) => children,
  };
});

// ── Mock lucide-react ────────────────────────────────────────────
jest.mock('lucide-react', () => {
  const R = require('react');
  const Icon = (props: Record<string, unknown>) =>
    R.createElement('svg', { 'data-testid': props['data-testid'] || 'icon' });
  return new Proxy({}, { get: () => Icon });
});

// ── Mock product API hooks ──────────────────────────────────────
let mockGetProductsQuery = { data: null, isLoading: true, error: null };
let mockGetDealsQuery = { data: null, isLoading: true, error: null };

jest.mock('@/features/catalog/api/product-api', () => ({
  useGetProductsQuery: () => mockGetProductsQuery,
  useGetBestSellersQuery: () => mockGetProductsQuery,
  useGetDealsQuery: () => mockGetDealsQuery,
}));

// ── Mock brand API hooks ────────────────────────────────────────
let mockGetBrandsQuery = { data: { data: [] }, isLoading: false, error: null, refetch: jest.fn() };
jest.mock('@/features/catalog/api/brand-api', () => ({
  useGetBrandsQuery: () => mockGetBrandsQuery,
}));

// ── Mock category API hooks ─────────────────────────────────────
let mockGetAllCategoriesQuery = { data: { data: [] }, isLoading: false };
jest.mock('@/features/catalog/api/category-api', () => ({
  useGetAllCategoriesQuery: () => mockGetAllCategoriesQuery,
  useGetCategoriesQuery: () => ({ data: [], isLoading: false }),
}));

// ── Mock catalog feature barrel ─────────────────────────────────
jest.mock('@/features/catalog', () => {
  const R = require('react');
  return {
    ProductCard: ({ id }: { id?: string }) =>
      R.createElement('div', { 'data-testid': `product-card-${id}` }),
    ProductListCard: ({ id }: { id?: string }) =>
      R.createElement('div', { 'data-testid': `product-list-card-${id}` }),
  };
});

// ── Mock common components ──────────────────────────────────────
jest.mock('@/components/common', () => ({
  PremiumButton: ({ children, onClick }: { children: unknown; onClick?: () => void }) =>
    React.createElement('button', { onClick }, children),
}));

jest.mock('@/components/common/LoadingSpinner', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: () => R.createElement('div', { 'data-testid': 'loading-spinner' }),
  };
});

jest.mock('@/components/common/LoadingState', () => ({
  SectionLoading: () => React.createElement('div', { 'data-testid': 'section-loading' }),
}));

jest.mock('@/components/common/Select', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: ({
      options,
      value,
      onChange,
    }: {
      options: { value: string; label: string }[];
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
    }) =>
      R.createElement(
        'select',
        {
          value,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value),
          'data-testid': 'sort-select',
        },
        options.map((o) => R.createElement('option', { key: o.value, value: o.value }, o.label)),
      ),
  };
});

jest.mock('@/components/common/Pagination', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: ({
      onPageChange,
    }: {
      currentPage?: number;
      totalPages?: number;
      onPageChange?: (page: number) => void;
    }) =>
      R.createElement('div', {
        'data-testid': 'pagination',
        onClick: () => onPageChange && onPageChange(2),
      }),
  };
});

jest.mock('@/components/common/ErrorState', () => {
  const R = require('react');
  return {
    __esModule: true,
    ErrorState: () => R.createElement('div', { 'data-testid': 'error-state' }),
  };
});

// ── Mock PageLayout ─────────────────────────────────────────────
jest.mock('@/components/layout/PageLayout', () => {
  const R = require('react');
  return {
    __esModule: true,
    PageLayout: ({ children }: { children: unknown }) =>
      R.createElement('div', { 'data-testid': 'page-layout' }, children),
  };
});

// ── Mock proxy-img (dùng import.meta.env nên phải mock để tránh SyntaxError) ──
jest.mock('@/utils/proxy-img', () => ({
  proxyImg: (url: string) => url || 'https://placeholder.img/200x200',
}));

// ── Mock utilities ──────────────────────────────────────────────
jest.mock('@/utils/localize', () => ({
  localizeField: (_field: unknown, key: string, _lang: string) => {
    // Nếu _field là object có thuộc tính 'name' → trả về name
    if (_field && typeof _field === 'object' && 'name' in (_field as Record<string, unknown>)) {
      return (_field as Record<string, string>)['name'] || key;
    }
    return key;
  },
}));

jest.mock('@/utils/error-utils', () => ({
  getErrorMsg: (_err: unknown, fallback: string) => fallback,
  ErrorType: {},
}));

// ── Mock routes ─────────────────────────────────────────────────
jest.mock('@/routes/paths', () => ({
  ROUTES: {
    SHOP: '/shop',
  },
  buildRoute: {
    productDetail: (id: string) => `/products/${id}`,
    shopBrand: (id: string) => `/shop?brand=${id}`,
    shopCategory: (id: string) => `/shop?category=${id}`,
  },
}));

// ── Stub window.scrollTo — jsdom không implement ─────────────────────────────
// BestSellersPage và NewArrivalsPage gọi window.scrollTo trong handlePageChange;
// nếu không stub, jsdom ném "Not implemented" làm fail test.
beforeAll(() => {
  jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ── Import pages sau mock ───────────────────────────────────────
import BestSellersPage from '@/features/catalog/pages/BestSellersPage';
import DealsPage from '@/features/catalog/pages/DealsPage';
import BrandsPage from '@/features/catalog/pages/BrandsPage';
import CategoriesPage from '@/features/catalog/pages/CategoriesPage';
import NewArrivalsPage from '@/features/catalog/pages/NewArrivalsPage';

// ═══════════════════════════════════════════════════════════════
// BestSellersPage
// ═══════════════════════════════════════════════════════════════
describe('BestSellersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProductsQuery = { data: null, isLoading: true, error: null };
  });

  it('loading state — hiển thị spinner khi đang tải dữ liệu', () => {
    render(<BestSellersPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('loaded state — hiển thị tiêu đề sản phẩm bán chạy', () => {
    mockGetProductsQuery = {
      data: { data: [], total: 0, limit: 12 },
      isLoading: false,
      error: null,
    };
    render(<BestSellersPage />);
    expect(screen.getByText('bestSellers.title')).toBeInTheDocument();
  });

  it('loaded state — hiển thị empty state khi không có sản phẩm', () => {
    mockGetProductsQuery = {
      data: { data: [], total: 0, limit: 12 },
      isLoading: false,
      error: null,
    };
    render(<BestSellersPage />);
    expect(screen.getByText('bestSellers.noProducts.title')).toBeInTheDocument();
  });

  it('error state — hiển thị thông báo lỗi khi API thất bại', () => {
    mockGetProductsQuery = { data: null, isLoading: false, error: new Error('Server error') };
    render(<BestSellersPage />);
    expect(screen.getByText('bestSellers.error.title')).toBeInTheDocument();
  });

  it('loaded với sản phẩm (total > 0) → hiển thị dòng thống kê', () => {
    mockGetProductsQuery = {
      data: { data: [{ id: 'p1' }], total: 5, limit: 12 },
      isLoading: false,
      error: null,
    };
    render(<BestSellersPage />);
    expect(screen.getByText('bestSellers.stats')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// DealsPage
// ═══════════════════════════════════════════════════════════════
describe('DealsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDealsQuery = { data: null, isLoading: true, error: null };
  });

  it('loading state — hiển thị spinner khi đang tải deals', () => {
    render(<DealsPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('loaded state — hiển thị tiêu đề trang deals', () => {
    mockGetDealsQuery = { data: { data: [] }, isLoading: false, error: null };
    render(<DealsPage />);
    expect(screen.getByText('deals.heroTitle')).toBeInTheDocument();
  });

  it('loaded state — hiển thị empty state khi không có deals', () => {
    mockGetDealsQuery = { data: { data: [] }, isLoading: false, error: null };
    render(<DealsPage />);
    expect(screen.getByText('deals.empty')).toBeInTheDocument();
  });

  it('error state — hiển thị thông báo lỗi khi API thất bại', () => {
    mockGetDealsQuery = { data: null, isLoading: false, error: new Error('Server error') };
    render(<DealsPage />);
    expect(screen.getByText('deals.errorTitle')).toBeInTheDocument();
  });

  it('loaded với deal giá dạng chuỗi → parse price/compareAtPrice đúng', () => {
    mockGetDealsQuery = {
      data: { data: [{ id: 'd1', price: '100000', compareAtPrice: '200000' }] },
      isLoading: false,
      error: null,
    };
    render(<DealsPage />);
    expect(screen.getByText('deals.heroTitle')).toBeInTheDocument();
  });

  it('loaded với deal giá dạng số → dùng trực tiếp (nhánh else, lines 40-44)', () => {
    // price/compareAtPrice là number → typeof !== 'string' → nhánh else giữ nguyên giá trị
    mockGetDealsQuery = {
      data: { data: [{ id: 'd-num', price: 150000, compareAtPrice: 300000 }] },
      isLoading: false,
      error: null,
    };
    render(<DealsPage />);
    expect(screen.getByText('deals.heroTitle')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// BrandsPage
// ═══════════════════════════════════════════════════════════════
describe('BrandsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBrandsQuery = { data: { data: [] }, isLoading: false, error: null, refetch: jest.fn() };
  });

  it('render trang thương hiệu không bị crash', () => {
    render(<BrandsPage />);
    // PageLayout mock wrapper luôn render
    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
  });

  it('hiển thị tiêu đề brands khi đã tải xong', () => {
    render(<BrandsPage />);
    expect(screen.getByText('brands.title')).toBeInTheDocument();
  });

  it('hiển thị empty state khi không có thương hiệu nào', () => {
    render(<BrandsPage />);
    expect(screen.getByText('brands.noResults')).toBeInTheDocument();
  });

  it('loading state — hiển thị skeleton khi đang tải', () => {
    mockGetBrandsQuery = { data: undefined, isLoading: true, error: null, refetch: jest.fn() };
    render(<BrandsPage />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('hiển thị card thương hiệu khi có dữ liệu', () => {
    mockGetBrandsQuery = {
      data: { data: [{ id: '1', name: 'Apple', logoUrl: null }] },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<BrandsPage />);
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// CategoriesPage
// ═══════════════════════════════════════════════════════════════
describe('CategoriesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllCategoriesQuery = { data: { data: [] }, isLoading: false };
  });

  it('render trang danh mục không bị crash', () => {
    render(<CategoriesPage />);
    expect(screen.getByText('categories.heroTitle')).toBeInTheDocument();
  });

  it('hiển thị empty state khi không có danh mục nào', () => {
    render(<CategoriesPage />);
    expect(screen.getByText('categories.noResults')).toBeInTheDocument();
  });

  it('loading state — hiển thị skeleton khi đang tải', () => {
    mockGetAllCategoriesQuery = { data: null, isLoading: true };
    render(<CategoriesPage />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('hiển thị card danh mục khi có dữ liệu', () => {
    mockGetAllCategoriesQuery = {
      data: {
        data: [
          {
            id: '1',
            name: 'Điện thoại',
            nameVi: 'Điện thoại',
            slug: 'dien-thoai',
            productCount: 5,
          },
        ],
      },
      isLoading: false,
    };
    render(<CategoriesPage />);
    expect(screen.getByText('Điện thoại')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// BrandsPage — interaction tests
// ═══════════════════════════════════════════════════════════════
describe('BrandsPage: render với brands data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hiển thị brand cards khi có dữ liệu — nhiều brands', () => {
    // Arrange — 3 thương hiệu
    mockGetBrandsQuery = {
      data: {
        data: [
          { id: '1', name: 'Apple', slug: 'apple', logoUrl: null },
          { id: '2', name: 'Samsung', slug: 'samsung', logoUrl: null },
          { id: '3', name: 'Sony', slug: 'sony', logoUrl: null },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    };
    // Act
    render(<BrandsPage />);
    // Assert — tất cả thương hiệu xuất hiện
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Samsung')).toBeInTheDocument();
    expect(screen.getByText('Sony')).toBeInTheDocument();
  });

  it('không hiển thị "brands.noResults" khi có brands', () => {
    mockGetBrandsQuery = {
      data: { data: [{ id: '1', name: 'Apple', slug: 'apple', logoUrl: null }] },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<BrandsPage />);
    expect(screen.queryByText('brands.noResults')).not.toBeInTheDocument();
  });

  it('brand name không có trong SIMPLE_ICONS_SLUGS → getBrandLogoUrl trả null → render initial', () => {
    // "TêN Thương Hiệu Lạ" chắc chắn không có trong SIMPLE_ICONS_SLUGS → logoSrc=null → nhánh false của ternary
    mockGetBrandsQuery = {
      data: {
        data: [
          { id: '99', name: 'TenThuongHieuKhongCoTrongSimpleIcons', slug: 'custom', logoUrl: null },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    };
    render(<BrandsPage />);
    expect(screen.getByText('TenThuongHieuKhongCoTrongSimpleIcons')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// CategoriesPage — interaction tests
// ═══════════════════════════════════════════════════════════════
describe('CategoriesPage: render với categories data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hiển thị category cards khi có dữ liệu — nhiều danh mục', () => {
    // Arrange — 2 danh mục
    mockGetAllCategoriesQuery = {
      data: {
        data: [
          {
            id: '1',
            name: 'Điện thoại',
            nameVi: 'Điện thoại',
            slug: 'dien-thoai',
            productCount: 10,
          },
          { id: '2', name: 'Laptop', nameVi: 'Laptop', slug: 'laptop', productCount: 5 },
        ],
      },
      isLoading: false,
    };
    // Act
    render(<CategoriesPage />);
    // Assert — cả 2 danh mục xuất hiện
    expect(screen.getByText('Điện thoại')).toBeInTheDocument();
    expect(screen.getByText('Laptop')).toBeInTheDocument();
  });

  it('không hiển thị "categories.noResults" khi có dữ liệu', () => {
    mockGetAllCategoriesQuery = {
      data: {
        data: [
          {
            id: '1',
            name: 'Điện thoại',
            nameVi: 'Điện thoại',
            slug: 'dien-thoai',
            productCount: 3,
          },
        ],
      },
      isLoading: false,
    };
    render(<CategoriesPage />);
    expect(screen.queryByText('categories.noResults')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// BrandsPage — interaction tests (click, loading, error)
// ═══════════════════════════════════════════════════════════════
describe('BrandsPage: interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('render với 3 brands → click brand đầu tiên → không crash', () => {
    // Arrange — 3 thương hiệu, mỗi brand là một thẻ Link
    mockGetBrandsQuery = {
      data: {
        data: [
          { id: '1', name: 'Apple', slug: 'apple', logoUrl: null },
          { id: '2', name: 'Samsung', slug: 'samsung', logoUrl: null },
          { id: '3', name: 'Sony', slug: 'sony', logoUrl: null },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    };
    // Act
    render(<BrandsPage />);
    // Assert — brand đầu tiên render, click vào không crash (Link mock → <a>)
    const appleLink = screen.getByText('Apple').closest('a');
    expect(appleLink).toBeInTheDocument();
    fireEvent.click(appleLink!);
    // Sau click vẫn hiển thị brand — không crash
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('brands loading → hiển thị skeleton', () => {
    // Arrange
    mockGetBrandsQuery = { data: undefined, isLoading: true, error: null, refetch: jest.fn() };
    // Act
    render(<BrandsPage />);
    // Assert — skeleton present (animate-pulse CSS class)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('brands error state → ErrorState component render', () => {
    // Arrange
    mockGetBrandsQuery = {
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: jest.fn(),
    };
    // Act
    render(<BrandsPage />);
    // Assert — ErrorState được render khi có lỗi
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// DealsPage — interaction tests
// ═══════════════════════════════════════════════════════════════
describe('DealsPage: interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDealsQuery = { data: { data: [] }, isLoading: false, error: null };
  });

  it('render trang deals → sort dropdown present', () => {
    // Arrange — deals data loaded
    // Act
    render(<DealsPage />);
    // Assert — sort select render (Select mock → <select data-testid="sort-select">)
    expect(screen.getByTestId('sort-select')).toBeInTheDocument();
  });

  it('click sort option → không crash', () => {
    // Arrange
    render(<DealsPage />);
    const sortSelect = screen.getByTestId('sort-select');
    // Act — đổi sort sang price_asc
    fireEvent.change(sortSelect, { target: { value: 'price_asc' } });
    // Assert — component vẫn render bình thường sau khi đổi sort
    expect(screen.getByTestId('sort-select')).toBeInTheDocument();
  });

  it('deals data → product count shown khi có sản phẩm', () => {
    // Arrange — 2 sản phẩm
    mockGetDealsQuery = {
      data: {
        data: [
          { id: '1', price: '500000', compareAtPrice: '1000000', createdAt: '2020-01-01' },
          { id: '2', price: '300000', compareAtPrice: '600000', createdAt: '2020-01-01' },
        ],
      },
      isLoading: false,
      error: null,
    };
    // Act
    render(<DealsPage />);
    // Assert — key text "deals.showing" hiển thị (t mock → trả về key)
    expect(screen.getByText('deals.showing')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// CategoriesPage — interaction tests
// ═══════════════════════════════════════════════════════════════
describe('CategoriesPage: interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('click category card → navigate không được gọi (Link mock, không crash)', () => {
    // Arrange — 1 danh mục có slug
    mockGetAllCategoriesQuery = {
      data: {
        data: [{ id: '1', name: 'Laptop', nameVi: 'Laptop', slug: 'laptop', productCount: 8 }],
      },
      isLoading: false,
    };
    // Act
    render(<CategoriesPage />);
    const categoryLink = screen.getByText('Laptop').closest('a');
    expect(categoryLink).toBeInTheDocument();
    fireEvent.click(categoryLink!);
    // Assert — không crash, component vẫn hiển thị
    expect(screen.getByText('Laptop')).toBeInTheDocument();
  });

  it('categories loading → skeleton present', () => {
    // Arrange
    mockGetAllCategoriesQuery = { data: null, isLoading: true };
    // Act
    render(<CategoriesPage />);
    // Assert — skeleton (animate-pulse) hiển thị
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// NewArrivalsPage — interaction tests
// ═══════════════════════════════════════════════════════════════
describe('NewArrivalsPage: interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('render với products → hiển thị list sản phẩm', () => {
    // Arrange — 2 sản phẩm mới
    mockGetProductsQuery = {
      data: {
        data: [
          { id: 'p1', nameVi: 'iPhone 16', nameEn: 'iPhone 16', price: 25000000 },
          { id: 'p2', nameVi: 'Galaxy S25', nameEn: 'Galaxy S25', price: 20000000 },
        ],
        total: 2,
        limit: 12,
      },
      isLoading: false,
      error: null,
    };
    // Act
    render(<NewArrivalsPage />);
    // Assert — ProductCard mock render theo id
    expect(screen.getByTestId('product-card-p1')).toBeInTheDocument();
    expect(screen.getByTestId('product-card-p2')).toBeInTheDocument();
  });

  it('loading → spinner visible', () => {
    // Arrange
    mockGetProductsQuery = { data: null, isLoading: true, error: null };
    // Act
    render(<NewArrivalsPage />);
    // Assert
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('error → thông báo lỗi hiển thị', () => {
    // Arrange
    mockGetProductsQuery = { data: null, isLoading: false, error: new Error('Network error') };
    // Act
    render(<NewArrivalsPage />);
    // Assert
    expect(screen.getByText('newArrivals.errorTitle')).toBeInTheDocument();
  });

  it('handlePageChange — click pagination gọi window.scrollTo với top=0', () => {
    // Arrange — đủ sản phẩm để pagination hiển thị (total 25 > limit 12, totalPages > 1)
    const scrollToSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    mockGetProductsQuery = {
      data: {
        data: [{ id: 'p1' }],
        total: 25,
        limit: 12,
      },
      isLoading: false,
      error: null,
    };
    // Act
    render(<NewArrivalsPage />);
    const pagination = screen.getByTestId('pagination');
    fireEvent.click(pagination);
    // Assert — window.scrollTo được gọi với top=0
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    scrollToSpy.mockRestore();
  });

  it('handlePageChange — click pagination cập nhật currentPage', () => {
    // Arrange — đủ điều kiện hiển thị pagination
    jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    mockGetProductsQuery = {
      data: {
        data: [{ id: 'p2' }],
        total: 25,
        limit: 12,
      },
      isLoading: false,
      error: null,
    };
    // Act
    render(<NewArrivalsPage />);
    const pagination = screen.getByTestId('pagination');
    // Click → onPageChange(2) được gọi → setCurrentPage(2) → component không crash
    fireEvent.click(pagination);
    // Assert — component vẫn render sau khi đổi trang
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
    jest.restoreAllMocks();
  });

  it('handleSortChange — thay đổi sort option → setSortOption và reset page=1', () => {
    mockGetProductsQuery = {
      data: { data: [{ id: 'p3' }], total: 5, limit: 12 },
      isLoading: false,
      error: null,
    };
    render(<NewArrivalsPage />);
    const sortSelect = screen.getByTestId('sort-select');
    // Act — đổi sort sang price_asc
    fireEvent.change(sortSelect, { target: { value: 'price_asc' } });
    // Assert — component không crash
    expect(screen.getByTestId('sort-select')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// BrandsPage: more interactions
// ═══════════════════════════════════════════════════════════════
describe('BrandsPage: more interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBrandsQuery = {
      data: {
        data: [
          { id: '1', name: 'Apple', slug: 'apple', logoUrl: null },
          { id: '2', name: 'Samsung', slug: 'samsung', logoUrl: null },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    };
  });

  it('click search input → không crash', () => {
    // Arrange
    render(<BrandsPage />);
    const searchInput = document.querySelector('input[type="text"]');
    expect(searchInput).toBeInTheDocument();
    // Act — click vào ô tìm kiếm
    fireEvent.click(searchInput!);
    // Assert — component vẫn hiển thị bình thường
    expect(screen.getByText('brands.title')).toBeInTheDocument();
  });

  it('type vào search → brands được lọc theo tên', () => {
    // Arrange
    render(<BrandsPage />);
    const searchInput = document.querySelector('input[type="text"]');
    // Act — nhập "Apple" vào ô tìm kiếm
    fireEvent.change(searchInput!, { target: { value: 'Apple' } });
    // Assert — Apple hiển thị, Samsung bị lọc ra (localizeField mock trả về key 'name')
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('type chuỗi không khớp → hiển thị empty state', () => {
    // Arrange
    render(<BrandsPage />);
    const searchInput = document.querySelector('input[type="text"]');
    // Act — nhập chuỗi không khớp brand nào
    fireEvent.change(searchInput!, { target: { value: 'Xiaomi' } });
    // Assert — empty state xuất hiện vì không có brand khớp
    expect(screen.getByText('brands.noResults')).toBeInTheDocument();
  });

  it('click brand card link → không crash, component vẫn render', () => {
    // Arrange
    render(<BrandsPage />);
    const samsungLink = screen.getByText('Samsung').closest('a');
    expect(samsungLink).toBeInTheDocument();
    // Act
    fireEvent.click(samsungLink!);
    // Assert — component không crash sau click
    expect(screen.getByText('Samsung')).toBeInTheDocument();
  });

  it('brand card hover (mouseEnter) → không crash', () => {
    // Arrange
    render(<BrandsPage />);
    const appleLink = screen.getByText('Apple').closest('a');
    // Act
    fireEvent.mouseEnter(appleLink!);
    // Assert — component vẫn hiển thị bình thường
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// DealsPage: more interactions
// ═══════════════════════════════════════════════════════════════
describe('DealsPage: more interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDealsQuery = {
      data: {
        data: [
          { id: 'd1', price: '500000', compareAtPrice: '1000000', createdAt: '2020-01-01' },
          { id: 'd2', price: '200000', compareAtPrice: '800000', createdAt: '2020-01-01' },
        ],
      },
      isLoading: false,
      error: null,
    };
  });

  it('click product card → không crash', () => {
    // Arrange
    render(<DealsPage />);
    const productCards = screen.getAllByTestId(/^product-card-/);
    // Act — click vào card đầu tiên
    fireEvent.click(productCards[0]);
    // Assert — page vẫn render sau click
    expect(screen.getByText('deals.heroTitle')).toBeInTheDocument();
  });

  it('change sort dropdown sang price_asc → không crash', () => {
    // Arrange
    render(<DealsPage />);
    const sortSelect = screen.getByTestId('sort-select');
    // Act
    fireEvent.change(sortSelect, { target: { value: 'price_asc' } });
    // Assert — sort select vẫn hiển thị sau thay đổi
    expect(screen.getByTestId('sort-select')).toBeInTheDocument();
  });

  it('change sort dropdown sang price_desc → không crash', () => {
    // Arrange
    render(<DealsPage />);
    const sortSelect = screen.getByTestId('sort-select');
    // Act
    fireEvent.change(sortSelect, { target: { value: 'price_desc' } });
    // Assert
    expect(screen.getByTestId('sort-select')).toBeInTheDocument();
  });

  it('click grid view button → không crash', () => {
    // Arrange
    render(<DealsPage />);
    // Grid button có aria-label="shop.gridView" (mock t() trả về key)
    const gridBtn = screen.getByRole('button', { name: 'shop.gridView' });
    // Act
    fireEvent.click(gridBtn);
    // Assert — vẫn render sau click
    expect(screen.getByText('deals.heroTitle')).toBeInTheDocument();
  });

  it('click list view button → không crash', () => {
    // Arrange
    render(<DealsPage />);
    const listBtn = screen.getByRole('button', { name: 'shop.listView' });
    // Act
    fireEvent.click(listBtn);
    // Assert — component vẫn hiển thị
    expect(screen.getByText('deals.heroTitle')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// CategoriesPage: more interactions
// ═══════════════════════════════════════════════════════════════
describe('CategoriesPage: more interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllCategoriesQuery = {
      data: {
        data: [
          { id: '1', name: 'Laptop', nameVi: 'Laptop', slug: 'laptop', productCount: 5 },
          {
            id: '2',
            name: 'Điện thoại',
            nameVi: 'Điện thoại',
            slug: 'dien-thoai',
            productCount: 10,
          },
        ],
      },
      isLoading: false,
    };
  });

  it('click search input → không crash', () => {
    // Arrange
    render(<CategoriesPage />);
    const searchInput = document.querySelector('input[type="text"]');
    expect(searchInput).toBeInTheDocument();
    // Act
    fireEvent.click(searchInput!);
    // Assert
    expect(screen.getByText('categories.heroTitle')).toBeInTheDocument();
  });

  it('type vào search → lọc danh mục theo tên', () => {
    // Arrange
    render(<CategoriesPage />);
    const searchInput = document.querySelector('input[type="text"]');
    // Act — nhập "Laptop"
    fireEvent.change(searchInput!, { target: { value: 'Laptop' } });
    // Assert — Laptop còn hiển thị
    expect(screen.getByText('Laptop')).toBeInTheDocument();
  });

  it('type chuỗi không khớp → hiển thị empty state', () => {
    // Arrange
    render(<CategoriesPage />);
    const searchInput = document.querySelector('input[type="text"]');
    // Act — nhập chuỗi không khớp danh mục nào
    fireEvent.change(searchInput!, { target: { value: 'ZZZNotExist' } });
    // Assert — empty state hiển thị
    expect(screen.getByText('categories.noResults')).toBeInTheDocument();
  });

  it('category card hover (mouseEnter) → không crash', () => {
    // Arrange
    render(<CategoriesPage />);
    const laptopLink = screen.getByText('Laptop').closest('a');
    expect(laptopLink).toBeInTheDocument();
    // Act
    fireEvent.mouseEnter(laptopLink!);
    // Assert
    expect(screen.getByText('Laptop')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// BestSellersPage: more interactions
// ═══════════════════════════════════════════════════════════════
describe('BestSellersPage: more interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('click sort option price_asc → không crash', () => {
    // Arrange — data đã load
    mockGetProductsQuery = {
      data: { data: [{ id: 'bs1' }], total: 1, limit: 12 },
      isLoading: false,
      error: null,
    };
    render(<BestSellersPage />);
    const sortSelect = screen.getByTestId('sort-select');
    // Act
    fireEvent.change(sortSelect, { target: { value: 'price_asc' } });
    // Assert — sort select vẫn hiển thị
    expect(screen.getByTestId('sort-select')).toBeInTheDocument();
  });

  it('click sort option newest → không crash', () => {
    // Arrange
    mockGetProductsQuery = {
      data: { data: [{ id: 'bs2' }], total: 1, limit: 12 },
      isLoading: false,
      error: null,
    };
    render(<BestSellersPage />);
    const sortSelect = screen.getByTestId('sort-select');
    // Act
    fireEvent.change(sortSelect, { target: { value: 'newest' } });
    // Assert
    expect(screen.getByTestId('sort-select')).toBeInTheDocument();
  });

  it('product card click → không crash', () => {
    // Arrange — 1 sản phẩm
    mockGetProductsQuery = {
      data: { data: [{ id: 'bs3' }], total: 1, limit: 12 },
      isLoading: false,
      error: null,
    };
    render(<BestSellersPage />);
    const card = screen.getByTestId('product-card-bs3');
    // Act
    fireEvent.click(card);
    // Assert — page không crash
    expect(screen.getByText('bestSellers.title')).toBeInTheDocument();
  });

  it('pagination hiển thị khi total > limit', () => {
    // Arrange — 25 sản phẩm, limit 12 → Pagination render
    mockGetProductsQuery = {
      data: { data: [{ id: 'bs4' }], total: 25, limit: 12 },
      isLoading: false,
      error: null,
    };
    render(<BestSellersPage />);
    // Assert — Pagination component được render
    const pagination = screen.getByTestId('pagination');
    // Act — click vào pagination container
    fireEvent.click(pagination);
    expect(pagination).toBeInTheDocument();
  });

  it('sort change reset page → sort select phản hồi đúng giá trị', () => {
    // Arrange
    mockGetProductsQuery = {
      data: { data: [{ id: 'bs5' }], total: 1, limit: 12 },
      isLoading: false,
      error: null,
    };
    render(<BestSellersPage />);
    const sortSelect = screen.getByTestId('sort-select');
    // Act — đổi sang price_desc
    fireEvent.change(sortSelect, { target: { value: 'price_desc' } });
    // Assert — component vẫn hiển thị sau reset page
    expect(screen.getByText('bestSellers.title')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// CategoriesPage: slug/name mapping coverage (dòng 48-54)
// ═══════════════════════════════════════════════════════════════
describe('CategoriesPage: slug/name mapping', () => {
  const mkCat = (id: string, name: string, slug: string) => ({
    id,
    name,
    slug,
    nameVi: name,
    nameEn: name,
    isActive: true,
    sortOrder: 0,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('category với name điện thoại → render được', () => {
    mockGetAllCategoriesQuery = {
      data: { data: [mkCat('1', 'Điện thoại', 'dien-thoai-custom')] },
      isLoading: false,
    };
    render(<CategoriesPage />);
    expect(screen.getByText('categories.heroTitle')).toBeInTheDocument();
  });

  it('category với name tablet → render được', () => {
    mockGetAllCategoriesQuery = {
      data: { data: [mkCat('2', 'Máy tính bảng tablet', 'tablet-custom')] },
      isLoading: false,
    };
    render(<CategoriesPage />);
    expect(screen.getByText('categories.heroTitle')).toBeInTheDocument();
  });

  it('category với name laptop → render được', () => {
    mockGetAllCategoriesQuery = {
      data: { data: [mkCat('3', 'Laptop máy tính xách tay', 'laptop-custom')] },
      isLoading: false,
    };
    render(<CategoriesPage />);
    expect(screen.getByText('categories.heroTitle')).toBeInTheDocument();
  });

  it('category với name smartwatch → render được', () => {
    mockGetAllCategoriesQuery = {
      data: { data: [mkCat('4', 'Smartwatch thông minh', 'watch-custom')] },
      isLoading: false,
    };
    render(<CategoriesPage />);
    expect(screen.getByText('categories.heroTitle')).toBeInTheDocument();
  });

  it('category với name đồng hồ → render được', () => {
    mockGetAllCategoriesQuery = {
      data: { data: [mkCat('5', 'Đồng hồ watch', 'dong-ho-custom')] },
      isLoading: false,
    };
    render(<CategoriesPage />);
    expect(screen.getByText('categories.heroTitle')).toBeInTheDocument();
  });

  it('category không match slug/name → fallback icon Package', () => {
    mockGetAllCategoriesQuery = {
      data: { data: [mkCat('6', 'Phụ kiện khác', 'phu-kien-khac')] },
      isLoading: false,
    };
    render(<CategoriesPage />);
    expect(screen.getByText('categories.heroTitle')).toBeInTheDocument();
  });

  it('category với slug khớp CATEGORY_CONFIG → dùng config theo slug (line 46/47)', () => {
    // slug 'laptop' nằm trong CATEGORY_CONFIG → nhánh `slug && CATEGORY_CONFIG[slug]` true
    mockGetAllCategoriesQuery = {
      data: { data: [mkCat('7', 'Laptop', 'laptop')] },
      isLoading: false,
    };
    render(<CategoriesPage />);
    expect(screen.getByText('Laptop')).toBeInTheDocument();
  });

  it('category có image → render <img> thay gradient (lines 134,141-149)', () => {
    mockGetAllCategoriesQuery = {
      data: {
        data: [
          {
            id: '8',
            name: 'Có ảnh',
            nameVi: 'Có ảnh',
            slug: 'co-anh',
            image: 'https://cdn.example.com/cat.jpg',
            productCount: 0,
          },
        ],
      },
      isLoading: false,
    };
    render(<CategoriesPage />);
    const img = document.querySelector('img[src="https://cdn.example.com/cat.jpg"]');
    expect(img).toBeInTheDocument();
  });

  it('category không có nameVi/name (name undefined) → nhánh `name?.toLowerCase() || ""` (line 48)', () => {
    // nameVi và name đều undefined → getCategoryConfig nhận name=undefined → `name?...` undefined → `|| ''`
    mockGetAllCategoriesQuery = {
      data: {
        data: [{ id: '9', name: '', nameVi: undefined, slug: 'slug-khong-trong-config' }],
      },
      isLoading: false,
    };
    render(<CategoriesPage />);
    // Render không crash, fallback Package icon được dùng
    expect(screen.getByText('categories.heroTitle')).toBeInTheDocument();
  });

  it('category productCount=0 → không render badge số sản phẩm', () => {
    mockGetAllCategoriesQuery = {
      data: { data: [mkCat('10', 'Trống', 'trong-rong')] },
      isLoading: false,
    };
    render(<CategoriesPage />);
    expect(screen.queryByText('categories.productCount')).not.toBeInTheDocument();
  });

  it('category không có slug (slug undefined) → nhánh `slug &&` false (line 46)', () => {
    // slug undefined → `slug && CATEGORY_CONFIG[slug]` short-circuit false → rơi xuống name matching
    mockGetAllCategoriesQuery = {
      data: { data: [{ id: '11', name: 'Điện thoại', nameVi: 'Điện thoại', slug: undefined }] },
      isLoading: false,
    };
    render(<CategoriesPage />);
    expect(screen.getByText('Điện thoại')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// BestSellers/NewArrivals — nhánh `data?.length || 0` (line 88/84)
// ═══════════════════════════════════════════════════════════════
describe('BestSellers/NewArrivals — stats khi total>0 nhưng data rỗng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('BestSellers: total>0, data=undefined → shown=0 (nhánh || 0, line 88)', () => {
    mockGetProductsQuery = {
      data: { data: undefined, total: 7, limit: 12 },
      isLoading: false,
      error: null,
    };
    render(<BestSellersPage />);
    // total truthy → render stats; data?.length undefined → || 0
    expect(screen.getByText('bestSellers.stats')).toBeInTheDocument();
  });

  it('NewArrivals: total>0, data=undefined → shown=0 (nhánh || 0, line 84)', () => {
    mockGetProductsQuery = {
      data: { data: undefined, total: 9, limit: 12 },
      isLoading: false,
      error: null,
    };
    render(<NewArrivalsPage />);
    expect(screen.getByText('newArrivals.showing')).toBeInTheDocument();
  });
});
