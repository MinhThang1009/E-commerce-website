# Backend — TechStore E-Commerce

← Quay lại [`CLAUDE.md`](../CLAUDE.md)

> Kiến trúc Modular Monolith (Vertical Slice + Layered). Entry point: `src/server.js` → `src/app.js`.

## Mục lục

- [1. Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
- [2. DI Pattern](#2-di-pattern)
  - [2.1 Module factory](#21-module-factory)
  - [2.2 Wiring trong app.js](#22-wiring-trong-appjs)
  - [2.3 Singleton modules](#23-singleton-modules)
- [3. Request trace end-to-end](#3-request-trace-end-to-end)
  - [3.1 POST /api/orders](#31-post-apiorders)
- [4. Module mount pattern](#4-module-mount-pattern)
- [5. Shared infrastructure](#5-shared-infrastructure)
- [6. Modules](#6-modules)
- [7. Test structure](#7-test-structure)
- [8. Commands](#8-commands)
- [9. Architecture constraints](#9-architecture-constraints)
- [10. CLAUDE.md con](#10-claudemd-con)

---

## 1. Kiến trúc tổng quan

```
Request → Express → Middleware stack → Module Router
                                         └→ Controller (HTTP handler)
                                              └→ Service (Business logic)
                                                   └→ Repository (Data access)
                                                        └→ Sequelize → MySQL
```

**17 modules**, mỗi module = 1 vertical slice tự trị:
- Không import lẫn nhau trực tiếp
- Giao tiếp qua **EventBus** (async) hoặc **DI injection** (sync, qua `app.js`)
- `src/app.js` là nơi duy nhất khởi tạo và wiring dependencies

**Shared infrastructure** (dùng chung, không thuộc module nào):
- `src/models/` — 25 Sequelize models (image.js tồn tại nhưng không export — Image model đã gỡ khỏi index.js)
- `src/middlewares/` — authenticate, authorize, rate-limiter, detect-locale
- `src/services/` — email, vector-store, embedding
- `src/shared/` — EventBus, AppError, UnitOfWork
- `src/utils/` — logger, i18n, catch-async, image-url, localize
- `src/constants/` — SHIPPING_*, OTP_*, JWT_*

---

## 2. DI Pattern

Tất cả dependencies inject qua constructor — **KHÔNG** `require()` service từ service khác trực tiếp.

### 2.1 Module factory

Mỗi module export 1 factory function nhận dependencies object, trả về `{ basePath, router, subscribeEvents }`:

```js
// src/modules/orders/module.js
module.exports = ({ Order, OrderItem, Cart, CartItem, Product, ProductVariant,
                    User, DiscountCode, InventoryLog,
                    sequelize, eventBus, logger, emailService, constants }) => {
  const ordersRepository = new SequelizeOrdersRepository({ Order, OrderItem, ... });
  const emailGateway     = { sendOrderConfirmationEmail: (...args) => emailService.sendOrderConfirmationEmail(...args) };
  const ordersService    = new OrdersService({ ordersRepository, emailGateway, eventBus, logger, constants });
  const ordersController = new OrdersController({ ordersService });
  const router           = buildRoutes({ ordersController });
  return { basePath: '/orders', router, subscribeEvents() {} };
};
```

### 2.2 Wiring trong app.js

`src/app.js` khởi tạo shared resources, gọi từng module factory, mount router:

```js
// Shared resources
const eventBus     = require('@shared/event-bus');
const sequelize    = require('@config/sequelize');
const { Order, ... } = require('@models');
const emailService = require('@services/email');

// Gọi factory — inject dependencies
const ordersModule = buildOrdersModule({ Order, OrderItem, Cart, CartItem, Product,
  ProductVariant, User, DiscountCode, InventoryLog,
  sequelize, eventBus, logger, emailService, constants });
ordersModule.subscribeEvents();

// Mount router
app.use('/api' + ordersModule.basePath, ordersModule.router);  // → /api/orders
```

### 2.3 Singleton modules

5 modules không dùng DI đầy đủ — thin wrapper quanh routes trực tiếp:

| Module | Pattern |
|---|---|
| `discount-code` | `module.exports = () => ({ basePath: '/discount-codes', router: require('./routes'), ... })` |
| `search-history` | Thin wrapper, basePath `/search-histories` |
| `image` | Thin wrapper, basePath `/images` |
| `admin` | Thin wrapper, basePath `/admin` |
| `attribute` | Thin wrapper + inject AI name generator via `attributeService.setNameGenerator(nameGenerator)` |

---

## 3. Request trace end-to-end

### 3.1 POST /api/orders

```
HTTP POST /api/orders
  └→ src/app.js               (mount /api/orders → ordersRouter)
      └→ modules/orders/routes.js
             authenticate → validateRequest(createOrderSchema) → ordersController.createOrder
          └→ OrdersController.createOrder(req, res)
              └→ OrdersService.createOrder({ userId, items, discountCode, ... })
                  ├→ this.repo.runInTransaction(async (tx) => {   ← repo tự wrap sequelize.transaction (KHÔNG qua shared unitOfWork)
                  │    SELECT FOR UPDATE ProductVariant rows
                  │    decrement stock
                  │    create Order + OrderItems
                  │    apply DiscountCode (nếu có)
                  │  })
                  ├→ emailGateway.sendOrderConfirmationEmail()  ← async, non-blocking
                  └→ eventBus.publish({ type: 'order.created', payload: { orderId, orderNumber, userId, total, items }, occurredAt: new Date().toISOString() })
                            └→ (hiện chưa có subscriber — inventory chỉ subscribe order.cancelled)
```

---

## 4. Module mount pattern

Hầu hết modules trả về `{ basePath, router }` — mount trực tiếp:

```js
app.use('/api' + authModule.basePath, authModule.router);   // → /api/auth
app.use('/api' + cartModule.basePath, cartModule.router);   // → /api/cart
```

**Chỉ 1 module** trả về `mounts` array (nhiều router trên nhiều paths):

```js
// catalog → /api/products, /api/categories, /api/brands
catalogModule.mounts.forEach(({ basePath, router }) => {
  app.use('/api' + basePath, router);
});
```

`content` module trả về single `{ basePath, router }` như các module khác:

```js
app.use('/api' + contentModule.basePath, contentModule.router);  // → /api/contact
```

---

## 5. Shared infrastructure

| Path | Dùng khi |
|---|---|
| `src/shared/errors/` | Throw HTTP errors: `new NotFoundError('User', id)`, `new BusinessError(...)` |
| `src/shared/event-bus.js` | Publish/subscribe events giữa modules |
| `src/shared/persistence/unit-of-work.js` | `runInTransaction()` + `lockRow()` (SELECT FOR UPDATE) |
| `src/utils/i18n.js` | `t('key', locale)` — bắt buộc cho user-facing strings |
| `src/utils/logger.js` | Winston logger — không dùng `console.log` |
| `src/services/email.js` | Gửi email (order confirmation, OTP, reset password) |
| `src/middlewares/authenticate.js` | `authenticate`, `optionalAuthenticate` |
| `src/middlewares/admin-auth.js` | `adminAuthenticate` — riêng cho admin endpoints |
| `src/middlewares/detect-locale.js` | Parse locale từ `Accept-Language` header hoặc `?lang=` |

**EventBus events hiện có (3):**
- `order.created` — publish bởi orders (hiện chưa có subscriber chức năng)
- `order.cancelled` — publish bởi orders, subscribe bởi inventory (ghi inventory log; actual stock restore xảy ra inline trong orders service)
- `auth.userRegistered` — publish bởi auth (chưa có subscriber)

---

## 6. Modules

| Module | Route prefix | DI Pattern | CLAUDE.md |
|---|---|---|---|
| admin | `/api/admin` | Thin wrapper | [CLAUDE.md](src/modules/admin/CLAUDE.md) |
| ai | `/api/chatbot` | Full DI | [CLAUDE.md](src/modules/ai/CLAUDE.md) |
| attribute | `/api/attributes` | Thin wrapper + AI inject | [CLAUDE.md](src/modules/attribute/CLAUDE.md) |
| auth | `/api/auth` | Full DI | [CLAUDE.md](src/modules/auth/CLAUDE.md) |
| cart | `/api/cart` | Full DI | [CLAUDE.md](src/modules/cart/CLAUDE.md) |
| catalog | `/api/products`, `/api/categories`, `/api/brands` | Full DI (mounts array) | [CLAUDE.md](src/modules/catalog/CLAUDE.md) |
| content | `/api/contact` | Full DI | [CLAUDE.md](src/modules/content/CLAUDE.md) |
| discount-code | `/api/discount-codes` | Thin wrapper | [CLAUDE.md](src/modules/discount-code/CLAUDE.md) |
| image | `/api/images` | Thin wrapper | [CLAUDE.md](src/modules/image/CLAUDE.md) |
| inventory | `/api/inventory` | Full DI | [CLAUDE.md](src/modules/inventory/CLAUDE.md) |
| orders | `/api/orders` | Full DI | [CLAUDE.md](src/modules/orders/CLAUDE.md) |
| payment | `/api/payments` | Full DI | [CLAUDE.md](src/modules/payment/CLAUDE.md) |
| reviews | `/api/reviews` | Full DI | [CLAUDE.md](src/modules/reviews/CLAUDE.md) |
| search-history | `/api/search-histories` | Thin wrapper | [CLAUDE.md](src/modules/search-history/CLAUDE.md) |
| upload | `/api/uploads` | Full DI (multer config in module) | [CLAUDE.md](src/modules/upload/CLAUDE.md) |
| users | `/api/users` | Full DI | [CLAUDE.md](src/modules/users/CLAUDE.md) |
| wishlist | `/api/wishlists` | Full DI | [CLAUDE.md](src/modules/wishlist/CLAUDE.md) |

**Special endpoints (không phải module):**
- `GET /api/health` — `src/routes/index.js`, trả về DB status
- `GET /api-docs` — Swagger UI
- `GET /api/img/*` — Image proxy (`src/modules/image/middlewares/image-proxy-router`)
- `GET /uploads/*` — Static file serving (local uploads)

---

## 7. Test structure

5 loại test trong backend:

| Loại | Location | Config | DB | Runtime |
|---|---|---|---|---|
| Unit | `src/modules/**/*.test.js`, `src/__tests__/*.test.js`, co-located | `jest.config.js` | Mock | ~10s |
| Integration | `src/__integration__/*.integration.test.js` | `jest.integration.config.js` | MySQL thật | ~50s |
| API HTTP | `src/__api__/*.http.test.js` | `jest.api.config.js` | MySQL thật | ~190s |
| E2E | `src/__e2e__/*.e2e.test.js` | `jest.e2e.config.js` | MySQL thật | ~20s |

Unit tests chạy song song; integration/api/e2e tests `maxWorkers=1`.

**Ports:** Unit=9999, Integration=9998, API=9997, E2E=9996

**Coverage thresholds (local jest.config.js):** statements 99.7%, branches 99.7%, functions 99.4%, lines 99.7%

**Coverage thresholds (CI):** statements ≥97%, lines ≥97%, branches ≥85%, functions ≥95%

---

## 8. Commands

```bash
# Từ thư mục backend/
npm run dev                  # Dev server (port 8888, node --watch)
npm run test                 # Unit tests + coverage (~10s)
npm run test:fast            # Unit tests không coverage
npm run test:file <pattern>  # Test 1 file theo pattern
npm run test:integration     # Integration tests (cần MySQL)
npm run test:api             # API HTTP tests (cần MySQL)
npm run test:e2e             # E2E tests (cần MySQL)
npm run lint                 # ESLint
npm run lint:strict          # ESLint --max-warnings 0 (CI)
npm run db:migrate           # Chạy pending Sequelize migrations
npm run db:seed              # Rebuild DB với seed data
npm run db:fresh             # Fresh DB (không seed)
npm run db:verify            # Verify DB schema
npm run ai:rebuild-vectors   # Re-index products cho AI search
npm run docs:openapi         # Export Swagger JSON
npm run i18n:translate       # Translate i18n keys
npm run db:cleanup-test-data # Cleanup test data (__INT_TEST_, __HTTP_, __E2E_ prefixes)
npm run kill                 # Kill port 8888 process (Windows)
```

---

## 9. Architecture constraints

Pre-commit hook (`scripts/audit-architecture.sh`) tự động block:

| Pattern bị cấm | Lý do |
|---|---|
| Service `require('@models')` hoặc `Model.findAll()` trực tiếp | Service không được biết về ORM layer — nhận models qua DI |
| Controller access ORM (`Model.findAll()` v.v.) | Controller chỉ gọi service, không query DB trực tiếp |
| Cross-module deep import (`@modules/A/services/...` từ module B) | Vi phạm encapsulation — inject qua `app.js` |
| Frontend deep import bypass barrel (warn only) | Nên import từ `@/features/{name}` thay vì internal path |

**Không bao giờ bypass:** `git commit --no-verify` — fix violation, đừng skip hook.

---

## 10. CLAUDE.md con

```
backend/CLAUDE.md                            ← File này
backend/src/
  config/CLAUDE.md                           ← sequelize, swagger config
  constants/CLAUDE.md                        ← Hằng số (shipping, OTP, JWT, cart)
  locales/CLAUDE.md                          ← i18n vi.json / en.json
  models/CLAUDE.md                           ← 25 models, associations
  migrations/CLAUDE.md                       ← 61 migrations, schema history
  middlewares/CLAUDE.md                      ← authenticate, authorize, rate-limiter
  shared/CLAUDE.md                           ← EventBus, AppError, UnitOfWork
    shared/errors/CLAUDE.md                  ← Error class hierarchy
    shared/persistence/CLAUDE.md             ← UnitOfWork pattern
  services/CLAUDE.md                         ← email, vector-store, embedding
    services/embedding/CLAUDE.md             ← Multi-provider embedding (Jina/HF)
    services/vector-store/CLAUDE.md          ← Hybrid search engine
  utils/CLAUDE.md                            ← logger, i18n, catch-async, image-url, localize
  jobs/CLAUDE.md                             ← cleanup cron (daily 2AM, weekly 3AM)
  routes/CLAUDE.md                           ← Legacy /health route
  modules/admin/CLAUDE.md                    ← Admin module
  modules/ai/CLAUDE.md                       ← AI chatbot, RAG pipeline
  modules/attribute/CLAUDE.md                ← Thuộc tính sản phẩm
  modules/auth/CLAUDE.md                     ← Auth: JWT, OAuth, OTP
  modules/cart/CLAUDE.md                     ← Giỏ hàng
  modules/catalog/CLAUDE.md                  ← Sản phẩm, danh mục, thương hiệu
  modules/content/CLAUDE.md                  ← Feedback/contact
  modules/discount-code/CLAUDE.md            ← Mã giảm giá
  modules/image/CLAUDE.md                    ← Image proxy
  modules/inventory/CLAUDE.md               ← Tồn kho
  modules/orders/CLAUDE.md                   ← Đơn hàng
  modules/payment/CLAUDE.md                  ← Thanh toán
  modules/reviews/CLAUDE.md                  ← Đánh giá
  modules/search-history/CLAUDE.md           ← Lịch sử tìm kiếm
  modules/upload/CLAUDE.md                   ← File upload
  modules/users/CLAUDE.md                    ← Profile người dùng
  modules/wishlist/CLAUDE.md                 ← Danh sách yêu thích
  __tests__/CLAUDE.md                        ← Unit cross-cutting tests
  __integration__/CLAUDE.md                  ← Integration test setup (MySQL real)
  __api__/CLAUDE.md                          ← API HTTP tests (Supertest, MySQL real)
  __e2e__/CLAUDE.md                          ← End-to-end user flows
backend/scripts/CLAUDE.md                    ← Maintenance scripts, seeders
backend/data/CLAUDE.md                       ← SQL dumps, seed, vector-db snapshot
backend/docs/CLAUDE.md                       ← OpenAPI spec (auto-generated)
```
