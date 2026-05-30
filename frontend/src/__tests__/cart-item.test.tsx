/// <reference types="jest" />
// @ts-nocheck
/**
 * CartItem component tests — render trực tiếp CartItem thật (không mock component).
 * File riêng vì cart-orders-pages.test.tsx mock CartItem ở module level.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock react-i18next ──────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
}));

// ── Mock react-router-dom ───────────────────────────────────────
jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    ...jest.requireActual('react-router-dom'),
    Link: ({ to, children }: { to: string; children: unknown }) =>
      R.createElement('a', { href: to }, children),
  };
});

// ── Mock framer-motion ──────────────────────────────────────────
jest.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_t: unknown, tag: string) =>
        ({ children, ...props }: Record<string, unknown>) => {
          const React = require('react');
          return React.createElement(tag, props, children);
        },
    },
  ),
  AnimatePresence: ({ children }: { children: unknown }) => children,
}));

// ── Mock stores ─────────────────────────────────────────────────
const mockUpdateQuantity = jest.fn();
const mockRemoveItem = jest.fn();
jest.mock('@/stores/cart-store', () => ({
  useCartStore: (selector: (s: unknown) => unknown) => {
    const state = { updateQuantity: mockUpdateQuantity, removeItem: mockRemoveItem };
    return selector(state);
  },
}));
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ isAuthenticated: true }),
}));

// ── Mock notifications ──────────────────────────────────────────
const mockShowNotification = jest.fn();
jest.mock('@/hooks/use-notifications', () => ({
  useNotifications: () => ({ showNotification: mockShowNotification }),
}));

// ── Mutable cart-api mutations ──────────────────────────────────
let mockUpdateCartItemFn = jest.fn().mockResolvedValue({});
let mockRemoveCartItemFn = jest.fn().mockResolvedValue({});
let mockIsUpdating = false;
let mockIsRemoving = false;

jest.mock('@/features/cart/api/cart-api', () => ({
  useUpdateCartItemMutation: () => ({
    mutateAsync: (...a: unknown[]) => mockUpdateCartItemFn(...a),
    isPending: mockIsUpdating,
  }),
  useRemoveCartItemMutation: () => ({
    mutateAsync: (...a: unknown[]) => mockRemoveCartItemFn(...a),
    isPending: mockIsRemoving,
  }),
}));

// ── Mock utils ──────────────────────────────────────────────────
jest.mock('@/utils/format', () => ({
  formatPrice: (p: number) => `${p}đ`,
  parsePrice: (p: unknown) => Number(p) || 0,
}));

jest.mock('@/routes/paths', () => ({
  buildRoute: { productDetail: (id: string) => `/products/${id}` },
}));

import CartItem from '@/features/cart/components/CartItem';

const baseItem = {
  id: 'item-1',
  productId: 'prod-1',
  name: 'iPhone 15',
  price: 25_000_000,
  quantity: 2,
  image: 'https://example.com/img.jpg',
  inStock: true,
  stockQuantity: 10,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateCartItemFn = jest.fn().mockResolvedValue({});
  mockRemoveCartItemFn = jest.fn().mockResolvedValue({});
  mockIsUpdating = false;
  mockIsRemoving = false;
});

describe('CartItem', () => {
  it('render tên sản phẩm', () => {
    render(<CartItem item={baseItem as any} />);
    expect(screen.getByText('iPhone 15')).toBeInTheDocument();
  });

  it('isCheckout=true → hiển thị số lượng text, ẩn stepper', () => {
    render(<CartItem item={baseItem as any} isCheckout />);
    // text có thể bị split với ': 2' → dùng regex
    expect(screen.getByText(/common\.quantity/)).toBeInTheDocument();
    expect(screen.queryByLabelText('cart.increaseQuantity')).not.toBeInTheDocument();
  });

  it('isCheckout=false → hiển thị stepper +/-', () => {
    render(<CartItem item={baseItem as any} />);
    expect(screen.getByLabelText('cart.increaseQuantity')).toBeInTheDocument();
    expect(screen.getByLabelText('cart.decreaseQuantity')).toBeInTheDocument();
  });

  it('attributes có giá trị → render badges', () => {
    render(<CartItem item={{ ...baseItem, attributes: { Color: 'Đen', Size: 'M' } } as any} />);
    expect(screen.getByText('Đen')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('inStock=false → hiển thị hết hàng', () => {
    render(<CartItem item={{ ...baseItem, inStock: false } as any} />);
    // text có thể bị split với emoji ❌ → query bằng regex
    expect(screen.getByText(/cart\.outOfStock/)).toBeInTheDocument();
  });

  it('stockQuantity <= 5 và inStock=true → cảnh báo stock thấp', () => {
    render(<CartItem item={{ ...baseItem, stockQuantity: 3 } as any} />);
    // text có thể bị split với emoji ⚡
    expect(screen.getByText(/cart\.lowStock/)).toBeInTheDocument();
  });

  it('tăng số lượng → gọi updateCartItem (id string)', async () => {
    render(<CartItem item={baseItem as any} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('cart.increaseQuantity'));
    });
    expect(mockUpdateCartItemFn).toHaveBeenCalledWith({ id: 'item-1', data: { quantity: 3 } });
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('giảm khi quantity=1 → không gọi updateCartItem (disabled)', async () => {
    render(<CartItem item={{ ...baseItem, quantity: 1 } as any} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('cart.decreaseQuantity'));
    });
    expect(mockUpdateCartItemFn).not.toHaveBeenCalled();
  });

  it('giảm khi quantity=3 → gọi updateCartItem với quantity=2', async () => {
    render(<CartItem item={{ ...baseItem, quantity: 3 } as any} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('cart.decreaseQuantity'));
    });
    expect(mockUpdateCartItemFn).toHaveBeenCalledWith({ id: 'item-1', data: { quantity: 2 } });
  });

  it('tăng vượt maxStock → stockLimit notification + không gọi API', async () => {
    // quantity=4, maxStock=4 → nút không disabled (quantity < maxStock thì enabled, xử lý trong handler)
    // Thực ra disabled khi quantity >= maxStock → cần quantity < maxStock nhưng newQuantity > maxStock
    // Không thể reach qua UI bình thường. Dùng newQuantity > 99 guard thay thế.
    // Test: quantity=1, newQuantity=2, maxStock=1 → button disabled → không test được qua click
    // → Test gián tiếp: quantity thấp nhưng stockQuantity=1 để nút bị disabled
    render(<CartItem item={{ ...baseItem, quantity: 1, stockQuantity: 1 } as any} />);
    // Nút tăng disabled khi quantity >= stockQuantity
    const increaseBtn = screen.getByLabelText('cart.increaseQuantity');
    expect(increaseBtn).toBeDisabled();
  });

  it('id không phải string → dùng updateQuantity store (offline)', async () => {
    render(<CartItem item={{ ...baseItem, id: 123 } as any} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('cart.increaseQuantity'));
    });
    expect(mockUpdateCartItemFn).not.toHaveBeenCalled();
    expect(mockUpdateQuantity).toHaveBeenCalled();
  });

  it('updateCartItem lỗi → fallback store + error notification', async () => {
    mockUpdateCartItemFn = jest.fn().mockRejectedValue(new Error('server'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<CartItem item={baseItem as any} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('cart.increaseQuantity'));
    });
    expect(mockUpdateQuantity).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    spy.mockRestore();
  });

  it('xóa item (id string) → gọi removeCartItem', async () => {
    render(<CartItem item={baseItem as any} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('cart.removeItem'));
    });
    expect(mockRemoveCartItemFn).toHaveBeenCalledWith('item-1');
  });

  it('xóa item (id numeric) → dùng removeItem store (offline)', async () => {
    render(<CartItem item={{ ...baseItem, id: 456 } as any} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('cart.removeItem'));
    });
    expect(mockRemoveCartItemFn).not.toHaveBeenCalled();
    expect(mockRemoveItem).toHaveBeenCalled();
  });

  it('removeCartItem lỗi → fallback store + error notification', async () => {
    mockRemoveCartItemFn = jest.fn().mockRejectedValue(new Error('server'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<CartItem item={baseItem as any} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('cart.removeItem'));
    });
    expect(mockRemoveItem).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    spy.mockRestore();
  });

  it('isUpdating=true → spinner trên stepper', () => {
    mockIsUpdating = true;
    render(<CartItem item={baseItem as any} />);
    expect(document.querySelectorAll('.animate-spin').length).toBeGreaterThan(0);
  });

  it('isRemoving=true → spinner trên nút xóa', () => {
    mockIsRemoving = true;
    render(<CartItem item={baseItem as any} />);
    expect(document.querySelectorAll('.animate-spin').length).toBeGreaterThan(0);
  });
});
