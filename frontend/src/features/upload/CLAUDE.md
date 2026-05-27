# Upload Feature — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
- [3. State Management](#3-state-management)
- [4. API Calls](#4-api-calls)
- [5. Components chính](#5-components-chính)
- [6. Types](#6-types)
- [7. Dependencies](#7-dependencies)
- [8. Gotchas & Edge Cases](#8-gotchas--edge-cases)
- [9. Tests](#9-tests)

---

# 1. Mục đích & Trách nhiệm

Cung cấp hooks để upload file/ảnh lên server. Không có UI riêng, không có pages — chỉ export hooks để các features khác dùng. Có 2 luồng upload độc lập dùng cho mục đích khác nhau:

- **Rich image upload** (`image-api.ts` → `/images/`): có thumbnails, category, optimize, admin tools, dùng cho product images.

---

# 2. Cấu trúc Files

```
api/
  image-api.ts    — Rich image upload: /images/ với metadata, thumbnails, admin tools; export imageKeys

index.ts          — Barrel export tất cả hooks và types
```

Không có `components/`, `pages/`, `types/` riêng.

---

# 3. State Management

## Server state (TanStack Query)

`image-api.ts` có query keys tập trung:

```typescript
export const imageKeys = {
  all: ['images'] as const,
  detail: (id: string) => [...imageKeys.all, 'detail', id] as const,
  byProduct: (productId: string) => [...imageKeys.all, 'product', productId] as const,
  health: () => [...imageKeys.all, 'health'] as const,
};
```


## Client state (Zustand)

Không dùng Zustand stores.

---

# 4. API Calls

## Queries (chỉ `image-api.ts`)

| Hook                                                | Endpoint                             | Mô tả                                              |
| --------------------------------------------------- | ------------------------------------ | -------------------------------------------------- |
| `useGetImageByIdQuery(id, options?)`                | `GET /api/images/:id`                | Chi tiết ảnh theo ID — enabled khi `id` có giá trị |
| `useGetImagesByProductIdQuery(productId, options?)` | `GET /api/images/product/:productId` | Danh sách ảnh của sản phẩm                         |
| `useImageHealthCheckQuery()`                        | `GET /api/images/health`             | Health check image service                         |


| Hook                          | Endpoint                              | Body                         | Mô tả                                           |
| ----------------------------- | ------------------------------------- | ---------------------------- | ----------------------------------------------- |
| `useUploadSingleMutation()`   | `POST /api/uploads/:type/single`      | `{ type, file }` — FormData  | Upload 1 file theo `type` (product/user/review) |
| `useUploadMultipleMutation()` | `POST /api/uploads/:type/multiple`    | `{ type, files }` — FormData | Upload nhiều file cùng type                     |
| `useDeleteFileMutation()`     | `DELETE /api/uploads/:type/:filename` | `{ type, filename }`         | Xóa file theo type + filename                   |

## Mutations — Rich image upload (`image-api.ts`, path `/api/images/`)

| Hook                                | Endpoint                           | Mô tả                                                                         |
| ----------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| `useUploadImageMutation()`          | `POST /api/images/upload`          | Upload ảnh với options: `category`, `productId`, `generateThumbs`, `optimize` |
| `useUploadMultipleImagesMutation()` | `POST /api/images/upload-multiple` | Upload nhiều ảnh có metadata                                                  |
| `useDeleteImageMutation()`          | `DELETE /api/images/:id`           | Xóa ảnh theo image ID                                                         |
| `useConvertBase64ToImageMutation()` | `POST /api/images/convert/base64`  | Convert base64 → stored image (admin paste từ clipboard)                      |
| `useCleanupOrphanedFilesMutation()` | `POST /api/images/admin/cleanup`   | Admin: dọn dẹp files không có DB reference                                    |

`UploadImageOptions`:

```typescript
interface UploadImageOptions {
  category?: 'product' | 'user' | 'review';
  productId?: string;
  generateThumbs?: boolean; // Tạo 3 sizes: 150px, 300px, 600px (small/medium/large) — chỉ dùng cho product images
  optimize?: boolean; // WebP conversion + compression — tốn CPU
}
```

---

# 5. Components chính

Không có components riêng trong feature này. UI upload được implement trong:

- `components/common/ImageUpload.tsx` — shared upload component với file picker + preview. Dùng `useUploadSingleMutation` từ feature này.

---

# 6. Types

```typescript
interface UploadResponse {
  status: string;
  message: string;
  data: { filename: string; originalName: string; url: string; size: number; type: string };
}
interface MultipleUploadResponse {
  status: string;
  message: string;
  data: { files: Array<{ filename; originalName; url; size }>; type: string; count: number };
}

// image-api.ts
interface ImageResponse {
  status: string;
  message: string;
  data: {
    id: string;
    originalName: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    width?: number;
    height?: number;
    category: 'product' | 'thumbnail' | 'user' | 'review';
    productId?: string;
    userId?: string;
    url: string;
    thumbnails?: Array<{ size: 'small' | 'medium' | 'large'; path: string; fileName: string }>;
    createdAt: string;
    updatedAt: string;
  };
}
interface MultipleImageResponse {
  data: {
    successful: ImageResponse['data'][];
    failed: Array<{ fileName: string; error: string }>;
    count: { total: number; successful: number; failed: number };
  };
}
```

---

# 7. Dependencies

**Feature này phụ thuộc vào:**

- `lib/api-client` — HTTP requests với `Content-Type: multipart/form-data`
- `@tanstack/react-query` — mutations + queries

**Feature này được dùng bởi:**

- `features/admin` — product images: `useUploadImageMutation`, `useConvertBase64ToImageMutation`, `useCleanupOrphanedFilesMutation`
- `features/users` — avatar: `useUploadSingleMutation` (type `'user'`)
- `components/common/ImageUpload` — dùng `useUploadSingleMutation`

---

# 8. Gotchas & Edge Cases

- **2 paths hoàn toàn khác nhau:**
  - `image-api.ts` → `/images/` — rich, có thumbnails + category + optimize
  - **Dùng `image-api.ts`** khi: product images (cần thumbnails), admin operations
- **`generateThumbs: true`** tạo 3 sizes (150px/300px/600px = small/medium/large). Chỉ dùng cho product images — không dùng cho avatar.
- **`optimize: true`** → WebP conversion + compression. Tốn CPU — không dùng cho bulk upload hoặc avatar.
- **`useConvertBase64ToImageMutation`** dùng trong admin product form khi user paste image từ clipboard vào rich text editor. Logic trong `utils/description-image-processor.ts`.
- **`useCleanupOrphanedFilesMutation`** chỉ dùng trong admin maintenance — không expose ra user-facing UI.
- **Tất cả mutations dùng `FormData`** — `apiClient` interceptor tự set `Content-Type: multipart/form-data`.
- **`options.skip`** trong queries là compat cũ (invert của `enabled`). Dùng `{ enabled: !!id }` cho code mới.

---

# 9. Tests

Không có test file riêng cho feature upload. Logic được test gián tiếp qua các test của features dùng upload hooks.
