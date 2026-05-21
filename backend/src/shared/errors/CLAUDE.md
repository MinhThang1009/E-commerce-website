# Error Classes — TechStore Backend

← Quay lại [`shared/CLAUDE.md`](../CLAUDE.md) | [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. Hierarchy](#2-hierarchy)
- [3. Chi tiết từng class](#3-chi-tiết-từng-class)
  - [3.1 AppError](#31-apperror)
  - [3.2 NotFoundError](#32-notfounderror)
  - [3.3 ValidationError](#33-validationerror)
  - [3.4 BusinessError](#34-businesserror)
  - [3.5 DomainError (alias)](#35-domainerror-alias)
- [4. Import](#4-import)
- [5. Conventions](#5-conventions)

---

# 1. Tổng quan

Custom error hierarchy cho backend. Tất cả operational errors (lỗi có thể xảy ra trong quá trình bình thường) extend từ `AppError`. Non-operational errors (bugs, unexpected failures) không extend AppError.

---

# 2. Hierarchy

```
AppError (base, isOperational=true)
├── NotFoundError (404)
├── ValidationError (400)
└── BusinessError (422)
    └── DomainError (alias backward compat)
```

---

# 3. Chi tiết từng class

## 3.1 AppError

Base class. Fields:

- `message` — user-facing error message
- `statusCode` — HTTP status code
- `status` — `'fail'` (4xx) hoặc `'error'` (5xx)
- `isOperational: true` — báo cho error handler biết đây là expected error
- `params` — optional extra data

## 3.2 NotFoundError

`new NotFoundError(resource, id)` → message: `"{resource} với id '{id}' không tồn tại"`

statusCode: 404

## 3.3 ValidationError

`new ValidationError(message, details?)` → statusCode 400, field `details` chứa validation errors.

## 3.4 BusinessError

`new BusinessError(message, domainCode?)` → statusCode 422. Field `domainCode` cho machine-readable error code.

## 3.5 DomainError (alias)

`module.exports = BusinessError` — alias backward compat. Dùng `BusinessError` trong code mới.

---

# 4. Import

```javascript
const {
  AppError,
  NotFoundError,
  ValidationError,
  BusinessError,
  DomainError,
} = require('@shared/errors');
// hoặc từ barrel:
const { AppError } = require('@shared');
```

---

# 5. Conventions

- Service throw `BusinessError` cho business rule violations (insufficient stock, invalid state)
- Service throw `NotFoundError` khi entity không tìm thấy
- Controller throw `ValidationError` nếu cần (thường Zod validator xử lý trước)
- **Không** throw plain `Error` từ service/controller — dùng subclass phù hợp
- Error handler (`middlewares/error-handler.js`) phân biệt `isOperational` để quyết định expose message hay không
