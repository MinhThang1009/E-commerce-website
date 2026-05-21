# Documentation Update Prompt — E-Commerce Website

---

## PHASE 1 — List Work Tree

**1.1** Liệt kê cấu trúc thư mục cấp cao nhất (chỉ depth 2, không hiện file) để nắm toàn bộ các thư mục con tồn tại trong project.
Bỏ qua hoàn toàn thư mục `node_modules` ở mọi cấp độ.

**1.2** Với từng thư mục con sau, liệt kê toàn bộ file bên trong — xử lý từng thư mục một, không gộp chung. Nếu thư mục con vẫn còn quá lớn thì tiếp tục chia nhỏ theo sub-thư mục:

**Root level:**
- `.claude/` (plans, hooks, alerts, skills, tmp)
- `.github/workflows/`
- `.husky/`
- `scripts/` (root)
- `docs/`
- `uploads/` (root)
- `backend/` (file ở root: `.env.example`, `.sequelizerc`, `package.json`, `jest*.config.js`, `eslint.config.js`)
- `frontend/` (file ở root: `.env.example`, `index.html`, `package.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `tsconfig*.json`, `jest*.cjs`, `.eslintrc.cjs`, `.lintstagedrc.cjs`)

**Backend:**
- `backend/src/config/`
- `backend/src/constants/`
- `backend/src/jobs/`
- `backend/src/locales/`
- `backend/src/middlewares/`
- `backend/src/migrations/`
- `backend/src/models/`
- `backend/src/routes/`
- `backend/src/services/` (bao gồm `embedding/` và `vector-store/`)
- `backend/src/shared/` (bao gồm `errors/` và `persistence/`)
- `backend/src/utils/`
- `backend/src/modules/admin/` (controllers, dtos, repositories, services, validators, utils)
- `backend/src/modules/ai/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/attribute/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/auth/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/cart/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/catalog/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/content/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/discount-code/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/image/` (controllers, dtos, middlewares, repositories, services, validators)
- `backend/src/modules/inventory/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/loyalty/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/orders/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/payment/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/reviews/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/search-history/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/upload/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/users/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/warranty-package/` (controllers, dtos, repositories, services, validators)
- `backend/src/modules/wishlist/` (controllers, dtos, repositories, services, validators)
- `backend/src/__tests__/`
- `backend/src/__integration__/`
- `backend/src/__api__/`
- `backend/src/__e2e__/`
- `backend/scripts/` (bao gồm `seeders/`)
- `backend/data/`
- `backend/docs/`

**Frontend:**
- `frontend/src/components/` (common, icons, layout, routing, sections)
- `frontend/src/config/`
- `frontend/src/constants/`
- `frontend/src/hooks/`
- `frontend/src/lib/`
- `frontend/src/locales/`
- `frontend/src/pages/`
- `frontend/src/routes/`
- `frontend/src/stores/`
- `frontend/src/styles/`
- `frontend/src/types/`
- `frontend/src/utils/`
- `frontend/src/features/admin/` (api, components, pages)
- `frontend/src/features/ai/` (api, components, hooks, types, constants)
- `frontend/src/features/auth/` (api, components, hooks, pages, types)
- `frontend/src/features/cart/` (api, components, hooks, pages, types)
- `frontend/src/features/catalog/` (api, components, hooks, pages, types, utils)
- `frontend/src/features/checkout/` (pages)
- `frontend/src/features/content/` (api, components, pages, types)
- `frontend/src/features/loyalty/` (api)
- `frontend/src/features/orders/` (api, components, pages, types)
- `frontend/src/features/payment/` (api, components, pages)
- `frontend/src/features/reviews/` (api, components, types)
- `frontend/src/features/upload/` (api)
- `frontend/src/features/users/` (api, pages)
- `frontend/src/features/wishlist/` (api, pages)
- `frontend/src/__tests__/` (bao gồm `__mocks__/`)
- `frontend/public/` (bao gồm `admin/`, `images/payment/`)
- `frontend/src/assets/`

> Hoàn thành toàn bộ Phase 1 trước khi chuyển sang Phase 2. Mục tiêu là không bỏ sót bất kỳ file nào trong toàn bộ project (ngoại trừ `node_modules`).

---

## PHASE 2 — Đọc Toàn Bộ Codebase và Tài Liệu Hiện Có

Dựa trên work tree vừa liệt kê, đọc toàn bộ nội dung của các nhóm file sau — đọc xong toàn bộ mới được chuyển sang Phase 3:

**2.1 File entry point và config:**
- `backend/src/server.js`, `backend/src/app.js`
- `backend/src/config/database.js`, `backend/src/config/redis.js`, `backend/src/config/sequelize.js`, `backend/src/config/swagger.js`
- `backend/src/constants/index.js`
- `backend/src/routes/index.js`
- `frontend/src/main.tsx`, `frontend/src/App.tsx`
- `frontend/src/routes/AppRoutes.tsx`, `frontend/src/routes/paths.ts`
- `frontend/src/config/i18n.ts`, `frontend/src/constants/index.ts`
- `frontend/src/lib/api-client.ts`, `frontend/src/lib/query-client.ts`
- `frontend/index.html`

**2.2 File SQL, seed data và OpenAPI:**
- `backend/data/migration_full.sql`
- `backend/data/seed_data.sql`
- `backend/data/products.json`
- `backend/data/vector-db.json`
- `backend/docs/openapi.json`
- `backend/scripts/seeders/20260101000001-seed-categories.js`
- `backend/scripts/seeders/20260101000002-seed-brands.js`
- `backend/scripts/seeders/20260101000003-seed-admin-user.js`
- `backend/scripts/seeders/20260101000004-seed-news.js`

**2.3 Models (toàn bộ):**
Đọc tất cả file `.js` trong `backend/src/models/` — đặc biệt `index.js` để nắm toàn bộ associations. Bỏ qua các file `.test.js`.

**2.4 Modules backend (toàn bộ):**
Với mỗi trong 19 module trong `backend/src/modules/`, đọc: `module.js`, `routes.js`, tất cả file trong `controllers/`, `services/`, `repositories/`, `dtos/`, `validators/`.
Lưu ý module `image` có thêm thư mục `middlewares/` riêng.

**2.5 Middlewares, shared, utils backend:**
- Toàn bộ file `.js` trong `backend/src/middlewares/` (bỏ qua `.test.js`)
- Toàn bộ file trong `backend/src/shared/errors/` và `backend/src/shared/persistence/`
- `backend/src/shared/admin-audit.js`, `backend/src/shared/event-bus.js`, `backend/src/shared/index.js`
- Toàn bộ file `.js` trong `backend/src/utils/` (bỏ qua `.test.js`)
- `backend/src/services/email.js`
- `backend/src/services/embedding/unified-embedding.js`
- `backend/src/services/vector-store/vector-store.js`
- `backend/src/jobs/cleanup.js`

**2.6 Locales backend và frontend:**
- `backend/src/locales/en.json`, `backend/src/locales/vi.json`
- `frontend/src/locales/en.json`, `frontend/src/locales/vi.json`

**2.7 Features frontend (toàn bộ):**
Với mỗi trong 14 feature trong `frontend/src/features/`, đọc tất cả file trong `api/`, `components/`, `hooks/`, `pages/`, `types/`, `utils/`, `constants/`. Bỏ qua `index.ts` nếu chỉ là re-export.

**2.8 Stores, hooks, utils, types, components frontend:**
- Toàn bộ file trong `frontend/src/stores/`
- Toàn bộ file trong `frontend/src/hooks/`
- Toàn bộ file trong `frontend/src/utils/`
- Toàn bộ file trong `frontend/src/types/`
- Toàn bộ file trong `frontend/src/components/common/`, `frontend/src/components/layout/`, `frontend/src/components/routing/`, `frontend/src/components/sections/`, `frontend/src/components/icons/`
- Toàn bộ file trong `frontend/src/pages/`
- `frontend/src/styles/_tokens.scss`, `frontend/src/styles/index.scss`, `frontend/src/styles/product-description.css`

**2.9 Config, package và build files:**
- `backend/package.json`, `frontend/package.json`, root `package.json`
- `backend/.env.example`, `frontend/.env.example`
- `backend/.sequelizerc`
- `frontend/vite.config.ts`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`
- `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/src/vite-env.d.ts`
- `frontend/jest.config.cjs`, `frontend/jest.setup.cjs`, `frontend/.lintstagedrc.cjs`
- `backend/jest.config.js`, `backend/jest.api.config.js`, `backend/jest.integration.config.js`, `backend/jest.e2e.config.js`
- `backend/eslint.config.js`, `frontend/.eslintrc.cjs`
- `.editorconfig`, `.prettierrc`, `.nvmrc`
- `.gitignore`

**2.10 CI/CD, husky và scripts:**
- `.github/workflows/ci.yml`, `.github/workflows/CLAUDE.md`
- `.github/dependabot.yml`
- `.husky/commit-msg`, `.husky/pre-commit`, `.husky/pre-push`
- `.claude/settings.json`, `.claude/settings.local.json`
- `.claude/hookify.audit-before-stop.md`
- `.claude/hooks/post-edit-check-docs.sh`
- Toàn bộ file trong `.claude/plans/`
- Toàn bộ file trong `.claude/alerts/`
- Toàn bộ file trong root `scripts/`
- Toàn bộ file `.js` trong `backend/scripts/` (trừ seeders đã đọc)

**2.11 Tài liệu hiện có (toàn bộ):**
- `CLAUDE.md`, `README.md`, `STRUCTURE.md`, `DIAGRAMS.md`, `TESTING_STRATEGY.md` ở root
- Tất cả `CLAUDE.md` trong các thư mục con backend và frontend

> Bỏ qua hoàn toàn: `node_modules/`, `coverage/`, `logs/`, `uploads/`, `.git/`, `backend/data/vector-db.json.bak`, `frontend/src/assets/.gitkeep`, `frontend/public/robots.txt`, `frontend/public/images/`, `frontend/public/admin/index.html`, `.claude/scheduled_tasks.lock`, `.claude/tmp/`, `docs/` (chứa file PDF/DOCX luận văn, không liên quan codebase), các file `*.lock` (trừ `package-lock.json`), các file `*.test.js` và `*.test.tsx` (trừ khi đọc riêng theo nhóm test).

---

## PHASE 3 — Cập Nhật 5 File Tài Liệu ở Root

Cập nhật toàn bộ 5 file sau ở root: `CLAUDE.md`, `README.md`, `STRUCTURE.md`, `DIAGRAMS.md`, `TESTING_STRATEGY.md` — đảm bảo đồng thời toàn bộ các tiêu chí:

**3.1 Nội dung đầy đủ**
Không thiếu bất kỳ module, feature, config, hoặc flow nào đang tồn tại trong codebase. Với project này, đảm bảo cover đủ:
- 19 backend modules: admin, ai, attribute, auth, cart, catalog, content, discount-code, image, inventory, loyalty, orders, payment, reviews, search-history, upload, users, warranty-package, wishlist
- 14 frontend features: admin, ai, auth, cart, catalog, checkout, content, loyalty, orders, payment, reviews, upload, users, wishlist
- Hệ thống AI/RAG (OpenAI embedding + vector-store JSON-based + cosine similarity)
- i18n song ngữ vi/en (backend locales + frontend i18n)
- Loyalty & Rewards system
- Inventory system với inventory_logs
- Warranty package system
- Event bus (shared/event-bus.js)
- Unit-of-work pattern (shared/persistence/)
- Admin audit log (shared/admin-audit.js + audit_logs table)
- 4 loại test: unit (`__tests__`), integration (`__integration__`), API HTTP (`__api__`), E2E (`__e2e__`)
- CI/CD pipeline (GitHub Actions ci.yml + dependabot)
- Husky hooks (commit-msg, pre-commit, pre-push)
- Claude Code config (.claude/plans, hooks, settings)
- OpenAPI docs (backend/docs/openapi.json)
- Vector store data (backend/data/vector-db.json)

**3.2 Nội dung chi tiết**
Mỗi phần được mô tả đủ sâu để agent hiểu được mục đích, cách hoạt động, và mối liên hệ với các phần khác.

**3.3 Consistent 100% với codebase thực tế**
Không có thông tin sai lệch, outdated, hoặc mâu thuẫn so với code thực tế.

---

## PHASE 4 — Kiểm Tra và Cập Nhật DIAGRAMS.md

Dựa trên toàn bộ codebase, `backend/data/migration_full.sql`, `backend/data/seed_data.sql`, `backend/data/vector-db.json`, `backend/docs/openapi.json` và các file seed trong `backend/scripts/seeders/`, verify và đảm bảo `DIAGRAMS.md` có đầy đủ tất cả các loại sơ đồ sau — nếu thiếu loại nào thì tạo mới ngay trong phase này:

**4.1 Usecase tổng quát**
Toàn bộ actor (Guest, Customer, Admin) và tất cả use case ở mức hệ thống.

**4.2 Usecase phân rã**
Phân rã chi tiết theo từng nhóm chức năng chính của project:
- Auth & User Management (đăng ký, đăng nhập, OTP, profile, địa chỉ)
- Catalog & Product (danh sách, chi tiết, filter, search, recently-viewed)
- Cart & Checkout
- Orders & Payment
- Reviews & Ratings
- Inventory & Warranty
- Loyalty & Rewards
- AI Chatbot & Search History
- Content Management (News, Banners, FAQ)
- Admin Dashboard (quản lý toàn bộ entities + audit log)

**4.3 Sơ đồ tuần tự (Sequence Diagram)**
Các flow nghiệp vụ quan trọng, bao gồm tối thiểu:
- Luồng đăng ký / đăng nhập (bao gồm OTP verify)
- Luồng checkout đầy đủ (cart → discount code → order → payment → inventory update → loyalty points)
- Luồng AI chatbot (RAG pipeline: query → embedding → vector search → context → LLM → response → chat_messages lưu DB)
- Luồng upload ảnh (multipart → upload module → image module → lưu DB)
- Luồng admin quản lý sản phẩm (tạo product → variants → specifications → attributes → images)
- Luồng token refresh (access token hết hạn → refresh token → cấp token mới)

**4.4 Sơ đồ quan hệ thực thể (ERD)**
Đọc trực tiếp `backend/data/migration_full.sql` để lấy danh sách bảng. Lưu ý: file có 40 `CREATE TABLE` nhưng 5 bảng đã bị drop bởi migrations sau (`collections`, `product_collections`, `email_campaigns`, `import_logs`, `newsletter_subscribers`) — chỉ vẽ **35 bảng active**. Với mỗi bảng, thể hiện đầy đủ: tên cột, kiểu dữ liệu, khóa chính, khóa ngoại, constraint, quan hệ (1-1, 1-n, n-n). Không được bỏ sót bất kỳ bảng active nào — kể cả junction table, lookup table, log table.

**4.5 Sơ đồ kiến trúc hệ thống (Architecture Diagram)**
Thể hiện đầy đủ: Frontend (React 18 / Vite / TypeScript / Zustand / TanStack Query / Tailwind) ↔ Backend (Express.js / Node.js / Sequelize ORM) ↔ Database (MySQL) ↔ Redis (cache + rate-limit) ↔ Vector Store (JSON file-based: `backend/data/vector-db.json`) ↔ OpenAI API (text-embedding + chat completion). Bao gồm: CI/CD (GitHub Actions), Husky git hooks, Claude Code (.claude/).

**4.6 Sơ đồ luồng dữ liệu RAG Pipeline**
Chi tiết luồng: user query → `unified-embedding.js` (OpenAI text-embedding) → cosine similarity search trong `vector-store.js` (so sánh với `vector-db.json`) → top-K context assembly → LLM prompt construction → OpenAI chat completion → response → lưu vào `chat_messages` table.

**4.7 Sơ đồ trạng thái (State Diagram)**
Tối thiểu cho:
- Trạng thái đơn hàng: pending → confirmed → shipping → delivered / cancelled / returned
- Trạng thái thanh toán: pending → completed / failed / refunded
- Trạng thái sản phẩm: draft → active / inactive (soft delete)
- Trạng thái user: active / inactive (isActive field)

**4.8 Sơ đồ thành phần (Component Diagram)**
Thể hiện cấu trúc 19 backend modules và 14 frontend features cùng các dependency chính giữa chúng, bao gồm shared services (email, embedding, vector-store, event-bus, unit-of-work).

> Với mỗi sơ đồ: đối chiếu với codebase và SQL files để đảm bảo không bỏ sót entity, actor, flow, hoặc quan hệ nào.

---

## PHASE 5 — Tạo Mới hoặc Cập Nhật CLAUDE.md ở Các Thư Mục Con

Dựa trên work tree, kiểm tra và xử lý từng thư mục sau — thư mục chưa có `CLAUDE.md` thì tạo mới, đã có thì cập nhật lại:

**Backend — đã có CLAUDE.md (cần cập nhật):**
- `backend/CLAUDE.md`
- `backend/scripts/CLAUDE.md`
- `backend/src/__integration__/CLAUDE.md`
- `backend/src/config/CLAUDE.md`
- `backend/src/jobs/CLAUDE.md`
- `backend/src/middlewares/CLAUDE.md`
- `backend/src/migrations/CLAUDE.md`
- `backend/src/models/CLAUDE.md`
- `backend/src/routes/CLAUDE.md`
- `backend/src/services/CLAUDE.md`
- `backend/src/services/embedding/CLAUDE.md`
- `backend/src/services/vector-store/CLAUDE.md`
- `backend/src/shared/CLAUDE.md`
- `backend/src/shared/errors/CLAUDE.md`
- `backend/src/shared/persistence/CLAUDE.md`
- `backend/src/utils/CLAUDE.md`
- `backend/src/modules/admin/CLAUDE.md`
- `backend/src/modules/ai/CLAUDE.md`
- `backend/src/modules/attribute/CLAUDE.md`
- `backend/src/modules/auth/CLAUDE.md`
- `backend/src/modules/cart/CLAUDE.md`
- `backend/src/modules/catalog/CLAUDE.md`
- `backend/src/modules/content/CLAUDE.md`
- `backend/src/modules/discount-code/CLAUDE.md`
- `backend/src/modules/image/CLAUDE.md`
- `backend/src/modules/inventory/CLAUDE.md`
- `backend/src/modules/loyalty/CLAUDE.md`
- `backend/src/modules/orders/CLAUDE.md`
- `backend/src/modules/payment/CLAUDE.md`
- `backend/src/modules/reviews/CLAUDE.md`
- `backend/src/modules/search-history/CLAUDE.md`
- `backend/src/modules/upload/CLAUDE.md`
- `backend/src/modules/users/CLAUDE.md`
- `backend/src/modules/warranty-package/CLAUDE.md`
- `backend/src/modules/wishlist/CLAUDE.md`

**Backend — đã có CLAUDE.md (cần kiểm tra/cập nhật):**
- `backend/src/__tests__/CLAUDE.md`
- `backend/src/__api__/CLAUDE.md`
- `backend/src/__e2e__/CLAUDE.md`
- `backend/data/CLAUDE.md`
- `backend/src/constants/CLAUDE.md`
- `backend/src/locales/CLAUDE.md`
- `backend/docs/CLAUDE.md`

**Frontend — đã có CLAUDE.md (cần cập nhật):**
- `frontend/CLAUDE.md`
- `frontend/src/components/CLAUDE.md`
- `frontend/src/config/CLAUDE.md`
- `frontend/src/constants/CLAUDE.md`
- `frontend/src/hooks/CLAUDE.md`
- `frontend/src/lib/CLAUDE.md`
- `frontend/src/pages/CLAUDE.md`
- `frontend/src/routes/CLAUDE.md`
- `frontend/src/stores/CLAUDE.md`
- `frontend/src/types/CLAUDE.md`
- `frontend/src/utils/CLAUDE.md`
- `frontend/src/features/admin/CLAUDE.md`
- `frontend/src/features/ai/CLAUDE.md`
- `frontend/src/features/auth/CLAUDE.md`
- `frontend/src/features/cart/CLAUDE.md`
- `frontend/src/features/catalog/CLAUDE.md`
- `frontend/src/features/checkout/CLAUDE.md`
- `frontend/src/features/content/CLAUDE.md`
- `frontend/src/features/loyalty/CLAUDE.md`
- `frontend/src/features/orders/CLAUDE.md`
- `frontend/src/features/payment/CLAUDE.md`
- `frontend/src/features/reviews/CLAUDE.md`
- `frontend/src/features/upload/CLAUDE.md`
- `frontend/src/features/users/CLAUDE.md`
- `frontend/src/features/wishlist/CLAUDE.md`

**Frontend — đã có CLAUDE.md (cần kiểm tra/cập nhật):**
- `frontend/src/__tests__/CLAUDE.md`
- `frontend/src/locales/CLAUDE.md`
- `frontend/src/styles/CLAUDE.md`

**Root level — đã có CLAUDE.md (cần kiểm tra/cập nhật):**
- `.github/workflows/CLAUDE.md`
- `scripts/CLAUDE.md`
- `.claude/plans/CLAUDE.md`

> Đảm bảo cùng tiêu chí chất lượng như Phase 3 cho tất cả file trên.

---

## PHASE 6 — Xây Dựng Hệ Thống Liên Kết Phân Cấp

Cập nhật `CLAUDE.md` ở root để đóng vai trò **entry point** duy nhất theo cấu trúc 3 cấp:

**Cấp 0 — Root `CLAUDE.md`:**
- Overview tổng thể project (e-commerce fullstack: React 18 + Express.js + MySQL + Redis + OpenAI/RAG)
- Link đến tất cả CLAUDE.md cấp 1: `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `.github/workflows/CLAUDE.md`, `scripts/CLAUDE.md`, `.claude/plans/CLAUDE.md`

**Cấp 1 — `backend/CLAUDE.md` và `frontend/CLAUDE.md`:**
- Mỗi file phải có link ngược về root và link đến tất cả CLAUDE.md cấp 2 trong phạm vi của nó
- `backend/CLAUDE.md` link đến: `src/config/`, `src/constants/`, `src/jobs/`, `src/locales/`, `src/middlewares/`, `src/migrations/`, `src/models/`, `src/routes/`, `src/services/`, `src/shared/`, `src/utils/`, tất cả 19 `src/modules/*/`, `src/__tests__/`, `src/__integration__/`, `src/__api__/`, `src/__e2e__/`, `scripts/`, `data/`, `docs/`
- `frontend/CLAUDE.md` link đến: `src/components/`, `src/config/`, `src/constants/`, `src/hooks/`, `src/lib/`, `src/locales/`, `src/pages/`, `src/routes/`, `src/stores/`, `src/styles/`, `src/types/`, `src/utils/`, tất cả 14 `src/features/*/`, `src/__tests__/`

**Cấp 2 — Tất cả CLAUDE.md trong thư mục con:**
- Mỗi file phải có link ngược lên CLAUDE.md cấp 1 của nó

---

## PHASE 7 — Verify Toàn Bộ

Sau khi hoàn tất, thực hiện kiểm tra chéo:

- Đối chiếu từng `CLAUDE.md` với code thực tế trong thư mục tương ứng
- Kiểm tra tất cả anchor link trong ToC có hoạt động đúng không
- Kiểm tra tất cả cross-link giữa các `CLAUDE.md` có trỏ đúng path không
- Kiểm tra số lượng: backend phải có đủ 42 CLAUDE.md (35 existing + 7 new), frontend phải có đủ 28 CLAUDE.md (25 existing + 3 new), root level phải có đủ 3 CLAUDE.md (.github/workflows/, scripts/, .claude/plans/)
- Liệt kê rõ từng điểm còn thiếu, còn sai, hoặc chưa đủ chi tiết (nếu có) rồi fix ngay trong phase này

---

## Yêu Cầu Format Bắt Buộc cho Toàn Bộ File CLAUDE.md

- Có **Table of Contents** ở đầu file, các mục trong ToC là anchor link trỏ đến từng section
- **Section header chính** được đánh số thứ tự: `# 1. Section Name`, `# 2. Section Name`, ...
- **Section header con** được đánh số thứ tự phân cấp: `## 1.1 Subsection`, `## 1.2 Subsection`, `### 1.1.1 Sub-subsection`, ...
- Số thứ tự phải liên tục, nhất quán, và phản ánh đúng cấu trúc phân cấp thực tế của nội dung

---

## Mục Tiêu Cuối Cùng

Agent khi đọc codebase sẽ bắt đầu từ `CLAUDE.md` ở root → theo các liên kết xuống `backend/CLAUDE.md` hoặc `frontend/CLAUDE.md` → tiếp tục đến từng module/feature → đọc đủ toàn bộ codebase theo đúng thứ tự ưu tiên, không bỏ sót module nào. Hệ thống số thứ tự và ToC giúp agent navigate nhanh đến đúng section cần thiết mà không phải đọc toàn bộ file.
