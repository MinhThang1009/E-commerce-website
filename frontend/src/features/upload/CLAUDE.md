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

Cung cấp hooks để quản lý ảnh đã lưu trên server (image management). Không có UI riêng, không có pages — chỉ export hooks để các features khác dùng. Hiện chỉ còn 2 mutation, không có query:

- **Image management** (`image-api.ts` → `/images/`): xóa ảnh theo ID + convert base64 → stored image. Dùng chủ yếu cho admin product form.

---

# 2. Cấu trúc Files

```
api/
  image-api.ts    — Image management: delete + convert base64; export 2 mutation hooks + types

index.ts          — Barrel export (re-export tất cả từ api/image-api.ts)
```

Không có `components/`, `pages/`, `types/`, `hooks/`, `stores/` riêng.

---

# 3. State Management

## Server state (TanStack Query)

`image-api.ts` có query keys nội bộ (không export), chỉ dùng để invalidate sau mutation:

```typescript
const imageKeys = {
  all: ['images'] as const,
};
```

## Client state (Zustand)

Không dùng Zustand stores.

---

# 4. API Calls

## Queries

Không có query hook nào trong feature này.

## Mutations — Image management (`image-api.ts`, path `/api/images/`)

| Hook                                | Endpoint                          | Mô tả                                                    |
| ----------------------------------- | --------------------------------- | -------------------------------------------------------- |
| `useDeleteImageMutation()`          | `DELETE /api/images/:id`          | Xóa ảnh theo image ID                                    |
| `useConvertBase64ToImageMutation()` | `POST /api/images/convert/base64` | Convert base64 → stored image (admin paste từ clipboard) |

`useConvertBase64ToImageMutation` nhận `{ base64Data: string; options?: ConvertBase64Options }`; mặc định `category` = `'product'`.

`ConvertBase64Options`:

```typescript
interface ConvertBase64Options {
  category?: string;
  productId?: string;
}
```

> Upload file thật (single/multiple) KHÔNG đi qua feature này — xem [§5](#5-components-chính).

---

# 5. Components chính

Không có components riêng trong feature này. UI upload được implement trong:

- `components/common/ImageUpload.tsx` — shared upload component với file picker + preview. Gọi trực tiếp `fetch` đến `POST /api/uploads/:type/:endpoint` (không qua hook của feature này).

---

# 6. Types

```typescript
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

interface ConvertBase64Options {
  category?: string;
  productId?: string;
}
```

---

# 7. Dependencies

**Feature này phụ thuộc vào:**

- `lib/api-client` — HTTP requests
- `@tanstack/react-query` — mutations

**Feature này được dùng bởi:**

- `features/admin` — product form (CreateProductPage, EditProductPage): `useConvertBase64ToImageMutation`; CreateProductPage còn dùng `useDeleteImageMutation`

---

# 8. Gotchas & Edge Cases

- **Upload file thật KHÔNG ở feature này:** `components/common/ImageUpload.tsx` gọi thẳng `fetch` đến `/uploads/:type/...`. Feature `upload` chỉ lo image management (delete + convert base64).
- **`useConvertBase64ToImageMutation`** dùng trong admin product form khi user paste image từ clipboard vào rich text editor. Logic gọi qua `utils/description-image-processor.ts` (nhận hàm `uploadImageFn` được inject từ page, không import hook trực tiếp).
- **`imageKeys` không export** — chỉ dùng nội bộ để `invalidateQueries` sau mutation.
- **Mutation `convert/base64` gửi JSON** (`{ base64Data, category, productId }`), không phải FormData.

---

# 9. Tests

Không có test file riêng cho feature upload. Logic được test gián tiếp qua các test của features dùng upload hooks.
