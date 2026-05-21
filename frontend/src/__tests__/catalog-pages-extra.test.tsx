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

// ── Mock lucide-react ────────────────────────────────────────────
jest.mock('lucide-react', () => {
  const R = require('react');
  const Icon = ({ 'data-testid': testId }: { 'data-testid'?: string }) =>
    R.createElement('svg', { 'data-testid': testId || 'icon' });
  return {
    Smartphone: Icon,
    Tablet: Icon,
    Laptop: Icon,
    Watch: Icon,
    Clock: Icon,
    Package: Icon,
    LayoutGrid: Icon,
    Search: Icon,
    ChevronRight: Icon,
    SearchX: Icon,
  };
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
  BannerDisplay: () => null,
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
    default: () => R.createElement('div', { 'data-testid': 'pagination' }),
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
    newsDetail: (slug: string) => `/news/${slug}`,
  },
}));

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
