# Naming — Basic (file / folder / code / DB / API / git / env)

> Updated Phase 42 — Modular Monolith (BE) + Feature-based (FE).

## Backend (Node.js + Express + Sequelize) — Modular Monolith

### Folder structure
```
backend/src/
├── modules/                # Modular Monolith — 1 folder = 1 bounded context
│   ├── {name}/             # Simple module (auth, users, cart, wishlist, reviews,
│   │                       #   loyalty, content, upload, catalog)
│   │   ├── controllers/    # {name}Controller.js — thin layer parse req → service
│   │   ├── services/       # {name}Service.js — business logic, KHÔNG touch Model
│   │   ├── repositories/   # I{Name}Repository.js (interface)
│   │   │                   # Sequelize{Name}Repository.js (impl)
│   │   ├── validators/     # {name}Validator.js — Joi schemas
│   │   ├── dtos/           # {name}Dto.js — plain factory function (KHÔNG class Mapper)
│   │   ├── routes.js       # Express router definition
│   │   └── module.js       # DI factory: wire repo → service → controller → router
│   │
│   └── {name}/             # DDD-lite module (orders, payment, inventory, chat, ai)
│       ├── (như simple +)
│       ├── domain/
│       │   ├── aggregates/ # {Name}Aggregate.js — rich method, state transitions
│       │   ├── events/     # {Name}{Action}Event.js — Domain Event
│       │   ├── policies/   # {Name}Policy.js — pure business rules
│       │   └── ports/      # I{ExternalService}.js — interface external service
│       └── infrastructure/ # Adapter impl: {X}Gateway.js
│
├── shared/                 # Cross-cutting infrastructure
│   ├── errors/             # AppError, DomainError, ValidationError, NotFoundError
│   ├── eventBus.js         # In-process pub/sub
│   ├── result.js           # Result.ok/fail
│   ├── persistence/        # sequelize, unitOfWork
│   ├── http/middlewares/   # authenticate, errorHandler, validateRequest, ...
│   ├── socket/             # Socket.IO bridge
│   ├── cache/              # Redis client
│   ├── utils/, logger.js, mailer.js
│   └── index.js            # Top barrel
│
├── models/, migrations/    # Sequelize models + migrations (chia theo entity)
├── config/                 # sequelize.js, redis.js, swagger.js
├── middlewares/            # Legacy middlewares (re-exported qua shared/http/)
├── jobs/                   # Cron jobs (cleanup, ...)
├── constants/              # App-wide constants (POINTS_*, SHIPPING_*)
├── utils/                  # Cross-cutting utils
├── __tests__/              # Jest test suites
└── app.js, server.js
```

### File naming
| Layer | Convention | Ví dụ |
|---|---|---|
| Module folder | `lowercase` singular hoặc plural | `auth/`, `orders/`, `catalog/` |
| Module entry | `module.js` | `modules/auth/module.js` |
| Controller | `{name}Controller.js` PascalCase class trong file camelCase | `authController.js` exports `AuthController` |
| Service | `{name}Service.js` PascalCase class | `authService.js` exports `AuthService` |
| Repository interface | `I{Name}Repository.js` | `IAuthRepository.js` (EXCEPTION với "no I prefix" — DDD/clean convention) |
| Repository impl | `Sequelize{Name}Repository.js` hoặc `Filesystem{Name}Repository.js` | `SequelizeAuthRepository.js` |
| Validator | `{name}Validator.js` exports Joi schemas | `authValidator.js` |
| DTO | `{name}Dto.js` exports `to{X}Dto(model)` plain function | `authDto.js` exports `toUserDto` |
| Routes | `routes.js` (1 file/module) | `modules/auth/routes.js` |
| Domain Aggregate | `{Name}Aggregate.js` PascalCase | `OrderAggregate.js`, `InventoryAggregate.js` |
| Domain Event | `{Name}{Action}Event.js` | `OrderCreatedEvent.js`, `PaymentSucceededEvent.js` |
| Domain Policy | `{Name}Policy.js` | `RefundPolicy.js`, `OrderStatusPolicy.js` |
| Domain Port | `I{ServiceName}.js` interface | `ILlmGateway.js`, `ISocketBridge.js` |
| Infrastructure Gateway | `{Name}Gateway.js` impl của port | `MomoGateway.js`, `VnPayGateway.js` |
| Models | `camelCase.js` | `product.js`, `orderItem.js` |
| Middlewares | `camelCase.js` | `authenticate.js` |
| Migrations | `YYYYMMDDHHmm-kebab-description.js` | `2026050501-rename-columns.js` |
| Tests | `{name}.test.js` hoặc `{name}.unit.test.js` | `authService.unit.test.js` |

