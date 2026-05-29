# Handoff — Admin Flagship Redesign (branch `refactor/admin-glass-redesign`)

> Cập nhật: 2026-05-29. Đọc kèm `ADMIN_UI_FLAGSHIP_2026.md` (spec, project root).

## ⏩ Session 2026-05-30 — Audit + P0 fixes (đọc trước)

**Đã làm phiên này** (working tree sạch, mọi commit verify xanh typecheck/lint/test:ci 550/i18n):
- **Audit + kiểm chứng 9.5/10** → `ADMIN_POLISH_BACKLOG.md` (124 finding, P0/P1/P2 + thứ tự) + `ADMIN_AUDIT_VALIDATION.md` (chỉ **1 FP** = F121 `.input-error`; 52 gap mới audit gốc bỏ sót, 7 P0).
- **5 commit P0**: `f0892aa` (5 bug: `type=button` ×4 form chống submit sớm · OrdersPage `paymentMethod?.` crash guard · xoá AttributeModal `debug_attributes` · BrandsPage `safeHostname`) · `14bf552` (Pricing/Seo `grid-cols-1 sm:grid-cols-2`) · `7bf6e9c` (bỏ `localhost:8888` hardcode → derive `VITE_API_URL`) · `7b3f40e` (empty/loading state Inventory + Discount, phủ desktop+mobile) · `0000103` (docs).

**Bước kế (P0 cuối — chưa làm):** `DashboardCharts.tsx` thêm helper `EmptyChart` (icon + `t('admin.charts.noData')` — CẦN thêm i18n key) + skeleton, wrap 5 chart khi data rỗng. Data source: `orderStatusData?.data` (~L486), `userGrowthData?.data` (~L552), `topProductsData?.data` (~L625), `categoryData?.data` (~L688), `paymentMethodsData?.data` (~L780). Revenue+OrderCount đã có skeleton (`isDetailedLoading` ~L236). Lưu ý: marginal thấp (chart hiện vẫn render với data thưa; EmptyChart chỉ kích hoạt khi rỗng hẳn).

**Sau đó:** (1) fresh-review đợt P0 (~13 file, tránh self-review bias) · (2) P1 work-packages trong backlog (WP-A states chung → WP-B light-token → WP-C a11y…). **KHÔNG fix F121** (false positive). CAT_PALETTE = won't-fix (cố ý, theo gotcha).

## Commits đã có (mới → cũ)

