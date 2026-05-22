# Frontend Component Tests — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Mục đích](#1-mục-đích)
- [2. Files](#2-files)
- [3. Setup & mocks](#3-setup--mocks)
  - [3.1 jest.config.cjs (root `frontend/`)](#31-jestconfigcjs-root-frontend)
  - [3.2 **mocks**/ trong test files](#32-__mocks__-trong-test-files)
- [4. Cách chạy](#4-cách-chạy)
- [5. Conventions](#5-conventions)
  - [5.1 Tên test](#51-tên-test)
  - [5.2 Render helper](#52-render-helper)
  - [5.3 User events](#53-user-events)
  - [5.4 Query priority](#54-query-priority)
  - [5.5 Async assertions](#55-async-assertions)
- [6. Gotchas](#6-gotchas)

---

# 1. Mục đích

Frontend tests xác minh:

- Component render đúng theo props/state
- User interactions (click, type, submit, navigation)
- Zustand stores logic (actions, state transitions, persistence)
- Utility functions (format, error parsing, token management)
- API hooks behavior (mock TanStack Query responses)

**KHÔNG test:**

- Browser-specific behavior (E2E sẽ làm)
- Real API calls (mock toàn bộ)
- Backend business logic

**Baseline:** 17 suites, 437 tests, ~7s runtime, **100% coverage** tất cả metrics. (Note: test count may differ slightly after loyalty/warranty removal.)

---

# 2. Files

| File                              | Phạm vi                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `auth-pages.test.tsx`             | Login, Register, ForgotPassword, ResetPassword pages                                  |
| `auth-pages-extra.test.tsx`       | Auth pages bổ sung (verify email, edge cases)                                         |
| `auth-store.test.tsx`             | `auth-store.ts` — actions, state transitions, localStorage/sessionStorage persistence |
| `auth-utils.test.tsx`             | `auth-utils.ts` — handleUnauthorizedError, handleAutoLogout, getErrorMessage          |
| `cart-orders-pages.test.tsx`      | Cart page, Orders page, Order detail                                                  |
| `catalog-pages.test.tsx`          | Shop page, Categories, Brands page                                                    |
| `catalog-pages-extra.test.tsx`    | Catalog pages bổ sung (filters, sorting, pagination)                                  |
| `catalog-detail-pages.test.tsx`   | ProductDetail page — variants, add to cart, reviews                                   |
| `catalog-chat-stores.test.tsx`    | Catalog store + Chat store — synergy, history management                              |
| `checkout-payment-pages.test.tsx` | Checkout flow → Payment redirect                                                      |
| `components.test.tsx`             | Shared components: Button, Modal, Input, Card, Badge, Pagination, Rating...           |
| `content-pages.test.tsx`          | Contact page, TrackOrder page                                                         |
| `stores.test.tsx`                 | Cart store, Wishlist store, UI store — actions + state                                |
| `token-manager.test.tsx`          | Token refresh, auto-logout, deduplication logic                                       |
| `user-pages.test.tsx`             | Profile page, Address management                                                      |
| `utils.test.cjs`                  | Utility functions (CommonJS test runner compat)                                       |
| `utils.test.tsx`                  | Utility functions — format, error-utils, cn, price-utils                              |
| `__mocks__/fileMock.cjs`          | Mock cho static files (images, SVG)                                                   |

---

# 3. Setup & mocks

## 3.1 jest.config.cjs (root `frontend/`)

```js
// Key config
preset: 'ts-jest'
testEnvironment: 'jsdom'
setupFilesAfterFramework: ['<rootDir>/jest.setup.cjs']  // import @testing-library/jest-dom
transform: {
  '^.+\\.tsx?$': 'ts-jest',
  '^.+\\.cjs$': ['babel-jest', ...]
}
moduleNameMapper: {
  '@/(.*)': '<rootDir>/src/$1',
  '@features/(.*)': '<rootDir>/src/features/$1',
  '@components/(.*)': '<rootDir>/src/components/$1',
  '@stores/(.*)': '<rootDir>/src/stores/$1',
  // ... (all aliases)
}
```

## 3.2 **mocks**/ trong test files

Các mocks thường dùng:

- **`apiClient`** mock — control response/error từ Axios
- **`i18n`** mock — `t(key) => key` (trả về key thô để test assertions đơn giản)
- **`react-router-dom`** — wrap trong `MemoryRouter` qua render helper
- **`react-i18next`** — `useTranslation()` trả về `{ t: key => key, i18n: { language: 'vi' } }`

---

# 4. Cách chạy

```bash
# từ frontend/
npm test                    # watch mode (jest default)
npm run test:ci             # CI mode + coverage + forceExit
```

---

# 5. Conventions

## 5.1 Tên test

```ts
// Tên bằng tiếng Việt, mô tả behavior cụ thể
describe('Button component', () => {
  it('hiển thị loading spinner khi isLoading=true', () => { ... });
  it('disable khi isLoading=true', () => { ... });
  it('gọi onClick khi click button', () => { ... });
});
```

## 5.2 Render helper

```ts
// Dùng renderWithProviders để wrap QueryClientProvider + BrowserRouter + i18n
import { renderWithProviders } from './test-utils';
const { getByRole, getByText } = renderWithProviders(<Component />);
```

## 5.3 User events

```ts
import userEvent from '@testing-library/user-event';
// Dùng userEvent thay fireEvent cho interactions gần với user thật
await userEvent.type(input, 'hello');
await userEvent.click(button);
```

## 5.4 Query priority

1. `getByRole` (accessibility)
2. `getByLabelText` (forms)
3. `getByText` (text content)
4. `getByTestId` (last resort)

## 5.5 Async assertions

```ts
// Đúng
await waitFor(() => expect(element).toBeInTheDocument());

// Sai
await new Promise((r) => setTimeout(r, 1000));
```

---

# 6. Gotchas

- **TanStack Query isolation:** tạo `QueryClient` mới cho mỗi test — `new QueryClient({ defaultOptions: { queries: { retry: false } } })` — để tránh data bleeding giữa tests.
- **Zustand stores:** reset trong `beforeEach` via `useStore.setState(initialState, true)` (second arg `true` = replace, không merge).
- **i18n key assertions:** khi mock `t(key) => key`, assert bằng key (`t('auth.login.title')` → `'auth.login.title'`), không phải text Việt/Anh.
- **Coverage 100%:** thêm code mới → phải kèm test. Không dùng `/* istanbul ignore */` trừ khi có lý do documented rõ ràng.
- **React 18 act() warnings:** đã handle trong setup. Nếu vẫn xuất hiện → check `await` thiếu trước user event calls.
- **localStorage mock:** Jest jsdom có `localStorage` global — test có side effects cần `beforeEach(() => localStorage.clear())`.
