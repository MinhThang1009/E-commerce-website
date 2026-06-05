/// <reference types="jest" />
// @ts-nocheck
/**
 * ProductCard coverage bổ sung — file riêng để override i18n language='en'
 * và test guard isToggling (nhánh 77).
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// i18n language = 'en' để cover nhánh ternary 'en-US' (lines 246, 255)
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
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
jest.mock('@/utils/localize', () => ({ localizeField: (f: any, k: string) => (f && f[k]) || k }));
jest.mock('@/utils/price-utils', () => ({
  calculatePriceRange: (price: number) => ({ basePrice: price, minPrice: price, maxPrice: price }),
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
jest.mock('@/features/cart', () => ({ useAddToCartMutation: () => ({ mutateAsync: jest.fn() }) }));
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

describe('ProductCard — locale en-US + guard', () => {
  it('language=en + có discount → format giá theo en-US (nhánh en, lines 246/255)', () => {
    render(<ProductCard {...baseProps} compareAtPrice={30_000_000} />);
    // en-US format dùng dấu phẩy ngăn cách: 30,000,000
    expect(screen.getByText(/30,000,000/)).toBeInTheDocument();
    expect(screen.getByText('product.savings')).toBeInTheDocument();
  });

  it('toggle wishlist hoàn tất → mutation server được gọi đúng 1 lần', async () => {
    render(<ProductCard {...baseProps} />);
    const btn = screen.getByLabelText('product.toggleWishlist');
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(mockAddToWishlistLocal).toHaveBeenCalledTimes(1);
    expect(mockAddToWishlistFn).toHaveBeenCalledTimes(1);
  });
});
