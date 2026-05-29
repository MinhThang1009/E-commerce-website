# Handoff — Admin Flagship Redesign (branch `refactor/admin-glass-redesign`)

> Cập nhật: 2026-05-29. Đọc kèm `ADMIN_UI_FLAGSHIP_2026.md` (spec, project root).

## Commits đã có (mới → cũ)

```
899e240 refactor(admin): bỏ list Top sản phẩm trùng, low-stock full-width lưới 2 cột
8d935d4 refactor(admin): bố cục lại charts dashboard giảm khoảng trống
7e26414 feat(admin): polish dashboard + token-hoá UI + fix lọc đơn theo URL
06daeed feat(admin): rollout flagship 6 trang list + form stepper + Lucide icon
69384089 fix(admin): sửa clone sản phẩm 500 do .get() trên cột JSON attributes
4574e4b feat(admin): redesign Products flagship D/E + design-system (checkpoint gốc)
```

Working tree **sạch**. `.screenshots/` (untracked) là ảnh verify — không commit, nên gitignore.

## ĐÃ XONG

- **Rollout 6 trang LIST** (Users, Orders, Categories, Brands, Discount, Inventory): `AdminPageHeader` gradientTitle, `AdminStatCard` chung, StatStrip data thật, stock-bar, instant search, `admin-btn-primary`.
- **Form sản phẩm** (Create/Edit): bỏ tab ngang → `ProductFormStepper` (vertical stepper + timeline dọc) + `ProductFormSaveBar` (Lưu nháp/Xuất bản) + autosave localStorage (`use-form-autosave`). Xoá `TabNavigation`, `FormActions`.
- **Dashboard**: `Sparkline` (data thật 30 ngày từ `useGetDetailedStatsQuery`), bento doanh thu rộng 2 cột; charts reorder = Revenue Area **full-width** + 6 chart 3 hàng 2 cột đều (bỏ pie lẻ); bottom chỉ còn "Cảnh báo sắp hết hàng" full-width lưới 2 cột (đã bỏ list "Top sản phẩm" trùng với chart).
- **Token-hoá UI**: `Switch`/`Checkbox`/`Select`/`Input` + 9 admin form component + màu semantic inline → `var(--accent)` / `--admin-error/warning/info`. Switch dùng Liquid Glass (`.admin-switch` trong index.scss).
- **Dọn emoji → Lucide** toàn bộ admin + i18n (status select, Tiptap toolbar, attrModal/variantModal/specs) + storefront i18n + sample data. **0 emoji** còn trong vi/en.json.
- **Nút CTA solid → glass** (`admin-btn-primary`): "Áp dụng" charts, "Quản lý người dùng" dashboard. (Nút số trang pagination giữ solid — là chỉ báo.)
- **Fix bug**: clone sản phẩm 500 (backend, `productAttributes`); OrdersPage đọc `?status` từ URL; KPI Users tint color-mix; UserDetail cover → signature teal→coral.

## CÒN LẠI (ưu tiên trên xuống)

1. **(d) Toolbar dashboard** gom 2 ô date + "Áp dụng" vào popover "⚙ Tùy chỉnh" (`DashboardCharts.tsx` ~dòng 230-275) — đã duyệt, chưa làm.
2. **Nút Làm mới**: đổi `isLoading`→`isFetching` để icon quay khi bấm (Users/Categories/Brands/Inventory).
3. **2 key i18n pre-existing** thiếu ở en.json: `admin.products.editTabs.faqs`, `admin.products.pricing.comparePriceTooltipVariant`.
4. **Token semantic §2.2** (LỚN, cross-cutting, cần duyệt): bỏ `--admin-*` (Ant: info#1890ff/success#52c41a/error#ff4d4f/warning#faad14) → emerald/amber/red/blue đồng bộ chart §2.2. Đụng rất nhiều file → nên làm 1 lần ở `_tokens.scss` rồi grep thay.
5. **Categories tree thật** (indent + connector — spec §8 mới chỉ list phẳng).
6. **Command palette ⌘K** (phase F) · **Responsive/a11y QA** (phase G, bảng→card list <768).
7. **Xoá mock** `frontend/public/_mock-d.html` + `_mock-e.html` khi rollout hoàn tất.

## FILE/COMPONENT KHÓA

- Primitive chung: `features/admin/components/` → `AdminPageHeader`, `AdminStatCard`, `Sparkline`, `StatusPill`, `FlipNumber`, `DashboardCharts`, `GlassTooltip`.
- Form: `features/catalog/components/ProductFormStepper.tsx`, `ProductFormSaveBar.tsx`; hook `features/catalog/hooks/use-form-autosave.ts`.
- Glass/token classes: `frontend/src/styles/index.scss` (`.admin-btn-primary`, `.admin-switch`, `.admin-kpi-card`, `.admin-checkbox/radio`), tokens `_tokens.scss`.

## VERIFY (từ `frontend/`)

`npm run typecheck` · `npm run lint` (--max-warnings 0) · `npm run test:ci` (18 suites / **550** tests) · `node ../scripts/check-i18n.js` (parity; chỉ còn 2 key pre-existing ở mục #3).
Dev: BE `:8888`, FE `:5175`. Admin: admin@techstore.vn / Admin@123. Screenshot 2 theme qua chrome-devtools MCP (lưu ý: navigate→screenshot dễ race, dùng `wait_for` text trước khi chụp).

## GOTCHAS

- `primary-500` (#2AACA7) = brand teal = `--color-primary` (static); `var(--accent)` shift #2aaca7 light → #4bbcb8 dark. Form control dùng `var(--accent)`.
- `button.tsx`/`badge.tsx`/`alert.tsx` (shadcn) **cố ý giữ** palette (storefront-shared; alert emerald/amber/red/blue đã khớp §2.2).
- StatStrip "data thật": Orders dùng `useGetDashboardStatsQuery` (ordersByStatus); Products/Discount/Inventory tính từ list đã tải (page-scoped — chấp nhận như pattern hiện có).
- Charts hex (`CAT_PALETTE` trong ProductsPage, `chart-colors.ts`) = palette phân loại, KHÔNG token-hoá (giống Recharts).
- Commit format: `<type>(<scope>): <subject tiếng Việt ≤72 ký tự>`. Pre-commit chạy lint-staged (eslint+prettier) + audit-architecture; KHÔNG `--no-verify`.