```
190f5f6 feat(admin): danh mục dạng cây — thụt lề + connector + thu gọn
ee9e69a refactor(admin): nút glass + isFetching + token-hoá nốt control còn lại
0e99ae7 feat(admin): toolbar popover Tùy chỉnh + dời đơn hàng gần đây
5f31348 fix(admin): top-products query thiếu Product.id làm vỡ association ảnh
0a4110d docs(admin): handoff brief redesign (commits/việc còn lại/gotchas)
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

## ĐÃ XONG (đợt sau handoff)

- **(d) Toolbar dashboard** ✅: gom 2 ô date + "Áp dụng" vào popover "Tùy chỉnh" (nút `Settings2`, self-built popover — không thêm dep). Đóng khi click-outside/Escape/sau apply. Fix kèm: nâng `z-20` toolbar card khi popover mở (mỗi `admin-chart-card` là 1 stacking context do `backdrop-filter` → popover bị SVG chart đè). i18n `customize/fromDate/toDate`. Commit `0e99ae7`.
- **Nút Làm mới** ✅: `isLoading`→`isFetching` (Users/Categories/Brands/Inventory) để icon quay khi refetch. Commit `ee9e69a`.
- **2 key i18n pre-existing** ✅: thêm `editTabs.faqs` + `comparePriceTooltipVariant` → parity 100%. Bỏ số thứ tự "1." thừa ở tab label form. Commit `0e99ae7`.
- **Categories tree thật** ✅: dựng cây client-side từ `parentId` (BE `/categories/tree` trả PHẲNG, không nested!). Node có con → chevron thu gọn + badge số con; node con thụt lề + connector elbow (├/└). Bỏ phân trang (cây hiện toàn bộ + thu gọn), footer tổng số. i18n `expand/collapse/totalCount`. Verified screenshot thật (inject child vào React Query cache vì BE chặn tạo child — xem gotcha). Commit `190f5f6`.
- **Xoá mock** ✅: `_mock-d.html` + `_mock-e.html` — hoá ra bị gitignore (dòng 58), chưa từng tracked → xoá file thuần, không commit.
- **Polish thêm** ✅: nút solid→glass (EditProduct/QuickView/Attribute+VariantModal/sections), stepper active tint mềm, UserDetail avatar `z-10`, ProductCategoryForm chip+skeleton token-hoá. Backend: fix top-products query thiếu `Product.id`. Commit `5f31348`, `ee9e69a`.

## CÒN LẠI (ưu tiên trên xuống)

1. **Token semantic §2.2** (LỚN, cross-cutting, **cần duyệt**): bỏ `--admin-*` (Ant: info#1890ff/success#52c41a/error#ff4d4f/warning#faad14) → emerald/amber/red/blue đồng bộ chart §2.2. Đụng rất nhiều file → nên làm 1 lần ở `_tokens.scss` rồi grep thay.
2. **Command palette ⌘K** (phase F) · **Responsive/a11y QA** (phase G, bảng→card list <768).

## FILE/COMPONENT KHÓA

- Primitive chung: `features/admin/components/` → `AdminPageHeader`, `AdminStatCard`, `Sparkline`, `StatusPill`, `FlipNumber`, `DashboardCharts`, `GlassTooltip`.
- Form: `features/catalog/components/ProductFormStepper.tsx`, `ProductFormSaveBar.tsx`; hook `features/catalog/hooks/use-form-autosave.ts`.
- Glass/token classes: `frontend/src/styles/index.scss` (`.admin-btn-primary`, `.admin-switch`, `.admin-kpi-card`, `.admin-checkbox/radio`), tokens `_tokens.scss`.

## VERIFY (từ `frontend/`)

`npm run typecheck` · `npm run lint` (--max-warnings 0) · `npm run test:ci` (18 suites / **550** tests) · `node ../scripts/check-i18n.js` (parity **100%**, 2960 key mỗi file).
Dev: BE `:8888`, FE `:5175`. Admin: admin@techstore.vn / Admin@123. Screenshot 2 theme qua chrome-devtools MCP (lưu ý: navigate→screenshot dễ race, dùng `wait_for` text trước khi chụp; nếu báo "browser already running" → kill chrome process lọc theo path `chrome-devtools-mcp` rồi navigate lại).

## GOTCHAS

- `primary-500` (#2AACA7) = brand teal = `--color-primary` (static); `var(--accent)` shift #2aaca7 light → #4bbcb8 dark. Form control dùng `var(--accent)`.
- `button.tsx`/`badge.tsx`/`alert.tsx` (shadcn) **cố ý giữ** palette (storefront-shared; alert emerald/amber/red/blue đã khớp §2.2).
- StatStrip "data thật": Orders dùng `useGetDashboardStatsQuery` (ordersByStatus); Products/Discount/Inventory tính từ list đã tải (page-scoped — chấp nhận như pattern hiện có).
- Charts hex (`CAT_PALETTE` trong ProductsPage, `chart-colors.ts`) = palette phân loại, KHÔNG token-hoá (giống Recharts).
- Commit format: `<type>(<scope>): <subject tiếng Việt ≤72 ký tự>`. Pre-commit chạy lint-staged (eslint+prettier) + audit-architecture; KHÔNG `--no-verify`.
- **Tạo danh mục con BỊ CHẶN ở seed env**: category ID seed là số ("1","2"...) nhưng BE validate `parentId` phải UUID → `POST /api/categories` trả `400 "Invalid UUID"`. Không phải bug FE tree (chỉ render). Tree đã verify bằng cách inject child vào React Query cache `["categories","tree"]` rồi reload để bỏ. Nếu cần dùng nesting thật → phải xử lý mismatch số↔UUID ở BE trước (ngoài scope redesign).
