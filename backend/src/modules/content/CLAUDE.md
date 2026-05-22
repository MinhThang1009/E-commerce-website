# Content Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Pattern (DI đầy đủ)](#12-pattern-di-đầy-đủ)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 Contact/Feedback](#31-contactfeedback)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on](#51-depends-on)
  - [5.2 Used by](#52-used-by)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Xử lý feedback/liên hệ từ khách hàng: gửi email thông báo cho admin và tạo `Feedback` record trong DB.

**Lưu ý:** Banner management và News management đã bị xóa hoàn toàn khỏi module này. Content module chỉ còn 1 endpoint: `POST /api/contact/feedback`.

## 1.2 Pattern (DI đầy đủ)

Module dùng DI qua constructor injection. `routes.js` là single file (không phải thư mục `routes/`).

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/content/
  module.js
  routes.js                              — single file, export { contact }
  controllers/
    content-controller.js                — handler cho contact/feedback
  services/
    content-service.js                   — sendFeedback logic + email notify
  repositories/
    sequelize-content-repository.js      — CRUD Feedback
    i-content-repository.js              — interface
  validators/
    content-validator.js                 — Zod: feedbackSchema
  dtos/
    content-dto.js                       — pass-through DTOs
  CLAUDE.md
```

---

# 3. Business Logic Chính

## 3.1 Contact/Feedback

- `sendFeedback({ payload })` — validate `name`, `email`, `subject`, `content` (required). Tạo `Feedback` record với `status: 'pending'`. Gửi email thông báo đến `adminEmail` fire-and-forget (lỗi email chỉ log warn, không fail request).

---

# 4. API Endpoints

Base path: `/api/contact`

| Method | Path        | Auth | Mô tả                                    |
| ------ | ----------- | ---- | ---------------------------------------- |
| POST   | `/feedback` | —    | Gửi form phản hồi/liên hệ (validate 422) |

---

# 5. Dependencies

## 5.1 Depends on

- Models inject từ app.js: `Feedback`
- `emailService` — `sendAdminFeedbackNotification` (wrap qua `emailGateway` adapter inline trong `module.js`)
- `eventBus`, `logger`
- `adminEmail` — từ DI inject hoặc `process.env.ADMIN_EMAIL`

## 5.2 Used by

- Frontend `ContactPage` — form liên hệ (`POST /api/contact/feedback`)
- `src/components/common/FeedbackModal.tsx` — cùng endpoint

---

# 6. Gotchas & Edge Cases

- **`adminEmail` fail silent**: Email failure chỉ log error, request vẫn trả 200. Không re-throw.
- **Banner và News đã bị xóa**: Model `Banner`, `News` đã drop. Routes `/api/banners` và `/api/news` không còn tồn tại. Không reference lại.
- **`content-dto.js` có `toCampaignDto`**: Dead code từ `EmailCampaign` model đã bị drop. KHÔNG reference.

---

# 7. Tests

| File                                             | Loại | Mô tả                        |
| ------------------------------------------------ | ---- | ---------------------------- |
| `services/content-service.test.js`               | Unit | Service logic: feedback      |
| `controllers/content-controller.test.js`         | Unit | HTTP layer: feedback handler |
| `controllers/content-controller.contact.test.js` | Unit | Feedback/contact edge cases  |
| `validators/content-validator.test.js`           | Unit | Zod schema validation        |
| `repositories/content-repository.test.js`        | Unit | Repository queries           |
