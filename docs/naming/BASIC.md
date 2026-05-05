# Naming — Basic (file / folder / code / DB / API / git / env)

## Backend (Node.js + Express + Sequelize)

### File naming
| Layer | Convention | Ví dụ |
|---|---|---|
| Models | `camelCase.js` | `product.js`, `orderItem.js` |
| Controllers | `camelCase.js` | `auth.js`, `product.js` |
| Routes | `camelCase.js` | `discountCode.js` |
| Validators | `camelCase.js` | `user.js` |
| Middlewares | `camelCase.js` | `authenticate.js` |
| Services | `camelCase.js` | `vnpay.js`, `email.js` |
| Utils | `camelCase.js` | `catchAsync.js` |
| Migrations | `YYYYMMDDHHmm-kebab-description.js` | `2026050501-rename-columns.js` |
| Tests | `{name}.test.js` hoặc `{name}.unit.test.js` | `chatbot.unit.test.js` |

### JavaScript code
- Variables, functions: `camelCase` (`getUserById`)
- Classes, Sequelize models: `PascalCase` (`Product`, `OrderItem`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_RETRY_COUNT`)
- Booleans: prefix `is*/has*/can*` (`isActive`, `hasDiscount`)
- Async functions: KHÔNG bắt buộc suffix Async, để TS/JSDoc detect

### Database (Phase 40 chuẩn)
- Tables: `snake_case` plural (`order_items`)
- Columns: `snake_case` (`created_at`, `points_earned`)
- FK constraints: `fk_{table}_{singular_ref}` (`fk_orders_user`)
- Indexes: `idx_{table}_{col}` hoặc `uq_{table}_{col}`
- ENUM values: lowercase, multi-word `snake_case`

### API URL
- Base: `/api/v1/` (hoặc `/api/`)
- Collection resources: kebab-case plural (`/products`, `/discount-codes`)
- Singleton resources: singular (`/cart`, `/auth`)
- Action endpoints: verb-style chấp nhận (`/auth/login`, `/uploads`)
- Path params: camelCase trong code, kebab trong URL nếu multi-word (`/orders/:orderId/items/:itemId`)

## Frontend (React + TS + Vite + Redux Toolkit)

### File naming
| Layer | Convention | Ví dụ |
|---|---|---|
| Pages | `*Page.tsx` PascalCase | `HomePage.tsx`, `CheckoutPage.tsx` |
| UI components | `PascalCase.tsx` | `Button.tsx`, `Card.tsx` |
| Domain components | `PascalCase.tsx` under `domain/{feature}/` | `domain/product/ProductCard.tsx` |
| Hooks | `use*.ts` camelCase | `useAuth.ts`, `useDebounce.ts` |
| Services | `{singularEntity}Api.ts` camelCase | `productApi.ts`, `emailCampaignApi.ts` |
| Types | `{entity}.types.ts` lowercase | `product.types.ts` |
| Store slices | `{entity}Slice.ts` camelCase | `authSlice.ts`, `cartSlice.ts` |
| Utils | `camelCase.ts` | `format.ts`, `priceUtils.ts` |
| Contexts | `*Context.tsx` PascalCase | `StripeContext.tsx` |
| i18n locales | `{lang}.json` | `vi.json`, `en.json` |

### Folder structure
```
frontend/src/
├── components/
│   ├── ui/              # Pure presentational (Button, Input, Modal...)
│   ├── domain/          # Domain-specific
│   │   ├── product/
│   │   ├── cart/
│   │   ├── order/
│   │   ├── review/
│   │   └── ...
│   ├── icons/           # SVG icon components
│   ├── layout/          # MainLayout, Footer, Grid
│   ├── modals/          # Global modals
│   └── sections/        # Page sections (Hero, HomeNews)
├── features/            # Redux slices + feature-scoped components
│   ├── auth/, cart/, products/, ...
├── pages/               # Top-level route components
├── hooks/, services/, store/, types/, utils/, contexts/, locales/
```

### TypeScript code
- Variables, functions: `camelCase`
- Types, interfaces, enums: `PascalCase` (`User`, `OrderStatus`)
- React components: `PascalCase`
- Component props interface: `{ComponentName}Props` (`ButtonProps`)
- Constants: `UPPER_SNAKE_CASE`
- Booleans: `is*/has*/can*` prefix
- Event handlers: `handle{Event}` (`handleSubmit`)
- Callbacks: `on{Event}` (`onSubmit` cho prop)

## Git
- Branch: `phase-{N}-{kebab-description}` (vd `phase-41-naming-consistency`)
- Commit: tuân Rule 4.1 plan.md (prefix + em dash + tiếng Việt)

## Env vars
- `UPPER_SNAKE_CASE` (`DATABASE_URL`, `JWT_SECRET`)
