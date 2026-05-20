# TechStore E-Commerce — Claude Code Context

Full-stack e-commerce (thesis project). Monorepo: `backend/` + `frontend/`.

## Commands

### Backend (`cd backend`)
```bash
pnpm dev                    # Start dev server (port 8888, nodemon)
pnpm test                   # Run all tests (171 suites, ~15s)
pnpm test:fast              # Run tests without coverage
pnpm lint                   # ESLint --max-warnings 0
pnpm db:migrate             # Run pending Sequelize migrations
pnpm db:seed                # Rebuild DB with seed data (rebuildDb.js)
pnpm ai:rebuild-vectors     # Re-index products for AI search (scripts/index-products.js)
```

### Frontend (`cd frontend`)
```bash
pnpm dev                    # Vite dev server (port 5175)
pnpm build                  # Production build
pnpm typecheck              # tsc --noEmit
pnpm lint                   # ESLint --max-warnings 0
pnpm test                   # Jest (jest.config.cjs)
```

## Architecture

### Backend — Modular Monolith
- **Framework:** Node.js + Express + Sequelize 6 + MySQL 8
- **Pattern:** Controller → Service → Repository (DDD-lite for complex modules)
- **Modules (19):** `admin`, `ai`, `attribute`, `auth`, `cart`, `catalog`, `content`, `discount-code`, `image`, `inventory`, `loyalty`, `orders`, `payment`, `reviews`, `search-history`, `upload`, `users`, `warranty-package`, `wishlist`
- **Entry:** `src/server.js` → `src/app.js` (DI wiring)
- **Cache:** Redis optional; falls back to in-memory automatically

### Frontend — Feature-Sliced Design
- **Framework:** React 18 + TypeScript + Vite
- **State (server):** TanStack Query v5 — all API calls, caching, mutations
- **State (client):** Zustand v5 — `authStore`, `cartStore`, `uiStore`, `catalogStore`, `chatStore`, `wishlistStore` in `src/stores/`
- **API client:** `src/lib/api-client.ts` (Axios instance with auth interceptor)
- **Features (14):** `admin`, `ai`, `auth`, `cart`, `catalog`, `checkout`, `content`, `loyalty`, `orders`, `payment`, `reviews`, `upload`, `users`, `wishlist`
- **Each feature has:** `api/`, `components/`, `pages/`, `hooks/`, `types/`

## Module Aliases

### Backend (`_moduleAliases` in `package.json`)
```
@modules   → src/modules
@shared    → src/shared
@utils     → src/utils
@middlewares → src/middlewares
@models    → src/models
@config    → src/config
@services  → src/services
@jobs      → src/jobs
```

### Frontend (Vite `resolve.alias` in `vite.config.ts`)
```
@           → src/
@features   → src/features
@components → src/components
@stores     → src/stores
@lib        → src/lib
@hooks      → src/hooks
@pages      → src/pages
@routes     → src/routes
@utils      → src/utils
@types      → src/types
@constants  → src/constants
@config     → src/config
@styles     → src/styles
@assets     → src/assets
```

## Key Gotchas

- **Sort backend:** products sorted by `COALESCE(MIN(variant.price), base_price)` — not by `basePrice` alone. Do not revert.
- **`getAllProducts` cache** is temporarily disabled for sort debugging — do not re-enable without verifying sort behavior first.
- **`scripts/index-products.js`** requires `require('module-alias/register')` at the top — already fixed, do not remove.
- **DB migrations:** use `pnpm db:migrate`, never re-enable `sequelize.sync()` in `server.js` (breaks with "Too many keys").
- **i18n mandatory:** all user-visible strings through `t('key')`. Keys must exist in both `src/locales/vi.json` and `src/locales/en.json`.
- **Test naming:** Vietnamese descriptions are intentional project policy (thesis defense board reads them).
- **Commit format:** `<type>(<scope>): <Vietnamese subject>` — see `AGENT_RULES.md` Rule 4.1 for full spec.
- **Pre-commit hook** (`scripts/audit-architecture.sh`) blocks: service importing Sequelize models directly, controller touching ORM, cross-module deep imports. Fix the violation, do not bypass with `--no-verify`.
- **New backend module:** use generator `node scripts/new-module.mjs --name=<name> --type=simple|ddd-lite` — do not copy manually.
- **Current branch:** `refactor/feature-based-architecture`
- **Rate limiters:** `chatbotLimiter` = 20 req/60s (AI endpoint rất dễ bị hit khi test). `authLimiter` = 10 req/60min prod. Khi test AI, dùng `NODE_ENV=development` để limiter nới lỏng.
- **Vector Store:** auto-rebuild on startup nếu số lượng vector lệch >5% so với số sản phẩm active trong DB. Nếu thấy log "Rebuilding vector store..." khi start server là bình thường.
- **Cron Jobs:** 2 jobs chạy tự động — daily 2:00 AM (cleanup carts/OTP/tokens/discount/chat/uploads) và weekly Sunday 3:00 AM (orphaned images). Không disable trừ khi có lý do rõ ràng.

## Test Baseline (as of 2026-05-19)

- 171 suites / 4212 tests (~15s runtime)
- Full details: `docs/TESTING_COVERAGE_BASELINE.md`
- CI: `.github/workflows/ci.yml` — runs on push/PR to `main`
