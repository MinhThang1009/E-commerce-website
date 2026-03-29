# 🛒 E-Commerce Website - Hướng dẫn cài đặt & chạy dự án

## 📦 Yêu cầu phần mềm

| Phần mềm | Phiên bản | Ghi chú |
|----------|-----------|---------|
| [Node.js](https://nodejs.org) | v18+ | Bắt buộc |
| [MySQL](https://dev.mysql.com/downloads/) | v8.0+ | Bắt buộc |
| [Redis](https://redis.io) | v7+ | Bắt buộc (Windows dùng [Memurai](https://www.memurai.com/)) |
| pnpm | Latest | `npm install -g pnpm` |

---

## 🗄️ 1. Cài đặt Database (MySQL)

### Tạo database

Mở MySQL client (MySQL Workbench, HeidiSQL, hoặc terminal) và chạy:

```sql
CREATE DATABASE websitebanhangmini;
```

### Cấu hình kết nối

Mở file `be/.env` và điền thông tin MySQL của bạn:

```env
DB_USER=root
DB_PASSWORD=       # Mật khẩu MySQL của bạn
DB_NAME=websitebanhangmini
DB_HOST=127.0.0.1
DB_PORT=3306
```

---

## 🔧 2. Cài đặt & chạy Backend

```powershell
# Di chuyển vào thư mục backend
cd be

# Cài dependencies
pnpm install

# Chạy migration để tạo bảng
pnpm db:migrate

# Xóa dữ liệu cũ (nếu có) và nạp dữ liệu mẫu mới (70 sản phẩm + 150 biến thể đa dạng)
npm run db:cleanup    # Dọn dẹp dữ liệu cũ (Sản phẩm, Đơn hàng, Tin tức...)
npm run db:seed       # Nạp 70 sản phẩm mẫu (iPhone, Samsung, MacBook, RTX Laptop, v.v.)
npm run db:verify     # Kiểm tra lại số lượng dữ liệu sau khi seed

# Hoặc dùng lệnh gộp (Reset toàn bộ dữ liệu về trạng thái mẫu)
npm run db:reset

# Khởi động server (development)
pnpm dev
```

> ✅ Backend chạy tại: `http://localhost:8888`  
> 📖 API Docs (Swagger): `http://localhost:8888/api-docs`

### Tài khoản Admin mặc định

| | |
|--|--|
| Email | `admin@example.com` |
| Mật khẩu | `Admin@123` |

---

## 🎨 3. Cài đặt & chạy Frontend

```powershell
# Di chuyển vào thư mục frontend
cd fe

# Cài dependencies
pnpm install

# Khởi động dev server
pnpm dev
```

> ✅ Frontend chạy tại: `http://localhost:5175`
# E-commerce-wesbite
# E-commerce-wesbite
