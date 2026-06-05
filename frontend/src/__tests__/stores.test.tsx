/// <reference types="jest" />
/**
 * Frontend unit tests — Zustand Stores.
 * Test state management logic không cần DOM, không cần API.
 */
import { act, renderHook } from '@testing-library/react';
import { useCartStore, convertServerCartItem } from '@stores/cart-store';
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

  test('addNotification dedupe — toast trùng message+type thì thay thế, không xếp chồng', () => {
    const { result } = renderHook(() => useUiStore());
    act(() => {
      result.current.addNotification({ message: 'Trùng', type: 'success', duration: 3000 });
      result.current.addNotification({ message: 'Trùng', type: 'success', duration: 3000 });
    });
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].message).toBe('Trùng');
  });

  test('addNotification — cùng message khác type thì giữ cả hai', () => {
    const { result } = renderHook(() => useUiStore());
    act(() => {
      result.current.addNotification({ message: 'Same', type: 'success', duration: 3000 });
      result.current.addNotification({ message: 'Same', type: 'error', duration: 3000 });
    });
    expect(result.current.notifications).toHaveLength(2);
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

// ── Cart Store — Additional ────────────────────────────────────────────────
describe('cartStore — additional', () => {
  const makeServerItem = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'item1',
      productId: 'p1',
      variantId: null,
      quantity: 1,
      cartId: 'cart1',
      Product: {
        name: 'Sản phẩm A',
        price: 100000,
        thumbnail: 'thumb.jpg',
        inStock: true,
        stockQuantity: 5,
      },
      ProductVariant: null,
      ...overrides,
    }) as any;

  const makeServerCart = (items: any[] = []) =>
    ({
      id: 'cart1',
      totalItems: items.reduce((s: number, i: any) => s + i.quantity, 0),
      subtotal: 0,
      items,
    }) as any;

  test('setServerCart cập nhật items từ server format', () => {
    const { result } = renderHook(() => useCartStore());
    const serverCart = makeServerCart([makeServerItem({ quantity: 3 })]);

    act(() => {
      result.current.setServerCart(serverCart);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].name).toBe('Sản phẩm A');
    expect(result.current.items[0].quantity).toBe(3);
  });

  test('updateQuantity thay đổi số lượng và tính lại subtotal', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem({
        id: 'x',
        productId: 'p1',
        name: 'X',
        price: 50000,
        quantity: 1,
        image: '',
      });
    });
    act(() => {
      result.current.updateQuantity({ id: 'x', quantity: 4 });
    });

    expect(result.current.items[0].quantity).toBe(4);
    expect(result.current.subtotal).toBe(200000);
  });

  test('updateQuantity id không tồn tại → không thay đổi', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem({
        id: 'a',
        productId: 'p1',
        name: 'A',
        price: 10000,
        quantity: 2,
        image: '',
      });
      result.current.updateQuantity({ id: 'ghost', quantity: 99 });
    });

    expect(result.current.items[0].quantity).toBe(2);
  });

  test('closeCart đặt isOpen = false', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      useCartStore.setState({ isOpen: true });
      result.current.closeCart();
    });

    expect(result.current.isOpen).toBe(false);
  });

  test('openCart đặt isOpen = true', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.openCart();
    });

    expect(result.current.isOpen).toBe(true);
  });

  test('setLoading (cart) cập nhật isLoading', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);
  });

  test('initializeCart với items hợp lệ trong localStorage', () => {
    const items = [{ id: '1', productId: 'p1', name: 'X', price: 100000, quantity: 2, image: '' }];
    (localStorage.getItem as jest.Mock).mockReturnValueOnce(JSON.stringify(items));

    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.initializeCart();
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalItems).toBe(2);
  });

  test('initializeCart với localStorage rỗng → xóa items', () => {
    (localStorage.getItem as jest.Mock).mockReturnValueOnce(null);

    const { result } = renderHook(() => useCartStore());

    act(() => {
      useCartStore.setState({
        items: [{ id: 'z', productId: 'p1', name: 'Z', price: 1, quantity: 1, image: '' } as any],
      });
      result.current.initializeCart();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
  });

  test('mergeWithLocalCart gộp item cục bộ chưa có trong server cart', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      useCartStore.setState({
        items: [
          {
            id: 'local1',
            productId: 'p2',
            name: 'Local',
            price: 200000,
            quantity: 1,
            image: '',
            variantId: undefined,
            inStock: true,
            stockQuantity: 5,
            cartId: '',
          } as any,
        ],
      });
    });

    const serverCart = makeServerCart([makeServerItem({ quantity: 1 })]);

    act(() => {
      result.current.mergeWithLocalCart(serverCart);
    });

    // server item (p1) + local item (p2) = 2 items riêng biệt
    expect(result.current.items).toHaveLength(2);
  });

  test('mergeWithLocalCart cộng dồn quantity khi cùng productId+variantId', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      useCartStore.setState({
        items: [
          {
            id: 'local1',
            productId: 'p1',
            name: 'A',
            price: 100000,
            quantity: 2,
            image: '',
            variantId: undefined,
            inStock: true,
            stockQuantity: 5,
            cartId: '',
          } as any,
        ],
      });
    });

    const serverCart = makeServerCart([
      makeServerItem({ quantity: 1, productId: 'p1', variantId: undefined }),
    ]);

    act(() => {
      result.current.mergeWithLocalCart(serverCart);
    });

    // Cùng productId → cộng dồn: server=1 + local=2 = 3
    expect(result.current.items[0].quantity).toBe(3);
  });

  test('convertServerCartItem chuyển đổi đúng khi có ProductVariant', () => {
    const serverItem = makeServerItem({
      variantId: 'v1',
      ProductVariant: {
        id: 'v1',
        name: 'Size L',
        price: 150000,
        attributes: { size: 'L' },
        stockQuantity: 3,
      },
    });

    const result = convertServerCartItem(serverItem);

    expect(result.name).toBe('Sản phẩm A');
    expect(result.price).toBe(150000);
    expect(result.variantId).toBe('v1');
    expect(result.attributes).toEqual({ size: 'L' });
  });

  test('convertServerCartItem không có variant → dùng Product price', () => {
    const serverItem = makeServerItem();

    const result = convertServerCartItem(serverItem);

    expect(result.price).toBe(100000);
    expect(result.variantId).toBeNull();
    expect(result.attributes).toBeUndefined();
  });

  test('convertServerCartItem variant có attributes=null → fallback { variant: name }', () => {
    // Branch line 42: attributes || { variant: name } khi attributes falsy
    const serverItem = makeServerItem({
      variantId: 'v2',
      ProductVariant: { id: 'v2', name: 'Đỏ', price: 200000, attributes: null, stockQuantity: 1 },
    });

    const result = convertServerCartItem(serverItem);

    expect(result.attributes).toEqual({ variant: 'Đỏ' });
  });

  test('mergeWithLocalCart với local item có variantId → tạo ProductVariant', () => {
    // Branch lines 233-239: item.variantId truthy → ProductVariant được tạo
    const { result } = renderHook(() => useCartStore());

    act(() => {
      useCartStore.setState({
        items: [
          {
            id: 'local1',
            productId: 'p3',
            name: 'X',
            price: 300000,
            quantity: 1,
            image: '',
            variantId: 'v5',
            inStock: true,
            stockQuantity: 3,
            cartId: 'existing-cart',
            attributes: { variant: 'XL' },
          } as any,
        ],
      });
    });

    const serverCart = makeServerCart([]);

    act(() => {
      result.current.mergeWithLocalCart(serverCart);
    });

    const cartItems = (result.current.serverCart as any).items;
    expect(cartItems[0].ProductVariant).toBeDefined();
    expect(cartItems[0].ProductVariant.id).toBe('v5');
    expect(cartItems[0].ProductVariant.name).toBe('XL');
    // cartId truthy → dùng item.cartId
    expect(cartItems[0].cartId).toBe('existing-cart');
    // inStock=true → short-circuit truthy branch
    expect(cartItems[0].Product.inStock).toBe(true);
  });

  test('mergeWithLocalCart với cartId và serverCart.id đều falsy → cartId=""', () => {
    // Branch cuối: item.cartId || serverCart.id || '' khi cả hai đều falsy
    const { result } = renderHook(() => useCartStore());

    act(() => {
      useCartStore.setState({
        items: [
          {
            id: 'lx',
            productId: 'p9',
            name: 'Z',
            price: 1,
            quantity: 1,
            image: '',
            variantId: undefined,
            inStock: true,
            stockQuantity: 1,
            cartId: '',
          } as any,
        ],
      });
    });

    const emptyServerCart = { ...makeServerCart([]), id: '' } as any;

    act(() => {
      result.current.mergeWithLocalCart(emptyServerCart);
    });

    const cartItems = (result.current.serverCart as any).items;
    expect(cartItems[0].cartId).toBe('');
  });

  test('mergeWithLocalCart với falsy inStock/stockQuantity/variant → dùng fallback', () => {
    // Falsy branches: false||true, 0||0, ''||''
    const { result } = renderHook(() => useCartStore());

    act(() => {
      useCartStore.setState({
        items: [
          {
            id: 'local2',
            productId: 'p4',
            name: 'Y',
            price: 100000,
            quantity: 1,
            image: '',
            variantId: 'v9',
            inStock: false,
            stockQuantity: 0,
            cartId: '',
            attributes: { variant: '' },
          } as any,
        ],
      });
    });

    const serverCart = makeServerCart([]);

    act(() => {
      result.current.mergeWithLocalCart(serverCart);
    });

    const cartItems = (result.current.serverCart as any).items;
    // cartId='' falsy → serverCart.id='cart1'
    expect(cartItems[0].cartId).toBe('cart1');
    // inStock=false → false||true = true
    expect(cartItems[0].Product.inStock).toBe(true);
    // stockQuantity=0 → 0||0 = 0
    expect(cartItems[0].Product.stockQuantity).toBe(0);
    // attributes.variant='' → ''||'' = ''
    expect(cartItems[0].ProductVariant.name).toBe('');
  });
});

