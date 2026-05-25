# Product Sub-Services — AI Module

← Quay lại [`ai/CLAUDE.md`](../../CLAUDE.md) | [`backend/CLAUDE.md`](../../../../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. File Map](#2-file-map)
- [3. Từng file](#3-từng-file)
  - [3.1 product-name-generator.js](#31-product-name-generatorjs)
- [4. Gotchas](#4-gotchas)

---

# 1. Tổng quan

`product-name-generator.js` là singleton sinh tên sản phẩm động từ attribute values, được inject vào `attribute` module qua setter.

> `enrichProductData` đã chuyển sang `@utils/product-helpers` — không còn trong thư mục này.

---

# 2. File Map

```
product/
  product-name-generator.js  — Singleton; 5 async methods; query AttributeValue + AttributeGroup
```

---

# 3. Từng file

## 3.1 product-name-generator.js

**Singleton** (`module.exports = new ProductNameGeneratorService()`).

Require `@models` trực tiếp (không nhận DI). Tự định nghĩa associations inline nếu chưa tồn tại:
- `AttributeValue.belongsTo(AttributeGroup, { as: 'attributeGroup' })`
- `AttributeGroup.hasMany(AttributeValue, { as: 'values' })`

**5 async methods:**

| Method | Signature | Mô tả |
|---|---|---|
| `generateProductName` | `(baseName, selectedAttributes=[], separator=' ') → Promise<string>` | Query `AttributeValue` có `affectsName=true` + `isActive=true`; sort theo `attributeGroup.sortOrder` + `sortOrder`; join `nameTemplate \|\| name` với separator |
| `generateVariantName` | `(baseName, attributesCombination={}, separator=' ') → Promise<string>` | Wrapper: extract `Object.values(attributesCombination)` rồi gọi `generateProductName` |
| `previewProductName` | `(baseName, selectedAttributes=[], options={}) → Promise<Object>` | Preview không lưu DB; trả `{ originalName, generatedName, hasChanges, parts, affectingAttributes? }` |
| `getNameAffectingAttributes` | `(productId=null) → Promise<Array>` | List tất cả AttributeValue có `affectsName=true` + `isActive=true`; include AttributeGroup active |
| `batchGenerateNames` | `(items=[], separator=' ') → Promise<Array>` | Sequential loop (không parallel); mỗi item: `{ id, baseName, selectedAttributes }` → trả `{ id, baseName, generatedName, selectedAttributes }` |

**Tên thực dùng:** `nameTemplate` ưu tiên hơn `name` — nếu `nameTemplate` có giá trị thì dùng `nameTemplate`.

**Inject vào `attribute` module:** `attribute` module gọi `attributeService.setNameGenerator(productNameGenerator)` sau khi module khởi tạo xong.

---

# 4. Gotchas

- **`product-name-generator` định nghĩa associations inline** — tránh phụ thuộc vào thứ tự load models. Nếu association đã tồn tại thì skip (`if (!AttributeValue.associations.attributeGroup)`).
- **`generateProductName` trả `baseName` ngay nếu `selectedAttributes` rỗng hoặc không có attribute nào `affectsName=true`** — không throw.
- **`batchGenerateNames` là sequential** — mỗi item chờ item trước xong mới chạy. Cho nhiều items → chậm hơn Promise.all, nhưng tránh quá tải DB.
- **`productId` trong `getNameAffectingAttributes` không được dùng** — param nhận nhưng `whereCondition` không lọc theo productId (có thể là placeholder cho tương lai).
- **Cross-module import bị hook block** — `attribute` module không được require `product-name-generator` trực tiếp; phải nhận qua DI/setter từ `app.js`.
