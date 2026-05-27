# Users Feature — TechStore Frontend

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

Trang profile (`/profile`) với 4 tabs: thông tin cá nhân, đổi mật khẩu, đơn hàng (redirect link), địa chỉ giao hàng. Xử lý CRUD địa chỉ và cập nhật thông tin profile. Export `useGetAddressesQuery` + `userKeys` để dùng bởi `CheckoutPage` (feature checkout).

---

# 2. Cấu trúc Files

```
api/
  user-api.ts              — TanStack Query hooks + export userKeys

components/
  ProfileAddressesTab.tsx  — Tab quản lý địa chỉ giao hàng (extracted từ ProfilePage)

pages/
  ProfilePage.tsx          — /profile: layout 4 tabs (~789 dòng, giảm từ ~1021 sau refactor)

index.ts                   — Barrel export
```

Không có `types/` riêng. UI inline trong `ProfilePage` hoặc từ `src/components/common/`, ngoại trừ address tab đã tách ra `ProfileAddressesTab`.

---

# 3. State Management

## Server state (TanStack Query)

```typescript
export const userKeys = {
  all: ['user'] as const, // Lưu ý: 'user' số ít (không phải 'users')
  addresses: () => [...userKeys.all, 'addresses'] as const,
  currentUser: () => [...userKeys.all, 'current'] as const,
};
```

## Client state (Zustand)

- `authStore` — đọc `user` (display), gọi `updateUser()` thủ công sau `useUpdateProfileMutation`
- `uiStore` — `addNotification()` cho toast success/error

---

# 4. API Calls

## Queries

| Hook                             | Endpoint                   | Mô tả                                                                                   |
| -------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| `useGetAddressesQuery(options?)` | `GET /api/users/addresses` | Danh sách địa chỉ giao hàng. Cũng dùng bởi `CheckoutPage` để autofill shipping address. |

`ProfilePage` cũng dùng `useGetCurrentUserQuery` từ feature `auth` để lấy user data mới nhất.

## Mutations

| Hook                             | Endpoint                                 | Mô tả                                                                              |
| -------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `useUpdateProfileMutation()`     | `PUT /api/users/profile`                 | Cập nhật firstName, lastName, phone, avatar. Invalidate `userKeys.currentUser()`.  |
| `useChangePasswordMutation()`    | `POST /api/users/change-password`        | Body: `{ currentPassword, newPassword, confirmPassword }`. Không invalidate query. |
| `useAddAddressMutation()`        | `POST /api/users/addresses`              | Thêm địa chỉ mới. Invalidate `userKeys.addresses()`.                               |
| `useUpdateAddressMutation()`     | `PUT /api/users/addresses/:id`           | Cập nhật địa chỉ. Invalidate `userKeys.addresses()`.                               |
| `useDeleteAddressMutation()`     | `DELETE /api/users/addresses/:id`        | Xóa địa chỉ. Invalidate `userKeys.addresses()`.                                    |
| `useSetDefaultAddressMutation()` | `PATCH /api/users/addresses/:id/default` | Đặt làm địa chỉ mặc định. Invalidate `userKeys.addresses()`.                       |

---

# 5. Components chính

## Pages

| Page          | Route      | Mô tả                                                                                        |
| ------------- | ---------- | -------------------------------------------------------------------------------------------- |
| `ProfilePage` | `/profile` | Layout 4 tabs với hero header + avatar card. Address tab extracted ra `ProfileAddressesTab`. |

## Components

| Component             | Mô tả                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProfileAddressesTab` | Tab quản lý địa chỉ giao hàng — extracted từ `ProfilePage` để giảm kích thước file (1021 → ~789 dòng). Nhận state + callbacks qua props, không có logic riêng. |

## 4 Tabs trong ProfilePage

| Tab key     | Nội dung                                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `info`      | Cập nhật firstName, lastName, phone. Email read-only (không thể thay đổi). Avatar hiển thị hoặc initials fallback. Toggle edit mode (`isEditing`).                         |
| `password`  | Form đổi mật khẩu: currentPassword, newPassword, confirmPassword. Min 6 chars cho new password.                                                                            |
| `orders`    | Link redirect sang `/orders`. Không render order list inline — chỉ hiển thị icon + button.                                                                                 |
| `addresses` | Render `ProfileAddressesTab` — CRUD địa chỉ: danh sách với default indicator, form thêm/sửa inline (toggle `showAddressForm`). Validate phone VN: `/^(0\|\+84)[0-9]{9}$/`. |

---

# 6. Types

Types dùng chung từ `src/types/user.types.ts`:

```typescript
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'customer' | 'admin';
  isEmailVerified: boolean;
  createdAt: string;
}

interface Address {
  id: string;
  name?: string; // Tên địa chỉ (VD: "Nhà", "Văn phòng")
  firstName: string;
  lastName: string;
  phone?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
}
```

API request types (từ `api/user-api.ts`):

```typescript
interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
}
interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
```

---

# 7. Dependencies

**Feature này phụ thuộc vào:**

- `features/auth` — `useGetCurrentUserQuery` trong `ProfilePage` để fetch user data mới nhất
- `components/common/Button` — UI buttons
- `stores/auth-store` — đọc `user`, gọi `updateUser()`
- `stores/ui-store` — `addNotification()`
- `utils/error-utils` — `getErrorMsg()`

**Feature này được dùng bởi:**

- `features/checkout` — `useGetAddressesQuery`, `userKeys` để autofill + invalidate địa chỉ

---

# 8. Gotchas & Edge Cases

- **`useUpdateProfileMutation` KHÔNG tự update `authStore`** — sau mutation thành công, `ProfilePage` phải gọi `authStore.updateUser(newData)` thủ công. Bỏ sót → Header hiển thị avatar/tên cũ.
- **Avatar upload là 2 bước riêng biệt:** (1) upload file qua `useUploadSingleMutation` từ feature `upload` → lấy URL, (2) gọi `useUpdateProfileMutation({ avatar: newUrl })`, (3) gọi `authStore.updateUser({ avatar: newUrl })`.
- **Tab `orders` chỉ là redirect link** sang `/orders` — không fetch hay render order list trong profile.
- **`useSetDefaultAddressMutation` dùng PATCH** — không phải PUT. Khác với `useUpdateAddressMutation` (PUT).
- **`userKeys.all` là `['user']`** (số ít), không phải `['users']` — khi viết custom invalidation, không nhầm.
- **Protected route:** `ProfilePage` nằm sau `ProtectedRoute` trong `AppRoutes.tsx` — không cần check auth trong component.
- **`userKeys` được export** và dùng bởi `CheckoutPage` để invalidate danh sách địa chỉ sau khi thêm địa chỉ mới từ checkout.
- **Validate phone VN:** regex `/^(0|\+84)[0-9]{9}$/` sau khi remove spaces, dashes, dots. Phone không bắt buộc (optional field).

---

# 9. Tests

- `frontend/src/__tests__/user-pages.test.tsx` — ProfilePage, address management
