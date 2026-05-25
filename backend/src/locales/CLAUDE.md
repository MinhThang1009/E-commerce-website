# Backend Locales (i18n)

> Translation files cho user-facing strings từ backend (error messages, email subject, validation).

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Mục đích](#1-mục-đích)
- [2. Files](#2-files)
- [3. Quy tắc đặt key](#3-quy-tắc-đặt-key)
- [4. Cách dùng trong code](#4-cách-dùng-trong-code)
- [5. Validation locale](#5-validation-locale)
- [6. Gotchas](#6-gotchas)

---

# 1. Mục đích

Mỗi message hiển thị cho user từ backend (response error, email body, notification) PHẢI đi qua `t('key', locale)` thay vì hardcode chuỗi.

Locale được phát hiện qua middleware `detect-locale.js`:

- Query param `?lang=vi|en`
- Header `Accept-Language`
- Fallback `vi`

---

# 2. Files

```
locales/
├── vi.json    ← Tiếng Việt (mặc định)
└── en.json    ← Tiếng Anh
```

Cấu trúc: nested object, JSON. Ví dụ:

```json
{
  "errors": {
    "auth": {
      "invalidCredentials": "Email hoặc mật khẩu không đúng"
    },
    "order": {
      "notFound": "Không tìm thấy đơn hàng"
    }
  },
  "email": {
    "orderConfirmation": {
      "subject": "Xác nhận đơn hàng #{{orderId}}"
    }
  }
}
```

---

# 3. Quy tắc đặt key

- **Namespace theo domain**: `errors.<module>.<keyName>`, `email.<template>.<field>`, `validation.<rule>`
- **Tên key bằng tiếng Anh**, camelCase
- **Interpolation**: dùng `{{var}}` cho biến (xem `utils/i18n.js`)
- Mỗi key BẮT BUỘC có trong **cả `vi.json` lẫn `en.json`**

---

# 4. Cách dùng trong code

```js
const { t } = require('@utils/i18n');

// Trong controller/service (locale lấy từ req.locale)
throw new BusinessError(t('errors.order.notFound', req.locale));

// Email
const subject = t('email.orderConfirmation.subject', locale, { orderId: order.id });
```

---

# 5. Validation locale

Script `scripts/check-i18n.js` (root scripts) so sánh keys giữa `vi.json` và `en.json`:

```bash
node scripts/check-i18n.js
```

CI sẽ fail nếu phát hiện key thiếu ở một trong 2 file.

---

# 6. Gotchas

- **Không xóa key cũ** mà chưa search toàn codebase — có thể đang được dùng.
- **Không hardcode string** trong service/controller. Pre-commit hook không block, nhưng code review reject.
- **Interpolation phải khớp** giữa 2 file. `vi.json` có `{{orderId}}` thì `en.json` cũng phải có.
- **Email templates** phức tạp (HTML đa dòng) — vẫn dùng i18n key, không hardcode HTML chứa string tiếng Việt.
