# Loyalty Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 DI Pattern](#12-di-pattern)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 getLoyaltyInfo](#31-getloyaltyinfo)
  - [3.2 redeemPoints](#32-redeempoints)
  - [3.3 earnPoints — internal, không có HTTP endpoint](#33-earnpoints--internal-không-có-http-endpoint)
  - [3.4 Tier thành viên](#34-tier-thành-viên)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on](#51-depends-on)
  - [5.2 Used by](#52-used-by)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Quản lý chương trình tích điểm khách hàng: xem điểm hiện tại và lịch sử giao dịch, đổi điểm lấy giảm giá khi checkout. Điểm được cộng **sau khi đơn hàng chuyển sang `delivered`** — không cộng khi đặt hàng hay thanh toán. Đây là business rule cố định.

## 1.2 DI Pattern

DI đầy đủ (không phải Singleton):

```js
const repo = new SequelizeLoyaltyRepository({ User, LoyaltyHistory, sequelize });
const service = new LoyaltyService({ loyaltyRepository: repo, eventBus, logger });
const controller = new LoyaltyController({ loyaltyService: service });
```

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/loyalty/
  module.js                                    — factory DI: repo → service → controller → router
  routes.js                                    — 2 routes: GET / và POST /redeem
  controllers/
    loyalty-controller.js                      — thin HTTP wrapper
    loyalty-controller.test.js
  services/
    loyalty-service.js                         — getLoyaltyInfo, redeemPoints (~85 lines)
    loyalty-service.test.js
    loyalty-service.redeem.test.js
  repositories/
    i-loyalty-repository.js                    — interface
    sequelize-loyalty-repository.js            — User.loyaltyPoints + LoyaltyHistory queries
    loyalty-repository.test.js
  dtos/
    loyalty-dto.js                             — toLoyaltyDto() (chưa dùng thực tế, có TODO)
  validators/
    loyalty-validator.js                       — redeemPointsSchema (Zod): points integer > 0
```

---

# 3. Business Logic Chính

## 3.1 getLoyaltyInfo

Lấy `user.loyaltyPoints` và `LoyaltyHistory` paginated (DESC `createdAt`). Tính tier dựa trên `loyaltyPoints` hiện tại. Query params: `page` (default 1), `limit` (default 10).

## 3.2 redeemPoints

Đổi điểm lấy discount value:

```
1. sequelize.transaction()
2. SELECT FOR UPDATE trên User row  ← chống race condition
3. Validate user.loyaltyPoints >= points  → 400 nếu thiếu
4. user.decrement('loyaltyPoints', points)
5. LoyaltyHistory.create({ type: 'spend', points: -N })
6. user.reload() trong transaction
7. Trả về { pointsRedeemed, remainingPoints }
```

## 3.3 earnPoints — internal, không có HTTP endpoint

Logic tích điểm **không nằm trong loyalty service** mà được thực hiện **inline** trong `orders-service.js` khi admin cập nhật status sang `delivered` (hoặc khi user `confirmReceived`):

```js
// orders-service.js — updateOrderStatus() và confirmReceived()
const pointsEarned = Math.floor(parseFloat(order.subtotal) / constants.POINTS_EARN_RATE);
repo.updateUserPoints(user, user.loyaltyPoints + pointsEarned);
repo.createLoyaltyHistory({ type: 'earn', points: pointsEarned, orderId });
order.pointsEarned = pointsEarned;
```

Không có method `earnPoints` trên `LoyaltyService`. Loyalty service chỉ expose `getLoyaltyInfo` và `redeemPoints`.

## 3.4 Tier thành viên

Dựa trên `loyaltyPoints` **hiện tại** của user (không phải tổng lịch sử):

| Tier     | Điểm   |
| -------- | ------ |
| Bronze   | < 10   |
| Silver   | 10–49  |
| Gold     | 50–199 |
| Platinum | ≥ 200  |

User đổi điểm → `loyaltyPoints` giảm → tier có thể xuống.

---

# 4. API Endpoints

Base path: `/api/loyalty`. Tất cả require `authenticate`.

| Method | Path      | Auth         | Mô tả                                                  |
| ------ | --------- | ------------ | ------------------------------------------------------ |
| GET    | `/`       | authenticate | Xem điểm hiện tại, tier, lịch sử giao dịch (paginated) |
| POST   | `/redeem` | authenticate | Đổi điểm lấy giảm giá                                  |

**Query params `GET /`:** `page` (default 1), `limit` (default 10)

**Body `POST /redeem`:** `{ points: number (int, > 0) }` — validated bởi `redeemPointsSchema`

---

# 5. Dependencies

## 5.1 Depends on

Inject từ `app.js`:

- **Models:** `User` (field `loyaltyPoints`), `LoyaltyHistory`
- **sequelize:** cho `sequelize.transaction()` trong `redeemPoints`
- **eventBus, logger:** inject nhưng service hiện tại không dùng

## 5.2 Used by

- `orders` — logic tích điểm inline trong `orders-service.js` khi status → `delivered`. Loyalty module không cần được inject vào orders module — orders tự thao tác trực tiếp trên `User` và `LoyaltyHistory` model qua `ordersRepository`.
- `admin` — hiển thị `loyaltyPoints` của users trong dashboard

---

# 6. Gotchas & Edge Cases

- **Điểm cộng sau DELIVERED, không phải PAID:** Business rule cố định. Nếu user trả bằng COD, điểm chưa được cộng cho đến khi admin cập nhật status sang `delivered`. Đây là đúng behavior.
- **`earnPoints` không tồn tại trên LoyaltyService:** Logic tích điểm là inline trong `orders-service.js`. Không nên thêm method `earnPoints` vào loyalty service trừ khi có yêu cầu rõ ràng.
- **SELECT FOR UPDATE trong `redeemPoints`:** `sequelize.transaction()` + `lock: t.LOCK.UPDATE` bắt buộc để tránh race condition khi 2 requests đổi điểm đồng thời. Không bỏ.
- **`LoyaltyHistory.type` values:** `'earn'` (tích điểm từ đơn hàng), `'spend'` (đổi điểm khi checkout hoặc redeem), `'refund'` (hoàn điểm khi hủy đơn hoặc thu hồi điểm đã trao khi đơn bị cancel).
- **DTO chưa hoàn chỉnh:** `loyalty-dto.js` có `// TODO: pick fields`. Controller trả về plain object từ service, không qua DTO transform. Không sửa DTO cho đến khi có yêu cầu cụ thể.
- **Tier tính từ điểm hiện tại:** `getLoyaltyInfo` tính tier từ `user.loyaltyPoints` tại thời điểm call. Không có tier history.

---

# 7. Tests

| File                                              | Loại        | Mô tả                               |
| ------------------------------------------------- | ----------- | ----------------------------------- |
| `services/loyalty-service.test.js`                | Unit        | `getLoyaltyInfo`, tier calculation  |
| `services/loyalty-service.redeem.test.js`         | Unit        | `redeemPoints` flow, race condition |
| `controllers/loyalty-controller.test.js`          | Unit        | HTTP layer                          |
| `repositories/loyalty-repository.test.js`         | Unit        | Repository queries                  |
| `src/__integration__/loyalty.integration.test.js` | Integration | DB integration                      |
| `src/__integration__/loyalty.http.test.js`        | HTTP        | End-to-end HTTP                     |
