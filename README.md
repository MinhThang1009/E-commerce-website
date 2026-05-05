# E-Commerce Website — Hướng dẫn cài đặt & chạy dự án

[![CI](https://github.com/MinhThang1009/E-commerce-website/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MinhThang1009/E-commerce-website/actions/workflows/ci.yml)

## Giới thiệu

Website thương mại điện tử bán thiết bị công nghệ, xây dựng theo mô hình full-stack với backend REST API và frontend SPA. Dự án khóa luận tốt nghiệp — single-instance deployment, đánh giá qua demo + defense.

## Status

| Hạng mục | State | Chi tiết |
|---|---|---|
| **Schema compliance** | ✅ 100% | MySQL standard: snake_case, fk_*/uq_*/idx_* naming, 19 CHECK constraints, DECIMAL(15,2) unified, soft delete cho 13 tables |
| **Test suite** | 411 tests | BE 391 (jest, 31 suites, ~13s) + FE 20 (jest CommonJS) |
| **BE coverage** | 31.67% overall | services/payment 88%, utils 99%, routes 99% integration |
| **CI/CD** | ✅ GitHub Actions | Lint + typecheck + test + build trên mỗi push |
| **Security** | npm audit: 0 high/critical | Helmet CSP, rate limit 5 levels, JWT + OTP 2FA |
| **Architecture tooling** | ✅ Modular Monolith ready | Module generator, pre-commit hook audit, ESLint custom rules (Phase 42 Step 19) |

## Documentation

Tài liệu chuyên đề trong [`docs/`](docs/):
- [`NAMING_CONVENTION.md`](docs/NAMING_CONVENTION.md) — naming standard backend/frontend/DB/API/git
- [`naming/BASIC.md`](docs/naming/BASIC.md), [`MODERN_TS_2025.md`](docs/naming/MODERN_TS_2025.md), [`DOMAIN_GLOSSARY.md`](docs/naming/DOMAIN_GLOSSARY.md) — 3 file con
- [`GLOSSARY_EXCEPTIONS.md`](docs/GLOSSARY_EXCEPTIONS.md) — false positives + nuanced cases
- [`PRODUCTION_RUNBOOK.md`](docs/PRODUCTION_RUNBOOK.md) — backup/restore/deploy/rollback runbook + bundle size notes
- [`TESTING_COVERAGE_BASELINE.md`](docs/TESTING_COVERAGE_BASELINE.md) — coverage snapshot + Phase 44 roadmap

`AGENT_RULES.md` — 35 rules áp dụng mọi phase (đọc đầu mỗi session).



**Công nghệ sử dụng:**

| Thành phần | Công nghệ |
|---|---|
| Backend | Node.js, Express.js, Sequelize ORM |
| Frontend | React 18, TypeScript, Vite |
| Database | MySQL 8.0 |
| UI Library | Ant Design, Tailwind CSS |
| Thanh toán | Stripe, VNPay, MoMo |
| AI Chatbot | Google Gemini API |
| Realtime | Socket.IO |
| Email | Nodemailer (Gmail SMTP) |

---

## Cấu trúc thư mục

```
.
├── backend/          # Server Node.js + Express
│   ├── src/
│   │   ├── app.js               # Khởi tạo Express app
│   │   ├── server.js            # Entry point khởi động server
│   │   ├── config/              # Cấu hình database, socket, swagger
│   │   ├── controllers/         # Xử lý request/response (26 controllers)
│   │   ├── models/              # Định nghĩa bảng database - Sequelize (38 models)
│   │   ├── routes/              # Khai báo API routes (27 files)
│   │   ├── services/            # Business logic, tích hợp bên ngoài (13 services)
│   │   ├── middlewares/         # Auth, error handler, rate limiter (6 files)
│   │   ├── validators/          # Validation schema cho request (9 files)
│   │   ├── migrations/          # Lịch sử thay đổi schema database (19 files)
│   │   └── utils/               # Tiện ích dùng chung
│   ├── data/                    # Dữ liệu database (SQL schema, seed data)
│   │   ├── migration_full.sql   # Script tạo toàn bộ schema
│   │   └── data_new.sql         # Dữ liệu mẫu (45 sản phẩm)
│   ├── scripts/                 # Script quản lý database (seed, cleanup, verify)
│   ├── uploads/                 # Ảnh upload từ người dùng
│   ├── .env                     # Biến môi trường (không commit lên git)
│   └── package.json
│
├── frontend/         # Giao diện React + TypeScript
│   ├── src/
│   │   ├── App.tsx              # Root component
│   │   ├── main.tsx             # Entry point
│   │   ├── components/          # Các component tái sử dụng
│   │   │   ├── admin/           # Component dành cho trang quản trị
│   │   │   ├── auth/            # Component xác thực (login, protected route)
│   │   │   ├── common/          # Component dùng chung (Button, Modal, Input...)
│   │   │   ├── features/        # Component theo tính năng (ProductCard, FilterPanel...)
│   │   │   ├── layout/          # Header, Footer, MainLayout
│   │   │   ├── product/         # Form tạo/sửa sản phẩm
│   │   │   └── payment/         # Form thanh toán Stripe, QR chuyển khoản
│   │   ├── pages/               # Các trang của website (54 trang)
│   │   │   ├── admin/           # Trang quản trị (dashboard, sản phẩm, đơn hàng...)
│   │   │   └── *.tsx            # Trang người dùng (home, shop, cart, checkout...)
│   │   ├── services/            # Gọi API backend (20+ files)
│   │   ├── hooks/               # Custom React hooks (16 hooks)
│   │   ├── store/               # Redux state management
│   │   ├── routes/              # Cấu hình React Router
│   │   ├── types/               # TypeScript type definitions
│   │   ├── contexts/            # React contexts
│   │   ├── locales/             # File dịch đa ngôn ngữ (i18n)
│   │   └── styles/              # CSS toàn cục
│   ├── .env                     # Biến môi trường frontend
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md
```

---

## Yêu cầu phần mềm

| Phần mềm | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | v18+ | Bắt buộc |
| MySQL | v8.0+ | Bắt buộc |
| pnpm | Latest | `npm install -g pnpm` |

---

## Cài đặt & chạy

### 1. Tạo database

Mở MySQL client và chạy:

```sql
CREATE DATABASE techstore;
```

### 2. Cấu hình môi trường Backend

Mở file `backend/.env` và điền thông tin MySQL:

```env
DB_USER=root
DB_PASSWORD=       # Mật khẩu MySQL của bạn
DB_NAME=techstore
DB_HOST=127.0.0.1
DB_PORT=3306
```

### 3. Chạy Backend

```powershell
cd backend

pnpm install

# Tạo bảng từ migration
pnpm db:migrate

# Nạp dữ liệu mẫu
npm run db:seed

# Khởi động server
pnpm dev
```

> Backend chạy tại: `http://localhost:8888`  
> API Docs (Swagger): `http://localhost:8888/api-docs`

**Tài khoản Admin mặc định:**

| | |
|---|---|
| Email | `admin@example.com` |
| Mật khẩu | `Admin@123` |

### 4. Chạy Frontend

```powershell
cd frontend

pnpm install

pnpm dev
```

> Frontend chạy tại: `http://localhost:5175`

---

## Các tính năng chính

**Người dùng:**
- Đăng ký, đăng nhập (JWT), đăng nhập Google OAuth
- Xem sản phẩm, tìm kiếm, lọc theo danh mục / thương hiệu
- Giỏ hàng, thanh toán (Stripe, VNPay, MoMo, chuyển khoản)
- Theo dõi đơn hàng, đánh giá sản phẩm
- Danh sách yêu thích, tích điểm thành viên
- Chat hỗ trợ với AI (Google Gemini)

**Quản trị (Admin):**
- Dashboard thống kê doanh thu, đơn hàng, người dùng
- Quản lý sản phẩm (CRUD, biến thể, hình ảnh, bảo hành)
- Quản lý đơn hàng, người dùng, danh mục, thương hiệu
- Quản lý banner, tin tức, mã giảm giá
- Gửi email marketing, theo dõi hỗ trợ khách hàng

---

## Biến môi trường quan trọng

| Biến | Mô tả |
|---|---|
| `DB_NAME` | Tên database MySQL |
| `JWT_SECRET` | Khóa bí mật ký JWT token |
| `STRIPE_SECRET_KEY` | API key Stripe (test key) |
| `GEMINI_API_KEY` | API key Google Gemini AI |
| `VNP_TMN_CODE` | Mã merchant VNPay |
| `MOMO_PARTNER_CODE` | Mã partner MoMo |
| `EMAIL_USERNAME` | Gmail dùng gửi email |
| `FRONTEND_URL` | URL frontend (mặc định: http://localhost:5175) |
