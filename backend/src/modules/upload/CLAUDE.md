# Upload Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Phân biệt với image module](#12-phân-biệt-với-image-module)
  - [1.3 Pattern (DI đầy đủ, multer config trong module.js)](#13-pattern-di-đầy-đủ-multer-config-trong-modulejs)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 processSingleUpload](#31-processsingleupload)
  - [3.2 processMultipleUpload](#32-processmultipleupload)
  - [3.3 deleteFile (admin only)](#33-deletefile-admin-only)
  - [3.4 Magic bytes validation](#34-magic-bytes-validation)
  - [3.5 Multer config (trong module.js)](#35-multer-config-trong-modulejs)
- [4. API Endpoints](#4-api-endpoints)
  - [4.1 Routes](#41-routes)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on (module này dùng)](#51-depends-on-module-này-dùng)
  - [5.2 Used by (module khác dùng module này)](#52-used-by-module-khác-dùng-module-này)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Nhận multipart/form-data, validate magic bytes (JPEG/PNG/WebP), lưu file lên local filesystem. Không xử lý image transformation (resize, thumbnail, metadata) — đó là nhiệm vụ của `image` module.

## 1.2 Phân biệt với image module

| Upload module                                        | Image module                                     |
| ---------------------------------------------------- | ------------------------------------------------ |
| Nhận file upload, validate magic bytes, lưu lên disk | Tạo thumbnail, xử lý metadata, lưu DB record     |
| Trả về URL path                                      | Trả về `Image` model với dimensions, isThumbnail |
| Stateless (không có DB record)                       | Có DB record trong `images` table                |

## 1.3 Pattern (DI đầy đủ, multer config trong module.js)

```js
// module.js setup multer + dirs, sau đó wire:
const uploadRepository = new FilesystemUploadRepository();
const service = new UploadService({ uploadRepository, uploadDirs, eventBus, logger });
const controller = new UploadController({ uploadService: service, uploadEngine });
```

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/upload/
  module.js                                    — multer config, dir setup, factory DI
  routes.js                                    — 3 routes
  controllers/
    upload-controller.js
    upload-controller.test.js
    upload-controller.edge-cases.test.js
  services/
    upload-service.js                          — magic bytes validation, file URL builder, admin delete
    upload-service.test.js
  repositories/
    i-upload-repository.js
    filesystem-upload-repository.js            — wrap fs.promises (fileExists, deleteFile, readFileHeader)
    filesystem-upload-repository.test.js
  validators/
    upload-validator.js
  dtos/
    upload-dto.js
```

---

# 3. Business Logic Chính

## 3.1 processSingleUpload

```js
processSingleUpload({ file, uploadType });
```

1. Validate `file` tồn tại
2. `validateMagicBytes(file.path)` — đọc 12 bytes header
3. Nếu invalid → `deleteFile(file.path)` (best-effort), throw 400
4. Trả `{ filename, originalName, url: /uploads/{type}/{filename}, size, type }`

## 3.2 processMultipleUpload

```js
processMultipleUpload({ files, uploadType });
```

1. Validate từng file bằng magic bytes
2. Phân loại `validFiles` và `invalidPaths`
3. Xóa `invalidPaths` song song (Promise.allSettled — best-effort)
4. Nếu 0 file valid → throw 400
5. Trả mảng `[{ filename, originalName, url, size }]`

## 3.3 deleteFile (admin only)

```js
deleteFile({ user, type, filenameRaw });
```

1. `user.role !== 'admin'` → throw 403
2. `uploadDirs[type]` không tồn tại → throw 400
3. `path.basename(filenameRaw)` để strip directory components
4. Path traversal guard: `filePath.startsWith(uploadDir + sep)`
5. `fileExists` check → throw 404 nếu không có
6. `uploadRepository.deleteFile(filePath)`

## 3.4 Magic bytes validation

Đọc 12 bytes đầu của file để phát hiện file giả mạo (đổi tên .exe thành .jpg):

| Format | Signature                                                             |
| ------ | --------------------------------------------------------------------- |
| JPEG   | `FF D8 FF` (3 bytes đầu)                                              |
| PNG    | `89 50 4E 47 0D 0A 1A 0A` (8 bytes đầu)                               |
| WebP   | `52 49 46 46` (RIFF) tại offset 0 + `57 45 42 50` (WEBP) tại offset 8 |

## 3.5 Multer config (trong module.js)

- **Storage:** diskStorage, filename = `uuid()` + original extension (lowercase)
- **fileFilter:** chỉ nhận `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- **limits:** `fileSize: 5MB`, `files: 10`
- **uploadDirs:** subdirs trong `backend/uploads/`: `reviews`, `products`, `users`, `categories`, `brands`, `avatars`, `temp`

---

# 4. API Endpoints

## 4.1 Routes

Base path: `/api/uploads`. Tất cả require `authenticate`.

| Method | Path               | Auth         | Mô tả                                                 |
| ------ | ------------------ | ------------ | ----------------------------------------------------- |
| POST   | `/:type/single`    | authenticate | Upload 1 file (multer `single('file')`)               |
| POST   | `/:type/multiple`  | authenticate | Upload nhiều file (multer `array('files', maxCount)`) |
| DELETE | `/:type/:filename` | authenticate | Xóa file (service check `user.role === 'admin'`)      |

**`:type` hợp lệ:** `reviews`, `products`, `users`, `categories`, `brands`, `avatars`, `temp`

**Giới hạn multiple upload theo type:**

- `reviews` → max 5 files
- Tất cả types khác → max 10 files

---

# 5. Dependencies

## 5.1 Depends on (module này dùng)

Inject từ `app.js` (optional):

- `uploadsBaseDir` — override base dir cho test (default: `backend/uploads/`)
- `eventBus`, `logger`

Module không nhận Sequelize models — chỉ dùng `fs.promises`, `multer`, `uuid`, `path`.

## 5.2 Used by (module khác dùng module này)

- `admin` — upload ảnh sản phẩm
- `users` — upload avatar (FE upload file, lấy URL, rồi gọi `PUT /api/users/profile`)
- `reviews` — upload ảnh review

---

# 6. Gotchas & Edge Cases

- **Magic bytes validation xảy ra SAU khi multer lưu file:** File giả mạo được lưu lên disk trước, sau đó bị xóa ngay. Đây là behavior đúng (multer không có API đọc bytes trước khi lưu).
- **MIME type của multer là lớp bảo vệ đầu tiên, không đủ:** Attacker có thể gửi `Content-Type: image/jpeg` cho file thực ra là exe. Magic bytes check là lớp bảo vệ thực sự.
- **`DELETE /:type/:filename` là admin-only tại service layer:** Route không dùng `authorize('admin')` middleware — kiểm tra được thực hiện trong `uploadService.deleteFile()`. Không thêm middleware authorize — sẽ duplicate check.
- **Temp files cleanup:** `uploads/temp/` bị cleanup daily 2AM bởi `src/jobs/cleanup.js`. Không xóa temp files thủ công.
- **`module.js` expose internals:** `_uploadDirs`, `_uploadEngine`, `validateMagicBytes`, `deleteFile` được export cho legacy compat và tests.
- **Path traversal guard:** `path.basename()` + startsWith check. Quan trọng — không bỏ khi refactor.

---

# 7. Tests

| File                                                | Loại | Mô tả                                                      |
| --------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `services/upload-service.test.js`                   | Unit | Magic bytes validation, processSingle/Multiple, deleteFile |
| `controllers/upload-controller.test.js`             | Unit | HTTP layer, multer integration                             |
| `controllers/upload-controller.edge-cases.test.js`  | Unit | Edge cases: bad type, path traversal                       |
| `repositories/filesystem-upload-repository.test.js` | Unit | fs.promises wrapper                                        |
| `src/__api__/image-upload.api.test.js`              | HTTP | End-to-end upload flow                                     |
