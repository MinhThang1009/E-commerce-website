# Admin Feature — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Routes](#12-routes)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. State Management](#3-state-management)
  - [3.1 Server state (React Query)](#31-server-state-react-query)
  - [3.2 Client state (Zustand)](#32-client-state-zustand)
- [4. API Calls](#4-api-calls)
  - [4.1 Endpoints sử dụng](#41-endpoints-sử-dụng)
  - [4.2 Query hooks](#42-query-hooks)
- [5. Components chính](#5-components-chính)
- [6. Types](#6-types)
- [7. Dependencies](#7-dependencies)
  - [7.1 Depends on](#71-depends-on)
  - [7.2 Used by](#72-used-by)
- [8. Gotchas & Edge Cases](#8-gotchas--edge-cases)
- [9. Tests](#9-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Dashboard quản trị toàn bộ: xem analytics/KPIs, quản lý sản phẩm/đơn hàng/người dùng/tồn kho, tạo/xóa mã giảm giá. Tất cả pages trong feature này require role `admin`.

## 1.2 Routes

| Route                      | Page                |
| -------------------------- | ------------------- |
| `/admin/dashboard`         | `DashboardPage`     |
| `/admin/products`          | `ProductsPage`      |
| `/admin/products/create`   | `CreateProductPage` |
| `/admin/products/edit/:id` | `EditProductPage`   |
| `/admin/categories`        | `CategoriesPage`    |
| `/admin/brands`            | `BrandsPage`        |
| `/admin/orders`            | `OrdersPage`        |
| `/admin/users`             | `UsersPage`         |
| `/admin/users/:id`         | `UserDetailPage`    |
| `/admin/discount-codes`    | `DiscountCodesPage` |
| `/admin/inventory`         | `InventoryPage`     |

---

# 2. Cấu trúc Files

## 2.1 File listing

```
features/admin/
  api/
    admin-dashboard-api.ts    — Analytics: overview stats, 8 analytics endpoints; export adminDashboardKeys
    admin-order-api.ts        — Quản lý đơn hàng: list, update status; export adminOrderKeys
    admin-product-api.ts      — CRUD sản phẩm, clone, status toggle; auto-parse JSON variants/attributes; export adminProductKeys
    admin-user-api.ts         — Quản lý người dùng: list, get, update, delete; export adminUserKeys
    discount-code-api.ts      — CRUD mã giảm giá; export discountCodeKeys

  components/
    AdminLayout.tsx           — Layout wrapper: sidebar nav, header với dark mode toggle, responsive drawer mobile
    CreateProductForm.tsx     — Form nhiều tab tạo sản phẩm: basic info, variants, images, attributes, SEO, FAQ
    DashboardCharts.tsx       — Charts recharts: revenue line, category pie, order bar, top products
    ProductExportModal.tsx    — Modal export danh sách sản phẩm ra Excel (dùng exceljs)

  pages/
    DashboardPage.tsx         — /admin/dashboard: KPI cards + DashboardCharts + recent orders table + low-stock widget
    InventoryPage.tsx         — /admin/inventory: bảng tồn kho theo variant
    DiscountCodesPage.tsx     — /admin/discount-codes: danh sách + CRUD mã giảm giá
    UsersPage.tsx             — /admin/users: bảng người dùng với filter
    UserDetailPage.tsx        — /admin/users/:id: profile đầy đủ + chỉnh sửa role/status

    catalog/
      ProductsPage.tsx        — /admin/products: danh sách với filter (category, status, price, stock)
      CreateProductPage.tsx   — /admin/products/create: dùng CreateProductForm
      EditProductPage.tsx     — /admin/products/:id/edit
      ProductImportPage.tsx   — /admin/products/import: import hàng loạt (file exists but not registered in AppRoutes.tsx — currently unreachable)
      CategoriesPage.tsx      — /admin/categories: quản lý danh mục cây
      CategoryPage.tsx        — /admin/categories/:id: chi tiết danh mục (file exists but not registered in AppRoutes.tsx — currently unreachable)
      BrandsPage.tsx          — /admin/brands: quản lý thương hiệu

    orders/
      OrdersPage.tsx          — /admin/orders: bảng Ant Design với filter trạng thái, modal chi tiết + update status

  index.ts                    — Barrel export
```

---

# 3. State Management

## 3.1 Server state (React Query)

Mỗi api file có query key object riêng:

- `adminDashboardKeys` — `['admin-dashboard', ...]`
- `adminProductKeys` — `['admin-products', ...]`
- `adminOrderKeys` — `['admin-orders', ...]`
- `adminUserKeys` — `['admin-users', ...]`
- `discountCodeKeys` — `['discount-codes', ...]`

Tất cả mutations invalidate query key tương ứng sau khi thành công.

## 3.2 Client state (Zustand)

- `authStore` — lấy token, kiểm tra role (`admin`). Không có Zustand store riêng cho admin.
- `uiStore` — theme dark/light toggle trong `AdminLayout`.

---

# 4. API Calls

## 4.1 Endpoints sử dụng

| Method | Path                                   | Mô tả                                                                 |
| ------ | -------------------------------------- | --------------------------------------------------------------------- |
| GET    | `/admin/dashboard`                     | Tổng quan: totalUsers, totalRevenue, aov, topProducts, ordersByStatus |
| GET    | `/admin/stats`                         | Stats chi tiết theo startDate/endDate/groupBy                         |
| GET    | `/admin/analytics/order-status`        | Phân bố trạng thái đơn hàng                                           |
| GET    | `/admin/analytics/top-products`        | Top sản phẩm (metric: revenue/soldCount)                              |
| GET    | `/admin/analytics/revenue-by-category` | Doanh thu theo danh mục                                               |
| GET    | `/admin/analytics/user-growth`         | Tăng trưởng người dùng                                                |
| GET    | `/admin/analytics/payment-methods`     | Phân tích phương thức thanh toán                                      |
| GET    | `/admin/analytics/low-stock`           | Sản phẩm sắp hết (threshold param)                                    |
| GET    | `/admin/chatbot/stats`                 | Thống kê chatbot                                                      |
| GET    | `/admin/orders`                        | Danh sách đơn hàng (pagination + filter)                              |
| PUT    | `/admin/orders/:id/status`             | Cập nhật trạng thái đơn hàng                                          |
| GET    | `/admin/products`                      | Danh sách sản phẩm admin                                              |
| GET    | `/admin/products/:id`                  | Chi tiết sản phẩm (auto-parse JSON variants.attributes)               |
| POST   | `/admin/products`                      | Tạo sản phẩm                                                          |
| PUT    | `/admin/products/:id`                  | Cập nhật sản phẩm                                                     |
| DELETE | `/admin/products/:id`                  | Xóa sản phẩm                                                          |
| POST   | `/admin/products/:id/clone`            | Clone sản phẩm                                                        |
| PATCH  | `/admin/products/:id/status`           | Toggle active/inactive                                                |
| GET    | `/admin/users`                         | Danh sách người dùng                                                  |
| GET    | `/admin/users/:id`                     | Chi tiết người dùng                                                   |
| PUT    | `/admin/users/:id`                     | Cập nhật role/status người dùng                                       |
| DELETE | `/admin/users/:id`                     | Xóa người dùng                                                        |
| GET    | `/admin/discount-codes`                | Danh sách mã giảm giá                                                 |
| GET    | `/admin/discount-codes/:id`            | Chi tiết mã giảm giá                                                  |
| POST   | `/admin/discount-codes`                | Tạo mã giảm giá                                                       |
| PUT    | `/admin/discount-codes/:id`            | Cập nhật mã giảm giá                                                  |
| DELETE | `/admin/discount-codes/:id`            | Xóa mã giảm giá                                                       |

## 4.2 Query hooks

**Queries:**

- `useGetDashboardStatsQuery()` — tổng quan dashboard
- `useGetDetailedStatsQuery(params)` — stats chi tiết (startDate, endDate, groupBy)
- `useGetOrderStatusAnalyticsQuery(params?)` — phân bố trạng thái đơn
- `useGetTopProductsAnalyticsQuery(params?)` — top sản phẩm
- `useGetRevenueByCategoryAnalyticsQuery(params?)` — doanh thu theo danh mục
- `useGetUserGrowthAnalyticsQuery(params)` — tăng trưởng người dùng
- `useGetPaymentMethodsAnalyticsQuery()` — phân tích phương thức thanh toán
- `useGetLowStockAnalyticsQuery(params?)` — sản phẩm sắp hết hàng
- `useGetChatbotStatsQuery(params?)` — thống kê chatbot
- `useGetAdminOrdersQuery(params)` — danh sách đơn hàng admin
- `useGetAdminProductsQuery(filters?)` — danh sách sản phẩm admin
- `useLazyGetAdminProductsQuery()` — lazy variant, trả về `{ trigger }`, gọi `await trigger(filters)` thủ công
- `useGetAdminProductByIdQuery(id)` — chi tiết sản phẩm
- `useGetAllUsersQuery(params?)` — danh sách người dùng
- `useGetUserByIdQuery(id)` — chi tiết người dùng
- `useGetDiscountCodesQuery(params?)` — danh sách mã giảm giá
- `useGetDiscountCodeByIdQuery(id)` — chi tiết mã giảm giá

**Mutations:**

- `useUpdateOrderStatusMutation()` — cập nhật trạng thái đơn hàng
- `useCreateProductMutation()` — tạo sản phẩm
- `useUpdateProductMutation()` — cập nhật sản phẩm; invalidate cả `['products']` public list
- `useDeleteProductMutation()` — xóa sản phẩm; invalidate cả `['products']` public list
- `useCloneProductMutation()` — clone sản phẩm
- `useUpdateProductStatusMutation()` — toggle trạng thái active/inactive
- `useUpdateUserMutation()` — cập nhật thông tin/role người dùng
- `useDeleteUserMutation()` — xóa người dùng
- `useCreateDiscountCodeMutation()` — tạo mã giảm giá
- `useUpdateDiscountCodeMutation()` — cập nhật mã giảm giá
- `useDeleteDiscountCodeMutation()` — xóa mã giảm giá

---

# 5. Components chính

| Component            | Mô tả                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdminLayout`        | Sidebar (12 mục nav), header với user dropdown + dark mode toggle. Responsive: drawer Ant Design trên mobile, sidebar cố định trên desktop. Wrap ở route level — không import trong từng page. |
| `CreateProductForm`  | Form nhiều tab với state phức tạp: basic info, variants (hierarchical), images, attributes (dynamic), SEO, FAQ. Dùng trong cả `CreateProductPage` và `EditProductPage`.                        |
| `DashboardCharts`    | Recharts wrapper: revenue line chart, category pie chart, order status bar chart, top products list. Data fetch nội bộ qua `useGetTopProductsAnalyticsQuery` và các hooks analytics.           |
| `ProductExportModal` | Chọn columns muốn export, filter range date, tạo file Excel qua `exceljs`.                                                                                                                     |

---

# 6. Types

Types export từ từng api file (không có `types/` directory riêng trong feature này):

```typescript
// admin-dashboard-api.ts
interface DashboardOverview {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  aov: number;
  cancelledOrdersMonth: number;
  lowStockCount: number;
  ordersByStatus: Record<string, number>;
}
interface DashboardStats {
  overview: DashboardOverview;
  monthly: MonthlyStats;
  growth: GrowthStats;
  topProducts: TopProduct[];
}
interface ChatbotStats {
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  intentBreakdown: Record<string, number>;
  fallbackRate: number;
  avgResponseTimeMs: number;
}

// admin-product-api.ts
interface CreateProductRequest {
  name: string;
  baseName?: string;
  description: string;
  shortDescription: string;
  price?: number | string;
  comparePrice?: number | string | null;
  stock?: number;
  sku?: string;
  images: string[];
  status: 'active' | 'inactive' | 'draft';
  featured?: boolean;
  categoryIds: string[];
  condition?: 'new' | 'like-new' | 'used' | 'refurbished';
  specifications?: Array<{
    name: string;
    value: string;
    category?: string;
  }>;
  attributes?: Array<{
    name: string;
    value: string;
  }>;
  variants?: Array<{
    name: string;
    variantName?: string;
    sku?: string;
    price: number | string;
    compareAtPrice?: number | string | null;
    stockQuantity?: number;
    stock?: number;
    isDefault?: boolean;
    isAvailable?: boolean;
    attributes?: Record<string, string>;
    specifications?: Record<string, string | number | boolean>;
    images?: string[];
  }>;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
}

// admin-order-api.ts
interface AdminOrder {
  id: string;
  number: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod: string;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  User: { id; firstName; lastName; email; phone? };
  items: Array<{ id; productId; quantity; unitPrice: number; Product }>;
}

// admin-user-api.ts
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'customer' | 'admin';
  isEmailVerified: boolean;
  isActive: boolean;
}
```

---

# 7. Dependencies

## 7.1 Depends on

- `features/auth` — `useAuth()` hook cho `AdminLayout` (user info, logout)
- `stores/auth-store` — kiểm tra isAuthenticated, role
- `stores/ui-store` — theme state cho `AdminLayout`
- Ant Design (`antd`) — Table, Modal, Form, Select, Pagination, Drawer (dùng rộng rãi trong admin)
- `recharts` — charts trong `DashboardCharts`
- `exceljs` — export Excel trong `ProductExportModal`

## 7.2 Used by

- `AppRoutes.tsx` — mount `AdminLayout` tại route `/admin/*`

---

# 8. Gotchas & Edge Cases

- **`useGetAdminProductByIdQuery`** tự parse JSON string cho `attributes` và `variants.attributes` trong `queryFn` — data trả về đã là object, không cần parse lại.
- **`useUpdateProductMutation` và `useDeleteProductMutation`** invalidate cả `['products']` (public catalog list) để user thấy thay đổi ngay.
- **`useLazyGetAdminProductsQuery`** trả về `{ trigger }` không phải React Query instance — gọi `await trigger(filters)` thủ công.
- **Admin pages catalog/orders/content** nằm trong `features/admin/pages/<domain>/`, không phải feature domain tương ứng.
- **`AdminLayout`** wrap ở route level trong `AppRoutes.tsx` — không cần import trong từng page.
- **Charts** dùng `recharts` — không dùng Chart.js hay D3.
- **Export Excel** dùng `exceljs` — không dùng `xlsx` hay `sheetjs`.
- **`AdminRoute`** trong `src/components/routing/` chỉ cho phép role `admin`.
- **Query keys có cấu trúc** (`adminDashboardKeys`, etc.) — không dùng inline string array như features nhỏ.
- **`CategoriesPage` dùng `useGetCategoryTreeQuery`** (từ `features/catalog`) thay vì `useGetAllCategoriesQuery` — cần raw tree kể cả categories inactive/không có sản phẩm.

---

# 9. Tests

Không có test file riêng trong `features/admin/`. Coverage qua:

- `backend/__tests__/` — unit tests cho admin API endpoints
- `backend/__api__/` — API tests cho tất cả admin routes

Frontend tests nằm trong `frontend/src/__tests__/` — component tests dùng Jest + RTL.
