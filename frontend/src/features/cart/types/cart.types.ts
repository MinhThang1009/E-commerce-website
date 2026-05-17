/**
 * @file cart.types.ts
 * @layer Type
 * @feature cart
 * @description TypeScript type definitions cho feature cart
 */
// Các kiểu dữ liệu giỏ hàng
export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  attributes?: Record<string, string>; // Dành cho biến thể như kích thước, màu sắc, v.v.
  variantId?: string;
  inStock?: boolean;
  stockQuantity?: number;
  cartId?: string;
  warrantyPackageIds?: string[]; // Dành cho gói bảo hành
  warrantyPackages?: {
    id: string;
    name: string;
    price: number;
    durationMonths: number;
  }[];
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  isLoading: boolean;
  totalItems: number;
  subtotal: number;
  serverCart: ServerCart | null;
}

export interface ServerCart {
  id: string | null;
  items: ServerCartItem[];
  totalItems: number;
  subtotal: number;
}

export interface ServerCartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  Product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    thumbnail: string;
    inStock: boolean;
    stockQuantity: number;
  };
  ProductVariant?: {
    id: string;
    name: string;
    price: number;
    stockQuantity: number;
    attributes?: Record<string, string>;
  };
}

export interface AddToCartPayload {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  attributes?: Record<string, string>;
  variantId?: string;
  warrantyPackageIds?: string[];
}

export interface UpdateCartItemPayload {
  id: string;
  quantity: number;
}

