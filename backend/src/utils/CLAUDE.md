# Utils — Backend Utility Functions

> Pure utility functions không có state. Import qua alias `@utils`.

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. logger.js](#1-loggerjs)
- [2. i18n.js](#2-i18njs)
- [3. catch-async.js](#3-catch-asyncjs)
- [4. image-url.js](#4-image-urljs)
- [5. localize.js](#5-localizejs)
- [6. product-helpers.js](#6-product-helpersjs)

---

## 1. logger.js

**Dùng thay `console.log`** trong mọi application code.

```js
const logger = require('@utils/logger');
logger.info('Order created', { orderId, userId });
logger.warn('Redis unavailable — fallback to memory');
logger.error('Payment failed', { error: e.message, orderId });
logger.debug('Query params', { page, limit }); // Chỉ output trong dev
```

**Transports:**

- Dev: colored human-readable format (console)
- Prod: JSON format (ELK/Datadog compatible) + file rotation

**File logs (production only):**

- `logs/error.log` — chỉ errors
- `logs/combined.log` — tất cả levels
- Rotation: 10MB per file, giữ 5 files

**Env var:** `LOG_LEVEL` (default: `debug` dev / `info` prod)

---

## 2. i18n.js

Translation function cho user-facing strings. Bắt buộc dùng cho mọi message trả về client.

```js
const { t } = require('@utils/i18n');

t('auth.emailInUse', 'vi'); // → "Email đã được sử dụng"
t('order.notFound', 'en'); // → "Order not found"
t('greeting', 'vi', { name: 'Minh' }); // param interpolation
// → null nếu key không tồn tại
```

Locale files: `src/locales/vi.json` và `src/locales/en.json`. Khi thêm key mới → cập nhật cả 2 file.

---

## 3. catch-async.js

Wrap async route handler, auto-forward errors tới `next()`. Tránh viết try-catch lặp lại trong controllers.

```js
const { catchAsync } = require('@utils/catch-async');

router.post(
  '/orders',
  authenticate,
  catchAsync(async (req, res) => {
    const order = await ordersService.createOrder(req.body);
    res.status(201).json(order);
    // Errors tự động → errorHandler (không cần try-catch)
  }),
);
```

---

## 4. image-url.js

Normalize image URLs cross-environment (dev vs prod, CDN vs local).

```js
const { sanitizeStoredImageValue, buildPublicImageUrl } = require('@utils/image-url');

sanitizeStoredImageValue(input); // strip base URL → relative path (để lưu DB)
buildPublicImageUrl(input); // combine ASSET_BASE + path → full public URL
```

**Env vars:** `BACKEND_URL`, `API_URL`, `ASSET_BASE_URL`, `CDN_BASE_URL`

---

## 5. localize.js

Lấy field đúng ngôn ngữ từ bilingual entity (Vi/En columns).

```js
const { localizeEntity, localizeList } = require('@utils/localize');

localizeEntity(product, 'en', 'product'); // → { name: 'iPhone 17', description: '...' }
localizeList(products, 'vi', 'product'); // → map qua array
```

Supported entity types và fields:

- `product` — `name`, `shortDescription`, `description`, `seoTitle`, `seoDescription`
- `category` — `name`, `description`
- `brand` — `name`

Luôn giữ `_vi` và `_en` columns trong response object (admin cần cả 2). `FIELD_MAPS` cũng được export nếu cần introspect.

---

## 6. product-helpers.js

Stock và variant utilities dùng trong catalog service.

```js
const {
  calculateTotalStock,
  updateProductTotalStock,
  validateVariantAttributes,
  generateVariantSku,
  hasVariants,
  getVariantStock,
  findVariantByAttributes,
} = require('@utils/product-helpers');

calculateTotalStock(variants); // sum stockQuantity từ tất cả variants
updateProductTotalStock(productId, Product); // re-sum variants → update product.stockQuantity (async)
validateVariantAttributes(productAttrs, variantAttrs); // check variant attrs nằm trong allowed values
generateVariantSku(productSku, attrs); // "SKU-RED-256GB"
hasVariants(product); // product.variants.length > 0
getVariantStock(variants, selectedAttrs); // stockQuantity của variant khớp attrs
findVariantByAttributes(variants, selectedAttrs); // tìm variant khớp exact attribute combo
```