### JavaScript code
- Variables, functions: `camelCase` (`getUserById`)
- Classes, Sequelize models, Aggregates: `PascalCase` (`Product`, `OrderAggregate`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_RETRY_COUNT`, `POINTS_VALUE`)
- Booleans: prefix `is*/has*/can*` (`isActive`, `hasDiscount`)
- Async functions: KHÔNG bắt buộc suffix `Async`, để TS/JSDoc detect

### Cross-module communication
- KHÔNG `require` thẳng controller/service module khác → vi phạm bounded context
- Dùng **eventBus** publish/subscribe cho async coupling: `eventBus.publish(OrderCreatedEvent({...}))`
- Dùng **DI** (qua module.js factory) cho sync direct call

### Database (Phase 40 chuẩn)
- Tables: `snake_case` plural (`order_items`)
- Columns: `snake_case` (`created_at`, `points_earned`)
- FK constraints: `fk_{table}_{singular_ref}` (`fk_orders_user`)
- Indexes: `idx_{table}_{col}` hoặc `uq_{table}_{col}`
- ENUM values: lowercase, multi-word `snake_case`

### API URL
- Base: `/api/v1/` (hoặc `/api/`)
- Collection resources: kebab-case plural (`/products`, `/discount-codes`)
- Singleton resources: singular (`/cart`, `/auth`)
- Action endpoints: verb-style chấp nhận (`/auth/login`, `/uploads`)
- Path params: camelCase trong code, kebab trong URL nếu multi-word (`/orders/:orderId/items/:itemId`)
- Module mount: `/api{module.basePath}` (vd `module.basePath = '/orders'` → `/api/orders`)

## Frontend (React + TS + Vite + Redux Toolkit) — Feature-based

### Folder structure
```
frontend/src/
├── features/                   # Feature-based — 1 folder = 1 BE module tương ứng
│   └── {name}/                 # auth, catalog, cart, checkout, orders, payment,
│   │                           #   reviews, wishlist, loyalty, content, chat, ai,
│   │                           #   admin, upload, users, ui
│   │   ├── api/                # {entity}Api.ts — RTK Query injectEndpoints
│   │   ├── components/         # Feature-specific UI components
│   │   ├── hooks/              # use{X}.ts — feature hooks
│   │   ├── pages/              # *Page.tsx route components
│   │   │   └── admin/          # *Page.tsx admin sub-routes (nếu có)
│   │   ├── store/              # {entity}Slice.ts — Redux Toolkit slice
│   │   ├── types/              # {entity}.types.ts
│   │   ├── contexts/           # *Context.tsx (nếu có)
│   │   └── index.ts            # Barrel export — public surface của feature
│
├── components/                 # Cross-cutting UI (KHÔNG feature-specific)
│   ├── common/                 # UI primitives — Button, Input, Modal, Card,
│   │                           #   Badge, Pagination, LanguageSwitcher, ...
│   ├── icons/                  # SVG icon components
│   ├── layout/                 # MainLayout, Header, Footer
│   ├── modals/                 # Global modals (AttributeModal, VariantModal)
│   ├── sections/               # Page sections (HeroSection, HomeNewsSection)
│   └── shared/                 # Cross-feature components (ProductCard,
│                               #   OrderDetails, SearchBar) — sẽ migrate vào
│                               #   features tương ứng nếu chỉ 1 feature dùng
│
├── pages/                      # Top-level static pages KHÔNG thuộc feature nào
│                               # (HomePage, AboutPage, FAQs, Privacy, Terms,
│                               #   ProfilePage, NotFound, Unauthorized,
│                               #   Shipping, ProfilePage)
├── services/                   # Cross-cutting API setup (api.ts, apiClient.ts)
├── hooks/                      # Cross-cutting hooks (useDebounce, useToast, ...)
├── types/                      # Cross-cutting types (common.types, ui.types,
│                               #   user.types, discount.types) + index barrel
├── store/                      # Redux store config (combine reducers)
├── routes/                     # AppRoutes.tsx — lazy import feature pages
├── utils/, contexts/, locales/, config/, styles/, __tests__/
└── App.tsx, main.tsx
```

### File naming
| Layer | Convention | Ví dụ |
|---|---|---|
| Feature folder | `lowercase` singular hoặc plural — match BE module | `auth/`, `catalog/`, `orders/` |
| Feature barrel | `index.ts` | `features/auth/index.ts` |
| Pages | `*Page.tsx` PascalCase | `LoginPage.tsx`, `CheckoutPage.tsx` |
| Components | `PascalCase.tsx` | `ProductCard.tsx`, `CartItem.tsx` |
| Hooks | `use*.ts` camelCase | `useAuth.ts`, `useProductForm.ts` |
| API services | `{singularEntity}Api.ts` camelCase | `productApi.ts`, `emailCampaignApi.ts` |
| Types | `{entity}.types.ts` lowercase | `product.types.ts`, `auth.types.ts` |
| Store slices | `{entity}Slice.ts` camelCase | `authSlice.ts`, `cartSlice.ts` |
| Utils | `camelCase.ts` | `format.ts`, `priceUtils.ts` |
| Contexts | `*Context.tsx` PascalCase | `ThemeContext.tsx` |
| i18n locales | `{lang}.json` | `vi.json`, `en.json` |
| Tests | `{name}.test.ts(x)` | `cartUtils.test.ts` |

### Component file suffix
| Suffix | Ví dụ |
|---|---|
| `*Page.tsx` | route component | `LoginPage`, `CheckoutPage` |
| `*Layout.tsx` | layout wrapper | `MainLayout`, `AdminLayout` |
| `*Modal.tsx` | modal/dialog | `ReviewModal`, `ConfirmModal` |
| `*Form.tsx` | form container | `ProductForm`, `LoginForm` |
| `*Provider.tsx` | context provider | `AuthProvider`, `ThemeProvider` |
| `*Section.tsx` | page section | `HeroSection`, `HomeNewsSection` |
| `*Card.tsx` | card display | `ProductCard`, `OrderCard` |
| `*List.tsx` | list rendering | `ReviewList` |
| `*Item.tsx` | single item trong list | `CartItem`, `ReviewItem` |

### TypeScript code
- Variables, functions: `camelCase`
- Types, interfaces, enums: `PascalCase` (`User`, `OrderStatus`)
- KHÔNG dùng `I` prefix cho TypeScript interface (Hungarian obsolete) — EXCEPTION: BE Repository interface DDD convention vẫn `I*Repository`
- React components: `PascalCase`
- Component props interface: `{ComponentName}Props` (`ButtonProps`)
- Constants: `UPPER_SNAKE_CASE`
- Booleans: `is*/has*/can*` prefix
- Event handlers: `handle{Event}` (`handleSubmit`)
- Callbacks: `on{Event}` (`onSubmit` cho prop)

### Import patterns
- **External** (cross-feature): qua barrel `from '@/features/{name}'`
- **Internal** (cùng feature): relative path `from '../api/X'`, `from '../store/X'`
- **Lazy import** trong `routes/AppRoutes.tsx`: deep path để giữ code splitting
  ```ts
  const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
  ```
- **Cross-cutting** (components/common, hooks, utils): `from '@/components/common'`, `from '@/hooks/useDebounce'`

## Git
- Branch: commit thẳng `main` cho phase low-risk; branch riêng cho phase touch schema/infra/migration
- Commit: tuân Rule 4.1 plan.md (prefix `Refactor Phase X.Y — ` + em dash ` — ` + tiếng Việt)
- Examples:
  - `Refactor Phase 42.16 — Frontend feature auth refactor sang feature-based (Sprint 12)`
  - `Bugfix Phase 12 — stale closure trong ChatWidgetPortal`

## Env vars
- `UPPER_SNAKE_CASE` (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`)
- Required vars validate lúc startup (Rule 22)
- Optional vars có fallback: `process.env.X || 'default'`
