/**
 * @file cartStore.ts
 * @layer Store
 * @feature global
 * @description Zustand global state store
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  CartItem,
  CartState,
  ServerCart,
  ServerCartItem,
  UpdateCartItemPayload,
} from '@/features/cart/types/cart.types';

// Đọc giỏ hàng đã lưu từ localStorage
const getSavedCartItems = (): CartItem[] => {
  try {
    return JSON.parse(localStorage.getItem('cartItems') || '[]');
  } catch {
    /* istanbul ignore next */
    localStorage.removeItem('cartItems');
    /* istanbul ignore next */
    return [];
  }
};

// Hàm chuyển đổi cart item từ server sang định dạng cart item cục bộ
export const convertServerCartItem = (serverItem: ServerCartItem): CartItem => ({
  id: serverItem.id,
  productId: serverItem.productId,
  name: serverItem.Product.name,
  price: serverItem.ProductVariant?.price || serverItem.Product.price,
  quantity: serverItem.quantity,
  image: serverItem.Product.thumbnail,
  variantId: serverItem.variantId,
  inStock: serverItem.Product.inStock,
  stockQuantity: serverItem.ProductVariant?.stockQuantity || serverItem.Product.stockQuantity,
  cartId: serverItem.cartId,
  attributes: serverItem.ProductVariant
    ? serverItem.ProductVariant.attributes || { variant: serverItem.ProductVariant.name }
    : undefined,
});

// Tính tổng số lượng và tổng tiền từ danh sách items
const calcTotals = (items: CartItem[]) => ({
  totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
  subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
});

interface CartActions {
  setServerCart: (cart: ServerCart) => void;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (payload: UpdateCartItemPayload) => void;
  clearLocalCart: () => void;
  toggleCart: () => void;
  closeCart: () => void;
  openCart: () => void;
  setLoading: (isLoading: boolean) => void;
  initializeCart: () => void;
  mergeWithLocalCart: (serverCart: ServerCart) => void;
}

export const useCartStore = create<CartState & CartActions>()(
  immer((set) => ({
    items: getSavedCartItems(),
    isOpen: false,
    isLoading: false,
    totalItems: 0,
    subtotal: 0,
    serverCart: null,

    // Cập nhật giỏ hàng từ dữ liệu server
    setServerCart: (cart) =>
      set((state) => {
        state.serverCart = cart;
        state.items = cart.items.map(convertServerCartItem);
        state.totalItems = cart.totalItems;
        state.subtotal = cart.subtotal;
        // Lưu vào localStorage để truy cập offline
        localStorage.setItem('cartItems', JSON.stringify(state.items));
      }),

    // Thao tác giỏ hàng cục bộ (dành cho khách hoặc offline)
    addItem: (item) =>
      set((state) => {
        const existingItemIndex = state.items.findIndex(
          (existing) =>
            existing.productId === item.productId &&
            JSON.stringify(existing.attributes) === JSON.stringify(item.attributes),
        );

        if (existingItemIndex >= 0) {
          // Nếu sản phẩm đã có, tăng số lượng
          state.items[existingItemIndex].quantity += item.quantity;
        } else {
          // Nếu chưa có, thêm mới
          state.items.push(item);
        }

        // Cập nhật tổng số lượng và tổng tiền
        const totals = calcTotals(state.items);
        state.totalItems = totals.totalItems;
        state.subtotal = totals.subtotal;

        // Lưu vào localStorage
        localStorage.setItem('cartItems', JSON.stringify(state.items));
      }),

    removeItem: (id) =>
      set((state) => {
        state.items = state.items.filter((item) => item.id !== id);

        const totals = calcTotals(state.items);
        state.totalItems = totals.totalItems;
        state.subtotal = totals.subtotal;

        localStorage.setItem('cartItems', JSON.stringify(state.items));
      }),

    updateQuantity: (payload) =>
      set((state) => {
        const item = state.items.find((item) => item.id === payload.id);
        if (item) {
          item.quantity = payload.quantity;

          const totals = calcTotals(state.items);
          state.totalItems = totals.totalItems;
          state.subtotal = totals.subtotal;
        }
        localStorage.setItem('cartItems', JSON.stringify(state.items));
      }),

    // Xóa giỏ hàng cục bộ (tách rõ với mutation clearCart trên server)
    clearLocalCart: () =>
      set((state) => {
        state.items = [];
        state.totalItems = 0;
        state.subtotal = 0;
        state.serverCart = null;
        localStorage.removeItem('cartItems');
      }),

    toggleCart: () =>
      set((state) => {
        state.isOpen = !state.isOpen;
      }),

    closeCart: () =>
      set((state) => {
        state.isOpen = false;
      }),

    openCart: () =>
      set((state) => {
        state.isOpen = true;
      }),

    setLoading: (isLoading) =>
      set((state) => {
        state.isLoading = isLoading;
      }),

    // Khởi tạo giỏ hàng từ localStorage
    initializeCart: () =>
      set((state) => {
        const items = JSON.parse(localStorage.getItem('cartItems') || '[]');

        // Nếu giỏ hàng trống hoặc không hợp lệ, xóa localStorage
        if (!items || !Array.isArray(items) || items.length === 0) {
          localStorage.removeItem('cartItems');
          state.items = [];
          state.totalItems = 0;
          state.subtotal = 0;
          return;
        }

        state.items = items;
        const totals = calcTotals(items);
        state.totalItems = totals.totalItems;
        state.subtotal = totals.subtotal;
      }),

    // Gộp giỏ hàng cục bộ với giỏ hàng server (dùng khi người dùng đăng nhập)
    mergeWithLocalCart: (serverCart) =>
      set((state) => {
        const localItems = [...state.items];

        // Chuyển đổi cart item từ server sang định dạng cục bộ
        const serverItems = serverCart.items.map(convertServerCartItem);

        // Logic gộp: với mỗi item cục bộ, kiểm tra xem đã tồn tại trong server cart chưa
        const mergedItems = [...serverItems];

        localItems.forEach((localItem) => {
          const existingServerItem = mergedItems.find(
            (serverItem) =>
              serverItem.productId === localItem.productId &&
              serverItem.variantId === localItem.variantId &&
              JSON.stringify(serverItem.attributes) === JSON.stringify(localItem.attributes),
          );

          if (existingServerItem) {
            // Nếu item đã có trong server cart, cộng thêm số lượng từ cục bộ
            existingServerItem.quantity += localItem.quantity;
          } else {
            // Nếu chưa có, thêm item cục bộ vào
            mergedItems.push(localItem);
          }
        });

        // Cập nhật state
        state.serverCart = {
          ...serverCart,
          items: mergedItems.map((item) => ({
            id: item.id,
            cartId: item.cartId || serverCart.id || '',
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
            Product: {
              id: item.productId,
              name: item.name,
              slug: '',
              price: item.price,
              thumbnail: item.image,
              inStock: item.inStock || true,
              stockQuantity: item.stockQuantity || 0,
            },
            ProductVariant: item.variantId
              ? {
                  id: item.variantId,
                  name: item.attributes?.variant || '',
                  price: item.price,
                  stockQuantity: item.stockQuantity || 0,
                }
              : undefined,
          })),
        };

        state.items = mergedItems;
        const totals = calcTotals(mergedItems);
        state.totalItems = totals.totalItems;
        state.subtotal = totals.subtotal;

        // Cập nhật localStorage
        localStorage.setItem('cartItems', JSON.stringify(state.items));
      }),
  })),
);
