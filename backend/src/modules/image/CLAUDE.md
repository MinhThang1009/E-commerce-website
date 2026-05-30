# Image Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Pattern (Singleton)](#12-pattern-singleton)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 Upload flow](#31-upload-flow)
  - [3.2 Image processing pipeline](#32-image-processing-pipeline)
  - [3.3 CDN Proxy](#33-cdn-proxy)
  - [3.4 Business rules](#34-business-rules)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on](#51-depends-on)
  - [5.2 Used by](#52-used-by)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Upload và quản lý ảnh: nhận multipart upload qua multer, xử lý ảnh (resize, WebP convert, strip EXIF) bằng sharp, lưu file lên filesystem, ghi metadata vào DB. Ngoài ra proxy ảnh external CDN qua `image-proxy-router` để bypass hotlink protection trên localhost/dev.

## 1.2 Pattern (Singleton)

Module dùng singleton pattern — **không nhận DI injection**:

```js
// module.js
module.exports = () => ({
  basePath: '/images',
  router: require('@modules/image/routes'),
  subscribeEvents() {},
});
```

Service require `@models/image` **trực tiếp** (không qua `db.Image` từ DI). Service được export là **singleton instance** (`module.exports = new ImageService()`).

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/image/
  module.js
  routes.js
  controllers/
    image-controller.js                  — class ImageController, export singleton instance
  services/
    image-service.js                     — class ImageService, export singleton instance
  repositories/
    sequelize-image-repository.js        — function exports: create, findById, findByProduct, findAll, findByFilePath
    i-image-repository.js                — interface
  middlewares/
    upload-middleware.js                 — multer config: diskStorage → uploads/temp, fileFilter JPEG/PNG/GIF/WebP, max 10MB, 10 files
    image-proxy-router.js                — CDN proxy router: mount tại /api/img (không phải /api/images)
  dtos/
    image-dto.js                         — pass-through DTOs (toDto, toDtoList)
  CLAUDE.md
```

> Module có thêm `middlewares/` riêng — đây là ngoại lệ, phần lớn modules không có.

---

# 3. Business Logic Chính

## 3.1 Upload flow

**`uploadImage(file, options)`**:

1. Nhận `file` từ multer (đã lưu tạm tại `uploads/temp`)
2. Generate UUID filename + structured path: `images/{category}/{year}/{month}/{uuid}.{ext}`
3. Nếu `optimize = true` (default): chạy `processImage` (resize, strip EXIF)
4. Lấy dimensions qua sharp metadata
5. Tạo DB record (`Image.create(...)`)
6. Nếu `generateThumbs = true` và `category = 'product'`: tạo 3 thumbnails (small 150x150, medium 300x300, large 600x600)
7. Xóa file tạm (`uploads/temp/...`)
8. Trả về `{ id, fileName, filePath, url: /uploads/{filePath}, dimensions, thumbnails }`

**`uploadMultipleImages(files, options)`** — iterate qua `uploadImage` cho từng file, thu thập successful/failed riêng.

**`deleteImage(id)`** — xóa file trên disk + thumbnails (nếu category='product') + DB record.

**`convertBase64ToFile(base64Data, options)`** — parse `data:{mime};base64,{data}`, write buffer ra file, tạo DB record.

**`cleanupOrphanedFiles()`** — scan toàn bộ `uploads/` recursively, so sánh với `filePath` trong DB (`isActive=true`), xóa files không có reference.

## 3.2 Image processing pipeline

**`processProductImage(inputPath, outputPath)`** — pipeline chuẩn cho ảnh sản phẩm:

- `.rotate()` — xoay theo EXIF orientation trước khi strip metadata
- `.resize(800, 800, { fit: 'inside', withoutEnlargement: true })` — max 800x800, giữ aspect ratio
- `.webp({ quality: 85 })` — chuyển sang WebP
- `.withMetadata(false)` — strip toàn bộ EXIF (tránh lộ GPS location)

**`processImage(inputPath, outputPath, options)`** — general version với `width`, `height`, `quality`, `fit` configurable.

## 3.3 CDN Proxy

**`image-proxy-router.js`** — mount tại `/api/img` (không phải `/api/images`) trong `app.js`:

- URL: `GET /api/img?url=https://cdnv2.tgdd.vn/...`
- Allowlist: `cdnv2.tgdd.vn`, `cdn.tgdd.vn`, `cdn2.cellphones.com.vn`
- Spoof `Referer: https://www.thegioididong.com/` để bypass hotlink protection
- Cache-Control: `public, max-age=86400`
- Timeout: 10s

## 3.4 Business rules

- **File path structure**: `uploads/images/{category}/{year}/{month}/{uuid}{ext}` — theo ngày để tránh quá nhiều files trong 1 thư mục.
- **Accepted MIME types**: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`
- **Max file size**: 10MB per file. Max 10 files per batch upload.
- **Thumbnail**: Tạo tự động cho `category = 'product'`, lưu vào `uploads/images/thumbnails/`
- **EXIF strip**: Bắt buộc trên tất cả processed images — tránh lộ GPS location của ảnh từ phone.
- **Orphan cleanup**: Chỉ chạy khi gọi thủ công `POST /admin/cleanup` hoặc qua admin UI — không tự động theo cron.

---

# 4. API Endpoints

Base path: `/api/images`

| Method | Path                  | Auth                             | Mô tả                                                |
| ------ | --------------------- | -------------------------------- | ---------------------------------------------------- |
| GET    | `/health`             | —                                | Health check image service                           |
| POST   | `/upload`             | authenticate                     | Upload 1 ảnh (multipart field: `image`)              |
| POST   | `/test-upload`        | — (public)                       | Upload 1 ảnh không auth — dùng trong dev/scripts     |
| POST   | `/upload-multiple`    | authenticate                     | Upload nhiều ảnh (multipart field: `images`, max 10) |
| GET    | `/product/:productId` | —                                | Danh sách ảnh của sản phẩm (isActive=true)           |
| GET    | `/:id`                | —                                | Metadata ảnh theo ID                                 |
| DELETE | `/:id`                | authenticate                     | Xóa ảnh (file + thumbnails + DB record)              |
| POST   | `/convert/base64`     | authenticate                     | Convert base64 string thành file                     |
| POST   | `/admin/cleanup`      | authenticate + adminAuthenticate | Dọn files không có DB reference                      |

**CDN Proxy** (`/api/img`): Mount riêng trong `app.js` qua `image-proxy-router.js` — proxy ảnh CDN external, KHÔNG liên quan đến các endpoints trên.

> `POST /test-upload` là public intentionally — dùng cho dev scripts và seeder.

---

# 5. Dependencies

## 5.1 Depends on

Singleton — không nhận inject qua DI. Require trực tiếp:

- `@models/image` — require trực tiếp trong service và repository (không qua `db.Image`)
- `sharp` — image processing (resize, format convert, EXIF strip)
- `multer` — multipart upload middleware
- `uuid` — generate unique filenames
- `@middlewares/admin-auth` — `adminAuthenticate` trong routes.js

## 5.2 Used by

- `catalog` — thumbnail URLs và product images (qua `ProductImage` model, không qua image module API)
- `admin` — upload và quản lý ảnh sản phẩm qua admin UI

---

# 6. Gotchas & Edge Cases

- **`Image` model không còn trong `models/index.js` associations**: Model `models/image.js` tồn tại nhưng đã bị xóa khỏi associations trong `models/index.js`. Module require `require('@models/image')` trực tiếp — KHÔNG dùng `db.Image`. Đừng refactor sang `db.Image` hay thêm lại vào associations.
- **Singleton service instance**: `module.exports = new ImageService()` — toàn bộ upload dir được init trong constructor (`initializeDirectories()` async). Race condition lý thuyết nếu upload ngay khi server khởi động trước khi dirs sẵn sàng — thực tế không xảy ra vì server listen sau init.
- **`/test-upload` public ở production**: Intentional cho scripts/seeder. Không disable trừ khi có lý do bảo mật rõ ràng.
- **CDN proxy mount tại `/api/img` (không phải `/api/images`)**: Hai routes khác nhau, mục đích khác nhau. `image-proxy-router.js` mount riêng trong `app.js`.
- **Multer lưu tạm tại `uploads/temp`**: File temp bị xóa sau khi processed. Nếu process thất bại → temp file có thể leak. `cleanupOrphanedFiles` không dọn temp folder — phải dọn thủ công nếu cần.
- **`/images/admin/cleanup` require cả `authenticate` VÀ `adminAuthenticate`**: Chain middleware — authenticate JWT trước, adminAuthenticate kiểm tra admin session sau.
- **Thumbnail không sinh cho non-product category**: `generateThumbs` chỉ chạy khi `category === 'product'`. Ảnh user/review không có thumbnail.
- **Repository dùng `entityType/entityId` pattern**: `sequelize-image-repository.js` `findByProduct` query `WHERE entityType = 'product' AND entityId = productId` — nhưng `image-service.js` query qua `Image.findAll({ where: { productId, isActive: true } })` trực tiếp (không qua repository). Hai approaches tồn tại song song.

---

# 7. Tests

| File                                                  | Loại | Mô tả                         |
| ----------------------------------------------------- | ---- | ----------------------------- |
| `services/image-service.test.js`                      | Unit | Upload, resize, cleanup logic |
| `controllers/image-controller.test.js`                | Unit | HTTP layer                    |
| `controllers/image-controller.error-handling.test.js` | Unit | Error cases                   |
| `controllers/image-controller.edge-cases.test.js`     | Unit | Edge cases batch 1            |
| `controllers/image-controller.edge-cases-2.test.js`   | Unit | Edge cases batch 2            |
| `middlewares/image-proxy-router.test.js`              | Unit | CDN proxy logic               |
| `middlewares/image-proxy-router.edge-cases.test.js`   | Unit | Proxy edge cases              |
| `repositories/image-repository.test.js`               | Unit | Repository queries            |
