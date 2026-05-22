// Route path constants — tập trung tất cả paths để tránh hardcode string literals
// Import: import { ROUTES } from '@/routes/paths';

export const ROUTES = {
  // Trang công khai
  HOME: '/',
  SHOP: '/shop',
  PRODUCT_DETAIL: '/products/:productId',
  CART: '/cart',

  // Danh mục & thương hiệu
  CATEGORIES: '/categories',
  CATEGORY: '/categories/:slug',
  BRANDS: '/brands',

  // Cửa hàng đặc biệt
  DEALS: '/deals',
  NEW_ARRIVALS: '/new-arrivals',
  BEST_SELLERS: '/best-sellers',

  // Trang tĩnh
  ABOUT: '/about',
  CONTACT: '/contact',
  FAQS: '/faqs',
  SHIPPING_RETURNS: '/shipping-returns',
  TRACK_ORDER: '/track-order',
  PRIVACY_POLICY: '/privacy-policy',
  TERMS: '/terms',
  // Xác thực
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
  VERIFY_EMAIL_TOKEN: '/verify-email/:token',

  // Trang yêu cầu đăng nhập
  CHECKOUT: '/checkout',
  CHECKOUT_PAYMENT: '/checkout/payment',
  PAYMENT_QR: '/payment-qr',
  PROFILE: '/profile',
  ORDERS: '/orders',
  WISHLIST: '/wishlist',

  // Lỗi
  UNAUTHORIZED: '/unauthorized',

  // Admin
  ADMIN: '/admin',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_PRODUCTS_CREATE: '/admin/products/create',
  ADMIN_PRODUCTS_EDIT: '/admin/products/edit/:id',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_USERS: '/admin/users',
  ADMIN_USER_DETAIL: '/admin/users/:id',
  ADMIN_WARRANTY_PACKAGES: '/admin/warranty-packages',
  ADMIN_DISCOUNT_CODES: '/admin/discount-codes',
  ADMIN_BRANDS: '/admin/brands',
  ADMIN_INVENTORY: '/admin/inventory',
  ADMIN_AUDIT_LOG: '/admin/audit-log',
} as const;

// Dynamic route helpers — dùng khi cần truyền tham số vào path
export const buildRoute = {
  productDetail: (id: string | number) => `/products/${id}`,
  category: (slug: string) => `/categories/${slug}`,
  shopSearch: (query: string) => `/shop?search=${encodeURIComponent(query)}`,
  shopCategory: (slug: string) => `/shop?category=${slug}`,
  shopBrand: (id: string | number) => `/shop?brand=${id}`,
  verifyEmail: (email?: string) =>
    `/verify-email${email ? `?email=${encodeURIComponent(email)}` : ''}`,
  paymentQr: (orderId: string | number, amount: string | number, numberOrder: string) =>
    `/payment-qr?orderId=${orderId}&amount=${amount}&numberOrder=${numberOrder}`,
  checkoutRepay: (repayOrderId: string | number, repayAmount: string | number) =>
    `/checkout?repayOrder=${repayOrderId}&amount=${repayAmount}`,
  adminProductEdit: (id: string | number) => `/admin/products/edit/${id}`,
  adminUserDetail: (id: string | number) => `/admin/users/${id}`,
  adminOrderDetail: (id: string | number) => `/admin/orders/${id}`,
  adminOrdersPending: () => '/admin/orders?status=pending',
  adminProductDetail: (id: string | number) => `/admin/products/${id}`,
} as const;

// Type cho route paths
export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
