# Config — Frontend Configuration — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
  - [1.1 Files](#11-files)
- [2. i18n.ts](#2-i18nts)
  - [2.1 Cách dùng](#21-cách-dùng)
  - [2.2 Cấu hình hiện tại](#22-cấu-hình-hiện-tại)
  - [2.3 Quy ước bắt buộc](#23-quy-ước-bắt-buộc)
- [3. Key Gotchas](#3-key-gotchas)

---

# 1. Tổng quan

## 1.1 Files

```
config/
  i18n.ts   — i18next + react-i18next initialization (side effect khi import)
```

---

# 2. i18n.ts

## 2.1 Cách dùng

```ts
// Import để trigger init — đặt trong main.tsx hoặc App.tsx, chạy trước mọi component
import '@/config/i18n';

// Dùng trong components
import { useTranslation } from 'react-i18next';
const { t, i18n } = useTranslation();

t('header.brand'); // → "TechStore"
t('cart.empty'); // → "Giỏ hàng trống" (vi) / "Cart is empty" (en)
i18n.language; // → 'vi' | 'en'
i18n.changeLanguage('en'); // Switch language
```

## 2.2 Cấu hình hiện tại

| Config            | Value                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Default locale    | `'vi'` (lấy từ `localStorage('language')`, fallback về `'vi'`)                           |
| Supported locales | `['vi', 'en']`                                                                           |
| Locale files      | `src/locales/vi.json`, `src/locales/en.json`                                             |
| Detection order   | `localStorage('language')` → `navigator.language` → `htmlTag`                            |
| Cache             | `localStorage('language')`                                                               |
| `fallbackLng`     | `'vi'` — nếu key không tìm thấy trong ngôn ngữ hiện tại, fallback về `vi`                |
| Debug             | Bật trong `development` (`process.env.NODE_ENV === 'development'`), tắt trong production |
| Default namespace | `'translation'` (1 file duy nhất, không split namespace)                                 |

## 2.3 Quy ước bắt buộc

Tất cả user-visible strings PHẢI dùng `t('key')` — không hardcode tiếng Việt/Anh trong JSX:

```tsx
// Đúng
<Button>{t('cart.addToCart')}</Button>
<p>{t('errors.networkError')}</p>

// Sai — hardcode
<Button>Thêm vào giỏ</Button>
<p>Network error occurred</p>
```

Khi thêm key mới → phải thêm vào **cả `vi.json` và `en.json`**.

---

# 3. Key Gotchas

- **Key phải có trong cả 2 file:** `vi.json` và `en.json` phải sync. Key thiếu ở 1 file → user switch ngôn ngữ → hiển thị key thô (ví dụ: `"checkout.bankTransfer.title"`).
- **Namespace duy nhất `'translation'`:** cả 2 locales đều dùng 1 namespace. Không có namespace splitting. Nếu cần thêm namespace → config thêm trong `i18n.ts`.
- **i18n init là side effect khi import** — không gọi function nào. Đảm bảo `import '@/config/i18n'` chạy trước khi bất kỳ component nào dùng `useTranslation()` render.
- **`navigator.language`** trả về `'vi-VN'` (có region code) — i18next tự normalize về `'vi'` khi match resources.
- **Language persistence:** user switch ngôn ngữ → lưu vào `localStorage('language')` → persist qua refresh.
- **Backend locales tách biệt:** `backend/src/locales/vi.json` và `backend/src/locales/en.json` là khác, dùng cho `i18next` ở backend — không liên quan đến file này.
