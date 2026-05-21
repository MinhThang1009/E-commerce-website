# Loyalty Feature — TechStore Frontend

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

Hiển thị điểm tích lũy của user và lịch sử giao dịch điểm. Không có route/page riêng — embedded hoàn toàn trong `ProfilePage` (tab loyalty) và `CheckoutPage` (checkout feature — hiển thị số điểm có thể dùng để đổi giảm giá).

**Không phải feature này xử lý:**

- Logic tính điểm (backend thực hiện sau ORDER DELIVERED)
- Logic đổi điểm khi thanh toán (checkout feature xử lý qua field `loyaltyPointsUsed` khi tạo đơn)

---

# 2. Cấu trúc Files

```
api/
  loyalty-api.ts   — useGetLoyaltyInfoQuery hook + loyaltyKeys

index.ts           — Barrel export
```

Feature tối giản — không có `components/`, `pages/`, `types/` directory.

---

# 3. State Management

## Server state (TanStack Query)

```typescript
export const loyaltyKeys = {
  all: ['loyalty'] as const,
  info: (params: unknown) => [...loyaltyKeys.all, 'info', params] as const,
};
```

## Client state (Zustand)

Không dùng Zustand store trực tiếp. `ProfilePage` đọc `isAuthenticated` từ `authStore` để enable query.

---

# 4. API Calls

## Queries

| Hook                                        | Endpoint                        | Mô tả                                                                               |
| ------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| `useGetLoyaltyInfoQuery(params?, options?)` | `GET /api/loyalty?page=&limit=` | Thông tin điểm tích lũy + lịch sử có pagination. Return type là `any` — chưa typed. |

**Signature đầy đủ:**

```typescript
function useGetLoyaltyInfoQuery(
  params?: { page?: number; limit?: number } | void,
  options?: { enabled?: boolean; skip?: boolean },
);
```

`options.skip` là compat cũ (invert của `enabled`). Dùng `enabled` cho code mới.

## Mutations

Không có mutation hook riêng. Đổi điểm xảy ra trong feature `orders` qua field `loyaltyPointsUsed` khi tạo đơn hàng.

---

# 5. Components chính

Không có components riêng trong feature này. UI hiển thị điểm được implement trực tiếp trong:

- **`ProfilePage`** (feature `users`) — tab loyalty:
  - Hiển thị tổng điểm: `loyaltyData?.data?.points`
  - Bảng lịch sử: `loyaltyData?.data?.history?.items` (type: `earn` / `spend` / `refund` / điều chỉnh)
  - Policy notes (3 rule bullets)

- **`CheckoutPage`** (feature `checkout`) — hiển thị số điểm khả dụng, cho phép chọn dùng điểm để giảm giá.

---

# 6. Types

Return type của `useGetLoyaltyInfoQuery` hiện là `any` — chưa typed. Shape thực tế từ backend response:

```typescript
// Inferred shape (không có type definition chính thức)
{
  data: {
    points: number; // Tổng điểm hiện có
    history: {
      items: Array<{
        id: string;
        type: 'earn' | 'spend' | 'refund' | string;
        points: number; // Dương = cộng, âm = trừ
        description: string;
        createdAt: string;
      }>;
      total: number;
      page: number;
      limit: number;
    }
  }
}
```

Khi cần typed → check backend `GET /api/loyalty` response và define interface trong `types/loyalty.types.ts`.

---

# 7. Dependencies

**Feature này phụ thuộc vào:**

- `lib/api-client` — HTTP requests
- `@tanstack/react-query` — server state

**Feature này được dùng bởi:**

- `features/users` — `ProfilePage` import `useGetLoyaltyInfoQuery` để hiển thị tab loyalty
- `features/checkout` — `CheckoutPage` import để hiển thị số điểm khả dụng

---

# 8. Gotchas & Edge Cases

- **Không có page/route riêng** — loyalty info hiển thị embedded trong `ProfilePage` (tab loyalty) và `CheckoutPage`. Không có `/loyalty` route.
- **Không có mutation hook riêng** — đổi điểm xảy ra trong orders feature qua `loyaltyPointsUsed` field khi tạo đơn hàng. Loyalty feature chỉ đọc, không ghi.
- **Điểm chỉ cộng sau DELIVERED** — không phải sau PLACED hay PAID. Hiển thị trong lịch sử với `type: 'earn'`.
- **Return type là `any`** — `useGetLoyaltyInfoQuery` chưa typed. Khi dùng data → tự narrow type bằng optional chaining.
- **`loyaltyKeys` được export** — dùng để `invalidateQueries` nếu cần refresh sau khi đổi điểm (ví dụ: sau `useConfirmReceivedMutation` trong orders feature).
- **`options.enabled` vs `options.skip`** — hook support cả 2 patterns (compat). Ưu tiên dùng `{ enabled: isAuthenticated }`.

---

# 9. Tests

Không có test file riêng cho feature loyalty. Logic được test gián tiếp qua:

- `frontend/src/__tests__/user-pages.test.tsx` — ProfilePage với tab loyalty
- `frontend/src/__tests__/checkout-payment-pages.test.tsx` — CheckoutPage với loyalty points
