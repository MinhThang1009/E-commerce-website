# Naming — Modern TypeScript / JavaScript Conventions (2025-2026)

> Áp dụng cho mọi code TS/JS mới. Code cũ migrate dần khi có cơ hội (không bắt buộc rewrite hàng loạt).

## Type vs Interface
- `interface` cho object shape có khả năng extend (props, model, DTO):
  ```ts
  interface UserProps { id: number; name: string; }
  interface AdminUserProps extends UserProps { role: 'admin'; }
  ```
- `type` cho union, intersection, utility, primitive alias:
  ```ts
  type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered';
  type PartialUser = Partial<User>;
  ```
- KHÔNG dùng `I` prefix: `User` không phải `IUser` (Hungarian notation đã obsolete trong TS modern).

## Generic types
- Single letter cho generic đơn giản: `<T>`, `<K, V>`.
- Descriptive prefix `T` cho generic phức tạp/cụ thể: `<TUser>`, `<TPayload>`, `<TQueryParams>`.
- KHÔNG dùng tên type thường (như `User`) làm generic param → conflict với type thật.

## Type-only imports (TS 4.5+)
Dùng `import type` cho symbol chỉ là type — tree-shake tốt hơn, build nhanh hơn:
```ts
import type { Product } from '@/types';
import type { ReactNode } from 'react';
import { fetchProducts } from '@/services/productApi';
```

## Export style
- **Backend (CommonJS):** chỉ named export — `module.exports = { funcA, funcB }`. KHÔNG `module.exports = funcA` (default).
- **Frontend (ESM):**
  - **Component**: `export default` cho lazy-loadable (page, modal lớn) — `export default function HomePage() {}`.
  - **Hook, util, service, type**: named export — `export function useAuth() {}`, `export const formatPrice = ...`.
  - **Re-export trong `index.ts` barrel**: dùng named — `export { default as Button } from './Button'`.
- **Tránh mixed default + named** trong cùng file (gây confuse).

## Path alias
- Frontend: `@/*` map tới `frontend/src/*` (đã config trong `tsconfig.json` + `vite.config.ts`).
- Backend: relative path `../` (Node.js + CommonJS không alias mặc định, không cần TypeScript path mapping).
- Quy tắc: trong cùng folder/feature dùng relative `./`; cross-feature/cross-layer dùng `@/`.

## Import grouping order (FE)
```ts
// 1. React + framework
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. External libraries (alphabetical trong nhóm)
import { Button } from 'antd';
import dayjs from 'dayjs';

// 3. Internal absolute (@/)
import { useAuth } from '@/features/auth';
import { ProductCard } from '@/components/domain/product';

// 4. Internal relative
import { useProductForm } from '../hooks/useProductForm';
import type { ProductFormProps } from './types';

// 5. Styles (last)
import './ProductForm.module.css';
```
Có blank line giữa mỗi nhóm. Optional: ESLint rule `import/order` enforce.

## Component file suffix conventions
| Suffix | Khi nào dùng | Ví dụ |
|---|---|---|
| `*Page.tsx` | Top-level route component | `CheckoutPage.tsx`, `HomePage.tsx` |
| `*Layout.tsx` | Layout wrapper | `MainLayout.tsx`, `AdminLayout.tsx` |
| `*Modal.tsx` | Modal/Dialog | `ConfirmModal.tsx`, `ReviewModal.tsx` |
| `*Form.tsx` | Form container | `ProductForm.tsx`, `LoginForm.tsx` |
| `*Provider.tsx` | Context provider | `AuthProvider.tsx`, `ThemeProvider.tsx` |
| `*Section.tsx` | Page section | `HeroSection.tsx`, `HomeNewsSection.tsx` |
| `*Card.tsx` | Card-style display | `ProductCard.tsx`, `OrderCard.tsx` |
| `*List.tsx` | List rendering | `ReviewList.tsx`, `OrderList.tsx` |
| `*Item.tsx` | Single item trong list | `CartItem.tsx`, `ReviewItem.tsx` |
| `*Button.tsx` | Specialized button | `LoadingButton.tsx`, `IconButton.tsx` |
| `with*.tsx` | Higher-order component | `withAuth.tsx`, `withErrorBoundary.tsx` |

