# Constants — App-wide Configuration Constants — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
  - [1.1 Import pattern](#11-import-pattern)
- [2. PAGINATION](#2-pagination)
  - [2.1 Values](#21-values)
- [3. UPLOAD](#3-upload)
  - [3.1 Values](#31-values)
- [4. SHIPPING](#4-shipping)
  - [4.1 Values](#41-values)
- [5. Key Gotchas](#5-key-gotchas)

---

# 1. Tổng quan

## 1.1 Import pattern

```ts
import { PAGINATION, UPLOAD } from '@constants';
// hoặc
import { PAGINATION } from '@/constants';
```

Files trong `src/constants/`:

- `index.ts` — `PAGINATION`, `UPLOAD`, `SHIPPING` constants
- `chart-colors.ts` — `PIE_COLORS`, `ORDER_STATUS_COLORS`, `CHART_BLUE/GREEN/...` cho Recharts

Tất cả constants `as const` — type-safe, không reassign.

---

# 2. PAGINATION

## 2.1 Values

```ts
PAGINATION.DEFAULT_PAGE; // 1   — trang đầu mặc định cho user-facing pages
PAGINATION.DEFAULT_LIMIT; // 10  — số items/trang cho user-facing lists
PAGINATION.ADMIN_LIMIT; // 20  — số items/trang cho admin tables
```

---

# 3. UPLOAD

## 3.1 Values

```ts
UPLOAD.MAX_FILE_SIZE_MB; // 5 — giới hạn dung lượng file upload (MB)
UPLOAD.ACCEPTED_IMAGE_TYPES; // ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
```

---

# 4. SHIPPING

## 4.1 Values

```ts
SHIPPING.FREE_THRESHOLD; // 5_000_000 — miễn phí ship nếu subtotal >= 5,000,000 VND
SHIPPING.BASE_RATE; // 30_000 — phí ship cơ bản (FE tự tính theo khoảng cách)
SHIPPING.MAX_FEE; // 100_000 — phí ship tối đa
```

---

# 5. Chart Colors (chart-colors.ts)

## 5.1 Export

```ts
import { PIE_COLORS, ORDER_STATUS_COLORS, CHART_BLUE, CHART_GREEN } from '@constants/chart-colors';
```

- `PIE_COLORS` — array 8 màu cho pie chart slices
- `ORDER_STATUS_COLORS` — `Record<string, string>` mapping order status → color (pending/processing/shipped/delivered/cancelled)
- `CHART_BLUE/GREEN/YELLOW/RED/VIOLET/PINK/CYAN/LIME` — named constants cho single-series charts

**Lý do dùng constants thay vì CSS vars:** Recharts dùng SVG attributes (`stroke`, `fill`) không nhận CSS custom properties. Khi muốn đổi màu → sửa ở đây VÀ `_tokens.scss`.

---

# 6. Key Gotchas

- **Luôn dùng constants** — không hardcode `limit: 10` hay `limit: 20` inline. Thay đổi 1 value → áp dụng toàn app.
- **`ADMIN_LIMIT: 20`** chỉ dùng cho admin tables — user-facing pages dùng `DEFAULT_LIMIT: 10`.
- **Constants này chỉ cho display/validation** — business logic (giới hạn file trên server) cũng được enforce ở backend. Client constants để hiển thị đúng thông tin cho user và validate trước khi upload.
- **`UPLOAD.MAX_FILE_SIZE_MB`** dùng trong `ImageUpload` component để validate file size phía client trước khi gửi lên server — server cũng có validation riêng.
