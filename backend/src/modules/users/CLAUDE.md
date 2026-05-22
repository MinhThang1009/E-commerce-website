# Users Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Pattern (DI đầy đủ)](#12-pattern-di-đầy-đủ)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 updateProfile](#31-updateprofile)
  - [3.2 changePassword](#32-changepassword)
  - [3.3 addAddress](#33-addaddress)
  - [3.4 deleteAddress](#34-deleteaddress)
  - [3.5 setDefaultAddress](#35-setdefaultaddress)
- [4. API Endpoints](#4-api-endpoints)
  - [4.1 Routes](#41-routes)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on (module này dùng)](#51-depends-on-module-này-dùng)
  - [5.2 Used by (module khác dùng module này)](#52-used-by-module-khác-dùng-module-này)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Quản lý profile cá nhân (thông tin, mật khẩu, avatar URL) và địa chỉ giao hàng. Avatar upload được delegate sang `upload` module — module này chỉ lưu URL string.

## 1.2 Pattern (DI đầy đủ)

```js
const repo = new SequelizeUsersRepository({ User, Address });
const service = new UsersService({ usersRepository: repo, eventBus, logger });
const controller = new UsersController({ usersService: service });
```

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/users/
  module.js                                    — factory DI
  routes.js                                    — 7 routes, tất cả require authenticate
  controllers/
    users-controller.js                        — thin HTTP wrapper, dùng toUserDto/toAddressDto
    users-controller.test.js
  services/
    users-service.js                           — ~143 lines: profile + address CRUD
    users-service.test.js
    users-service.unit.test.js
  repositories/
    i-users-repository.js
    sequelize-users-repository.js
    users-repository.test.js
  validators/
    users-validator.js                         — updateProfileSchema, changePasswordSchema, addressSchema (Zod)
    users-validator.test.js
  dtos/
    users-dto.js                               — toUserDto, toAddressDto
```

---

# 3. Business Logic Chính

## 3.1 updateProfile

Update `firstName`, `lastName`, `phone`, `avatar` (URL string). Chỉ cập nhật field nào được cung cấp (truthy check — `undefined` giữ nguyên giá trị cũ).

## 3.2 changePassword

1. Verify `currentPassword` bằng `user.comparePassword()` (bcrypt)
2. `user.password = newPassword` → Sequelize `beforeSave` hook hash tự động
3. Ghi timestamp vào Redis: `pw_changed:{userId}` = unix seconds (TTL 30 ngày) — để invalidate JWT tokens cũ
4. Redis fail (không có connection) → log warn, tiếp tục (không rollback)

## 3.3 addAddress

- Address đầu tiên của user → auto-set `isDefault = true`
- Nếu request `isDefault = true` → `clearDefaultAddresses(userId)` trước, rồi create

## 3.4 deleteAddress

- Xóa address, verify ownership
- Nếu address bị xóa là default → tìm address mới nhất còn lại (`findLatestAddressByUserId`) → promote làm default
- **Không throw lỗi khi xóa default address** (khác với CLAUDE.md cũ — code thực tế cho phép xóa và auto-promote)

## 3.5 setDefaultAddress

`clearDefaultAddresses(userId)` (set all `isDefault = false`) → set `address.isDefault = true`.

---

# 4. API Endpoints

## 4.1 Routes

Base path: `/api/users`. Tất cả require `authenticate` (global middleware ở đầu router).

| Method | Path                     | Auth         | Mô tả                                                               |
| ------ | ------------------------ | ------------ | ------------------------------------------------------------------- |
| PUT    | `/profile`               | authenticate | Cập nhật thông tin cá nhân (firstName, lastName, phone, avatar URL) |
| POST   | `/change-password`       | authenticate | Đổi mật khẩu                                                        |
| GET    | `/addresses`             | authenticate | Danh sách địa chỉ giao hàng                                         |
| POST   | `/addresses`             | authenticate | Thêm địa chỉ mới                                                    |
| PUT    | `/addresses/:id`         | authenticate | Cập nhật địa chỉ                                                    |
| DELETE | `/addresses/:id`         | authenticate | Xóa địa chỉ                                                         |
| PATCH  | `/addresses/:id/default` | authenticate | Đặt làm địa chỉ mặc định                                            |

**Không có `GET /me`:** `routes.js` không có endpoint `/me`. Profile lấy qua `auth` module (`GET /api/auth/me`) hoặc từ JWT payload trên client.

**Body `PUT /profile`:** `{ firstName?, lastName?, phone?, avatar? }` (tất cả optional)
**Body `POST /change-password`:** `{ currentPassword, newPassword, confirmPassword }` (newPassword min 6 chars, confirm phải khớp)
**Body address:** `{ firstName, lastName, address1, city, state, zip, country, company?, address2?, phone?, isDefault? }`

---

# 5. Dependencies

## 5.1 Depends on (module này dùng)

Inject từ `app.js`:

- **Models:** `User`, `Address`
- **eventBus, logger**
- **Redis** (optional, `require('@config/redis')` trực tiếp trong `changePassword()` — không inject)

## 5.2 Used by (module khác dùng module này)

- `auth` — share `User` model (auth tạo/query User, users module update User — không gọi service của nhau)
- `orders` — `shippingAddress` khi tạo đơn (đọc trực tiếp từ DB, không gọi users service)
- `admin` — user management (gọi qua admin service)

---

# 6. Gotchas & Edge Cases

- **Không có `GET /me`:** Endpoint `/me` không tồn tại trong module này. CLAUDE.md cũ liệt kê sai. Profile lấy từ auth module hoặc client-side JWT decode.
- **`changePassword` direct require Redis:** `require('@config/redis')` được gọi trực tiếp trong service body, không inject. Redis optional — nếu fail thì log warn và tiếp tục.
- **`deleteAddress` auto-promote:** Xóa default address → address mới nhất còn lại trở thành default. Không throw error. FE không cần confirm hay set address khác trước.
- **Avatar URL flow:** FE upload file → `POST /api/uploads/avatars/single` → nhận URL → gọi `PUT /api/users/profile` với `{ avatar: url }`. Module users không xử lý file.
- **Password hashing qua Sequelize hook:** `user.password = newPassword` và `saveUser()` → hook `beforeSave` trên User model tự hash. Không hash thủ công trong service.
- **`auth` và `users` share User model nhưng không circular:** Hai module cùng dùng `User` model inject từ `app.js`. Không import service của nhau.

---

# 7. Tests

| File                                            | Loại        | Mô tả                                    |
| ----------------------------------------------- | ----------- | ---------------------------------------- |
| `services/users-service.test.js`                | Unit        | Happy path: profile, password, addresses |
| `services/users-service.unit.test.js`           | Unit        | Isolated unit tests                      |
| `controllers/users-controller.test.js`          | Unit        | HTTP layer, DTO transform                |
| `repositories/users-repository.test.js`         | Unit        | Repository queries                       |
| `validators/users-validator.test.js`            | Unit        | Zod schema validation                    |
| `src/__integration__/users.integration.test.js` | Integration | DB integration                           |
| `src/__api__/users.api.test.js`                 | HTTP        | End-to-end HTTP                          |
