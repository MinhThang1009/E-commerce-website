# Attribute Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Pattern (Singleton với setter injection)](#12-pattern-singleton-với-setter-injection)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 CRUD AttributeGroup và AttributeValue](#31-crud-attributegroup-và-attributevalue)
  - [3.2 Name Generation](#32-name-generation)
  - [3.3 Business rules](#33-business-rules)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on (module này dùng)](#51-depends-on-module-này-dùng)
  - [5.2 Used by (module khác dùng module này)](#52-used-by-module-khác-dùng-module-này)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Quản lý hệ thống thuộc tính sản phẩm theo mô hình `AttributeGroup` (nhóm: "Màu sắc", "Kích cỡ") → `AttributeValue` (giá trị: "Đỏ", "XL"). Cung cấp API sinh tên sản phẩm tự động từ combination of attribute values, dùng khi tạo variant trong admin.

## 1.2 Pattern (Singleton với setter injection)

Module là **singleton** — service và repository `require('@models')` trực tiếp. `nameGenerator` (từ `ai` module) được inject qua setter sau khi khởi tạo để tránh circular dependency tại load time:

```js
// module.js
const attributeService = require('@modules/attribute/services/attribute-service');

module.exports = () => {
  // nameGenerator được require & inject TRONG factory để tránh circular import tại load time
  const nameGenerator = require('@modules/ai/services/product/product-name-generator');
  attributeService.setNameGenerator(nameGenerator);

  return {
    basePath: '/attributes',
    router: require('@modules/attribute/routes'),
    subscribeEvents() {},
  };
};
```

Đây là exception duy nhất cho rule DI — tránh circular import giữa `attribute` và `ai`.

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/attribute/
  module.js                                — Singleton + setter injection cho nameGenerator
  routes.js                                — HTTP endpoints: public + admin (router.use auth)
  controllers/
    attribute-controller.js               — Thin handler, delegate sang service
  services/
    attribute-service.js                  — ~120 lines: CRUD groups/values + name generation
  repositories/
    i-attribute-repository.js             — Interface (tài liệu)
    sequelize-attribute-repository.js     — Queries: findAllGroups, findProductWithGroups, CRUD,
                                            findRecentVariants
  dtos/
    attribute-dto.js
  CLAUDE.md
```

---

# 3. Business Logic Chính

## 3.1 CRUD AttributeGroup và AttributeValue

**`attribute-service.js`**:

- `getAttributeGroups()` — tất cả groups có `isActive=true`, kèm values `isActive=true`, sort theo `sortOrder`
- `getProductAttributeGroups(productId)` — groups gắn với sản phẩm qua `ProductAttributeGroup`
- `createGroup(data)` — tạo AttributeGroup mới
- `updateGroup(id, data)` — update group, 404 nếu không tìm thấy
- `deleteGroup(id)` — soft delete: set `isActive=false` (không xóa vật lý)
- `addValue({ attributeGroupId, ...data })` — validate group tồn tại, tạo AttributeValue
- `updateValue(id, data)` — update value, 404 nếu không tìm thấy
- `deleteValue(id)` — soft delete: set `isActive=false`
- `assignGroupToProduct({ productId, attributeGroupId, ...body })` — tạo record `ProductAttributeGroup`

## 3.2 Name Generation

Các method này **delegate sang `_nameGenerator`** (được inject từ ai module). Throw `AppError 500` nếu `setNameGenerator()` chưa được gọi:

- `previewProductName(baseName, selectedAttributes, options)` — preview tên từ attribute values, không lưu DB. Option `includeDetails=true` trả thêm info về từng attribute ảnh hưởng.
- `getNameAffectingAttributes(productId)` — list AttributeValue có `affectsName=true` và `isActive=true`
- `batchGenerateNames(items, separator)` — generate cho mảng `[{ baseName, selectedAttributes, id }]`
- `generateNameRealTime(baseName, attributeValues, productId)` — gọi `previewProductName` + lấy `suggestions` từ recent variants của product, trả thêm `timestamp`

## 3.3 Business rules

- **AttributeGroup types**: `color | config | storage | size | custom`
- **AttributeValue.affectsName**: Flag quyết định value có được dùng để sinh tên sản phẩm không. Chỉ value có `affectsName=true` và `isActive=true` mới được dùng trong name generation.
- **AttributeValue.nameTemplate**: Template riêng để hiển thị trong tên (vd: "256GB" thay vì "256"). Nếu null → dùng `name`.
- **Sort order**: Tên sinh ra ghép theo `attributeGroup.sortOrder` → `attributeValue.sortOrder`.
- **Soft delete**: Cả group lẫn value đều không xóa vật lý — set `isActive=false`. Queries luôn filter `isActive=true`.

---

# 4. API Endpoints

Base path: `/api/attributes`

Public endpoints (không cần auth):

| Method | Path                                     | Mô tả                                               |
| ------ | ---------------------------------------- | --------------------------------------------------- |
| GET    | `/attributes/groups`                     | Danh sách tất cả attribute groups (kèm values)      |
| GET    | `/attributes/products/:productId/groups` | Attribute groups gắn với sản phẩm                   |
| POST   | `/attributes/preview-name`               | Preview tên sản phẩm từ selected attribute values   |
| POST   | `/attributes/generate-name-realtime`     | Sinh tên real-time + suggestions từ recent variants |
| GET    | `/attributes/name-affecting`             | List attributes có flag `affectsName=true`          |

Admin endpoints (require `authenticate` + `authorize('admin')` — apply qua `router.use()`):

| Method | Path                                                       | Mô tả                             |
| ------ | ---------------------------------------------------------- | --------------------------------- |
| POST   | `/attributes/groups`                                       | Tạo attribute group mới           |
| PUT    | `/attributes/groups/:id`                                   | Cập nhật attribute group          |
| DELETE | `/attributes/groups/:id`                                   | Xóa (soft) attribute group        |
| POST   | `/attributes/groups/:attributeGroupId/values`              | Thêm value vào group              |
| PUT    | `/attributes/values/:id`                                   | Cập nhật attribute value          |
| DELETE | `/attributes/values/:id`                                   | Xóa (soft) attribute value        |
| POST   | `/attributes/products/:productId/groups/:attributeGroupId` | Gán group vào sản phẩm            |
| POST   | `/attributes/batch-generate-names`                         | Batch sinh tên cho nhiều sản phẩm |

---

# 5. Dependencies

## 5.1 Depends on (module này dùng)

- `ai` module — `product-name-generator` singleton inject qua setter (không import trực tiếp trong service)
- `@models` require trực tiếp (singleton pattern): `AttributeGroup`, `AttributeValue`, `ProductAttributeGroup`, `Product`, `ProductVariant`

## 5.2 Used by (module khác dùng module này)

- `catalog` module — filter sản phẩm theo attribute trong search/list
- `admin` module — CRUD attribute groups/values, batch generate names
- `ai` module — `product-name-generator` dùng `AttributeValue` + `AttributeGroup` models trực tiếp

**Events**: Module không publish và không subscribe event nào.

---

# 6. Gotchas & Edge Cases

- **`authorize('admin')` dùng string đơn**: `authorize('admin')`, không phải `authorize(['admin'])`. Admin routes apply qua `router.use(authenticate); router.use(authorize('admin'))` — toàn bộ routes sau đó đều protected.
- **Setter injection bắt buộc trước request**: `nameGenerator` phải được set trong `module.js` khi app khởi động. Nếu `setNameGenerator()` chưa chạy → các method name generation throw `AppError('Name generator chưa được khởi tạo', 500)`.
- **Pre-commit hook block cross-module import**: Không được `require('@modules/ai/...')` trực tiếp trong `attribute-service.js`. Chỉ inject qua setter từ `module.js`.
- **Circular dependency risk**: `ai` dùng `catalog` (product data), `attribute` dùng `ai` (name gen). Setter pattern tránh circular import tại load time — không phá vỡ pattern này.
- **Public name generation endpoints**: `preview-name` và `generate-name-realtime` là public — frontend dùng khi build product/variant form trong admin UI.
- **Soft delete không cascade**: Xóa group không tự động xóa values. Values `isActive=false` nhưng vẫn còn trong DB. Queries filter `isActive=true` nên không hiện ra.
- **`findRecentVariants`**: Lấy 10 variants gần nhất của product để suggest name combinations (dùng trong `generateNameRealTime`).

---

# 7. Tests

| File                                                            | Loại        | Mô tả                           |
| --------------------------------------------------------------- | ----------- | ------------------------------- |
| `services/attribute-service.test.js`                            | Unit        | Service logic (CRUD + name gen) |
| `controllers/attribute-controller.test.js`                      | Unit        | HTTP layer                      |
| `validators/attribute-validator.test.js`                        | Unit        | Zod schema validation           |
| `repositories/attribute-repository.test.js`                     | Unit        | Repository queries              |
| `src/__integration__/attribute.integration.test.js`             | Integration | DB integration (MySQL thật)     |
| `src/__integration__/attribute-extra.integration.test.js`       | Integration | Integration edge cases          |
| `src/__api__/attribute.http.test.js`                            | API HTTP    | End-to-end HTTP                 |
| `src/__api__/attribute-extra.http.test.js`                      | API HTTP    | HTTP edge cases                 |
| `src/__api__/attribute-users-warranty-search-deep.http.test.js` | API HTTP    | Deep HTTP scenarios             |
