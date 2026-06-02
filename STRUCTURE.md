# TechStore — Cấu Trúc Hệ Thống

## Mục lục

- [1. Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
- [2. Tech Stack](#2-tech-stack)
- [3. Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
  - [3.1 Root](#31-root)
  - [3.2 Backend](#32-backend)
  - [3.3 Frontend](#33-frontend)
- [4. Backend Architecture](#4-backend-architecture)
  - [4.1 Modular Monolith pattern](#41-modular-monolith-pattern)
  - [4.2 DI Pattern](#42-di-pattern)
  - [4.3 17 Backend Modules](#43-17-backend-modules)
  - [4.4 Shared Infrastructure](#44-shared-infrastructure)
- [5. Frontend Architecture](#5-frontend-architecture)
  - [5.1 Feature-Based pattern](#51-feature-based-pattern)
  - [5.2 13 Frontend Features](#52-13-frontend-features)
  - [5.3 State Management](#53-state-management)
- [6. Database Schema Overview](#6-database-schema-overview)
  - [6.1 Core tables](#61-core-tables)
  - [6.2 Junction & Log tables](#62-junction--log-tables)
- [7. Data Flow](#7-data-flow)
  - [7.1 Request lifecycle](#71-request-lifecycle)
  - [7.2 AI/RAG pipeline](#72-airag-pipeline)
  - [7.3 Event-driven flows](#73-event-driven-flows)
- [8. Cross-module Dependencies](#8-cross-module-dependencies)
- [9. Environment & Configuration](#9-environment--configuration)
  - [9.1 Backend env vars](#91-backend-env-vars)
  - [9.2 Frontend env vars](#92-frontend-env-vars)
- [10. Module Aliases](#10-module-aliases)
  - [10.1 Backend aliases](#101-backend-aliases)
  - [10.2 Frontend aliases](#102-frontend-aliases)

---

# 1. Tổng quan kiến trúc

TechStore là hệ thống monorepo gồm hai ứng dụng độc lập:

- **Backend**: Node.js API server, Modular Monolith với 17 modules, giao tiếp qua EventBus nội bộ
- **Frontend**: React SPA, Feature-Based với 13 features, không có cross-feature imports

```
Browser ──HTTP──▶ Vite Dev Proxy (port 5175)
                       │
                       ▼
              Express API Server (port 8888)
                       │
          ┌────────────┴─────────────┐
          ▼                          ▼
       MySQL 8                  vector-db.json
    (Sequelize 6)               (AI/RAG store)
```

Giao tiếp giữa backend và frontend: HTTP REST API, JSON, JWT Bearer token. Không có WebSocket hay GraphQL.

---

# 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend runtime | Node.js | 20 |
| Web framework | Express | 4.18 |
| ORM | Sequelize | 6.37 |
| Database | MySQL | 8.x |
| Auth | JWT (access 15m + refresh env `JWT_REFRESH_EXPIRES_IN`, cookie default 7d) + Google OAuth 2.0 + bcrypt | — |
| Email | Nodemailer (Gmail SMTP) | 7.x |
| Validation | Zod | 4.x |
| API docs | Swagger UI + swagger-jsdoc (OpenAPI 3.0) | — |
| Rate limiting | express-rate-limit | — |
| HTTP security | Helmet + sanitize-html (XSS) + CSRF Origin check | — |
| Logging | Winston | 3.x |
| Cron jobs | node-cron | 4.x |
| Image processing | Sharp + Multer | — |
| Frontend framework | React | 19 |
| Language | TypeScript | ~5.8.0 |
| Build tool | Vite | 8.0.14 |
| UI libraries | Radix UI + shadcn/ui, Tailwind CSS v4, Framer Motion v12 | — |
| Icons | lucide-react | 1.16 |
| Charts | Recharts | 2.12 |
| Rich text | @tiptap | 3.x |
| Excel export | exceljs | 4.4 |
| Maps | leaflet | 1.9.4 |
| Date | dayjs | 1.11 |
| XSS sanitize (client) | dompurify | 3.4 |
| Client state | Zustand v5 + Immer | — |
| Server state | TanStack Query | 5.x |
| Routing | React Router | 7.15.1 |
| i18n | i18next + react-i18next | — |
| LLM | OpenAI-compatible API (configurable endpoint + model) | — |
| Embedding | Jina v3 → HF e5-instruct → HF e5-base (chain fallback) | 1024-dim |
| Translation | DeepL API | — |

---

# 3. Cấu trúc thư mục

## 3.1 Root

```
e-commerce-website/
├── backend/                 # Node.js API server
├── frontend/                # React SPA
├── scripts/                 # Root scripts: audit-architecture.sh, lint-migrations.sh
├── .github/workflows/       # CI pipeline
├── .husky/                  # Git hooks
├── .gitignore
├── CLAUDE.md                # AI agent navigation entry point
├── STRUCTURE.md             # File này
├── TESTING_STRATEGY.md      # Chiến lược test
├── README.md                # Project README
└── DIAGRAMS.md              # Mermaid diagrams
```

## 3.2 Backend

```
backend/
├── src/
│   ├── server.js            # Entry point — env validation, DB connect, startup
│   ├── app.js               # Express app — middleware stack + DI wiring + module mounting
│   ├── modules/             # 17 feature modules (xem mục 4.3)
│   │   └── <name>/
│   │       ├── module.js          # DI factory — buildXxxModule({deps...})
│   │       ├── routes.js          # Express router factory
│   │       ├── controllers/       # HTTP layer
│   │       ├── services/          # Business logic
│   │       ├── repositories/      # Sequelize queries
│   │       ├── validators/        # Zod schemas
│   │       └── dtos/              # DTO mappers (output shape)
│   ├── models/              # 25 Sequelize models (image.js tồn tại nhưng không export — Image model đã gỡ khỏi index.js)
│   │   ├── index.js         # Barrel + tất cả associations
│   │   └── *.js             # Individual model files
│   ├── shared/
│   │   ├── event-bus.js     # In-process pub/sub singleton
│   │   ├── errors/          # AppError, error classes
│   │   └── persistence/
│   │       └── unit-of-work.js   # runInTransaction + lockRow
│   ├── services/            # Shared non-DI services
│   │   ├── email.js         # Nodemailer email service
│   │   ├── embedding/
│   │   │   └── unified-embedding.js   # Chain: Jina → e5-instruct → e5-base
│   │   └── vector-store/
│   │       └── vector-store.js        # HybridVectorStore (JSON-based)
│   ├── middlewares/
│   │   ├── authenticate.js  # JWT verify + optional variant
│   │   ├── admin-auth.js    # JWT verify dành riêng cho admin panel (adminAuthenticate)
│   │   ├── authorize.js     # Role-based access (admin/customer)
│   │   ├── rate-limiter.js  # apiLimiter, authLimiter, otpLimiter, chatbotLimiter, chatLimiter
│   │   ├── detect-locale.js # Accept-Language → req.locale
│   │   ├── validate-request.js  # Zod validation middleware
│   │   └── error-handler.js # Global error middleware
│   ├── utils/
│   │   ├── logger.js        # Winston logger (file + console)
│   │   ├── i18n.js          # i18next backend (vi/en)
│   │   ├── catch-async.js   # Async error wrapper cho controllers
│   │   └── image-url.js     # URL builder cho ảnh (CDN-aware)
│   ├── jobs/
│   │   └── cleanup.js       # Cron: daily 2AM + weekly Sunday 3AM
│   ├── config/
│   │   ├── database.js      # Sequelize CLI config (dev/test/production)
│   │   ├── sequelize.js     # Sequelize instance singleton
│   │   └── swagger.js       # OpenAPI spec builder
│   ├── constants/
│   │   └── index.js         # SHIPPING_FREE_THRESHOLD, JWT_*, PAGINATION_*, OTP_*, MAX_CART_QUANTITY
│   ├── locales/
│   │   ├── vi.json          # Tiếng Việt
│   │   └── en.json          # English
│   ├── routes/
│   │   └── index.js         # Health check endpoint (/api/health)
│   └── migrations/          # 61 Sequelize migrations (src/migrations — xem .sequelizerc)
├── data/
│   ├── vector-db.json       # AI vector store snapshot
│   └── *.sql                # SQL dumps + seed files
├── docs/
│   └── openapi.json         # Auto-generated OpenAPI spec
├── scripts/                 # rebuild-db.js, index-products.js, export-seed.js...
├── .env.example
├── .sequelizerc
├── jest.config.js           # Unit test config
├── jest.integration.config.js
├── jest.api.config.js
└── jest.e2e.config.js
```

## 3.3 Frontend

```
frontend/
├── src/
│   ├── features/            # 13 feature modules (xem mục 5.2)
│   │   └── <name>/
│   │       ├── api/         # TanStack Query hooks + API functions
│   │       ├── components/  # UI components của feature
│   │       ├── pages/       # Page-level components
│   │       ├── hooks/       # Feature-specific hooks
│   │       └── types/       # TypeScript interfaces của feature
│   ├── components/
│   │   ├── common/          # Buttons, Modals, Notifications, Spinner...
│   │   ├── layout/          # MainLayout, Header, Footer, Sidebar
│   │   ├── routing/         # ProtectedRoute, PublicOnlyRoute, AdminRoute
│   │   ├── sections/        # Reusable page sections
│   │   ├── icons/           # Custom icon components
│   │   └── ui/              # shadcn/ui primitives (button, card, dialog, input...)
│   ├── stores/              # 6 Zustand stores (xem mục 5.3)
│   ├── routes/
│   │   ├── AppRoutes.tsx    # Tất cả routes với lazy loading
│   │   └── paths.ts         # ROUTES constants + buildRoute helpers
│   ├── lib/
│   │   ├── api-client.ts    # Axios instance + interceptors (token attach + 401 handle)
│   │   └── query-client.ts  # TanStack QueryClient (staleTime 5m, gcTime 10m)
│   ├── hooks/               # 5 hooks (useTokenRefresh, useDebounce, useNotifications, useApiState, useScrollToTop)
│   ├── pages/               # Static pages (Home, About, FAQs, Privacy, Terms...)
│   ├── utils/               # 13 utilities (token-manager, auth-utils, formatters...)
│   ├── types/               # Shared TypeScript types (user.types, ui.types...)
│   ├── styles/              # SCSS tokens (_tokens.scss, index.scss)
│   ├── schemas/             # Zod validation schemas (auth.ts, checkout.ts)
│   ├── config/
│   │   └── i18n.ts          # i18next initialization (localStorage detect, vi mặc định)
│   ├── constants/
│   │   ├── index.ts         # PAGINATION, UPLOAD, SHIPPING
│   │   └── chart-colors.ts  # PIE_COLORS, ORDER_STATUS_COLORS, CHART_* (Recharts)
│   └── locales/
│       ├── vi.json
│       └── en.json
├── index.html
├── vite.config.ts           # Aliases, SCSS config, dev proxy /api → :8888
├── tailwind.config.js
├── jest.config.cjs          # FE test config (2 projects: utils + components)
└── .env.example
```

---

# 4. Backend Architecture

## 4.1 Modular Monolith pattern

Mỗi module là một **vertical slice tự trị** — đóng gói đầy đủ HTTP layer, business logic, DB queries, và event handlers. Module không được import trực tiếp từ module khác; mọi giao tiếp cross-module đi qua:

1. **EventBus** (pub/sub, in-process) — cho side effects bất đồng bộ (ví dụ: order.cancelled → inventory log)
2. **Shared models** (được inject qua DI) — khi cần query dữ liệu của module khác
3. **Shared services** (email, vectorStore) — được inject tường minh qua constructor

Entry point DI duy nhất: `src/app.js`. Đây là nơi khởi tạo tất cả modules bằng cách gọi factory function với dependencies.

## 4.2 DI Pattern

Có hai variant:

**Full DI (12 modules)**: Factory function nhận toàn bộ dependencies (Sequelize models, eventBus, logger, services...) qua tham số, không require trực tiếp trong file service.

```javascript
// Ví dụ: buildOrdersModule({ Order, OrderItem, Cart, ..., eventBus, logger, emailService })
const ordersModule = buildOrdersModule({ Order, OrderItem, ... });
ordersModule.subscribeEvents(); // đăng ký event handlers
app.use('/api' + ordersModule.basePath, ordersModule.router);
```

**Singleton (5 modules)**: `discount-code`, `search-history`, `image`, `admin`, `attribute` — wrapper mỏng, gọi service functions trực tiếp (không inject deps). Dùng cho modules ít phức tạp hoặc không cần isolation test.

## 4.3 17 Backend Modules

| Module | Base path | Mô tả |
|---|---|---|
| `auth` | `/api/auth` | Đăng ký, đăng nhập email/Google, JWT, OTP, forgot/reset password |
| `users` | `/api/users` | Profile, địa chỉ giao hàng (CRUD) |
| `catalog` | `/api/products`, `/api/categories`, `/api/brands` | Sản phẩm + danh mục + thương hiệu (3 sub-router) |
| `cart` | `/api/cart` | Giỏ hàng guest (sessionId) + user (userId), merge khi login |
| `orders` | `/api/orders` | Tạo đơn, track, cancel, admin manage |
| `payment` | `/api/payments` | MoMo + VNPay create-URL, IPN callback, refund (admin) |
| `inventory` | `/api/inventory` | Stock view + adjust. SELECT FOR UPDATE chống race condition |
| `reviews` | `/api/reviews` | CRUD review. Chỉ user có OrderItem với productId mới được review |
| `discount-code` | `/api/discount-codes` | CRUD mã giảm giá, validate, apply. usedCount tăng khi createOrder (manual) hoặc IPN success (online) |
| `ai` | `/api/chatbot` | RAG chat, gợi ý sản phẩm, thêm vào giỏ qua chatbot |
| `admin` | `/api/admin` | Dashboard analytics, bulk operations |
| `content` | `/api/contact` | Feedback/contact form |
| `wishlist` | `/api/wishlists` | Toggle yêu thích sản phẩm |
| `image` | `/api/images` + `/api/img` (proxy) | Quản lý ảnh, Sharp processing, image proxy |
| `upload` | `/api/uploads` | Multer file upload, resize, cleanup |
| `attribute` | `/api/attributes` | AttributeGroup + AttributeValue + AI name generator |
| `search-history` | `/api/search-histories` | Lưu và xem lịch sử tìm kiếm |

## 4.4 Shared Infrastructure

**EventBus** (`src/shared/event-bus.js`):
- In-process pub/sub singleton, không dùng external broker
- `subscribe(eventType, handler)` → trả về unsubscribe function
- `publish(event)` → `Promise.allSettled` (1 handler lỗi không ảnh hưởng handler khác)
- Event object: `{ type, payload, occurredAt }`

**UnitOfWork** (`src/shared/persistence/unit-of-work.js`):
- `runInTransaction(work, options)` — wrap business operation trong Sequelize transaction
- `lockRow(model, where, transaction)` — SELECT FOR UPDATE helper
- Nested call: nếu đã có `options.transaction` thì reuse, không mở SAVEPOINT mới

**AppError** (`src/shared/errors/index.js`):
- Custom error classes (AppError, NotFoundError, UnauthorizedError, ValidationError...)
- `statusCode` + `isOperational` flag để phân biệt app errors vs system crashes

**Cron Jobs** (`src/jobs/cleanup.js`):
- **Daily 2AM**: Xóa abandoned carts (>30 ngày), trim search history (>50/user), null-out OTP/reset token hết hạn, deactivate discount codes hết hạn, archive chat messages cũ, xóa recently viewed cũ
- **Weekly Sunday 3AM**: Dọn orphaned upload files

---

# 5. Frontend Architecture

## 5.1 Feature-Based pattern

Mỗi feature trong `src/features/<name>/` là unit cô lập:
- **Không** có cross-feature imports — feature A không import từ feature B
- Mỗi feature tự quản lý: API calls, types, components, pages, hooks riêng
- Shared code đặt tại `src/components/`, `src/stores/`, `src/hooks/`, `src/utils/`, `src/lib/`

Routing: tất cả routes lazy-loaded trong `AppRoutes.tsx` với `React.lazy` + `Suspense`. Code splitting tự động theo feature.

## 5.2 13 Frontend Features

| Feature | Trang chính | API hooks |
|---|---|---|
| `auth` | Login, Register, ForgotPassword, ResetPassword, VerifyEmail | useLoginMutation, useRegisterMutation, useGoogleLoginMutation, useForgotPasswordMutation |
| `catalog` | ShopPage, ProductDetailPage, CategoriesPage, BrandsPage, DealsPage, NewArrivalsPage, BestSellersPage | useGetProductsQuery, useGetProductBySlugQuery, useGetAllCategoriesQuery, useGetBrandsQuery |
| `cart` | CartPage | useGetCartQuery, useAddToCartMutation, useUpdateCartItemMutation, useRemoveCartItemMutation |
| `checkout` | CheckoutPage | useCreateOrderMutation, useApplyDiscountCodeMutation, useGetAvailableDiscountCodesQuery |
| `orders` | OrdersPage, TrackOrderPage | useGetUserOrdersQuery, useGetOrderByIdQuery, useCancelOrderMutation, useConfirmReceivedMutation |
| `payment` | PaymentQRPage | useCreateMomoUrlMutation, useCreateVNPayUrlMutation |
| `users` | ProfilePage | useUpdateProfileMutation, useGetAddressesQuery, useChangePasswordMutation |
| `wishlist` | WishlistPage | useGetWishlistQuery, useAddToWishlistMutation, useRemoveFromWishlistMutation |
| `reviews` | (embedded trong ProductDetail) | useGetProductReviewsQuery, useCreateReviewMutation |
| `ai` | ChatWidgetPortal (floating) | useSendChatbotMessageMutation, useAddToCartViaChatbotMutation |
| `admin` | DashboardPage + admin pages | useGetDashboardStatsQuery, useGetAdminOrdersQuery, useGetAdminProductsQuery... |
| `content` | ContactPage | useSendFeedbackMutation |
| `upload` | (embedded) | useUploadImageMutation, useUploadSingleMutation |

## 5.3 State Management

**6 Zustand stores** (tất cả dùng Immer middleware):

| Store | Dữ liệu quản lý | Persistence |
|---|---|---|
| `auth-store` | user, token, isAuthenticated, isLoading, justLoggedIn | localStorage (user), sessionStorage (access_token) |
| `cart-store` | items, totalItems, subtotal, serverCart, isOpen | localStorage (cartItems) |
| `chat-store` | messages, isOpen, sessionId, chatHistory | localStorage (chat_messages, chat_session_id) |
| `catalog-store` | recentlyViewed[] (max 10), compareList[] (max 4), filters | localStorage (recentlyViewed) |
| `wishlist-store` | items[] (product IDs) | Không persist |
| `ui-store` | notifications, isSearchOpen, isMobileMenuOpen, theme | localStorage (theme) |

**TanStack Query**: Server state (products, orders, user data...). Config mặc định: `staleTime: 5 phút`, `gcTime: 10 phút`, `retry: 1`, `refetchOnWindowFocus: false`.

**Axios interceptors** (`api-client.ts`):
- Request: attach `Authorization: Bearer <token>` từ `getValidToken()` (auto-refresh nếu sắp hết hạn)
- Response: catch 401 → gọi `handleUnauthorizedError` (logout + redirect `/login`)

---

# 6. Database Schema Overview

Sequelize models, MySQL 8, charset utf8mb4, timezone +07:00. Tất cả tables dùng `timestamps: true, underscored: true`.

## 6.1 Core tables

| Table | Model | Mô tả |
|---|---|---|
| `users` | User | Tài khoản: email, password (bcrypt), googleId, role (customer/staff/admin), otpCode, resetPasswordToken, resetPasswordExpires |
| `addresses` | Address | Địa chỉ giao hàng của user (1 user N addresses) |
| `categories` | Category | Danh mục sản phẩm (flat, có parentId cho nested display); fields: `isActive` (default true), `sortOrder` (default 0) |
| `brands` | Brand | Thương hiệu (name, slug, logoUrl) |
| `products` | Product | Sản phẩm: name (virtual→nameVi), slug, basePrice, compareAtPrice, status (active/inactive/draft/archived), categoryId, brandId (KHÔNG có cột thumbnail — thumbnail nằm ở ProductImage.isThumbnail) |
| `product_variants` | ProductVariant | Biến thể: variantName, price, stockQuantity, sku, attributes (JSON), isDefault |
| `product_attributes` | ProductAttribute | Key-value attributes gắn với sản phẩm (màu, size...) |
| `product_specifications` | ProductSpecification | Thông số kỹ thuật dạng key-value (RAM, CPU...) |
| `product_images` | ProductImage | Ảnh sản phẩm/biến thể (imageUrl, isThumbnail, color, variantId) |
| `carts` | Cart | Giỏ hàng: userId (nullable cho guest), sessionId, status (active/merged/converted/abandoned) |
| `cart_items` | CartItem | Item trong giỏ: cartId, productId, variantId, quantity |
| `orders` | Order | Đơn hàng: status, paymentMethod, paymentStatus, shipping fields phẳng (shippingFirstName…shippingAddress1/2), total, discountCodeId |
| `order_items` | OrderItem | Item đơn hàng: orderId, productId, variantId, quantity, unitPrice |
| `product_reviews` | Review | Đánh giá: userId, productId, rating, content, isVerified |
| `wishlists` | Wishlist | Junction: userId + productId (many-to-many) |
| `discount_codes` | DiscountCode | Mã giảm giá: code, type (percent/fixed), value, minOrderAmount, usedCount, usageLimit, startDate, endDate |
| `feedbacks` | Feedback | Form liên hệ: name, email, subject, content, status |
| `chat_messages` | ChatMessage | Lịch sử chat AI: userId (nullable), sessionId, role (user/assistant), content, isArchived |
| `search_histories` | SearchHistory | Lịch sử tìm kiếm: userId (nullable), sessionId, keyword, resultsCount |
| `recently_viewed` | RecentlyViewed | Sản phẩm đã xem: userId, productId, viewedAt |
| `inventory_logs` | InventoryLog | Inventory log tồn kho: productId, variantId, orderId, changeType, previousStock, newStock |

## 6.2 Junction & Log tables

| Table | Model | Quan hệ |
|---|---|---|
| `product_categories` | ProductCategory | Product ↔ Category (many-to-many, legacy compat) |
| `product_attribute_groups` | ProductAttributeGroup | Product ↔ AttributeGroup (many-to-many) |
| `attribute_groups` | AttributeGroup | Nhóm thuộc tính (màu sắc, dung lượng...) |
| `attribute_values` | AttributeValue | Giá trị trong nhóm thuộc tính |

**Lưu ý quan trọng về models đã xóa**: `Collection`, `EmailCampaign`, `NewsletterSubscriber`, `ImportLog`, `Banner`, `News`, `LoyaltyHistory`, `WarrantyPackage`, `ProductWarranty`, và model `Image` (file tồn tại nhưng đã xóa khỏi `index.js` associations) — không reference lại.

---

# 7. Data Flow

## 7.1 Request lifecycle

```
HTTP Request
    │
    ├─ Helmet (security headers)
    ├─ CORS check
    ├─ CSRF Origin validation (POST/PUT/PATCH/DELETE)
    ├─ Morgan logging (bỏ qua /health)
    ├─ Rate limiter (authLimiter cho /auth, apiLimiter cho production)
    ├─ detect-locale (Accept-Language → req.locale)
    ├─ express.json() + urlencoded body parse (limit 2mb) + cookieParser (refreshToken cookie)
    ├─ sanitizeBody (strip HTML tags — chống XSS)
    ├─ compression
    │
    ├─ Module router (vd: /api/orders → ordersModule.router)
    │       ├─ authenticate middleware (verify JWT)
    │       ├─ authorize middleware (role check)
    │       ├─ validateRequest (Zod schema)
    │       ├─ Controller (catchAsync wrapper)
    │       │       └─ Service (business logic)
    │       │               └─ Repository (Sequelize queries)
    │       │                       └─ MySQL
    │
    └─ errorHandler (global error middleware)
```

## 7.2 AI/RAG pipeline

**Indexing** (chạy offline hoặc auto-trigger):
```
Products (MySQL) ──▶ enrichProductData()
                           │
                           ▼ buildEmbeddingText() → max 1500 chars
                           │   (name + brand + category + description + price + stock)
                           ▼
                    UnifiedEmbeddingService.generateEmbedding(text, 'passage')
                           │  Chain: Jina v3 → HF e5-instruct → HF e5-base
                           ▼
                    vector-db.json (1024-dim vectors + metadata)
```

**Query** (realtime khi user chat):
```
User message ──▶ AIService.handleMessage()
                      │
                      └─── chatbotService.handleMessage() [7 bước]
                                │
                                ├─ ① validate (AppError 400 nếu sai)
                                ├─ ② expandAbbreviations (ip→iPhone...)
                                ├─ ③ isPromptInjection / isOffTopic → early return
                                ├─ ④ load conversationHistory Map
                                ├─ ⑤ Promise.all: rewriteQuery LLM + hybridSearch(normalizedQuery)
                                │         ├─ _semanticSearch(): cosine similarity (threshold 0.45)
                                │         ├─ _keywordSearch(): BM25-inspired (name×3, text×1)
                                │         └─ merge: boost +0.05 overlap, inject keyword-only
                                ├─ ⑥ Build prompt → LLM API (OpenAI-compatible)
                                └─ ⑦ persist: session Map + ChatMessage DB
```

**Auto-rebuild trigger** (startup):
```
Server start ──▶ checkVectorStoreSync()
                      │
                      ├─ Count active products có variant stock > 0 (MySQL)
                      ├─ Count vectors trong vector-db.json
                      └─ |activeCount - vectorCount| / activeCount > 0.05
                              ──▶ exec('npm run ai:rebuild-vectors')
```

## 7.3 Event-driven flows

EventBus là singleton in-process. Các luồng event chính:

**Order lifecycle**:
```
createOrder()
    ├─▶ eventBus.publish({ type: 'order.created', payload: { orderId, items, userId } })
    │           ▶ (hiện chưa có subscriber chức năng)
    └─▶ emailGateway.sendOrderConfirmationEmail() — fire-and-forget

cancelOrder()
    └─▶ eventBus.publish({ type: 'order.cancelled' })
                ▶ inventoryModule.subscribe → ghi inventory log (stock đã restore inline)

(payment confirmed)
    └─▶ paymentModule update paymentStatus inline trong service (không qua eventBus)
```

**Auth events**:
```
register() ──▶ (KHÔNG publish event — register() không có dòng publish nào; auth module không inject eventBus → this.eventBus=undefined; auth.userRegistered không tồn tại trong source)
logout()   ──▶ no-op server-side (clear refreshToken cookie Max-Age=0, client tự xóa access token)
```

**Catalog events**:
```
product.afterCreate/Update/Destroy
    └─▶ AI module hook → vectorStore.upsertProduct() hoặc deleteProduct()
```

---

# 8. Cross-module Dependencies

```
orders    ──▶ cart (xóa sau khi đặt)
          ──▶ users (shippingAddress, email)
          ──▶ inventory (eventBus: order.cancelled → ghi inventory log)
          ──▶ discount-code (apply, tăng usedCount khi createOrder hoặc IPN success)
          ──▶ emailService (gửi xác nhận đơn hàng)

cart      ──▶ catalog (Product/Variant info, kiểm tra stock)

catalog   ──▶ attribute (filters, AI name generator)
          ──▶ inventory (stock display tại variant level)
          ──▶ image (thumbnails)

auth      ──▶ users (User model)
          ◀── tất cả modules (authenticate middleware inject userId vào req.user)

admin     ──▶ orders, users, catalog, reviews, content, discount-code, inventory

ai        ──▶ catalog (vector search qua vectorStoreService)
          ──▶ attribute (name generator inject)
          ◀── Product model hooks (auto-upsert afterCreate/Update/Destroy)

payment   ──▶ orders (update paymentStatus inline trong service, không qua eventBus)

inventory ◀── orders (subscribe: order.cancelled → ghi inventory log; order.created chưa có subscriber)
```

---

# 9. Environment & Configuration

## 9.1 Backend env vars

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `PORT` | Không | Server port, mặc định 8888 |
| `NODE_ENV` | Không | `development` / `test` / `production` |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | **Có** | Kết nối MySQL |
| `DB_PORT` | Không | Mặc định 3306 |
| `DB_NAME_TEST` | Không | DB test, mặc định `techstore_test` |
| `DB_SSL` | Không | `true` cho production với SSL |
| `DB_SYNC` | Không | `true` để auto-sync schema (dev only) |
| `JWT_SECRET` | **Có** | >= 32 ký tự ngẫu nhiên |
| `JWT_EXPIRES_IN` | Không | Mặc định 15m |
| `JWT_REFRESH_SECRET` | **Có** | >= 32 ký tự ngẫu nhiên |
| `JWT_REFRESH_EXPIRES_IN` | Không | Cookie maxAge default 7d (auth-controller.js). JWT `expiresIn` không có fallback nếu bỏ trống. |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL_1`, `LLM_MODEL_2` | Không | OpenAI-compatible LLM endpoint (2 model fallback) |
| `JINA_API_KEY` | Không | Jina v3 embedding (ưu tiên) |
| `HF_API_KEY` | Không | HuggingFace embedding (fallback) |
| `DEEPL_API_KEY` | Không | DeepL translation |
| `OPENROUTER_API_KEY` | Không | OpenRouter cho LLM chatbot |
| `GOOGLE_CLIENT_ID` | Không | Google OAuth |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, `EMAIL_PASSWORD` | **Có** | Gmail SMTP |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | Không | From address + display name cho email gửi đi |
| `EMAIL_SECURE` | Không | `true` cho TLS (port 465). Mặc định false |
| `ADMIN_EMAIL` | Không | Email nhận feedback từ content module |
| `CDN_BASE_URL`, `ASSET_BASE_URL` | Không | Base URL cho ảnh/CDN (fallback về localhost nếu không set) |
| `TRANSLATE_MODEL` | Không | Model dùng cho translation (mặc định deepseek/deepseek-v4-flash:free) |
| `CORS_ORIGIN` | Không | Production: set cụ thể. Dev: dùng `CORS_ORIGINS_DEV` |
| `CORS_ORIGINS_DEV` | Không | Comma-separated origins cho dev |
| `FRONTEND_URL` | Không | Mặc định http://localhost:5175 |
| `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL`, `VNP_RETURN_URL`, `VNP_IPN_URL` | Không | VNPay |
| `VNP_API` | Không | VNPay refund API endpoint |
| `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_API_ENDPOINT` | Không | MoMo |
| `MOMO_IPN_URL`, `MOMO_REDIRECT_URL` | Không | MoMo IPN callback + redirect URL sau thanh toán |
| `LOG_LEVEL` | Không | Winston log level, mặc định `info` |

## 9.2 Frontend env vars

| Biến | Mô tả |
|---|---|
| `VITE_API_URL` | Backend API URL, mặc định `http://localhost:8888/api` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `VITE_GOONG_API_KEY` | Goong Maps API key |

---

# 10. Module Aliases

## 10.1 Backend aliases

Cấu hình trong `backend/package.json` (`_moduleAliases`) và `backend/jest.config.js` (`moduleNameMapper`):

```
@modules     → src/modules
@shared      → src/shared
@utils       → src/utils
@middlewares → src/middlewares
@models      → src/models
@config      → src/config
@services    → src/services
@jobs        → src/jobs
```

## 10.2 Frontend aliases

Cấu hình trong `frontend/vite.config.ts` (`resolve.alias`):

```
@            → src/
@assets      → src/assets
@components  → src/components
@config      → src/config
@constants   → src/constants
@contexts    → src/contexts    # dir chưa tồn tại (alias chết)
@features    → src/features
@hooks       → src/hooks
@lib         → src/lib
@pages       → src/pages
@routes      → src/routes
@schemas     → src/schemas
@services    → src/services    # dir chưa tồn tại (alias chết)
@stores      → src/stores
@styles      → src/styles
@types       → src/types
@utils       → src/utils
```

> Tổng 17 alias trong `vite.config.ts`. `@contexts` và `@services` trỏ tới thư mục chưa được tạo (`src/contexts`, `src/services`) — nên xóa khỏi config hoặc tạo thư mục tương ứng.
