# Search History Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Pattern (Singleton)](#12-pattern-singleton)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 saveSearch](#31-savesearch)
  - [3.2 getHistory](#32-gethistory)
  - [3.3 deleteOne / clearAll](#33-deleteone--clearall)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on](#51-depends-on)
  - [5.2 Used by](#52-used-by)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Ghi lại keyword tìm kiếm của user (cả guest lẫn logged-in) để hiển thị gợi ý tìm kiếm và cung cấp context cho AI chatbot khi tư vấn sản phẩm. Có dedup 1 giờ để tránh duplicate entries liên tục.

## 1.2 Pattern (Singleton)

Module nhỏ nhất trong codebase. Singleton — không nhận DI injection, không factory function:

```js
// module.js
module.exports = () => ({
  basePath: '/search-histories',
  router: require('@modules/search-history/routes'), // singleton router
  subscribeEvents() {},
});
```

Service và repository được `require()` trực tiếp, không inject qua constructor. `routes.js` export `express.Router()` instance trực tiếp (không phải factory function).

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/search-history/
  module.js                                    — singleton, không nhận deps
  routes.js                                    — singleton router (4 routes, không phải factory)
  controllers/
    search-history-controller.js               — plain functions (không phải class)
    search-history-controller.test.js
  services/
    search-history-service.js                  — plain functions: saveSearch, getHistory, deleteOne, clearAll
    search-history-service.test.js
  repositories/
    i-search-history-repository.js
    sequelize-search-history-repository.js     — require SearchHistory model trực tiếp
  validators/
    search-history-validator.js                — saveSearchSchema: keyword (string 1-500 chars)
  dtos/
    search-history-dto.js
```

---

# 3. Business Logic Chính

## 3.1 saveSearch

```js
saveSearch({ keyword, resultsCount, sessionId, userId });
```

1. Tính `since = now - 1 giờ`
2. `findDuplicate({ keyword, userId || sessionId, since })` — tìm bản ghi cùng keyword trong 1 giờ:
   - Nếu `userId` có → where `userId`
   - Nếu không → where `sessionId`
3. Nếu duplicate tồn tại → return `{ created: false, data: existing }`
4. Nếu không → `SearchHistory.create(...)` → return `{ created: true, data }`

Response HTTP: 201 nếu `created = true`, 200 nếu duplicate.

## 3.2 getHistory

```js
getHistory({ userId, limit = 10 })
```

Lấy recent searches của user đăng nhập, order DESC `createdAt`. Giới hạn `limit` (default 10, không có max cap).

## 3.3 deleteOne / clearAll

```js
deleteOne({ id, userId }); // verify ownership, destroy
clearAll({ userId }); // destroy all records của user
```

`deleteOne` tìm `findOneByUserAndId` — 404 nếu không tìm thấy (bao gồm không phải owner).

---

# 4. API Endpoints

Base path: `/api/search-histories`

| Method | Path   | Auth                                        | Mô tả                                                |
| ------ | ------ | ------------------------------------------- | ---------------------------------------------------- |
| POST   | `/`    | optional (không báo lỗi nếu không có token) | Lưu keyword (guest dùng sessionId, user dùng userId) |
| GET    | `/`    | authenticate                                | Lấy lịch sử tìm kiếm của user                        |
| DELETE | `/:id` | authenticate                                | Xóa 1 entry                                          |
| DELETE | `/`    | authenticate                                | Xóa toàn bộ lịch sử                                  |

**`POST /` — auth behavior đặc biệt:** `authenticate` middleware được gọi nhưng khi fail (không có token) sẽ không reject — flow tiếp tục với `req.user = undefined`. Controller lấy `userId = req.user ? req.user.id : null`. Guest flow → lưu với `sessionId` từ request body.

**Body `POST /`:** `{ keyword: string (1-500 chars), sessionId?: string }` — validated bởi `saveSearchSchema`

**Query params `GET /`:** `limit` (default 10)

---

# 5. Dependencies

## 5.1 Depends on

Singleton — không nhận inject từ `app.js`. Module require trực tiếp:

- `sequelize-search-history-repository.js` (singleton instance)
- `SearchHistory` model — required trực tiếp trong repository (`require('@models')`)

## 5.2 Used by

- `ai` — query search history của user để enrich chatbot context
- Frontend search bar — `GET /` để hiển thị recent searches

---

# 6. Gotchas & Edge Cases

- **Singleton, không phải DI:** Không nhận dependencies qua factory. Không refactor sang DI trừ khi có lý do rõ ràng.
- **Dedup window 1 giờ:** Cùng keyword trong 1 giờ → không tạo bản ghi mới (trả về existing). Đây là behavior đúng — không phải bug nếu history không tăng khi search liên tục.
- **Guest flow:** Guest lưu với `sessionId` (từ request body). `GET /` yêu cầu authenticate → guest không xem được history.
- **Không có max-entries-per-user limit:** Chỉ có dedup 1 giờ. Không có logic giới hạn 50 entries/user hay tương tự.
- **Cron cleanup (global):** `src/jobs/cleanup.js` (daily 2AM) xóa `SearchHistory` records cũ theo ngày — áp dụng toàn bộ, không per-user.
- **`routes.js` là singleton router:** Export `express.Router()` trực tiếp, không phải factory function. Khác với các modules DI khác export `({ controller }) => Router`.
- **`resultsCount` optional:** Controller đọc từ `req.body.resultsCount` nhưng không required trong validator. Có thể `null` trong DB.

---

# 7. Tests

| File                                                     | Loại        | Mô tả                                |
| -------------------------------------------------------- | ----------- | ------------------------------------ |
| `services/search-history-service.test.js`                | Unit        | saveSearch dedup, getHistory, delete |
| `controllers/search-history-controller.test.js`          | Unit        | HTTP layer                           |
| `routes.test.js`                                         | Unit        | Route definitions                    |
| `src/__integration__/search-history.integration.test.js` | Integration | DB integration                       |
