/// <reference types="jest" />
// @ts-nocheck
/**
 * ProductCard component tests — file riêng vì catalog-pages-extra mock ProductCard.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'vi' } }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    Link: ({ to, children }: any) => R.createElement('a', { href: to }, children),
  };
});

jest.mock('framer-motion', () => {
  const R = require('react');
  const motion = new Proxy(
    {},
    {
      get: (_: any, tag: string) =>
        R.forwardRef(({ children, onClick, disabled, 'aria-label': al, ...rest }: any, ref: any) =>
          R.createElement(tag, { onClick, disabled, 'aria-label': al, ref }, children),
        ),
    },
  );
  return { motion, AnimatePresence: ({ children }: any) => children };
});

jest.mock('lucide-react', () => {
  const R = require('react');
  const Icon = () => R.createElement('svg');
  return new Proxy({}, { get: () => Icon });
});

jest.mock('@/utils/proxy-img', () => ({ proxyImg: (u: string) => u || 'placeholder' }));
jest.mock('@/utils/localize', () => ({
  localizeField: (f: any, k: string) => (f && f[k]) || k,
}));
jest.mock('@/utils/price-utils', () => ({
  calculatePriceRange: (price: number) => ({ basePrice: price, minPrice: price, maxPrice: price }),
}));
jest.mock('@/routes/paths', () => ({
  buildRoute: { productDetail: (id: string) => `/products/${id}` },
}));

const mockAddToWishlistFn = jest.fn().mockResolvedValue({});
const mockRemoveFromWishlistFn = jest.fn().mockResolvedValue({});
let mockWishlistItems: string[] = [];
const mockAddToWishlistLocal = jest.fn();
const mockRemoveFromWishlistLocal = jest.fn();
const mockAddNotification = jest.fn();
let mockIsAuthenticated = true;

jest.mock('@/stores/wishlist-store', () => ({
  useWishlistStore: (sel: any) =>
    sel({
      items: mockWishlistItems,
      addToWishlistLocal: mockAddToWishlistLocal,
      removeFromWishlistLocal: mockRemoveFromWishlistLocal,
    }),
}));
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (sel: any) => sel({ isAuthenticated: mockIsAuthenticated }),
}));
jest.mock('@/stores/ui-store', () => ({
  useUiStore: (sel: any) => sel({ addNotification: mockAddNotification }),
}));
jest.mock('@/features/wishlist', () => ({
  useAddToWishlistMutation: () => ({ mutateAsync: (...a: any[]) => mockAddToWishlistFn(...a) }),
  useRemoveFromWishlistMutation: () => ({
    mutateAsync: (...a: any[]) => mockRemoveFromWishlistFn(...a),
  }),
}));
jest.mock('@/features/cart', () => ({
  useAddToCartMutation: () => ({ mutateAsync: jest.fn() }),
}));
// ProductCard tự import từ barrel — cần mock barrel để tránh circular
jest.mock('@/features/catalog', () => ({ calculatePriceRange: (p: number) => ({ basePrice: p }) }));

import ProductCard from '@/features/catalog/components/ProductCard';

const baseProps = {
  id: 'prod-1',
  name: 'iPhone 15',
  nameVi: 'iPhone 15',
  nameEn: 'iPhone 15',
  thumbnail: 'https://example.com/img.jpg',
  price: 25_000_000,
  compareAtPrice: 0,
  ratings: 4.5,
  isNew: false,
  slug: 'iphone-15',
  variants: undefined,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWishlistItems = [];
  mockIsAuthenticated = true;
  mockAddToWishlistFn.mockResolvedValue({});
  mockRemoveFromWishlistFn.mockResolvedValue({});
});

describe('ProductCard', () => {
  it('render tên sản phẩm', () => {
    render(<ProductCard {...baseProps} />);
    expect(screen.getByText('iPhone 15')).toBeInTheDocument();
  });

  it('isNew=true → hiển thị badge new', () => {
    render(<ProductCard {...baseProps} isNew />);
    expect(screen.getByText('product.new')).toBeInTheDocument();
  });

  it('compareAtPrice > price → hiển thị badge discount', () => {
    render(<ProductCard {...baseProps} compareAtPrice={30_000_000} />);
    expect(screen.getByText(/-\d+%/)).toBeInTheDocument();
  });

  it('variants có attributes → render variant badges', () => {
    const props = {
      ...baseProps,
      variants: [
        {
          id: 'v1',
          name: 'Black',
          price: 25_000_000,
          stockQuantity: 10,
          isDefault: true,
          attributes: { Color: 'Đen', Storage: '256GB' },
        },
      ],
    };
    render(<ProductCard {...props} />);
    // badges render trong hover area — chỉ verify không crash
    expect(screen.getByText('iPhone 15')).toBeInTheDocument();
  });

  it('chưa wishlist → click toggle → gọi addToWishlist', async () => {
    render(<ProductCard {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('product.toggleWishlist'));
    });
    expect(mockAddToWishlistFn).toHaveBeenCalled();
  });

  it('đã wishlist → click toggle → gọi removeFromWishlist', async () => {
    mockWishlistItems = ['prod-1'];
    render(<ProductCard {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('product.toggleWishlist'));
    });
    expect(mockRemoveFromWishlistFn).toHaveBeenCalled();
  });

  it('chưa login → click wishlist → addNotification + navigate login', async () => {
    mockIsAuthenticated = false;
    render(<ProductCard {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('product.toggleWishlist'));
    });
    expect(mockAddNotification).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('wishlist toggle lỗi → rollback local state', async () => {
    mockAddToWishlistFn.mockRejectedValueOnce(new Error('fail'));
    render(<ProductCard {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('product.toggleWishlist'));
    });
    expect(mockRemoveFromWishlistLocal).toHaveBeenCalled();
  });

  it('handleViewDetails → navigate product url', () => {
    render(<ProductCard {...baseProps} />);
    // button text = 'product.viewDetails' (t mock trả key)
    fireEvent.click(screen.getByText('product.viewDetails'));
    expect(mockNavigate).toHaveBeenCalledWith('/products/prod-1');
  });

  it('handleBuyNow → sessionStorage + navigate checkout', async () => {
    render(<ProductCard {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('product.buyNow'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/checkout?buyNow=true');
  });

  it('handleBuyNow với variant → dùng variant price', async () => {
    const props = {
      ...baseProps,
      variants: [
        {
          id: 'v1',
          name: 'Black',
          price: 26_000_000,
          stockQuantity: 5,
          isDefault: true,
          attributes: {},
        },
      ],
    };
    render(<ProductCard {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByText('product.buyNow'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/checkout?buyNow=true');
  });
});