## Boolean props (React + HTML)
- **Custom prop**: `is*/has*/can*` prefix — `<Modal isOpen={true} />`, `<Form hasError={false} />`.
- **HTML attribute reflect**: giữ nguyên tên HTML — `<button disabled>` không `<button isDisabled>`; `<input readOnly>` không `<input isReadOnly>`. (React JSX dùng camelCase cho HTML attr: `readOnly`, `tabIndex`, `onClick`.)

## Custom hook return shape
- **2 element** (state + setter): tuple — `const [value, setValue] = useToggle()`.
- **3+ element**: object — `const { data, isLoading, error } = useGetProductQuery()`.
- Tuân theo pattern `useState` (tuple) và RTK Query (object) để consistent.

## Redux Toolkit
| Item | Convention | Ví dụ |
|---|---|---|
| Slice name | feature plural hoặc concept singular | `cart`, `auth`, `products`, `wishlist` |
| Action verb | imperative present | `setX`, `clearX`, `addX`, `removeX`, `toggleX`, `fetchX` |
| Selector | prefix `select` + camelCase | `selectCurrentUser`, `selectCartTotal`, `selectIsAuthenticated` |
| Thunk (createAsyncThunk) | verb + entity, KHÔNG suffix `Thunk` | `fetchProductById`, `submitOrder` |
| RTK Query endpoint | verb + entity | `getProducts`, `createOrder`, `updateUser` |
| RTK Query hook (auto) | `use{Endpoint}{Query|Mutation}` | `useGetProductsQuery`, `useCreateOrderMutation` |

## DTO / Payload / Response naming
- Request body: `{Action}{Entity}Dto` — `CreateUserDto`, `UpdateProductDto`, `LoginRequestDto`.
- Response: `{Entity}ResponseDto` hoặc `{Entity}Dto` (nếu chỉ có 1 shape) — `OrderResponseDto`, `UserDto`.
- Query params: `{Action}{Entity}QueryDto` — `ListProductsQueryDto`, `SearchProductsQueryDto`.
- File location: `dtos/{entity}Dto.js` (BE), `types/{entity}.types.ts` (FE shared types match BE DTO).

## Service method verbs (Backend)
| Verb | Semantic | Return |
|---|---|---|
| `getX(id)` | Lấy 1 record, MUST exist | Entity hoặc throw `AppError(404)` |
| `findX(id)` | Tìm 1 record, có thể null | Entity hoặc `null` |
| `listX(filters, pagination)` | Liệt kê collection có filter | `{ items, total, page, limit }` |
| `searchX(query)` | Full-text / fuzzy search | `{ items, total }` |
| `createX(payload)` | Tạo mới | Entity vừa tạo |
| `updateX(id, patch)` | Sửa partial | Entity sau update |
| `replaceX(id, full)` | Sửa toàn bộ (PUT) | Entity sau replace |
| `deleteX(id)` | Xóa (soft hoặc hard tùy entity) | `void` hoặc `{ deletedId }` |
| `processX(payload)` | Action có side-effect (payment, email, webhook) | Result object |
| `validateX(payload)` | Validate, throw nếu fail | `void` (throw) hoặc `boolean` |

## Repository method verbs (Backend)
- `findOneById(id, options)` — by primary key.
- `findOneBy{Field}(value, options)` — by other unique field (vd `findOneByEmail`).
- `findManyBy{Field}(value, options)` — by non-unique field.
- `findAll(filter, pagination)` — collection.
- `upsert(payload)` — insert hoặc update (UNIQUE conflict).
- `bulkInsert(rows)` — multi insert.
- `softDelete(id)`, `hardDelete(id)`, `restore(id)` — delete variants.
- KHÔNG chứa business logic — chỉ wrap ORM call có cache/options.
