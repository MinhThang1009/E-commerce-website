# Kiến trúc hệ thống — TechStore E-Commerce

## Tổng quan

Monorepo với 2 package độc lập:
```
├── backend/    Express.js API (Node 22, Sequelize 6, MySQL)
├── frontend/   React 18 + TypeScript + Vite (Zustand + TanStack Query)
└── docs/       Tài liệu kiến trúc
```

---

## Backend — Modular Monolith

### Cấu trúc thư mục

```
backend/src/
├── app.js              Entry factory — wire modules + middleware
├── server.js           HTTP server entry
├── modules/            Domain modules (DDD-lite)
│   ├── admin/          Admin operations (wrapper → routes/admin.js)
│   ├── ai/             AI chatbot (Gemini via OpenRouter + RAG)
│   ├── attribute/      Product attributes (wrapper)
│   ├── auth/           Authentication & authorization
│   ├── cart/           Shopping cart
│   ├── catalog/        Products, brands, categories, collections
│   ├── content/        Banners, news, newsletter, contact
│   ├── discountCode/   Discount codes (wrapper)
│   ├── image/          Image management (wrapper)
│   ├── inventory/      Stock management
│   ├── location/       Province/district lookup (wrapper)
│   ├── loyalty/        Loyalty points
│   ├── orders/         Order lifecycle
│   ├── payment/        MoMo, VNPay, SePay webhooks
│   ├── reviews/        Product reviews
│   ├── searchHistory/  Search history (wrapper)
│   ├── upload/         File upload (S3/local)
│   ├── users/          User management
│   ├── warrantyPackage/ Warranty packages (wrapper)
│   └── wishlist/       Wishlist
├── controllers/        Legacy flat controllers (được wrap bởi wrapper modules)
│   ├── admin.js        Mega admin controller — tách dần vào modules
│   ├── adminImport.js  Bulk product import
│   ├── payment.js      Payment callbacks (partial — SePay webhook)
│   └── ...
├── routes/             Legacy flat routes (chỉ còn health endpoint)
│   └── index.js        Health check only
├── middlewares/        Express middlewares (canonical = shared/http/middlewares/)
├── models/             Sequelize models (39 tables)
├── migrations/         Sequelize migrations (timestamped)
├── services/           Legacy services + AI services
├── shared/             Cross-cutting concerns
│   ├── errors/         AppError hierarchy
│   ├── eventBus/       In-process event bus
│   ├── http/           HTTP utilities
│   └── persistence/    UnitOfWork
└── utils/              Utility functions + localization helpers
```

### Module pattern (DDD-lite)

Mỗi module đầy đủ có cấu trúc:
```
modules/<name>/
├── module.js           Factory function — wire DI, export { basePath, router, subscribeEvents }
├── routes.js           Express Router definitions
├── controllers/        HTTP request/response layer
├── services/           Business logic (orchestrate repository + domain)
├── repositories/       Data access (Sequelize implementations)
│   ├── I<Name>Repository.js  Interface/port
│   └── Sequelize<Name>Repository.js  Implementation
├── domain/
│   ├── aggregates/     Domain aggregates (invariant enforcement)
│   ├── events/         Domain events
│   ├── policies/       Business rules
│   └── ports/          Interfaces for external dependencies
├── dtos/               Data Transfer Objects
└── validators/         Joi validation schemas
```

**Wrapper modules** (thin delegates đến flat routes — bước đầu của migration):
```
modules/<name>/module.js → require('../../routes/<name>')
```

### Request flow

```
HTTP → app.js middlewares → module router → controller → service → repository → DB
                                                         ↓
                                                   eventBus.publish()
                                                         ↓
                                               Other module subscribers
```

### Dependency Injection

`app.js` build tất cả modules với DI:
```js
const catalogModule = buildCatalogModule({ Product, ProductVariant, Category, ... });
```

Modules nhận models + shared services qua constructor, không `require` trực tiếp.

---

## Frontend — Feature-based React

### Cấu trúc thư mục

```
frontend/src/
├── features/           14 feature modules
│   ├── ai/             AI chatbot widget
│   ├── admin/          Admin dashboard + pages
│   ├── auth/           Login, register, OAuth
│   ├── cart/           Shopping cart
│   ├── catalog/        Products, brands, categories, collections
│   ├── checkout/       Checkout flow
│   ├── content/        Banners, news, contact
│   ├── loyalty/        Loyalty points
│   ├── orders/         Order history + tracking
│   ├── payment/        Payment pages + QR
│   ├── reviews/        Product reviews
│   ├── upload/         File upload UI
│   ├── users/          Profile management
│   └── wishlist/       Wishlist
├── components/         Shared/reusable components
│   ├── common/         Buttons, modals, notifications
│   ├── icons/          Icon components
│   ├── layout/         Header, Footer, MainLayout
│   └── shared/         SearchBar (cross-cutting)
├── stores/             Zustand global state (6 stores)
├── routes/             React Router setup + paths.ts constants
├── constants/          Shared constants (pagination, upload, loyalty)
├── locales/            i18n keys (vi + en)
├── utils/              Utility functions
└── config/             i18n, Vite aliases
```

### State management

- **Server state**: TanStack Query (caching, mutations, invalidation)
- **Client state**: Zustand stores (`authStore`, `cartStore`, `uiStore`, `catalogStore`, `chatStore`, `wishlistStore`)

### i18n

Column-per-locale pattern (migration 2026051611):
- DB: `name_vi` (canonical) + `name_en` (nullable)
- Sequelize: VIRTUAL field `name` → getter returns `nameVi`
- API: `?lang=en` hoặc `Accept-Language` header
- Helper: `localizeEntity(entity, locale, type)` trong `utils/localize.js`

---

## Database — MySQL (InnoDB, utf8mb4_unicode_ci)

39 tables, soft-delete (paranoid) cho main entities. Xem `backend/data/migration_full.sql` cho full schema.

**Migration strategy**: Sequelize CLI, timestamped files `YYYYMMDDNN-description.js`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js 22 |
| Backend framework | Express.js 4 |
| ORM | Sequelize 6 |
| Database | MySQL 8 |
| Cache | Redis (optional, fallback in-memory) |
| AI | OpenRouter API (Gemini 2.0 Flash) |
| File storage | Local / S3-compatible |
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite |
| State (server) | TanStack Query v5 |
| State (client) | Zustand v5 |
| UI library | Ant Design + Tailwind CSS |
| Testing | Jest (backend, 678 tests) |
