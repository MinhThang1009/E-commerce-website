# TechStore E-Commerce — Claude Code Context

> Entry point dành cho AI agents. Đọc từ đây → theo links → xuống module cụ thể. Xem [STRUCTURE.md](STRUCTURE.md) cho kiến trúc tổng thể.

## Mục lục

- [1. Cách đọc codebase](#1-cách-đọc-codebase)
  - [1.1 Xác định scope task](#11-xác-định-scope-task)
  - [1.2 Thứ tự đọc file chuẩn](#12-thứ-tự-đọc-file-chuẩn)
  - [1.3 Trace request end-to-end](#13-trace-request-end-to-end)
  - [1.4 Bỏ qua hoàn toàn](#14-bỏ-qua-hoàn-toàn)
- [2. Agent Scope Rules](#2-agent-scope-rules)
- [3. Commands](#3-commands)
  - [3.1 Backend](#31-backend)
  - [3.2 Frontend](#32-frontend)
- [4. Architecture](#4-architecture)
  - [4.1 Backend — Modular Monolith](#41-backend--modular-monolith)
  - [4.2 Frontend — Feature-Based](#42-frontend--feature-based)
- [5. Module Aliases](#5-module-aliases)
  - [5.1 Backend](#51-backend)
  - [5.2 Frontend](#52-frontend)
- [6. Cross-module Dependencies](#6-cross-module-dependencies)
- [7. Key Gotchas](#7-key-gotchas)
- [8. Test Baseline](#8-test-baseline)
- [9. CLAUDE.md Map](#9-claudemd-map)

---

# 1. Cách đọc codebase

## 1.1 Xác định scope task

| Task liên quan đến | Đọc gì đầu tiên |
|---|---|
| Đơn hàng, checkout, trạng thái | [`backend/src/modules/orders/CLAUDE.md`](backend/src/modules/orders/CLAUDE.md) |
| Sản phẩm, danh mục, biến thể, thương hiệu | [`backend/src/modules/catalog/CLAUDE.md`](backend/src/modules/catalog/CLAUDE.md) |
| Tài khoản, đăng nhập, JWT, OAuth | [`backend/src/modules/auth/CLAUDE.md`](backend/src/modules/auth/CLAUDE.md) |
| AI chatbot, vector search, embedding | [`backend/src/modules/ai/CLAUDE.md`](backend/src/modules/ai/CLAUDE.md) → [`backend/src/services/CLAUDE.md`](backend/src/services/CLAUDE.md) |
| Giỏ hàng | [`backend/src/modules/cart/CLAUDE.md`](backend/src/modules/cart/CLAUDE.md) |
| Thanh toán MoMo/VNPay | [`backend/src/modules/payment/CLAUDE.md`](backend/src/modules/payment/CLAUDE.md) |
| Ảnh sản phẩm / upload file | [`backend/src/modules/image/CLAUDE.md`](backend/src/modules/image/CLAUDE.md) → [`backend/src/modules/upload/CLAUDE.md`](backend/src/modules/upload/CLAUDE.md) |
| Admin dashboard, CRUD, analytics | [`backend/src/modules/admin/CLAUDE.md`](backend/src/modules/admin/CLAUDE.md) |
| Middleware (auth/rate-limit) | [`backend/src/middlewares/CLAUDE.md`](backend/src/middlewares/CLAUDE.md) |
| DB schema / models / associations | [`backend/src/models/CLAUDE.md`](backend/src/models/CLAUDE.md) |
| Error handling, EventBus, UnitOfWork | [`backend/src/shared/CLAUDE.md`](backend/src/shared/CLAUDE.md) |
| Cron jobs / cleanup | [`backend/src/jobs/CLAUDE.md`](backend/src/jobs/CLAUDE.md) |
| Đánh giá sản phẩm | [`backend/src/modules/reviews/CLAUDE.md`](backend/src/modules/reviews/CLAUDE.md) |
| Tồn kho, inventory log | [`backend/src/modules/inventory/CLAUDE.md`](backend/src/modules/inventory/CLAUDE.md) |
| Mã giảm giá | [`backend/src/modules/discount-code/CLAUDE.md`](backend/src/modules/discount-code/CLAUDE.md) |
| Thuộc tính sản phẩm (màu, size...) | [`backend/src/modules/attribute/CLAUDE.md`](backend/src/modules/attribute/CLAUDE.md) |
| Lịch sử tìm kiếm | [`backend/src/modules/search-history/CLAUDE.md`](backend/src/modules/search-history/CLAUDE.md) |
| Profile người dùng, địa chỉ | [`backend/src/modules/users/CLAUDE.md`](backend/src/modules/users/CLAUDE.md) |
| Feedback/contact | [`backend/src/modules/content/CLAUDE.md`](backend/src/modules/content/CLAUDE.md) |
| Danh sách yêu thích | [`backend/src/modules/wishlist/CLAUDE.md`](backend/src/modules/wishlist/CLAUDE.md) |
| FE components (Button, Modal, Layout…) | [`frontend/src/components/CLAUDE.md`](frontend/src/components/CLAUDE.md) |
| FE state management (Zustand stores) | [`frontend/src/stores/CLAUDE.md`](frontend/src/stores/CLAUDE.md) |
| FE routing / navigation | [`frontend/src/routes/CLAUDE.md`](frontend/src/routes/CLAUDE.md) |
| FE API calls / TanStack Query | [`frontend/src/lib/CLAUDE.md`](frontend/src/lib/CLAUDE.md) |
| FE utilities | [`frontend/src/utils/CLAUDE.md`](frontend/src/utils/CLAUDE.md) |

## 1.2 Thứ tự đọc file chuẩn

> ⚠️ **CLAUDE.md là context và gotchas — không thay thế source code.**
> Phải đọc đủ các bước 2–5 bên dưới để hiểu logic thực tế.

**Backend module:**
```
1. src/modules/<name>/CLAUDE.md                              ← Tổng quan + gotchas
2. src/modules/<name>/module.js                              ← DI wiring, xem hết dependencies
3. src/modules/<name>/routes.js                              ← HTTP endpoints
4. src/modules/<name>/services/<name>-service.js             ← Core logic
5. src/modules/<name>/repositories/sequelize-<name>-repository.js  ← DB queries
```

**Frontend feature:**
```
1. src/features/<name>/CLAUDE.md       ← Tổng quan + gotchas
2. src/features/<name>/api/            ← TanStack Query hooks + API calls
3. src/features/<name>/types/          ← TypeScript interfaces
4. src/features/<name>/pages/          ← Page-level components
5. src/features/<name>/components/     ← UI components
```

## 1.3 Trace request end-to-end

```
backend/src/app.js          → xem module mount tại route nào
→ modules/<name>/routes.js  → xem middleware chain: authenticate → validate → controller
→ controllers/              → xem service call
→ services/                 → core business logic
→ repositories/             → Sequelize queries
```

## 1.4 Bỏ qua hoàn toàn

```
node_modules/       coverage/          dist/            build/
.git/objects/       logs/              uploads/
package-lock.json   *.lock
```

Dùng `Glob` tool — deny rules tự chặn node_modules, không cần filter thủ công.

---

# 2. Agent Scope Rules

**Khi sửa file interface** (module.js, service, controller, routes), **bắt buộc check**:
1. `src/modules/<name>/CLAUDE.md` có cần update không?
2. Cross-module relationships (phần "Depends on / Bị dùng bởi") có còn đúng không?
3. `STRUCTURE.md` → "Cross-module Dependencies" có cần cập nhật không?

---

# 3. Commands

## 3.1 Backend

```bash
# cd backend
npm run dev                 # Start dev server (port 8888, node --watch)
npm run test                # Run unit tests + coverage (~10s)
npm run test:fast           # Run unit tests không coverage
npm run test:integration    # Integration tests (cần MySQL thật, ~50s)
npm run test:api            # API HTTP tests (cần MySQL thật, ~190s)
npm run test:e2e            # E2E tests (cần MySQL thật, ~20s)
npm run lint                # ESLint
npm run lint:strict         # ESLint --max-warnings 0 (dùng trong CI)
npm run db:migrate          # Run pending Sequelize migrations
npm run db:seed             # Rebuild DB với seed data
npm run ai:rebuild-vectors  # Re-index products for AI search
npm run docs:openapi        # Export Swagger JSON → docs/openapi.json
npm run i18n:translate      # Translate i18n content (dry-run: npm run i18n:dry-run)
npm run db:cleanup          # Cleanup DB orphan records (dev)
npm run kill                # Kill process trên port 8888 (Windows)
```

## 3.2 Frontend

```bash
# cd frontend
npm run dev                 # Vite dev server (port 5175)
npm run build               # Production build
npm run typecheck           # tsc --noEmit
npm run lint                # ESLint --max-warnings 0
npm run format              # Prettier --write
npm test                    # Jest component tests (jest.config.cjs)
npm run test:ci             # CI mode + coverage
```

---

# 4. Architecture

## 4.1 Backend — Modular Monolith

- **Framework:** Node.js 20 + Express 4 + Sequelize 6 + MySQL 8
- **Pattern:** Mỗi module = 1 vertical slice tự trị. Bên trong: Controller → Service → Repository
- **17 modules:** `admin`, `ai`, `attribute`, `auth`, `cart`, `catalog`, `content`, `discount-code`, `image`, `inventory`, `orders`, `payment`, `reviews`, `search-history`, `upload`, `users`, `wishlist`
- **Entry:** `src/server.js` → `src/app.js` (DI wiring — nơi duy nhất khởi tạo modules)
- **Pattern variants:**
  - Full DI (12 modules): `auth`, `users`, `cart`, `wishlist`, `reviews`, `content`, `upload`, `catalog`, `orders`, `payment`, `inventory`, `ai`
  - Singleton / Thin wrapper (5 modules): `discount-code`, `search-history`, `image`, `admin`, `attribute`

## 4.2 Frontend — Feature-Based

- **Framework:** React 19 + TypeScript + Vite 8
- **Pattern:** Mỗi feature = 1 unit cô lập. Không có cross-feature imports.
- **Feature code** (`src/features/<name>/`): `api/`, `components/`, `hooks/`, `pages/`, `types/`
- **Shared:** `src/components/`, `src/stores/`, `src/hooks/`, `src/utils/`, `src/lib/`, `src/types/`
- **State (server):** TanStack Query v5; **State (client):** Zustand v5 + Immer
- **13 features:** `admin`, `ai`, `auth`, `cart`, `catalog`, `checkout`, `content`, `orders`, `payment`, `reviews`, `upload`, `users`, `wishlist`

---

# 5. Module Aliases

## 5.1 Backend

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

## 5.2 Frontend

```
@            → src/
@features    → src/features
@components  → src/components
@stores      → src/stores
@lib         → src/lib
@hooks       → src/hooks
@pages       → src/pages
@routes      → src/routes
@schemas     → src/schemas
@utils       → src/utils
@types       → src/types
@constants   → src/constants
@config      → src/config
@assets      → src/assets
@styles      → src/styles
# vite.config còn @contexts, @services nhưng dir chưa tồn tại (alias chết)
```

---

# 6. Cross-module Dependencies

```
orders    → cart (xóa sau đặt), users (shippingAddress), payment (check status),
            inventory (eventBus: order.cancelled), discount-code (apply),
            emailService

cart      → catalog (Product/Variant info)

catalog   → attribute (filters), inventory (stock display), image (thumbnails)

auth      → users (User model); ← used by all modules (authenticate middleware)

admin     → orders, users, catalog, reviews, content, discount-code, inventory

ai        → catalog (vector search via vectorStoreService), attribute (name generator inject)
          ← Product model hooks (auto-upsert afterCreate/Update/Destroy)

payment   → orders (update paymentStatus inline trong service, không qua eventBus)

inventory ← orders (subscribe: order.cancelled → ghi inventory log; order.created không có subscriber)
```

---

# 7. Key Gotchas

- **Sort backend:** `COALESCE(MIN(variant.price), base_price)` — không sort theo `basePrice` trực tiếp. Không revert.
- **`scripts/index-products.js`:** cần `require('module-alias/register')` ở đầu — không xóa.
- **DB migrations:** dùng `npm run db:migrate` để đổi schema. `sequelize.sync({alter,foreignKeys:false})` chỉ bật qua `DB_SYNC=true` dev-only (server.js:82), KHÔNG dùng thay migrations (`foreignKeys:false` né lỗi "Too many keys").
- **i18n bắt buộc:** tất cả user-visible strings qua `t('key')` (BE) / `useTranslation()` (FE). Key phải có trong cả `vi.json` và `en.json`.
- **Test naming:** Vietnamese descriptions là policy (hội đồng bảo vệ đọc).
- **Commit format:** `<type>(<scope>): <Vietnamese subject>` — xem `git-workflow.md`.
- **Pre-commit hook** (`scripts/audit-architecture.sh`) block: service import Sequelize trực tiếp, controller touch ORM, cross-module deep import. Fix violation, không bypass `--no-verify`.
- **New backend module:** `node scripts/new-module.mjs --name=<name> --type=simple|ddd-lite` — không copy thủ công.
- **Rate limiters:** `chatbotLimiter` = 20 req/60s (không có dev override).
- **Vector Store:** auto-rebuild khi vector count lệch >5% so với active products (server.js:125). Log "Vector store lệch >5% so với DB ... Tự động rebuild..." là bình thường.
- **Cron Jobs:** daily 2AM + weekly Sunday 3AM — không disable trừ khi có lý do rõ ràng.
- **Models đã drop hoàn toàn:** `Collection`, `EmailCampaign`, `NewsletterSubscriber`, `ImportLog`, `Banner`, `News`, `LoyaltyHistory`, `WarrantyPackage`, `ProductWarranty`, `ReviewFeedback`, `AuditLog`, `BrandCategory` — không reference lại.
- **Stock decrement:** LUÔN trong transaction với SELECT FOR UPDATE — không decrement bên ngoài unitOfWork.
- **Discount usedCount:** Manual payments (cod/bank_transfer/installment) → tăng ngay trong `createOrder` transaction. Online payments (momo/vnpay) → tăng trong `payment-service.js` sau IPN/return success. Không tăng tại bước validate/apply.
- **Image model:** file `models/image.js` tồn tại nhưng đã xóa khỏi `index.js` associations — `image` module require trực tiếp, không qua DI.
- **Content module:** chỉ còn 1 endpoint (`POST /api/contact/feedback`) — feedback/contact only.
- **Catalog module:** có 3 mount points (`/api/products`, `/api/categories`, `/api/brands`).
- **AI module basePath:** `/api/chatbot` (không phải `/api/ai`).
- **Wishlist module basePath:** `/api/wishlists` (plural).
- **Search history basePath:** `/api/search-histories`.
- **Role ENUM:** `users.role` = `('customer','staff','admin')` — `'manager'` đã xóa (migration `2026052204`), `'staff'` thêm sau (migration `2026060201`). Không hardcode `'manager'`.
- **RBAC 4-actor** (guest/customer/staff/admin): back-office (`adminAuthenticate`) cho admin+staff vào panel; **staff** = CRUD nghiệp vụ (products/orders-status/inventory-restock/discount/reviews/catalog-write/payment-refund/attribute); **admin** = xem-only back-office + độc quyền users + `analytics/user-growth`. Guard per-route: `requireRole`/`requireSuperAdmin` (BE) + `AdminRoute allowedRoles` + `useAuth().isStaff()` ẩn nút write (FE). Chi tiết: [`backend/src/middlewares/CLAUDE.md §4`](backend/src/middlewares/CLAUDE.md).
- **Vẽ/cập nhật sơ đồ từ code:** dùng plugin **`verify-then-draw`** (skill tự kích hoạt khi "vẽ sơ đồ", hoặc `/verify-then-draw:draw <module>`) — quy trình 3 tầng gate (code đúng nghiệp vụ → sơ đồ khớp code → ký pháp+đẹp), KHÔNG tin code mù rồi vẽ. Project instance ở [`verify-workflow/`](verify-workflow/) (`PROJECT.yaml` + `invariants.ecommerce.md` GATE-A + `diagram-manifest.yaml` + scripts `wf:gate`/`wf:routes`). Sơ đồ output ở [`diagrams/`](diagrams/) (nested theo loại). Chi tiết: [`verify-workflow/FRAMEWORK.md`](verify-workflow/FRAMEWORK.md).

---

# 8. Test Baseline

| Suite | Suites | Tests | Runtime | Config |
|---|---|---|---|---|
| BE Unit Tests | 215 | 5.377 | ~12s | `jest.config.js` |
| BE Integration Tests | 38 | 210 | ~57s | `jest.integration.config.js` |
| BE API HTTP Tests | 39 | 675 | ~160s | `jest.api.config.js` |
| BE E2E Tests | 5 | 100 | ~22s | `jest.e2e.config.js` |
| FE Component Tests | 28 | 937 | ~14s | `jest.config.cjs` (frontend/) |
| **Tổng** | **325** | **~7.285** | | |

> Đo lại 2026-06-06 (§A FE coverage: xóa 25 false-positive istanbul-ignore, thêm 22 test cases; §B payment audit: thêm 2 test cases; §C orders audit: thêm 2 test cases; §D admin logic audit: thêm 8 test cases). Cập nhật 2026-06-06 §E orders logic audit: thêm 1 test case (cancelPendingOrdersByUser lock assertion).

- **BE Coverage thresholds (local `jest.config.js`):** statements 99.7%, branches 99.7%, functions 99.4%, lines 99.7%
- **BE Coverage (CI):** statements ≥97%, lines ≥97%, branches ≥85%, functions ≥95%
- **FE Coverage:** global 79%+, per-file 100% cho auth pages + schemas/auth.ts (thresholds trong `jest.config.cjs`)
- **Test-quality (2 tầng bổ sung):** mutation (Stryker, gate=70) + property-based (fast-check, oracle = 25 invariant GATE-A). Bảng score per-module + quy trình: [`QUALITY_CHECKS.md`](QUALITY_CHECKS.md), [`TESTING_STRATEGY.md §13`](TESTING_STRATEGY.md).
- **CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — chạy BE Unit Tests + **FE lint/typecheck/test/build** (Integration/API/E2E không chạy trong CI vì không có MySQL service)
- **Full details:** [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md)

---

# 9. CLAUDE.md Map

```
CLAUDE.md                                    ← File này: navigation entry point
STRUCTURE.md                                 ← Architecture, tech stack, data flow, schema
DIAGRAMS.md                                  ← Mermaid diagrams (Use Case, Sequence, ERD, Flow)
RAG_CHATBOT_PIPELINE.md                      ← RAG pipeline 7 bước + 53 edge case (chatbot)
PIPELINE_TRACE_EXAMPLES.md                   ← Trace 22 path + Node Reference 43 node (chatbot)
TESTING_STRATEGY.md                          ← Chiến lược test 5 tầng (~7.251 tests) + mutation/property (§13)
README.md                                    ← Project README, setup instructions

backend/CLAUDE.md                            ← BE architecture, DI pattern, request trace
backend/src/
  config/CLAUDE.md                           ← sequelize, swagger
  constants/CLAUDE.md                        ← Hằng số toàn cục (shipping, OTP, JWT)
  locales/CLAUDE.md                          ← i18n vi.json / en.json, conventions
  models/CLAUDE.md                           ← 25 models, associations, conventions
  migrations/CLAUDE.md                       ← 62 migrations, phases, patterns
  middlewares/CLAUDE.md                      ← authenticate, authorize, rate-limiter
  shared/CLAUDE.md                           ← EventBus, AppError/errors, unit-of-work
  services/CLAUDE.md                         ← email, vector-store, embedding (shared, non-DI)
  utils/CLAUDE.md                            ← logger, i18n, catch-async, image-url, localize
  jobs/CLAUDE.md                             ← cleanup cron (daily 2AM, weekly 3AM)
  routes/CLAUDE.md                           ← Legacy /health route
  modules/admin/CLAUDE.md                    ← Admin module: dashboard, CRUD, analytics
  modules/ai/CLAUDE.md                       ← AI chatbot, RAG pipeline, vector search
  modules/ai/services/chatbot/CLAUDE.md       ← Chatbot sub-services (RAG, prompt, keyword, language)
  modules/ai/services/core/CLAUDE.md          ← AIService (orchestration) + AIPolicy (pure rules)
  modules/ai/services/embedding/CLAUDE.md     ← (embedding.js, vi-embedding.js đã xóa — chỉ còn CLAUDE.md)
  modules/ai/services/product/CLAUDE.md       ← ProductNameGenerator (singleton); enrichProductData → @utils/product-helpers
  modules/ai/services/translate/CLAUDE.md     ← translateBatch Vi→En (OpenRouter + MyMemory fallback)
  shared/errors/CLAUDE.md                     ← Error class hierarchy chi tiết
  shared/persistence/CLAUDE.md                ← UnitOfWork pattern chi tiết
  services/embedding/CLAUDE.md                ← Embedding service (provider chain)
  services/vector-store/CLAUDE.md             ← HybridVectorStore implementation
  modules/attribute/CLAUDE.md                ← Thuộc tính sản phẩm (màu, size, loại...)
  modules/auth/CLAUDE.md                     ← Auth: JWT, OAuth Google, OTP, password reset
  modules/cart/CLAUDE.md                     ← Giỏ hàng: guest/auth merge, variant pricing
  modules/catalog/CLAUDE.md                  ← Sản phẩm, danh mục, thương hiệu
  modules/content/CLAUDE.md                  ← Feedback/contact
  modules/discount-code/CLAUDE.md            ← Mã giảm giá
  modules/image/CLAUDE.md                    ← Image proxy, CDN bypass
  modules/inventory/CLAUDE.md               ← Tồn kho
  modules/orders/CLAUDE.md                   ← Đơn hàng, checkout, trạng thái
  modules/payment/CLAUDE.md                  ← Thanh toán MoMo/VNPay
  modules/reviews/CLAUDE.md                  ← Đánh giá sản phẩm
  modules/search-history/CLAUDE.md           ← Lịch sử tìm kiếm
  modules/upload/CLAUDE.md                   ← Upload file (multer, magic bytes)
  modules/users/CLAUDE.md                    ← Profile người dùng, địa chỉ
  modules/wishlist/CLAUDE.md                 ← Danh sách yêu thích
  __tests__/CLAUDE.md                        ← Unit cross-cutting tests
  __integration__/CLAUDE.md                  ← Integration tests (MySQL real)
  __api__/CLAUDE.md                          ← API HTTP tests (Supertest, MySQL real)
  __e2e__/CLAUDE.md                          ← End-to-end user flow tests

backend/scripts/CLAUDE.md                    ← Maintenance scripts, seeders
backend/data/CLAUDE.md                       ← SQL dumps, seed, vector-db snapshot
backend/docs/CLAUDE.md                       ← OpenAPI spec (auto-generated)

.github/workflows/CLAUDE.md                  ← CI pipeline: jobs, coverage thresholds, artifacts
scripts/CLAUDE.md                            ← Root scripts: audit, i18n check, module scaffolder

frontend/CLAUDE.md                           ← FE architecture, patterns, conventions
frontend/src/
  config/CLAUDE.md                           ← i18n initialization
  locales/CLAUDE.md                          ← i18n vi.json / en.json (frontend translations)
  lib/CLAUDE.md                              ← api-client, query-client
  stores/CLAUDE.md                           ← 6 Zustand stores
  routes/CLAUDE.md                           ← paths.ts, AppRoutes.tsx, lazy loading
  components/CLAUDE.md                       ← shared components (common/, layout/, routing/, sections/, icons/)
  hooks/CLAUDE.md                            ← 5 hook files (5 exported hooks)
  pages/CLAUDE.md                            ← 8 static pages
  utils/CLAUDE.md                            ← 13 utility files
  types/CLAUDE.md                            ← Type barrel, shared types
  styles/CLAUDE.md                           ← SCSS tokens, global CSS, Tailwind guidance
  constants/CLAUDE.md                        ← PAGINATION, UPLOAD, SHIPPING
  __tests__/CLAUDE.md                        ← Component tests (Jest + RTL)
  features/admin/CLAUDE.md                   ← Admin dashboard, CRUD pages
  features/ai/CLAUDE.md                      ← AI chatbot widget
  features/auth/CLAUDE.md                    ← Login, register, forgot password
  features/cart/CLAUDE.md                    ← Giỏ hàng
  features/catalog/CLAUDE.md                 ← Shop, product detail, categories, brands
  features/checkout/CLAUDE.md                ← Checkout flow
  features/content/CLAUDE.md                 ← Form liên hệ/feedback
  features/orders/CLAUDE.md                  ← Orders list, order detail
  features/payment/CLAUDE.md                 ← Payment QR page
  features/reviews/CLAUDE.md                 ← Product reviews
  features/upload/CLAUDE.md                  ← File upload
  features/users/CLAUDE.md                   ← Profile, address management
  features/wishlist/CLAUDE.md                ← Danh sách yêu thích
```
