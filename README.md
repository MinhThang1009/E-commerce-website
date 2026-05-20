# TechStore — Website Thương Mại Điện Tử Thiết Bị Công Nghệ

[![CI](https://github.com/MinhThang1009/E-commerce-website/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MinhThang1009/E-commerce-website/actions/workflows/ci.yml)

> **Khóa luận tốt nghiệp** — Xây dựng website thương mại điện tử bán thiết bị công nghệ tích hợp AI Chatbot hỗ trợ tư vấn sản phẩm.

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Tính năng](#2-tính-năng)
3. [Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
4. [Công nghệ sử dụng](#4-công-nghệ-sử-dụng)
5. [Cấu trúc thư mục](#5-cấu-trúc-thư-mục)
6. [Cài đặt & chạy](#6-cài-đặt--chạy)
7. [Biến môi trường](#7-biến-môi-trường)
8. [API Documentation](#8-api-documentation)
9. [Kiểm thử](#9-kiểm-thử)
10. [Trạng thái dự án](#10-trạng-thái-dự-án)

---

## 1. Giới thiệu

**TechStore** là website thương mại điện tử chuyên bán thiết bị công nghệ (laptop, điện thoại, smartwatch, tablet...) được xây dựng theo mô hình full-stack hiện đại. Hệ thống tích hợp trí tuệ nhân tạo (AI Chatbot) sử dụng kỹ thuật RAG (Retrieval-Augmented Generation) để hỗ trợ tư vấn sản phẩm cho khách hàng theo thời gian thực.

**Đặc điểm nổi bật:**
- Kiến trúc Modular Monolith — dễ mở rộng, tách biệt domain rõ ràng
- AI Chatbot tích hợp RAG pipeline — tìm kiếm ngữ nghĩa trên catalog sản phẩm
- Hỗ trợ thanh toán trực tuyến: VNPay và MoMo
- Đa ngôn ngữ: Tiếng Việt và Tiếng Anh
- Giao diện Glass Morphism hiện đại, responsive hoàn toàn
- Test coverage 100% với 4212 test cases

---

## 2. Tính năng

### 2.1. Người dùng (Khách hàng)

| Nhóm | Tính năng |
|------|-----------|
| **Tài khoản** | Đăng ký, đăng nhập JWT, đăng nhập Google OAuth, xác thực OTP 2FA, quản lý hồ sơ |
| **Duyệt sản phẩm** | Tìm kiếm full-text, lọc theo danh mục / thương hiệu / giá / đánh giá, sắp xếp, xem chi tiết biến thể |
| **Giỏ hàng** | Thêm/xóa/cập nhật số lượng, đồng bộ giỏ hàng khi đăng nhập |
| **Thanh toán** | Thanh toán COD, chuyển khoản ngân hàng, VNPay (QR + thẻ ATM), MoMo |
| **Đơn hàng** | Theo dõi trạng thái đơn hàng, lịch sử mua hàng, hủy đơn |
| **Đánh giá** | Đánh giá sản phẩm (sao + nhận xét), chỉ khách hàng đã mua mới đánh giá được |
| **Tương tác** | Danh sách yêu thích, xem lại sản phẩm gần đây, so sánh sản phẩm |
| **Loyalty** | Tích điểm thành viên, đổi điểm, hạng thành viên (Bronze/Silver/Gold/Platinum) |
| **AI Chatbot** | Tư vấn sản phẩm qua chat, tìm kiếm ngữ nghĩa, gợi ý theo nhu cầu, chat realtime |
| **Bảo hành** | Chọn gói bảo hành khi mua, tra cứu thông tin bảo hành |

### 2.2. Quản trị viên (Admin)

| Nhóm | Tính năng |
|------|-----------|
| **Dashboard** | Thống kê doanh thu, đơn hàng, người dùng mới theo ngày/tháng/năm |
| **Sản phẩm** | CRUD sản phẩm, quản lý biến thể (màu sắc, dung lượng, RAM...), upload ảnh, thông số kỹ thuật |
| **Danh mục & Thương hiệu** | Quản lý cây danh mục, thương hiệu, bộ sưu tập sản phẩm |
| **Đơn hàng** | Xem/cập nhật trạng thái đơn hàng, lọc đơn hàng, xuất báo cáo |
| **Người dùng** | Danh sách khách hàng, quản lý tài khoản, phân quyền |
| **Khuyến mãi** | Tạo/quản lý mã giảm giá, chương trình khuyến mãi |
| **Nội dung** | Quản lý banner trang chủ, bài viết tin tức, email marketing |
| **Tồn kho** | Theo dõi tồn kho theo biến thể sản phẩm |
| **Bảo hành** | Quản lý gói bảo hành, liên kết với sản phẩm |
| **Audit log** | Lịch sử thao tác của admin |

---

## 3. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│  React 18 + TypeScript (Vite) — localhost:5175              │
│  Feature-Sliced Design | Zustand | TanStack Query           │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API / WebSocket
┌───────────────────────────▼─────────────────────────────────┐
│                      BACKEND                                 │
│  Node.js + Express — localhost:8888                         │
│  Modular Monolith (19 modules)                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │Controller│→ │ Service  │→ │Repository│→ │  MySQL 8  │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AI Module (RAG Pipeline)                            │   │
│  │  Embedding → Vector Store → Semantic Search         │   │
│  │  LLM (cấu hình qua LLM_MODEL env — OpenAI-compatible)    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                    │                   │
    ┌────▼────┐          ┌────▼────┐        ┌────▼────┐
    │  Redis   │          │ MySQL 8 │        │ Nodemailer│
    │  Cache   │          │   DB    │        │  Gmail  │
    └──────────┘          └─────────┘        └─────────┘
```

### 3.1. Backend — Modular Monolith

Mỗi module trong `backend/src/modules/[name]/` có 6 lớp tách biệt:

```
[module]/
├── controllers/    ← HTTP request/response handler
├── services/       ← Business logic & use cases
├── repositories/   ← Data access (Repository Pattern)
├── dtos/           ← Data Transfer Objects (validation)
├── validators/     ← Zod validation schemas
├── routes.js       ← Route definitions
└── module.js       ← Dependency Injection factory
```

### 3.2. Middleware Stack

Các middleware được áp dụng theo thứ tự sau trong `app.js`:

| Thứ tự | Middleware | Vai trò |
|--------|-----------|---------|
| 1 | `helmet` | HTTP security headers (CSP, HSTS...) |
| 2 | `cors` | Cross-Origin Resource Sharing |
| 3 | CSRF | Bảo vệ Cross-Site Request Forgery |
| 4 | `morgan` | HTTP request logging |
| 5 | `authLimiter` | Rate limit riêng cho auth routes |
| 6 | `apiLimiter` | Rate limit chung cho toàn bộ API |
| 7 | `detect-locale` | Phát hiện ngôn ngữ từ header/query |
| 8 | `express.json` (2MB) | Parse JSON body (giới hạn 2MB) |
| 9 | `express.urlencoded` | Parse form-encoded body |
| 10 | `cookieParser` | Parse cookie header |
| 11 | `sanitizeHtml` | Làm sạch HTML input (chống XSS) |
| 12 | `compression` | Nén gzip response |
| 13 | `image-proxy` | Proxy ảnh nội bộ |
| 14 | `static /uploads` | Serve file tĩnh (ảnh upload) |
| 15 | Module routers | 19 domain modules |
| 16 | 404 handler | Bắt route không tồn tại |
| 17 | `errorHandler` | Global error handler |

### 3.3. Event Bus

Internal event bus (publish/subscribe trong process) — 6 events:

| Event | Publisher | Subscriber (action) |
|-------|-----------|-------------------|
| `auth.userRegistered` | auth module | Gửi email welcome |
| `order.created` | orders module | Gửi email xác nhận đơn |
| `order.cancelled` | orders module | Inventory: restore stock |
| `order.delivered` | orders module | Loyalty: cộng điểm |
| `payment.succeeded` | payment module | Orders: cập nhật trạng thái |
| `inventory.restocked` | inventory module | Thông báo sản phẩm có hàng |

### 3.4. Frontend — Feature-Sliced Design (FSD)

```
features/[name]/
├── api/            ← TanStack Query hooks (useQuery, useMutation)
├── components/     ← Feature-specific UI components
├── pages/          ← Page-level components (route targets)
├── hooks/          ← Custom React hooks
└── types/          ← TypeScript type definitions
```

### 3.5. AI Chatbot — RAG Pipeline

Workflow xử lý một tin nhắn (8 bước, 0 hardcode model):

```
Tin nhắn người dùng
        │
        ▼
1. Validate ─── quá dài / rỗng → 400 Bad Request
        │
        ▼
2. Normalize ─── expand viết tắt: ip→iPhone, ss→Samsung, bnh→bao nhiêu
        │
        ▼
3. Off-topic check (regex, 0 API call)
   ├── YES → LLM phản hồi trực tiếp (skip retrieval)
   └── NO ↓
        │
        ▼
4. Parallel (chạy đồng thời):
   ├── LLM rewrite query (max_tokens:80, temp:0, timeout 8s)
   └── Hybrid Search: BM25 + Cosine Similarity (topK=10, minScore=0.45)
        │
        ▼
5. Refine ─── so sánh results → chọn tốt hơn
   Fallback ─── score < threshold → hạ threshold, lấy top-3
        │
        ▼
6. Augment ─── build RAG prompt với retrieved products
        │
        ▼
7. LLM Generate (temperature:0.3, max_tokens:800, json_object)
        │
        ▼
8. Parse + Cache (Redis 5 phút, shared) → update history → return
   { response, products[], suggestions[], intent }
```

**Vector Store:** In-memory JSON file, dual embedding
- EN: `text-embedding-3-small` 1536-dim (OpenRouter)
- VI: `multilingual-e5-large` 1024-dim (HuggingFace)

**Intent (rule-based, 0 API call):** `product_search` · `off_topic` · `order_inquiry` · `policy` · `pricing` · `general`

**Chat history:** In-memory Map, TTL 30 phút, max 10 turns/session, persist to DB

**LLM:** OpenAI-compatible endpoint — cấu hình qua `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`

---

## 4. Công nghệ sử dụng

### 4.1. Backend

| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Node.js | v20+ | Runtime môi trường |
| Express.js | 4.x | Web framework |
| Sequelize | 6.x | ORM tương tác MySQL |
| MySQL | 8.0 | Cơ sở dữ liệu quan hệ |
| Redis | 5.x | Cache layer (optional) |
| Socket.IO | 4.x | Realtime communication |
| JSON Web Token | 9.x | Xác thực stateless |
| Nodemailer | 6.x | Gửi email (Gmail SMTP) |
| AI LLM (cấu hình qua .env) | — | Chatbot: OpenAI-compatible endpoint, model cấu hình linh hoạt |
| OpenRouter API | — | Embedding tiếng Anh (vector search) |
| HuggingFace API | — | Embedding tiếng Việt (multilingual) |
| Winston | 3.x | Logging |
| Jest | 29.x | Unit & integration testing |
| Swagger UI | — | API documentation |

### 4.2. Frontend

| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool |
| Zustand | 5.x | Global state management |
| TanStack Query | 5.x | Server state & caching |
| React Router | 6.x | Client-side routing |
| Tailwind CSS | 3.x | Utility-first styling |
| Framer Motion | 11.x | Animations |
| Axios | 1.x | HTTP client |
| react-i18next | 14.x | Đa ngôn ngữ (vi/en) |

### 4.3. DevOps & Tooling

| Công cụ | Vai trò |
|---------|---------|
| pnpm | Package manager |
| ESLint + Prettier | Code quality |
| GitHub Actions | CI/CD pipeline |
| Husky | Pre-commit hooks |

---

## 5. Cấu trúc thư mục

Backend theo **Modular Monolith + Layered Architecture (Clean Architecture)**. Frontend theo **Feature-Sliced Design (FSD)**.

```
e-commerce-website/
├── backend/
│   ├── src/
│   │   ├── app.js                  # Khởi tạo Express + DI container
│   │   ├── server.js               # Entry point, HTTP + WebSocket server
│   │   ├── config/                 # Database, Redis, Swagger, Socket config
│   │   ├── models/                 # 38 Sequelize models (ORM entities)
│   │   ├── migrations/             # 68 migration files (lịch sử schema DB)
│   │   ├── middlewares/            # Auth, error handler, rate limiter, CORS
│   │   ├── jobs/                   # Cron jobs (cleanup, email scheduling)
│   │   ├── utils/                  # Helper functions
│   │   │
│   │   ├── shared/                 # Shared infrastructure (dùng chung toàn backend)
│   │   │   ├── errors/             # Custom error classes (AppError, NotFoundError...)
│   │   │   ├── cache/              # Cache abstraction (Redis / in-memory fallback)
│   │   │   ├── persistence/        # Base repository, transaction helper
│   │   │   ├── utils/              # Shared utilities
│   │   │   ├── event-bus.js        # Internal event bus (publish/subscribe)
│   │   │   └── admin-audit.js      # Ghi audit log thao tác admin
│   │   │
│   │   └── modules/                # 19 domain modules — Modular Monolith
│   │       │                       # Mỗi module có cấu trúc chuẩn:
│   │       │                       #   controllers/ — HTTP handler
│   │       │                       #   services/    — Business logic
│   │       │                       #   repositories/— Data access (Repository Pattern)
│   │       │                       #   dtos/        — Data Transfer Objects
│   │       │                       #   validators/  — Zod validation schemas
│   │       │                       #   routes.js    — Route definitions
│   │       │                       #   module.js    — Dependency Injection factory
│   │       │
│   │       ├── auth/               # Đăng nhập, đăng ký, JWT, Google OAuth, OTP 2FA,
│   │       │                       # refresh token rotate, forgot/reset password
│   │       ├── catalog/            # Sản phẩm, biến thể, ảnh, thông số kỹ thuật,
│   │       │                       # danh mục, thương hiệu, bộ sưu tập
│   │       ├── cart/               # Giỏ hàng (guest sessionId + user), merge khi login
│   │       ├── orders/             # Đặt hàng, quản lý trạng thái, lịch sử
│   │       ├── payment/            # VNPay (HMAC-SHA512), MoMo, COD, IPN webhook
│   │       ├── users/              # Hồ sơ người dùng, địa chỉ giao hàng
│   │       ├── reviews/            # Đánh giá sản phẩm (chỉ khách đã mua)
│   │       ├── wishlist/           # Danh sách yêu thích
│   │       ├── loyalty/            # Tích điểm, đổi điểm, hạng thành viên
│   │       ├── discount-code/      # Mã giảm giá, điều kiện áp dụng
│   │       ├── image/              # Quản lý ảnh sản phẩm (CDN sync)
│   │       ├── inventory/          # Theo dõi tồn kho theo biến thể, inventory log
│   │       ├── warranty-package/   # Gói bảo hành, liên kết với sản phẩm
│   │       ├── content/            # Banner trang chủ, tin tức, email campaign
│   │       ├── admin/              # Dashboard thống kê, audit log, quản trị
│   │       ├── upload/             # Upload ảnh (local storage / CDN)
│   │       ├── search-history/     # Lịch sử tìm kiếm người dùng
│   │       ├── attribute/          # Thuộc tính sản phẩm động (specs)
│   │       └── ai/                 # AI Chatbot — RAG Pipeline
│   │           ├── controllers/
│   │           ├── services/
│   │           ├── rag/            # Orchestrator: normalize → classify → retrieve → augment
│   │           ├── embedding/      # Tạo vector embedding (multilingual-e5-large)
│   │           ├── vectorstore/    # Lưu trữ & tìm kiếm vector (semantic search)
│   │           ├── llm/            # Giao tiếp LLM (OpenAI-compatible, model cấu hình qua .env)
│   │           ├── routes.js
│   │           └── module.js
│   │
│   ├── data/
│   │   ├── migration_full.sql      # Toàn bộ schema (CREATE TABLE IF NOT EXISTS)
│   │   └── data_new.sql            # Dữ liệu mẫu (60 sản phẩm, categories, brands)
│   ├── scripts/                    # CLI scripts: seed, migrate, index vectors
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── features/               # 14 feature slices — Feature-Sliced Design (FSD)
│   │   │                           # Mỗi feature có: api/ components/ pages/
│   │   │                           #                  hooks/ types/ utils/
│   │   │
│   │   │   ├── admin/              # Admin dashboard, quản lý toàn hệ thống
│   │   │   ├── ai/                 # AI Chatbot widget, chat interface, history
│   │   │   ├── auth/               # Đăng nhập, đăng ký, Google OAuth, OTP verify
│   │   │   ├── cart/               # Giỏ hàng, cập nhật số lượng, tóm tắt
│   │   │   ├── catalog/            # Danh sách sản phẩm, chi tiết, filter, biến thể
│   │   │   ├── checkout/           # Luồng thanh toán, chọn địa chỉ, áp mã giảm giá
│   │   │   ├── content/            # Tin tức, banner hiển thị
│   │   │   ├── loyalty/            # Xem điểm, lịch sử tích/đổi điểm
│   │   │   ├── orders/             # Lịch sử đơn hàng, theo dõi trạng thái
│   │   │   ├── payment/            # Xử lý callback VNPay/MoMo, QR thanh toán
│   │   │   ├── reviews/            # Form đánh giá, hiển thị đánh giá sản phẩm
│   │   │   ├── upload/             # Upload ảnh (dùng trong admin/profile)
│   │   │   ├── users/              # Hồ sơ cá nhân, quản lý địa chỉ
│   │   │   └── wishlist/           # Danh sách yêu thích
│   │   │
│   │   ├── components/             # Shared UI components (dùng nhiều feature)
│   │   │   ├── common/             # Button, Input, Modal, Badge, Spinner...
│   │   │   ├── layout/             # Header, Footer, Sidebar, MainLayout
│   │   │   ├── sections/           # HeroSection, ProductGrid, BannerSlider...
│   │   │   └── icons/              # Icon components
│   │   │
│   │   ├── stores/                 # Zustand global state — 6 stores
│   │   │   ├── auth-store.ts       # Trạng thái đăng nhập, user info
│   │   │   ├── cart-store.ts       # Giỏ hàng local (guest)
│   │   │   ├── ui-store.ts         # Notifications, modals, loading
│   │   │   ├── wishlist-store.ts   # Danh sách yêu thích local
│   │   │   ├── catalog-store.ts    # Bộ lọc catalog, sort state
│   │   │   └── chat-store.ts       # Chat UI state (open/close, messages)
│   │   │
│   │   ├── lib/                    # API client (Axios instance) + TanStack Query config
│   │   ├── routes/                 # React Router config, route paths constants
│   │   ├── hooks/                  # Custom hooks dùng chung (useDebounce, useAuth...)
│   │   ├── utils/                  # Helpers: format giá, ngày, localize, token
│   │   ├── types/                  # Global TypeScript type definitions
│   │   ├── locales/                # i18n: vi.json, en.json
│   │   └── styles/                 # SCSS global + Tailwind custom tokens
│   │
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── docs/                           # Tài liệu kỹ thuật
│   ├── ARCHITECTURE.md             # Chi tiết kiến trúc hệ thống
│   ├── DIAGRAMS.md                 # Sơ đồ: Use Case, Sequence, ERD, Flowchart
│   ├── NAMING_CONVENTION.md        # Quy ước đặt tên
│   ├── MODULE_GUIDE.md             # Hướng dẫn tạo module mới
│   ├── PRODUCTION_RUNBOOK.md       # Hướng dẫn deploy/backup/rollback
│   └── TESTING_COVERAGE_BASELINE.md # Test coverage snapshot
│
├── AGENT_RULES.md                  # 35 quy tắc phát triển (AI-assisted)
├── CLAUDE.md                       # Claude Code project context
└── README.md
```

---

## 6. Cài đặt & chạy

### 6.1. Yêu cầu phần mềm

| Phần mềm | Phiên bản | Ghi chú |
|----------|-----------|---------|
| Node.js | v20+ | Bắt buộc |
| MySQL | v8.0+ | Bắt buộc |
| pnpm | Latest | `npm install -g pnpm` |
| Redis | v5.x | Tùy chọn — nếu không có, hệ thống dùng in-memory fallback |

### 6.2. Clone repository

```bash
git clone https://github.com/MinhThang1009/E-commerce-website.git
cd e-commerce-website
```

### 6.3. Tạo database

```sql
CREATE DATABASE techstore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 6.4. Cấu hình Backend

Tạo file `backend/.env` từ mẫu:

```env
# Database
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=techstore
DB_HOST=127.0.0.1
DB_PORT=3306

# JWT
JWT_SECRET=your_jwt_secret_key_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI Chatbot
OPENROUTER_API_KEY=your_openrouter_api_key

# Thanh toán VNPay
VNP_TMN_CODE=your_vnpay_merchant_code
VNP_HASH_SECRET=your_vnpay_hash_secret
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html

# Thanh toán MoMo
MOMO_PARTNER_CODE=your_momo_partner_code
MOMO_ACCESS_KEY=your_momo_access_key
MOMO_SECRET_KEY=your_momo_secret_key

# Email
EMAIL_USERNAME=your_gmail@gmail.com
EMAIL_PASSWORD=your_app_password

# App
NODE_ENV=development
FRONTEND_URL=http://localhost:5175
REDIS_URL=redis://localhost:6379
```

### 6.5. Khởi động Backend

```bash
cd backend
pnpm install

# Chạy migration tạo schema
pnpm run db:migrate

# Nạp dữ liệu mẫu (60 sản phẩm)
pnpm run db:seed

# Index sản phẩm vào AI vector store
pnpm run ai:rebuild-vectors

# Khởi động server
pnpm dev
```

**Backend chạy tại:** `http://localhost:8888`  
**Swagger API Docs:** `http://localhost:8888/api-docs`

**Tài khoản Admin mặc định:**

| Trường | Giá trị |
|--------|---------|
| Email | `admin@example.com` |
| Mật khẩu | `Admin@123` |

### 6.6. Khởi động Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

**Frontend chạy tại:** `http://localhost:5175`

### 6.7. Scripts tham khảo

#### 6.7.1. Backend (từ `backend/`)

| Script | Lệnh | Mô tả |
|--------|------|-------|
| Dev server | `npm run dev` | Nodemon watch mode |
| Tests | `npm run test` | Jest + coverage |
| Tests nhanh | `npm run test:fast` | Không coverage |
| Lint | `npm run lint` | ESLint strict |
| DB migrate | `npm run db:migrate` | Chạy migrations |
| DB seed | `npm run db:seed` | Rebuild + seed data |
| DB verify | `npm run db:verify` | Kiểm tra schema |
| AI vectors | `npm run ai:rebuild-vectors` | Rebuild vector store |
| API docs | `npm run docs:openapi` | Generate Swagger |

#### 6.7.2. Frontend (từ `frontend/`)

| Script | Lệnh | Mô tả |
|--------|------|-------|
| Dev | `npm run dev` | Vite dev server |
| Build | `npm run build` | Production build |
| Typecheck | `npm run typecheck` | TypeScript check |
| Lint | `npm run lint` | ESLint |
| Format | `npm run format` | Prettier |
| Tests | `npm run test` | Jest |

---

## 7. Biến môi trường

### 7.1. Backend (`backend/.env`)

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `DB_USER` | ✅ | Username MySQL |
| `DB_PASSWORD` | ✅ | Password MySQL |
| `DB_NAME` | ✅ | Tên database (mặc định: `techstore`) |
| `JWT_SECRET` | ✅ | Khóa ký JWT access token (min 32 ký tự) |
| `JWT_REFRESH_SECRET` | ✅ | Khóa ký JWT refresh token |
| `OPENROUTER_API_KEY` | ⚠️ | API key OpenRouter để chạy AI Chatbot |
| `GOOGLE_CLIENT_ID` | ⚠️ | Google OAuth Client ID |
| `VNP_TMN_CODE` | ⚠️ | Merchant code VNPay (cần để test thanh toán) |
| `MOMO_PARTNER_CODE` | ⚠️ | Partner code MoMo (cần để test thanh toán) |
| `EMAIL_USERNAME` | ⚠️ | Gmail gửi email xác nhận |
| `HF_API_KEY` | ⚠️ | HuggingFace API key — embedding tiếng Việt cho AI Chatbot |
| `TRANSLATE_MODEL` | ❌ | Model dịch thuật qua OpenRouter (mặc định: `openai/gpt-oss-20b:free`) |
| `LOG_LEVEL` | ❌ | Mức log Winston (info/debug/warn/error), mặc định: `info` |
| `REDIS_URL` | ❌ | URL Redis — nếu thiếu, dùng in-memory cache |
| `FRONTEND_URL` | ✅ | URL frontend (mặc định: `http://localhost:5175`) |

> ✅ Bắt buộc | ⚠️ Cần cho tính năng cụ thể | ❌ Tùy chọn

#### 7.1.2. Thanh toán

| Biến | Mô tả |
|------|-------|
| `VNP_TMN_CODE` | Merchant code VNPay |
| `VNP_HASH_SECRET` | Hash secret VNPay (HMAC-SHA512) |
| `VNP_RETURN_URL` | URL redirect sau thanh toán VNPay |
| `VNP_IPN_URL` | IPN webhook URL VNPay |
| `MOMO_PARTNER_CODE` | Partner code MoMo |
| `MOMO_ACCESS_KEY` | Access key MoMo |
| `MOMO_SECRET_KEY` | Secret key MoMo |
| `MOMO_IPN_URL` | IPN webhook URL MoMo |
| `SEPAY_API_KEY` | API key SePay (bank transfer webhook) |

### 7.2. Frontend (`frontend/.env`)

| Biến | Mô tả |
|------|-------|
| `VITE_API_URL` | URL backend API (mặc định: `http://localhost:8888/api`) |

---

## 8. API Documentation

### 8.1. Swagger UI

Tự động sinh từ code, truy cập sau khi chạy backend:

```
http://localhost:8888/api-docs
```

### 8.2. Tổng hợp endpoints

| Module | Prefix | Endpoints | Ghi chú |
|--------|--------|-----------|---------|
| Auth | `/api/auth` | 10 | Public + rate limited |
| Users | `/api/users` | 7 | Yêu cầu authenticate |
| Cart | `/api/cart` | 9 | Optional auth (hỗ trợ guest) |
| Catalog — Products | `/api/products` | 17 | Public read, admin write |
| Catalog — Categories | `/api/categories` | 9 | Cache 1800s |
| Catalog — Brands | `/api/brands` | 6 | Public |
| Catalog — Collections | `/api/collections` | 6 | Public |
| Orders | `/api/orders` | 11 | Yêu cầu authenticate |
| Payment | `/api/payments` | 8 | VNPay + MoMo + SePay |
| Reviews | `/api/reviews` | 8 | Yêu cầu mua hàng để review |
| Wishlist | `/api/wishlists` | 5 | Yêu cầu authenticate |
| Loyalty | `/api/loyalty` | 2 | Yêu cầu authenticate |
| AI Chatbot | `/api/chatbot` | 4 | Rate limit 20 req/60s |
| Inventory | `/api/inventory` | 2 | Admin only |
| Search History | `/api/search-histories` | 4 | Optional auth |
| Upload | `/api/uploads` | 3 | Yêu cầu authenticate |
| Warranty | `/api/warranty-packages` | 6 | Public read, admin write |
| Attributes | `/api/attributes` | 13 | Admin write |
| Discount Codes | `/api/discount-codes` | 1 | Public apply |
| Content | `/api/banners`, `/api/news`, etc. | 19 | Public read, admin write |
| Admin | `/api/admin` | 38 | Admin only |
| Images | `/api/images` | 9 | Yêu cầu authenticate |

**Tổng:** 197 endpoints (xác nhận từ Swagger spec)

### 8.3. Xác thực

- **Access Token:** JWT, TTL 15 phút, gửi qua `Authorization: Bearer <token>`
- **Refresh Token:** JWT rotate, TTL 7 ngày, lưu trong httpOnly cookie
- **Family ID Pattern:** Phát hiện token reuse attack, revoke toàn bộ family khi phát hiện

### 8.4. Route phân quyền

| Type | Middleware | Áp dụng |
|------|-----------|---------|
| `public` | Không có auth | Product read, search, news |
| `optionalAuth` | Token nếu có | Cart, product detail |
| `authenticate` | Bắt buộc token | Orders, profile, wishlist |
| `authorize('admin')` | Token + role admin | Product create/update, order manage |
| `adminAuthenticate` | Token admin đặc biệt | Admin dashboard, audit |

---

## 9. Kiểm thử

```bash
# Chạy toàn bộ test suite
cd backend && pnpm test

# Chạy không coverage (nhanh hơn)
cd backend && pnpm test:fast

# Typecheck frontend
cd frontend && pnpm typecheck
```

| Hạng mục | Kết quả |
|----------|---------|
| Test suites | 171 suites |
| Test cases | 4212 tests |
| Coverage | ≥99% (threshold jest.config.js) |
| Thời gian chạy | ~15 giây |

---

## 10. Trạng thái dự án

| Hạng mục | Trạng thái | Chi tiết |
|----------|------------|---------|
| **Schema** | ✅ Hoàn thành | MySQL chuẩn: snake_case, FK/UQ/IDX naming, 19 CHECK constraints, DECIMAL(15,2), soft delete 13 tables |
| **Test suite** | ✅ 100% pass | 171 suites / 4212 tests |
| **CI/CD** | ✅ Hoạt động | GitHub Actions: lint + typecheck + test + build |
| **Security** | ✅ | Helmet CSP, rate limit 5 cấp độ, JWT + OTP 2FA, input sanitization |
| **AI Chatbot** | ✅ | RAG pipeline + vector store + embedding (multilingual-e5-large) |
| **Thanh toán** | ✅ | VNPay + MoMo sandbox integration |
| **i18n** | ✅ | Tiếng Việt + Tiếng Anh |

---

## 11. CI/CD

### 11.1. GitHub Actions

Workflow: `.github/workflows/ci.yml`

**Trigger:** Push lên `main`, `phase-*`, `feat/*`, `fix/*` (bỏ qua thay đổi `.md`, `docs/`)

| Job | Runtime | Timeout | Steps |
|-----|---------|---------|-------|
| Backend | Node 22 | 20 phút | Lint → Audit → Test+Coverage → Enforce thresholds → Upload artifact |
| Frontend | Node 22 | 15 phút | Lint → Typecheck → Audit → Build → Bundle size check → Upload artifact |
| Summary | — | — | Báo cáo kết quả 2 jobs |

### 11.2. Coverage Thresholds (Backend)

| Metric | Ngưỡng tối thiểu |
|--------|-----------------|
| Statements | ≥ 97% |
| Lines | ≥ 97% |
| Branches | ≥ 85% |
| Functions | ≥ 95% |

### 11.3. Bundle Size Limit (Frontend)

- **Giới hạn:** ≤ 10 MB (dist/ directory)
- **Lý do:** Đảm bảo performance, kiểm soát code splitting

### 11.4. Artifacts

| Artifact | Retention | Nội dung |
|---------|----------|---------|
| `backend-coverage` | 7 ngày | JSON coverage report |
| `frontend-dist` | 3 ngày | Production build |

---

## Tài liệu

| Tài liệu | Mô tả |
|----------|-------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Chi tiết kiến trúc hệ thống, data flow |
| [`docs/MODULE_GUIDE.md`](docs/MODULE_GUIDE.md) | Hướng dẫn tạo module mới |
| [`docs/NAMING_CONVENTION.md`](docs/NAMING_CONVENTION.md) | Quy ước đặt tên toàn dự án |
| [`docs/PRODUCTION_RUNBOOK.md`](docs/PRODUCTION_RUNBOOK.md) | Deploy, backup, rollback |
| [`docs/TESTING_COVERAGE_BASELINE.md`](docs/TESTING_COVERAGE_BASELINE.md) | Test coverage baseline |
| [`AGENT_RULES.md`](AGENT_RULES.md) | 35 quy tắc phát triển |

---

*Dự án phát triển phục vụ mục đích học thuật — Khóa luận tốt nghiệp.*