// ── UI Store — Additional ──────────────────────────────────────────────────
describe('uiStore — additional', () => {
  test('toggleMobileMenu đổi isMobileMenuOpen', () => {
    const { result } = renderHook(() => useUiStore());

    expect(result.current.isMobileMenuOpen).toBe(false);
    act(() => {
      result.current.toggleMobileMenu();
    });
    expect(result.current.isMobileMenuOpen).toBe(true);
    act(() => {
      result.current.toggleMobileMenu();
    });
    expect(result.current.isMobileMenuOpen).toBe(false);
  });

  test('setTheme cập nhật theme và lưu vào localStorage', () => {
    const { result } = renderHook(() => useUiStore());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
  });
});

// ── UI Store — INITIAL_THEME module init ───────────────────────────────────────
// Các nhánh trong IIFE INITIAL_THEME chỉ có thể test qua jest.isolateModules

describe('uiStore — INITIAL_THEME module init', () => {
  test('localStorage có theme=dark → INITIAL_THEME = dark (stored branch)', () => {
    const spy = jest
      .spyOn(localStorage, 'getItem')
      .mockImplementation((key: string) => (key === 'theme' ? 'dark' : null));
    jest.isolateModules(() => {
      const freshStore = (require('@stores/ui-store') as any).useUiStore;
      expect(freshStore.getState().theme).toBe('dark');
    });
    spy.mockRestore();
  });

  test('matchMedia prefers dark và không có stored theme → INITIAL_THEME = dark (OS dark branch)', () => {
    // jsdom: matchMedia có thể non-configurable → dùng direct assignment
    const origMatchMedia = (window as any).matchMedia;
    (window as any).matchMedia = jest.fn().mockReturnValue({ matches: true });
    jest.isolateModules(() => {
      const freshStore = (require('@stores/ui-store') as any).useUiStore;
      expect(freshStore.getState().theme).toBe('dark');
    });
    (window as any).matchMedia = origMatchMedia;
  });
});
