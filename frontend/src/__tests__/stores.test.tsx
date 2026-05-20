/// <reference types="jest" />
/**
 * Frontend unit tests — Zustand Stores.
 * Test state management logic không cần DOM, không cần API.
 */
import { act, renderHook } from '@testing-library/react';
import { useCartStore } from '@stores/cart-store';
import { useUiStore } from '@stores/ui-store';
import { useWishlistStore } from '@stores/wishlist-store';

// Reset stores giữa tests
beforeEach(() => {
  useCartStore.setState({ items: [], isOpen: false, isLoading: false, serverCart: null });
  useUiStore.setState({
    notifications: [],
    isSearchOpen: false,
    isMobileMenuOpen: false,
    isLoading: false,
  });
  useWishlistStore.setState({ items: [] });
});

// ── Cart Store ────────────────────────────────────────────────
describe('cartStore', () => {
  test('addItem tăng totalItems', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addItem({
        id: '1',
        productId: '1',
        name: 'Product A',
        price: 100,
        quantity: 2,
        image: '',
      });
    });
    expect(result.current.totalItems).toBe(2);
    expect(result.current.items).toHaveLength(1);
  });

  test('addItem cùng id → cộng dồn quantity', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addItem({
        id: '1',
        productId: '1',
        name: 'P',
        price: 100,
        quantity: 1,
        image: '',
      });
      result.current.addItem({
        id: '1',
        productId: '1',
        name: 'P',
        price: 100,
        quantity: 3,
        image: '',
      });
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(4);
  });

  test('removeItem xóa đúng item', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addItem({
        id: 'a',
        productId: '1',
        name: 'A',
        price: 50,
        quantity: 1,
        image: '',
      });
      result.current.addItem({
        id: 'b',
        productId: '2',
        name: 'B',
        price: 80,
        quantity: 1,
        image: '',
      });
      result.current.removeItem('a');
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('b');
  });

  test('clearLocalCart xóa hết', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addItem({
        id: '1',
        productId: '1',
        name: 'X',
        price: 10,
        quantity: 5,
        image: '',
      });
      result.current.clearLocalCart();
    });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
  });

  test('toggleCart đổi trạng thái isOpen', () => {
    const { result } = renderHook(() => useCartStore());
    expect(result.current.isOpen).toBe(false);
    act(() => {
      result.current.toggleCart();
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      result.current.toggleCart();
    });
    expect(result.current.isOpen).toBe(false);
  });

  test('subtotal = sum(price * quantity)', () => {
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.addItem({
        id: '1',
        productId: '1',
        name: 'A',
        price: 100_000,
        quantity: 2,
        image: '',
      });
      result.current.addItem({
        id: '2',
        productId: '2',
        name: 'B',
        price: 200_000,
        quantity: 1,
        image: '',
      });
    });
    expect(result.current.subtotal).toBe(400_000);
  });
});

// ── UI Store ──────────────────────────────────────────────────
describe('uiStore', () => {
  test('addNotification thêm notification với id', () => {
    const { result } = renderHook(() => useUiStore());
    act(() => {
      result.current.addNotification({ message: 'Hello', type: 'success', duration: 3000 });
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].message).toBe('Hello');
    expect(result.current.notifications[0].id).toBeDefined();
  });

  test('removeNotification xóa đúng theo id', async () => {
    const { result } = renderHook(() => useUiStore());
    act(() => {
      result.current.addNotification({ message: 'A', type: 'info', duration: 3000 });
    });
    // Đợi 2ms để Date.now() cho ID khác nhau
    await new Promise((r) => setTimeout(r, 2));
    act(() => {
      result.current.addNotification({ message: 'B', type: 'error', duration: 3000 });
    });
    expect(result.current.notifications).toHaveLength(2);
    const idToRemove = result.current.notifications[0].id;
    act(() => {
      result.current.removeNotification(idToRemove);
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].message).toBe('B');
  });

  test('clearNotifications xóa hết', () => {
    const { result } = renderHook(() => useUiStore());
    act(() => {
      result.current.addNotification({ message: 'X', type: 'success', duration: 3000 });
      result.current.addNotification({ message: 'Y', type: 'success', duration: 3000 });
      result.current.clearNotifications();
    });
    expect(result.current.notifications).toHaveLength(0);
  });

  test('toggleSearch đổi isSearchOpen', () => {
    const { result } = renderHook(() => useUiStore());
    expect(result.current.isSearchOpen).toBe(false);
    act(() => {
      result.current.toggleSearch();
    });
    expect(result.current.isSearchOpen).toBe(true);
  });

  test('setLoading cập nhật isLoading', () => {
    const { result } = renderHook(() => useUiStore());
    act(() => {
      result.current.setLoading(true);
    });
    expect(result.current.isLoading).toBe(true);
    act(() => {
      result.current.setLoading(false);
    });
    expect(result.current.isLoading).toBe(false);
  });
});

// ── Wishlist Store ────────────────────────────────────────────
describe('wishlistStore', () => {
  test('addToWishlistLocal thêm productId', () => {
    const { result } = renderHook(() => useWishlistStore());
    act(() => {
      result.current.addToWishlistLocal('42');
    });
    expect(result.current.items).toContain('42');
  });

  test('removeFromWishlistLocal xóa đúng', () => {
    const { result } = renderHook(() => useWishlistStore());
    act(() => {
      result.current.addToWishlistLocal('1');
      result.current.addToWishlistLocal('2');
      result.current.removeFromWishlistLocal('1');
    });
    expect(result.current.items).not.toContain('1');
    expect(result.current.items).toContain('2');
  });

  test('setWishlist thay thế toàn bộ', () => {
    const { result } = renderHook(() => useWishlistStore());
    act(() => {
      result.current.addToWishlistLocal('99');
      result.current.setWishlist(['1', '2', '3']);
    });
    expect(result.current.items).toEqual(['1', '2', '3']);
  });

  test('clearWishlistLocal xóa hết', () => {
    const { result } = renderHook(() => useWishlistStore());
    act(() => {
      result.current.setWishlist(['1', '2', '3']);
      result.current.clearWishlistLocal();
    });
    expect(result.current.items).toHaveLength(0);
  });
});
