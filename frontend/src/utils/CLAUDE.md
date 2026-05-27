# Utils — Frontend Utility Functions — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
  - [1.1 Danh sách 14 files](#11-danh-sách-14-files)
- [2. Hay dùng nhất](#2-hay-dùng-nhất)
  - [2.1 cn — Tailwind class merging](#21-cn--tailwind-class-merging)
  - [2.2 format.ts — Format display](#22-formatts--format-display)
  - [2.3 error-utils.ts — Error handling](#23-error-utilsts--error-handling)
  - [2.4 localize.ts — Bilingual fields](#24-localizets--bilingual-fields)
- [3. Danh sách đầy đủ](#3-danh-sách-đầy-đủ)
  - [3.1 Quick reference](#31-quick-reference)
- [4. Key Gotchas](#4-key-gotchas)

---

# 1. Tổng quan

## 1.1 Danh sách 12 files

```
utils/
  cn.ts                           — Tailwind class merging (clsx + tailwind-merge)
  format.ts                       — Format giá VND, số, ngày
  price-utils.ts                  — Price range từ variants
  error-utils.ts                  — Parse/classify errors, retry logic
  auth-utils.ts                   — Auto-logout handler, 401 xử lý
  token-manager.ts                — Token validation + refresh + deduplication
  image-utils.ts                  — Category image mapping, fallback handler
  proxy-img.ts                    — Proxy URLs cho external images (TGDD/Cellphones)
  upload-url.ts                   — Construct full URL cho uploaded files
  localize.ts                     — Bilingual field extraction (Vi/En)
  export-utils.ts                 — Excel/CSV export via exceljs
  description-image-processor.ts  — Base64 → upload trong Rich Text Editor
```

Import qua `@utils/`:

```ts
import { cn } from '@utils/cn';
import { formatPrice } from '@utils/format';
import { getErrorMessage } from '@utils/error-utils';
```

---

# 2. Hay dùng nhất

## 2.1 cn — Tailwind class merging

```ts
import { cn } from '@utils/cn';
// Dùng: clsx để xử lý conditional classes + tailwind-merge để deduplicate conflicts
cn('p-4 text-sm', condition && 'p-8 font-bold', 'text-red-500');
// → 'p-8 text-sm font-bold text-red-500' (p-8 override p-4)
```

## 2.2 format.ts — Format display

```ts
import { formatPrice, formatDate, formatNumber, parsePrice } from '@utils/format';

formatPrice(1299000); // → "1.299.000 ₫" (luôn dùng vi-VN locale cho VND)
formatPriceUSD(29.99); // → "$29.99"
formatNumber(12345); // → "12.345" (vi-VN) hoặc "12,345" (en-US)
formatDate('2024-01-15'); // → "15 thg 1, 2024" (vi-VN medium)
formatDate(date, { dateStyle: 'short' }); // custom options
parsePrice('1,299,000'); // → 1299000 (parse string → number)
```

## 2.3 error-utils.ts — Error handling

```ts
import { parseError, getErrorMessage, isRetryableError, getErrorMsg } from '@utils/error-utils';

parseError(axiosError)        // → AppError { type, message, code, details }
getErrorMessage(error)        // → user-friendly string (Vietnamese)
isRetryableError(error)       // → true nếu NETWORK_ERROR hoặc SERVER_ERROR
getErrorMsg(error, fallback?) // → message, hoặc fallback nếu generic error

// ErrorType enum
import { ErrorType } from '@utils/error-utils';
// NETWORK_ERROR | VALIDATION_ERROR | AUTHENTICATION_ERROR | AUTHORIZATION_ERROR
// NOT_FOUND_ERROR | SERVER_ERROR | UNKNOWN_ERROR
```

## 2.4 localize.ts — Bilingual fields

```ts
import { localizeField, translateValue } from '@utils/localize';

localizeField(category, 'name', i18n.language);
// → category.nameVi (vi) hoặc category.nameEn ?? category.nameVi (en)

translateValue('Đen', 'en'); // → "Black" (color translation table)
```

---

# 3. Danh sách đầy đủ

## 3.1 Quick reference

| File                             | Export chính                                                                                                                                                                                              | Dùng khi                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `cn.ts`                          | `cn(...inputs)`                                                                                                                                                                                           | Merge Tailwind classes conditionally — bắt buộc dùng khi có conditional class            |
| `format.ts`                      | `formatPrice(n)`, `formatDate(d)`, `formatNumber(n)`, `parsePrice(s)`, `formatPriceUSD(n)`                                                                                                                | Hiển thị giá VND, ngày giờ, số                                                           |
| `price-utils.ts`                 | `calculatePriceRange(variants)` → `PriceInfo`; `calculateDiscountPercentage(original, sale)`                                                                                                              | Tính price range + discount % từ variants                                                |
| `error-utils.ts`                 | `parseError(err)`, `getErrorMessage(err)`, `isRetryableError(err)`, `getErrorMsg(err, fallback?)`, `createErrorHandler(fn?)`, `retryWithBackoff(fn, maxRetries, baseDelay)`, `formatErrorForLogging(err)` | Parse/classify Axios errors, lấy user-friendly message, retry logic                      |
| `auth-utils.ts`                  | `handleUnauthorizedError(error)`, `handleAutoLogout(msg?, delay?)`, `setNavigateFunction(navigate)`, `logoutManager`                                                                                      | 401 handling trong `api-client.ts`. `setNavigateFunction` gọi 1 lần trong App.tsx        |
| `token-manager.ts`               | `getValidToken()`, `isTokenExpired(token)`, `refreshTokenIfNeeded()`                                                                                                                                      | Token injection trong API request interceptor. **Deduplicate** nhiều concurrent requests |
| `image-utils.ts`                 | `getCategoryImage(name, slug?)`, `createCategoryImageErrorHandler(name)`                                                                                                                                  | Category image mapping, fallback handler                                                 |
| `proxy-img.ts`                   | `proxyImg(url)` → `/api/img?url=<encoded>`                                                                                                                                                                | Bypass hotlink protection của TGDD/Cellphones/CellphoneS                                 |
| `upload-url.ts`                  | `getUploadUrl(path)` → full URL                                                                                                                                                                           | Construct URL cho uploaded files (`/uploads/...` → full URL với domain)                  |
| `localize.ts`                    | `localizeField(obj, field, lang)`, `translateValue(value, lang)`                                                                                                                                          | Extract đúng ngôn ngữ từ object có `nameVi` + `nameEn`                                   |
| `export-utils.ts`                | `exportToExcel(data, headers, filename)`, `exportToCSV(data, headers, filename)`                                                                                                                          | Export admin reports/danh sách (dùng `exceljs`)                                          |
| `description-image-processor.ts` | `processDescriptionImages(html: string): Promise<string>`                                                                                                                                                 | Convert base64 ảnh trong Rich Text Editor HTML → upload + replace URL trước khi submit   |

---

# 4. Key Gotchas

- **`cn()` bắt buộc** khi có conditional Tailwind classes — `clsx(...)` một mình không deduplicate conflicting classes (`p-4` + `p-8` → giữ cả 2 với clsx). Dùng `cn('p-4', condition && 'p-8')`.
- **`formatPrice()` luôn dùng `vi-VN` locale** bất kể user đang xem tiếng Anh — VND display chuẩn là "1.299.000 ₫" (suffix, dấu chấm ngàn). `en-US` locale với VND cho prefix "₫1,299,000" — không đúng.
- **`proxyImg()` chỉ cần** cho ảnh từ `thegioididong.com`, `cellphones.com.vn`, `cellphoness.com.vn`. Ảnh self-hosted không cần proxy.
- **`token-manager.ts` deduplicate:** `isRefreshing` flag + `failedQueue[]`. Khi 5 requests trigger refresh đồng thời → chỉ 1 fetch `/refresh-token`, 4 request còn lại queue và nhận token mới từ `processQueue()`.
- **`description-image-processor.ts` async** — phải `await processDescriptionImages(html)` trước khi submit form có Rich Text Editor.
- **`auth-utils.ts` singleton `logoutManager`** — ngăn multiple auto-logout calls. `isLoggingOut` flag reset sau khi navigate hoàn tất.
- **`export-utils.ts` dùng `exceljs`** — không phải `xlsx`. Columns, styles, formatting theo pattern trong admin features.
