# TechStore — Website Thương Mại Điện Tử Thiết Bị Công Nghệ

[![CI](https://github.com/MinhThang1009/E-commerce-website/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MinhThang1009/E-commerce-website/actions/workflows/ci.yml)

> **Khóa luận tốt nghiệp** — Xây dựng website e-commerce chuyên bán thiết bị công nghệ, tích hợp AI Chatbot hỗ trợ tư vấn sản phẩm với kỹ thuật RAG (Retrieval-Augmented Generation).

## Mục lục

- [1. Giới thiệu](#1-giới-thiệu)
- [2. Kiến trúc & Chất lượng code](#2-kiến-trúc--chất-lượng-code)
- [3. Tech Stack](#3-tech-stack)
- [4. Yêu cầu hệ thống](#4-yêu-cầu-hệ-thống)
- [5. Cài đặt và chạy](#5-cài-đặt-và-chạy)
- [6. Tổng quan tính năng](#6-tổng-quan-tính-năng)
- [7. Hệ thống AI / RAG](#7-hệ-thống-ai--rag)
- [8. Testing](#8-testing)
- [9. Cấu trúc thư mục](#9-cấu-trúc-thư-mục)
- [10. Biến môi trường](#10-biến-môi-trường)
- [11. API Documentation](#11-api-documentation)
- [12. Tài liệu kỹ thuật](#12-tài-liệu-kỹ-thuật)

---

## 1. Giới thiệu

**TechStore** là website thương mại điện tử fullstack chuyên bán thiết bị công nghệ (laptop, điện thoại, smartwatch, tablet, phụ kiện...). Hệ thống tích hợp AI Chatbot sử dụng RAG để tư vấn sản phẩm theo thời gian thực, hỗ trợ thanh toán trực tuyến qua MoMo và VNPay, và có hệ thống quản trị toàn diện.

**Điểm nổi bật:**
- Kiến trúc Modular Monolith — 17 backend modules, DI pattern, Event-Driven Communication
- AI Chatbot với Hybrid RAG (cosine similarity + BM25 keyword, 1024-dim vectors)
- **5.388 test cases** (258 suites, 5 tầng), coverage 99,76% branches unit, CI/CD với GitHub Actions
- Hỗ trợ đa ngôn ngữ (vi/en), dark mode, responsive

---

## 2. Kiến trúc & Chất lượng code

### 2.1 Modular Monolith (Backend)

```
Client Request → Express Middleware (auth, rate-limit, XSS sanitize)
    → Module Router → Controller → Service → Repository → MySQL
                         ↕ EventBus (async cross-module communication)
```

17 modules độc lập, mỗi module tự chứa: `routes → controller → service → repository`. Module giao tiếp qua **EventBus** (pub/sub pattern), không import trực tiếp service lẫn nhau. DI wiring tập trung tại `app.js`.

### 2.2 Feature-Based Architecture (Frontend)

```
Route → Page (lazy-loaded) → Components
           ├→ TanStack Query hooks (server state, cache, optimistic updates)
           └→ Zustand stores (client state, persist localStorage)
                └→ apiClient (Axios, auto-inject JWT, auto-logout on 401)
```

13 features cô lập. Không có cross-feature imports. Shared code ở `components/`, `stores/`, `hooks/`, `utils/`.

### 2.3 Biện pháp chất lượng

| Biện pháp | Chi tiết |
|---|---|
| **5.388 test cases** | 5 tầng: Unit → Integration → API HTTP → E2E → Component |
| **Coverage thresholds** | Statements ≥97%, Lines ≥97%, Branches ≥85%, Functions ≥95% |
| **ESLint strict** | `--max-warnings 0` — không cho phép warning tồn tại |
| **Pre-commit hooks** | Secret scan + architecture audit (chặn service import ORM trực tiếp) + lint-staged |
| **CI/CD** | GitHub Actions: lint + typecheck + build + test trên mỗi push |
| **Type safety** | TypeScript strict mode (FE), Zod validation (BE) |
| **i18n coverage** | Mọi user-visible string qua `t('key')`, parity check vi/en |

---

## 3. Tech Stack

**Frontend**
- React 19.2.6 + TypeScript 5.8 + Vite 8.0.14 (build ~2.5s)
- Zustand v5 + Immer (client state) / TanStack Query v5 (server state)
- Tailwind CSS v4 (`@tailwindcss/vite`) + SCSS + shadcn/ui (Radix UI) + Framer Motion v12
- React Router v7 (lazy-loaded, code splitting)
- i18next v26 + react-i18next (vi/en) + Zod v4 (form/schema validation)
- Lucide React (icon library)
- dayjs (date utils), exceljs (export Excel), leaflet (bản đồ OpenStreetMap)

**Backend**
- Node.js 20 + Express 4 (Modular Monolith, 17 modules)
- Sequelize 6 + MySQL 8 (utf8mb4, timezone +07:00)
- JWT (access 15m + refresh env `JWT_REFRESH_EXPIRES_IN`, cookie default 7d), Google OAuth 2.0
- Nodemailer (Gmail SMTP), bcrypt, Zod validation

**AI / RAG**
- LLM: OpenAI-compatible endpoint (configurable model)
- Embedding: Jina v3 → HuggingFace multilingual-e5-large-instruct → multilingual-e5-large (chain fallback)
- Vector store: JSON-based, 1024-dim, Hybrid Search (cosine + BM25)
- Translation: DeepL API

**Infra / Tooling**
- GitHub Actions CI (lint + test + typecheck + build)
- Husky pre-commit (secret scan + architecture audit + lint-staged)
- ESLint + Prettier, Jest 29, node-cron
- Swagger / OpenAPI 3.0 (auto-generated từ JSDoc)

---

## 4. Yêu cầu hệ thống

- **Node.js** >= 20
- **MySQL** 8.x
- **OpenAI-compatible API key** (cho chatbot)
- **Jina AI API key** hoặc **HuggingFace API key** (cho embedding/vector search)

---

## 5. Cài đặt và chạy

### 5.1 Clone repo

```bash
git clone <repo-url>
cd e-commerce-website
```

### 5.2 Cài dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 5.3 Cấu hình môi trường

```bash
cp backend/.env.example backend/.env
# Điền: DB_*, JWT_SECRET (>=32 ký tự), JWT_REFRESH_SECRET (>=32 ký tự),
#        EMAIL_USERNAME, EMAIL_PASSWORD, LLM_*, JINA_API_KEY

cp frontend/.env.example frontend/.env
# Điền: VITE_API_URL, VITE_GOOGLE_CLIENT_ID
```

### 5.4 Khởi tạo database

```bash
cd backend
npm run db:migrate    # Tạo schema từ 61 migrations
npm run db:seed       # Import seed data (sản phẩm, danh mục, users mẫu)
```

### 5.5 Build vector store cho AI (tùy chọn)

```bash
cd backend
npm run ai:rebuild-vectors
```

Cần `JINA_API_KEY` hoặc `HF_API_KEY`. Nếu bỏ qua, chatbot vẫn hoạt động nhưng không có semantic search.

### 5.6 Chạy dự án

```bash
# Terminal 1 — Backend (port 8888)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5175)
cd frontend && npm run dev
```

- **Ứng dụng**: `http://localhost:5175`
- **Swagger API docs**: `http://localhost:8888/api-docs`
- **Health check**: `http://localhost:8888/api/health`

---

## 6. Tổng quan tính năng

### 6.1 Backend Modules (17)

| Module | Mô tả |
|---|---|
| `auth` | Đăng ký, đăng nhập (email/Google OAuth), JWT, OTP email, quên/reset mật khẩu |
| `users` | Profile người dùng, quản lý địa chỉ giao hàng |
| `catalog` | Sản phẩm, danh mục, thương hiệu, biến thể, thông số kỹ thuật, tìm kiếm, gợi ý |
| `cart` | Giỏ hàng (guest + authenticated), merge cart khi đăng nhập |
| `orders` | Tạo đơn, theo dõi, hủy đơn, xác nhận nhận hàng, admin quản lý trạng thái |
| `payment` | Thanh toán MoMo và VNPay (create URL + IPN callback + hoàn tiền) |
| `inventory` | Quản lý tồn kho, ghi log biến động stock, SELECT FOR UPDATE chống race condition |
| `reviews` | Đánh giá sản phẩm (chỉ user đã mua), thống kê rating tổng hợp |
| `discount-code` | Mã giảm giá (% hoặc cố định), hạn dùng, giới hạn số lần |
| `ai` | AI chatbot (Hybrid RAG 7-bước), gợi ý sản phẩm, thêm vào giỏ qua chat, analytics |
| `admin` | Dashboard analytics, CRUD toàn bộ entities |
| `content` | Feedback/contact form |
| `wishlist` | Danh sách yêu thích |
| `image` | Quản lý ảnh sản phẩm, image proxy, xử lý ảnh với Sharp |
| `upload` | Upload file (Multer + Sharp), resize, dọn orphaned files hàng tuần |
| `attribute` | Nhóm thuộc tính (màu, size, RAM...), giá trị thuộc tính, AI name generator |
| `search-history` | Lưu lịch sử tìm kiếm, cleanup tự động (giữ 50 entries/user) |

### 6.2 Frontend Features (13)

| Feature | Mô tả |
|---|---|
| `auth` | Login/Register/Google OAuth, forgot/reset password, verify email, auto token refresh |
| `catalog` | Trang shop với filter/sort, chi tiết sản phẩm, danh mục, thương hiệu, deals, new arrivals |
| `cart` | Giỏ hàng sidebar, guest cart với localStorage, merge khi đăng nhập |
| `checkout` | Luồng checkout, chọn địa chỉ, mã giảm giá, chọn thanh toán |
| `orders` | Lịch sử đơn hàng, xem chi tiết, hủy đơn, xác nhận nhận hàng, track order công khai |
| `payment` | Redirect MoMo/VNPay, QR code thanh toán, xử lý callback sau thanh toán |
| `users` | Profile, đổi mật khẩu, quản lý địa chỉ giao hàng |
| `wishlist` | Danh sách yêu thích, toggle từ bất kỳ trang sản phẩm |
| `reviews` | Viết đánh giá (sau khi đã mua), xem rating và bình luận |
| `ai` | Chat widget nổi (floating, resizable), hiển thị sản phẩm từ AI, thêm vào giỏ qua chat |
| `admin` | Dashboard analytics, CRUD sản phẩm/đơn hàng/người dùng/tồn kho |
| `content` | Form liên hệ/feedback |
| `upload` | Upload ảnh với preview, drag-and-drop, crop |

---

## 7. Hệ thống AI / RAG

Chatbot TechStore sử dụng kiến trúc Hybrid RAG, toàn bộ pipeline xử lý trong `ChatbotService` với 7 bước:

```
validate → normalize (expandAbbreviations) → injection/off-topic check
→ load session history → retrieve (parallel hybridSearch + LLM rewrite)
→ generate (LLM) → persist (session Map + DB)
```

**Indexing** (`npm run ai:rebuild-vectors`): Đọc sản phẩm active từ DB → xây dựng embedding text (tên + thương hiệu + danh mục + mô tả + giá + tồn kho) → gọi embedding API (chain fallback: Jina v3 → e5-instruct → e5-base) → lưu 1024-dim vectors vào `data/vector-db.json`.

**Retrieval (Hybrid Search)**: Chạy song song `hybridSearch` + `rewriteQuery` (LLM chuẩn hóa query):
- **Semantic search**: cosine similarity, ngưỡng mặc định 0.45
- **Keyword search**: BM25-inspired (name weight ×3, text weight ×1)
- Kết hợp: boost +0.05 nếu khớp cả hai; fallback minScore=0 topK=3 nếu không có kết quả

**Generation**: Sản phẩm liên quan + session history → context prompt → LLM (temp=0.3, max_tokens=800) → parse JSON → phản hồi tiếng Việt tự nhiên.

**Session memory**: Map in-memory, max 500 sessions, TTL 30 phút, LRU eviction. Reset khi restart server.

**Auto-rebuild**: Server startup so sánh số vector với sản phẩm active — lệch >5% thì trigger rebuild ngầm.

---

## 8. Testing

| Suite | Suites | Tests | DB | Runtime |
|---|---|---|---|---|
| BE Unit Tests | 157 | 3.724 | Mock | ~20s |
| BE Integration Tests | 36 | 184 | MySQL thật | ~55s |
| BE API HTTP Tests | 39 | 700 | MySQL thật | ~230s |
| BE E2E Tests | 5 | 100 | MySQL thật | ~25s |
| FE Component Tests | 21 | 680 | jsdom | ~12s |
| **Tổng** | **258** | **5.388** | | |

Coverage threshold (CI): Statements >= 97%, Lines >= 97%, Branches >= 85%, Functions >= 95%.

Test descriptions viết bằng **tiếng Việt** theo quy định đồ án.

```bash
# Backend
cd backend
npm run test              # Unit tests + coverage (~10s)
npm run test:fast         # Unit tests không coverage
npm run test:integration  # Integration tests (cần MySQL)
npm run test:api          # API HTTP tests (cần MySQL)
npm run test:e2e          # E2E tests (cần MySQL)
npm run lint              # ESLint --max-warnings 0

# Frontend
cd frontend
npm test                  # Component tests
npm run typecheck         # tsc --noEmit
npm run lint              # ESLint --max-warnings 0
npm run build             # Production build
```

---

## 9. Cấu trúc thư mục

```
e-commerce-website/
├── backend/
│   ├── src/
│   │   ├── app.js              # DI wiring, middleware stack, module mounting
│   │   ├── server.js           # Entry point, DB connect, env validation
│   │   ├── modules/            # 17 feature modules
│   │   │   ├── auth/           # routes.js, module.js, services/, controllers/, repositories/
│   │   │   ├── catalog/        # categories + brands + products
│   │   │   ├── orders/
│   │   │   ├── payment/        # MoMo + VNPay
│   │   │   ├── ai/             # chatbot service, vector search
│   │   │   └── ...             # 12 modules khác
│   │   ├── models/             # 25 Sequelize models + associations (index.js)
│   │   ├── shared/             # EventBus, AppError, UnitOfWork
│   │   ├── services/           # email, embedding (unified), vector-store
│   │   ├── middlewares/        # authenticate, authorize, rate-limiter
│   │   ├── utils/              # logger (Winston), i18n, catch-async
│   │   ├── jobs/               # Cron: daily 2AM + weekly Sunday 3AM
│   │   ├── config/             # database.js, sequelize.js, swagger.js
│   │   ├── constants/          # shipping, OTP, pagination limits
│   │   ├── locales/            # vi.json / en.json
│   │   └── migrations/         # 61 Sequelize migrations
│   ├── data/                   # vector-db.json, SQL dumps
│   ├── docs/                   # openapi.json (auto-generated)
│   └── scripts/                # rebuild-db.js, index-products.js, audit-architecture.sh
│
├── frontend/
│   ├── src/
│   │   ├── features/           # 13 feature modules
│   │   │   ├── auth/           # api/, pages/, components/, hooks/, types/
│   │   │   ├── catalog/
│   │   │   ├── cart/
│   │   │   ├── orders/
│   │   │   ├── ai/             # chat widget, ChatbotErrorBoundary
│   │   │   └── ...             # 8 features khác
│   │   ├── components/         # Shared: common/, layout/, routing/, icons/
│   │   ├── stores/             # 6 Zustand stores (auth, cart, chat, catalog, wishlist, ui)
│   │   ├── routes/             # AppRoutes.tsx (lazy), paths.ts
│   │   ├── lib/                # api-client.ts (Axios), query-client.ts (TanStack)
│   │   ├── hooks/              # 5 global hooks (use-api-state, use-debounce, use-notifications, use-scroll-to-top, use-token-refresh)
│   │   ├── pages/              # Static pages (Home, About, FAQs, Privacy...)
│   │   ├── utils/              # 14 utilities (token-manager, auth-utils...)
│   │   ├── types/              # Shared TypeScript types
│   │   ├── styles/             # SCSS tokens, global CSS
│   │   ├── config/             # i18n.ts initialization
│   │   ├── constants/          # PAGINATION, UPLOAD, SHIPPING
│   │   └── locales/            # vi.json / en.json
│   ├── index.html
│   └── vite.config.ts
│
├── scripts/                    # audit-architecture.sh, lint-migrations.sh
├── .github/workflows/ci.yml    # GitHub Actions CI
├── .husky/                     # pre-commit, commit-msg, pre-push hooks
├── CLAUDE.md                   # AI agent navigation entry point
├── STRUCTURE.md                # Kiến trúc chi tiết
└── TESTING_STRATEGY.md         # Chiến lược test 5 tầng
```

---

## 10. Biến môi trường

### 10.1 Backend (`backend/.env`)

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | **Có** | Kết nối MySQL |
| `DB_PORT` | Không | Mặc định 3306 |
| `JWT_SECRET` | **Có** | >= 32 ký tự ngẫu nhiên |
| `JWT_REFRESH_SECRET` | **Có** | >= 32 ký tự ngẫu nhiên |
| `JWT_EXPIRES_IN` | Không | Mặc định 15m |
| `EMAIL_USERNAME` | **Có** | Gmail address |
| `EMAIL_PASSWORD` | **Có** | Gmail App Password |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | Không | OpenAI-compatible endpoint cho chatbot |
| `JINA_API_KEY` | Không | Embedding provider chính (Jina v3) |
| `HF_API_KEY` | Không | HuggingFace fallback embedding |
| `DEEPL_API_KEY` | Không | Dịch nội dung tự động |
| `CORS_ORIGINS_DEV` | Không | Origins cho phép trong dev (comma-separated) |
| `FRONTEND_URL` | Không | Mặc định http://localhost:5175 |
| `GOOGLE_CLIENT_ID` | Không | Google OAuth |
| `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL` | Không | VNPay |
| `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` | Không | MoMo |
| `PORT` | Không | Mặc định 8888 |

### 10.2 Frontend (`frontend/.env`)

| Biến | Mô tả |
|---|---|
| `VITE_API_URL` | URL backend API, mặc định `http://localhost:8888/api` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `VITE_GOONG_API_KEY` | Goong Maps API key (geocoding địa chỉ → tọa độ; bản đồ hiển thị dùng Leaflet + OpenStreetMap) |

---

## 11. API Documentation

Swagger UI: `http://localhost:8888/api-docs`

Export JSON: `cd backend && npm run docs:openapi` → tạo `docs/openapi.json`

---

## 12. Tài liệu kỹ thuật

| File | Nội dung |
|---|---|
| [`STRUCTURE.md`](STRUCTURE.md) | Kiến trúc chi tiết, DB schema, data flow, cross-module deps |
| [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) | Chiến lược test 5 tầng, patterns, CI constraints |
| [`CLAUDE.md`](CLAUDE.md) | Navigation entry point cho AI agents |
| [`DIAGRAMS.md`](DIAGRAMS.md) | Mermaid diagrams (Use Case, Sequence, ERD, Flow) |
