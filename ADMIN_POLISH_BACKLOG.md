# Admin Polish Backlog — mục tiêu 9.5/10

> Nguồn: audit toàn diện 10 trang admin + design-system (2 vòng, 10 auditor song song qua workflow). Tổng **124 findings**. Cập nhật 2026-05-29. Đọc kèm `ADMIN_REDESIGN_HANDOFF.md`.
>
> ⚠️ **ĐÃ KIỂM CHỨNG** → xem `ADMIN_AUDIT_VALIDATION.md`: 124 finding gốc verify lại (chỉ **1 false positive** F121, 1 FIXED, 6 PARTIAL, 8 NEEDS_VERIFY, còn lại REAL) + phát hiện **52 gap mới audit gốc bỏ sót (7 P0!)** — gồm 5× nút thiếu `type="button"` gây submit form sớm, `localhost:8888` lộ production, modal crash. Các P0 gap này **ưu tiên cao hơn** phần lớn finding gốc.

## Tóm tắt

| Severity | Số lượng | Ý nghĩa |
|---|---|---|
| 🔴 P0 | 4 | Trang **trông như hỏng** — làm ngay |
| 🟠 P1 | 39 | Phần tách 7.5 → 9.5 (gộp thành 5 work-package WP-A…E) |
| 🟢 P2 | 81 | Delight / hoàn thiện (gộp 6 nhóm) |

**Điểm hiện tại ~7.5–8/10.** Khoảng cách tới 9.5 không ở lỗi chí mạng mà ở 4 trục: (1) states không đủ/không nhất quán, (2) light-mode hỏng hover (`bg-white/[0.0x]` ~49 chỗ/13 file), (3) a11y rải rác, (4) mỗi trang tự chế component thay vì dùng chung.

> Quy ước effort: `S` ≤30 phút · `M` ~1-3h · `L` >half-day.
> Path tương đối từ `frontend/src/`.

---

## 🔴 P0 — làm trước (~nửa ngày)

1. **Chart thiếu empty/loading state** `[M]` — `features/admin/components/DashboardCharts.tsx`. 5/7 chart (pie trạng thái, pie thanh toán, line user-growth, bar top-SP, bar danh mục) KHÔNG có empty/loading state → khi data thưa Recharts vẽ khung trống không nhãn. **Đây là gốc rễ "chart trông rỗng"** — đã verify KHÔNG phải bug màu (chart-colors.ts hex tĩnh hợp lệ, pie innerRadius55/outerRadius95). Fix: thêm helper `<EmptyChart>` (icon mờ + `t('admin.charts.noData')`) render khi `(data?.data ?? []).length === 0`; 5 query expose `isLoading` + dùng `.shimmer h-72` như Revenue/OrderCount.
2. **InventoryPage loading/empty là chữ thô** `[S]` — `features/admin/pages/InventoryPage.tsx:343-354`. Plain text trong `<td>` thay vì skeleton + empty-state icon+CTA. Fix: shimmer rows (giống `CategoriesPage:263-267`) + empty block (icon PackageX/Boxes + title + mô tả).
3. **DiscountCodesPage loading/empty là chữ thô** `[S]` — `features/admin/pages/DiscountCodesPage.tsx:314-325`. Fix: shimmer + empty-state block (icon + title + CTA "Tạo mã") đồng bộ `BrandsPage:202-222`.
4. **BrandsPage crash `new URL()`** `[S]` ✅VERIFIED — `features/admin/pages/catalog/BrandsPage.tsx:288` (và mobile `:369`). `new URL(record.website).hostname` không try/catch → website thiếu scheme (vd `techstore.vn`) hoặc malformed = throw, vỡ cả bảng. Fix: `const host = (() => { try { return new URL(record.website).hostname } catch { return record.website } })()`.

---

## 🟠 P1 — 5 work-package (37 findings)

### WP-A · States & error nhất quán `[L]` *(impact cao nhất — làm sau P0)*
Tạo `<EmptyState>` / `<ErrorState>` / skeleton dùng chung, áp mọi trang + chart.
- `UsersPage:93` **silent failure**: không destructure `error` → lỗi API hiện thành "không có dữ liệu".
- Error-state 3 kiểu khác nhau: Products có `<h2>` không `<p>`, Orders có `<p>` không `<h2>`, Users không có nhánh error.
- Inventory/Dashboard không xử lý `isError` (lỗi tải lẫn vào "no data").
- Dashboard low-stock card biến mất khi rỗng (bento mất cân bằng) → cần positive-empty-state ("Không có SP sắp hết").
- Skeleton Dashboard/Edit lệch layout thật → CLS lớn.
- `CreateProductPage:201,562` `missingFields={[]}` hardcode → validation create không liệt kê field thiếu (Edit thì đúng).
- Orders empty-state mất trên mobile (`OrdersPage:440-623`, card-list bọc trong `length>0`).

### WP-B · Light-mode tokens `[M]` *(cần screenshot light verify)*
- `styles/index.scss` + `_tokens.scss`: thêm `--bg-hover`/`--bg-subtle` + biến thể `.dark` cho semantic color (info/warning/violet/danger/success hiện chỉ define ở `:root`, không dark variant → text màu trên nền tối thiếu contrast). Đề xuất dark dùng Tailwind-400 (`#60a5fa`/`#fbbf24`/`#a78bfa`/`#f87171`/`#34d399`).
- Thay ~49× `bg-white/[0.0x]` (13 file) → token theme-aware (light mode hiện gần như vô hình).
- **Bug**: `index.scss:1683-1697` define trùng `--color-border`/`--color-bg-secondary` đè block đầu → dark border thành `#334155` (slate ám xanh, vi phạm rule neutral). Xoá block trùng, giữ `#27272a`.
- **Perf**: `index.scss:120-124` universal `transition: *` áp mọi node → jank table/chart khi filter/sort. Thu hẹp scope.

### WP-C · A11y `[M]`
- aria-label nút icon-only desktop: `CategoriesPage:437-452`, `BrandsPage:302-317`, `OrdersPage:599-614`, `ProductsPage:703-735` (mobile đã có → inconsistency).
- `ProductsPage:539` checkbox "select all" aria-label = "Hình ảnh" (SAI nghĩa).
- Chart SVG không có `role="img"`+aria-label / data-table fallback (`DashboardCharts`).
- `<select>` groupBy/compare + Status Select trong row thiếu label.
- focus-visible ring thiếu (Categories tree toggle, AdminLayout nav/menu, Inventory expand).
- GrowthPill chỉ dựa màu+mũi tên, không text → fail "don't use color alone" (`DashboardPage:57-74`).
- `AdminLayout:232-252` user-menu thiếu aria-expanded/haspopup; `:352` Bell aria-label hardcode "Notifications".

### WP-D · Component dùng chung / consistency `[M]`
- `<Pagination>` chung cho `ProductsPage:908-961` + `BrandsPage:414-442` (tự chế, light-mode hỏng).
- `StatusPill` cho `OrdersPage:66-115` (tự định nghĩa STATUS_CONFIG).
- Dialog glass thay `window.confirm`: `UsersPage:127-128`, `DiscountCodesPage:157-171`.
- `BrandsPage` `any` → import `Brand` type, bỏ eslint-disable.
- `AdminLayout:254-276` user-menu không outside-click/ESC dismiss → dùng Radix DropdownMenu.

### WP-E · Bug `[S-M]`
- `OrdersPage:413-417` search uncontrolled (thiếu `value`) + không debounce.
- `OrdersPage:745,289` pagination dùng `pagination.totalPages` (API) thay biến local *(cần verify shape API)*.
- `GlassTooltip:56-62` nhãn series chỉ render khi có `color` → mất nhãn với Bar/Cell.
- `AdminLayout:349-359` Bell không `onClick`, dot đỏ tĩnh giả.
- `w-4.5` (DashboardPage/AdminStatCard) có thể không generate *(verify build Tailwind v4)*.
- `CreateProductPage:434` `alert()` native chặn thread → `addNotification`.

---

## 🟢 P2 — 62 findings, 6 nhóm

- **i18n sweep** `[M]`: `sectionNumber` hardcode VN ×7 file (Products/Orders/Users/Create/Edit/UserDetail), `'N/A'` (`OrdersPage:893,936`), aria-label "Previous/Next" tiếng Anh.
- **Dead-code** `[S]`: `useEffect` rỗng (`CreateProduct:177`), orphan state (`_attributeGroups/_hierarchicalVariants/_specifications`, `_isDataLoaded`), `_getTabLabelStyle`, `isFetchingForExport` dead, `key={index}` (`UserDetail:362`).
- **Null-safety** `[M]`: `Math.min(...NaN)` giá (`ProductsPage:273`), label `'undefined'` tồn kho (`:1066`), `order.id.substring` thiếu `?.` (`UserDetail:272`).
- **Micro-interaction** `[S]`: QuickView thiếu `exit` anim (`ProductsPage:1000`), hover/transition không đồng nhất card/row.
- **Responsive** `[M]`: stepper 9 bước dọc đẩy form xuống sâu <lg, bảng chi tiết đơn cuộn ngang mobile (`OrdersPage:768-832`).
- **Token polish** `[S]`: `CAT_PALETTE` 8 hex cứng (`ProductsPage:94`), `strokeWidth` 3 mức lẫn, radii scale, màu tiền `--color-info`.

---

## Thứ tự thực hiện đề xuất
1. **P0** (4) — hết "trông hỏng".
2. **WP-A states** — nền tảng, kéo theo nhiều P1/P2 states.
3. **WP-B light tokens** — define token trước rồi replace (cần screenshot light).
4. **WP-C a11y + WP-E bug** — batch nhỏ song song.
5. **WP-D consistency** — đụng nhiều file, làm sau khi có component chung.
6. **P2** — cuối.

## ⚠️ Cần xác minh trước khi code
Screenshot light-mode (hover/token) · shape API `pagination.totalPages` · `w-4.5` build Tailwind v4 · đo contrast thật (avatar gradient, dark semantic) · ý đồ stepper edit khác create.

---

## Phụ lục — toàn bộ 124 findings chi tiết
> Raw findings từ audit (P0=4 · P1=39 · P2=81), nhóm theo severity → category. Work-package ở trên đã gộp/dedup các findings này.

### 🔴 P0

- **[BUG]** `features/admin/pages/BrandsPage.tsx:288` _(Lists catalog)_  
  new URL(record.website).hostname gọi không try/catch — nếu website không có scheme (vd 'techstore.vn' thay vì 'https://...') hoặc rỗng-nhưng-truthy thì new URL() throw → crash cả bảng (silent failure thành blank/error boundary). Cùng lỗi ở mobile card line 369.  
  **Fix:** Bọc helper an toàn: const host = (() => { try { return new URL(record.website).hostname } catch { return record.website } })(); hoặc validate scheme trước khi render. Áp dụng cả desktop (288) và mobile (369).

- **[STATES]** `features/admin/components/DashboardCharts.tsx:482-540, 549-577, 622-676, 685-727, 739-767, 776-803` _(Dashboard charts)_  
  Chỉ Revenue/OrderCount có skeleton (gated `isDetailedLoading`, line 236). 5 chart còn lại (orderStatus pie, userGrowth line, topProducts bar, category bar, paymentMethods pie) KHÔNG có loading state, KHÔNG có empty state. Khi data thưa hoặc `data: []` thì Recharts render một khung trống không nhãn — đúng triệu chứng 'chart trông rỗng' người dùng thấy. Đây là gốc rễ UX, không phải bug màu.  
  **Fix:** Thêm helper EmptyChart (icon mờ + dòng `t('admin.charts.noData')`) render khi `(data?.data ?? []).length === 0`. Bọc mỗi `<ResponsiveContainer>` trong điều kiện: data rỗng → EmptyChart, ngược lại → chart. Đồng thời 5 query này nên expose `isLoading` và dùng cùng `.shimmer h-72` như 2 chart đầu để loading nhất quán.

- **[STATES]** `features/admin/pages/DiscountCodesPage.tsx:314-325` _(Lists catalog)_  
  Loading & empty dùng plain text ('common.loading'/'common.noData') trong colSpan cell — không skeleton, không empty-state icon+CTA. Lệch hẳn với CategoriesPage/BrandsPage (cùng nhóm list) vốn có shimmer + empty block đẹp.  
  **Fix:** Dùng shimmer skeleton cho isLoading và empty-state block (icon Percent/TicketPercent + title + description + nút 'Tạo mã' CTA) thống nhất với BrandsPage line 202-222.

- **[STATES]** `features/admin/pages/InventoryPage.tsx:343-354` _(Lists catalog)_  
  Loading & empty states dùng plain text trong <td> ('common.loading' / 'common.noData') — không có skeleton/shimmer cũng không có empty-state icon+CTA như chuẩn ProductsPage/UsersPage/CategoriesPage/BrandsPage. Trông như trang bị hỏng/trống trơn khi không có data.  
  **Fix:** Thay loading bằng shimmer rows (giống CategoriesPage line 263-267: [...Array(6)].map shimmer h-14) và empty bằng block flex-col items-center có icon (PackageX/Boxes) + tiêu đề + mô tả, đồng bộ với 3 trang còn lại.


### 🟠 P1

- **[A11Y]** `features/admin/components/AdminLayout.tsx:232-252` _(Design-system components)_  
  Nút toggle user-menu thiếu aria-expanded và aria-haspopup; screen reader không biết đây là disclosure mở popover. ChevronDown xoay là visual-only.  
  **Fix:** Thêm aria-expanded={showUserMenu} aria-haspopup="menu" vào <button>. Cân nhắc thêm id + aria-controls trỏ tới container popover.

- **[A11Y]** `features/admin/components/AdminLayout.tsx:174-189,232,264,319,349` _(Design-system components)_  
  Các nav link / button tương tác không áp focus-visible ring. Design system có sẵn utility .focus-ring nhưng không dùng ở đây; keyboard user khó thấy focus (nhất là khi reset outline).  
  **Fix:** Thêm focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none (hoặc class .focus-ring) cho Link nav, nút user-menu, nút Menu, nút Bell, link trong dropdown. Cần xác minh outline mặc định có bị reset không.

- **[A11Y]** `features/admin/components/DashboardCharts.tsx:411-470, 482-540, 549-577, 622-676, 685-727, 739-767, 776-803` _(Dashboard charts)_  
  Toàn bộ chart là SVG thuần, không có `role="img"` + `aria-label` tóm tắt dữ liệu, cũng không có bảng/figcaption thay thế. Screen reader không đọc được bất kỳ chart nào. Heading dùng `<h3>` (tốt) nhưng nội dung chart hoàn toàn vô hình với AT.  
  **Fix:** Bọc mỗi `<ResponsiveContainer>` trong `<div role="img" aria-label={t('admin.charts.<name>') + ' — ' + summaryText}>` với summaryText sinh từ data (vd tổng doanh thu, số đơn). Lý tưởng hơn: thêm `<figure>`+`<figcaption>` hoặc visually-hidden data table fallback.

- **[A11Y]** `features/admin/components/DashboardCharts.tsx:336-344, 350-370` _(Dashboard charts)_  
  `<select>` groupBy (336) và compare (350) không có `<label>` hay `aria-label`. Icon-only context khiến screen reader chỉ đọc giá trị hiện tại, không biết select này điều khiển gì.  
  **Fix:** Thêm `aria-label={t('admin.charts.groupByLabel')}` cho select groupBy và `aria-label={t('admin.comparison.label')}` cho select compare.

- **[A11Y]** `features/admin/pages/BrandsPage.tsx:302-317` _(Lists catalog)_  
  Nút icon-only Edit/Delete desktop table thiếu aria-label (chỉ title). Mobile card line 382/390 cũng thiếu aria-label. Lệch chuẩn DiscountCodesPage/UsersPage.  
  **Fix:** Thêm aria-label cho cả 4 button (2 desktop + 2 mobile) dùng t('common.edit')/t('common.delete').

- **[A11Y]** `features/admin/pages/CategoriesPage.tsx:437-452` _(Lists catalog)_  
  Nút icon-only Edit/Delete trong DESKTOP table chỉ có title, thiếu aria-label → screen reader đọc rỗng. (Mobile card line 555/564 đã có aria-label, desktop thì không → cũng là inconsistency nội bộ.) DiscountCodesPage desktop có cả title+aria-label nên Categories/Brands tụt lại.  
  **Fix:** Thêm aria-label={t('common.edit')} và aria-label={t('common.delete')} cho 2 button desktop, đồng bộ với DiscountCodesPage line 410/419.

- **[A11Y]** `features/admin/pages/CategoriesPage.tsx:366-385` _(Lists catalog)_  
  Nút toggle thu gọn cây có aria-expanded/aria-label tốt nhưng thiếu focus-visible style — keyboard nav qua cây không thấy focus rõ trên nền glass. Áp dụng tương tự nút edit/delete (chỉ có hover, không focus-visible).  
  **Fix:** Thêm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 cho các button icon-only trong trang.

- **[A11Y]** `features/admin/pages/DashboardPage.tsx:57-74, 386, 429` _(Design tokens (SCSS))_  
  GrowthPill conveys direction only via an up/down arrow icon + color and a bare number (e.g. '12.5%'). There is no text/aria indicating increase vs decrease, so screen-reader users hear just '12.5%' with no sign, and the meaning relies on color (fails 'don't use color alone'). The arrow icon has no accessible label.  
  **Fix:** Add a visually-hidden sign or aria-label to GrowthPill, e.g. aria-label={`${isPositive ? t('admin.dashboard.stats.increase') : t('admin.dashboard.stats.decrease')} ${abs}%`} on the span, and mark <Arrow aria-hidden />. Same treatment for the AdminStatCard trend pill (line 78-90).

- **[A11Y]** `features/admin/pages/InventoryPage.tsx:374-385` _(Lists catalog)_  
  Nút toggle expand/collapse (Chevron) trong desktop table thiếu type="button" và thiếu aria-label/aria-expanded → không cho biết trạng thái mở/đóng cho screen reader; cũng thiếu focus-visible ring rõ.  
  **Fix:** Thêm type="button", aria-expanded={isExpanded}, aria-label={isExpanded ? t('inventory.collapse') : t('inventory.expand')} (cần thêm i18n keys), và focus-visible:ring-2.

- **[A11Y]** `features/admin/pages/catalog/ProductsPage.tsx:539` _(Lists nhiều traffic)_  
  Checkbox 'select all' trong header table có aria-label={t('admin.products.table.image')} → đọc ra là 'Hình ảnh', SAI hoàn toàn ngữ nghĩa. Screen reader sẽ thông báo checkbox chọn-tất-cả là 'Hình ảnh'.  
  **Fix:** Đổi thành aria-label mô tả đúng, vd t('admin.products.bulk.selectAll', { defaultValue: 'Chọn tất cả sản phẩm' }).

- **[A11Y]** `features/admin/pages/orders/OrdersPage.tsx:599-614` _(Lists nhiều traffic)_  
  2 nút icon-only (Eye/Pencil) trong cột actions của bảng desktop chỉ có title=, KHÔNG có aria-label. title hỗ trợ screen reader không đáng tin cậy (nhiều SR bỏ qua title trên button). ProductsPage cũng cùng vấn đề (line 703-735: các nút view/edit/clone/delete chỉ title, không aria-label). UsersPage thì làm ĐÚNG (vừa title vừa aria-label) → CONSISTENCY + A11Y.  
  **Fix:** Thêm aria-label cho mọi nút icon-only ở OrdersPage desktop và ProductsPage (desktop+mobile), đồng bộ với pattern UsersPage đã có aria-label.

- **[A11Y / I18N]** `features/admin/components/AdminLayout.tsx:352` _(Design-system components)_  
  Nút Bell dùng aria-label hardcoded tiếng Anh "Notifications" — vi phạm i18n (mọi user-visible string phải qua t()) và không đồng bộ ngôn ngữ khi switch sang vi.  
  **Fix:** Đổi thành aria-label={t('admin.notifications')} (thêm key vào cả vi.json + en.json). Tham chiếu pattern nút Menu ngay trên đã dùng t('admin.menu').

- **[A11Y / UX]** `features/admin/pages/catalog/CreateProductPage.tsx:434` _(Form & detail)_  
  Dùng native alert() để cảnh báo khi tab chưa được phép truy cập (handleTabChange). alert() block thread, không theo design glass, không nhất quán với addNotification() đã dùng ở các chỗ khác trong cùng file (line 172, 373, 386), và không accessible/i18n-styled như toast hệ thống.  
  **Fix:** Thay alert(t('admin.products.tabs.incompleteWarning')) bằng addNotification({ message: t('...'), type: 'warning' }) để đồng nhất với pattern notification còn lại.

- **[BUG / DEAD-CODE]** `features/admin/components/AdminLayout.tsx:254-276` _(Design-system components)_  
  Popover user-menu (showUserMenu) không có outside-click dismiss và không đóng bằng ESC. Mở menu rồi click chỗ khác → menu kẹt mở; điều hướng bằng route khác cũng không reset state. Trải nghiệm hỏng nhẹ.  
  **Fix:** Dùng Radix DropdownMenu (đã có shadcn/ui) thay cho state thủ công — tự xử lý outside-click, ESC, focus trap, aria. Hoặc tối thiểu thêm useEffect đăng ký listener mousedown/keydown(Escape) đóng menu.

- **[BUG / DEAD-CODE]** `features/admin/components/AdminLayout.tsx:349-359` _(Design-system components)_  
  Nút Bell (notifications) không có onClick — chỉ là placeholder. Dot đỏ luôn hiển thị (hardcoded) gợi ý có thông báo nhưng click không làm gì → silent dead UI.  
  **Fix:** Nếu chưa có tính năng notification: ẩn nút hoặc disable + tooltip 'Sắp có'. Nếu giữ: gắn handler mở panel và bind dot vào state thật (số lượng chưa đọc). Tránh dot đỏ tĩnh đánh lừa.

- **[BUG / Dead-code]** `features/admin/pages/catalog/CreateProductPage.tsx:177` _(Form & detail)_  
  useEffect rỗng `useEffect(() => {}, [attributes])` — comment nói 'Debug: Log attributes' nhưng body trống, không làm gì. Dead effect chạy mỗi lần attributes đổi, gây nhiễu và hiểu nhầm ý đồ.  
  **Fix:** Xóa hẳn useEffect rỗng này (cùng comment debug đi kèm).

- **[BUG/SILENT-FAILURE]** `features/admin/components/GlassTooltip.tsx:56-62` _(Dashboard charts)_  
  Tên series (`displayName`) chỉ render BÊN TRONG khối `{entry.color && (...)}`. Nếu Recharts không truyền `color` (xảy ra với một số payload: Bar dùng <Cell>, pie ở vài version, ghost Line), tooltip mất hẳn nhãn tên — chỉ còn giá trị trần. Silent label loss.  
  **Fix:** Tách `displayName` ra ngoài điều kiện color: luôn render `<span>{displayName}</span>`, chỉ chấm màu (`<span className="w-2 h-2 rounded-full">`) mới gated bởi `entry.color`. Đảm bảo label luôn hiển thị.

- **[BUG/SILENT-FAILURE]** `features/admin/pages/UsersPage.tsx:93` _(Lists nhiều traffic)_  
  useGetAllUsersQuery KHÔNG destructure 'error' → khi API lỗi, trang chỉ hiển thị empty-state 'Không có dữ liệu' (isEmpty = !isLoading && users.length===0), che giấu lỗi thật. Admin tưởng không có user trong khi thực ra request fail. Silent failure.  
  **Fix:** Destructure error từ query và render error-state riêng (giống Orders/Products) trước khi rơi vào nhánh isEmpty.

- **[BUG/SILENT-FAILURE]** `features/admin/pages/orders/OrdersPage.tsx:413-417` _(Lists nhiều traffic)_  
  Input search là UNCONTROLLED — chỉ có onChange={handleSearch}, KHÔNG có prop value. searchTerm state thay đổi nhưng ô input không bind value nên: (1) không thể reset/clear search bằng code, (2) khác hẳn ProductsPage (value={searchTerm}) và UsersPage (value={filters.search}) → CONSISTENCY. Ngoài ra search KHÔNG debounce (gọi API mỗi keystroke qua setSearchTerm→query), trong khi ProductsPage có debounce 300ms reset page.  
  **Fix:** Thêm value={searchTerm} vào Input. Cân nhắc bọc handleSearch trong debounce (useDebounce hook đã có ở src/hooks/use-debounce.ts) để tránh gọi API mỗi ký tự.

- **[BUG/SILENT-FAILURE]** `styles/index.scss:120-124` _(Design tokens (SCSS))_  
  Universal transition `*, *::before, *::after { transition: var(--theme-transition); }` áp transition lên MỌI element. Trên admin có table/list nhiều row + chart → mỗi lần hover/state-change trigger transition trên hàng nghìn node, gây jank, và transition color/bg 0.4s làm UI 'lờ đờ' khi filter/sort table. Đây là anti-pattern perf phổ biến.  
  **Fix:** Giới hạn scope: chỉ transition trên element thật sự đổi theme, hoặc dùng selector hẹp hơn. Tối thiểu thêm các container động (table, .recharts-wrapper) vào danh sách .no-theme-transition ở line 127-132. Cần xác minh bằng performance trace.

- **[BUG/SILENT-FAILURE]** `tailwind.config.js + features/admin/pages/DashboardPage.tsx + components/AdminStatCard.tsx:tailwind.config.js:104-112; DashboardPage:288,319,380,487; AdminStatCard:72` _(Design tokens (SCSS))_  
  The config overrides theme.extend.spacing with an explicit numeric scale that has keys 4 and 5 but NO 4.5. Icons use className='w-4.5 h-4.5' (5 occurrences). Under a classic JS spacing map these utilities are not generated and not safelisted, so the icons may render at their fallback/intrinsic size instead of the intended 18px, breaking icon-size consistency. NEEDS VERIFICATION: project is Tailwind v4 (@tailwindcss/vite) where the dynamic --spacing scale can still emit 4.5 even with a JS config; behavior at the v3-config-on-v4 boundary is uncertain.  
  **Fix:** Confirm in the built CSS / DevTools whether .w-4.5 exists. If missing, either add 4.5:'1.125rem' (and 3.5 already exists) to theme.extend.spacing, or replace w-4.5 h-4.5 with an in-scale size (w-4 h-4 or w-5 h-5) consistently across both files.

- **[CONSISTENCY]** `features/admin/pages/BrandsPage.tsx:82,153,247,329` _(Lists catalog)_  
  editingBrand: useState<any>, handleEdit(brand: any), record: any xuyên file (eslint-disable no-explicit-any ở line 7). Các trang khác (CategoriesPage dùng Category, DiscountCodesPage dùng DiscountCode) đều typed. Brand đã có type ở features/catalog nhưng không import → mất type-safety.  
  **Fix:** Import Brand type từ @features/catalog/types và bỏ eslint-disable; thay any bằng Brand.

- **[CONSISTENCY]** `features/admin/pages/DiscountCodesPage.tsx:157-171` _(Lists catalog)_  
  Dùng window.confirm() cho delete — phá vỡ glass design. CategoriesPage và BrandsPage đã dùng <Dialog className="glass-dialog"> confirm đẹp. Đây là inconsistency rõ giữa 4 trang cùng nhóm (UsersPage cũng còn window.confirm nhưng ngoài scope).  
  **Fix:** Thay bằng deleteConfirmId state + <Dialog glass-dialog> như CategoriesPage line 587-614 (icon Trash2 trong vòng tròn danger, nút Hủy/Xóa).

- **[CONSISTENCY]** `features/admin/pages/DiscountCodesPage.tsx:347,349,379,455,457,485` _(Lists catalog)_  
  Icon màu hardcode qua token nhưng dùng trực tiếp text-[var(--color-warning)]/text-[var(--color-success)]/text-[var(--color-info)] cho icon Percent/Banknote và usedCount — trong khi StatusPill đã chuẩn hoá. OK về token nhưng usedCount dùng --color-info còn type icon mix warning/success → bảng màu lộn xộn so với phần còn lại (teal accent chủ đạo). Cần xác minh chủ ý.  
  **Fix:** Cân nhắc gom: dùng --accent cho usedCount thay --color-info để đồng nhất accent teal; giữ warning/success cho percent/fixed nếu là chủ ý semantic. Cần xác minh với design.

- **[CONSISTENCY]** `styles/index.scss:40-48, 96-103, 1646-1697` _(Design tokens (SCSS))_  
  --color-bg-primary / --color-text-primary / --color-border bị define TRÙNG ở 2 nơi với GIÁ TRỊ KHÁC NHAU. Block 1 (line 40-48 light, 96-103 dark) set --color-bg-secondary:#fafafa, --color-text-secondary:#52525b, --color-border dark:#27272a. Block 2 (line 1683-1697) set lại --color-bg-secondary:#f9fafb, --color-text-secondary:#6b7280, --color-border dark:#334155 (xanh slate, vi phạm rule 'neutral không slate blue'). Vì cùng specificity, block sau (1646+) THẮNG → legacy compat values ở block đầu bị vô hiệu, dark border thành #334155 (ám xanh).  
  **Fix:** Xóa block trùng ở line 1683-1697 (và phần .dark tương ứng 1690-1697), giữ 1 nguồn duy nhất. Nếu muốn giữ legacy compat thì hợp nhất giá trị — đặc biệt sửa --color-border dark về #27272a (neutral) thay vì #334155 (slate).

- **[I18N/STATES]** `features/admin/components/DashboardCharts.tsx:536, 799` _(Dashboard charts)_  
  Tooltip 2 pie (orderStatus line 536, paymentMethods line 799) dùng `<GlassTooltip />` không truyền `formatter` lẫn `labelMap`. Kết quả: hiển thị nameKey thô (vd `momo`, `cod`) và count trần không định dạng; với payment, field `revenue` bị bỏ hẳn (không formatPrice). Tên phương thức/status không qua i18n.  
  **Fix:** Truyền `labelMap` map method/status → `t(...)` và `formatter` phù hợp. Với paymentMethods, cân nhắc hiển thị cả revenue đã `formatPrice()` (hiện chỉ map `value`=count).

- **[RESPONSIVE]** `features/admin/pages/InventoryPage.tsx:387` _(Lists catalog)_  
  Cột tên sản phẩm desktop dùng truncate max-w-[300px] nhưng <td> không có cơ chế giãn — ở khoảng 768-1024px tên dài bị cắt sớm trong khi vẫn còn chỗ. Bảng không có min-w nên có thể bị bóp. So với DiscountCodesPage có min-w-[800px] đảm bảo scroll.  
  **Fix:** Thêm min-w cho table (vd min-w-[720px]) để overflow-x-auto hoạt động đúng, hoặc bỏ max-w cứng để tên giãn theo cột.

- **[RESPONSIVE]** `features/admin/pages/orders/OrdersPage.tsx:745` _(Lists nhiều traffic)_  
  Pagination chỉ render khi pagination.totalPages > 1 NHƯNG totalPages của API có thể KHÔNG được set đúng (totalPages tính local ở line 289 = Math.ceil(totalItems/pageSize), còn điều kiện render dùng pagination.totalPages từ API). Nếu API không trả pagination.totalPages mà chỉ trả totalItems thì pagination biến mất dù có nhiều trang. Cần xác minh shape API.  
  **Fix:** Đổi điều kiện render dùng biến local totalPages đã tính: {totalPages > 1 && (...)} thay vì pagination.totalPages, đồng bộ cách UsersPage làm (line 548 dùng totalPages local). Cần xác minh.

- **[STATES]** `features/admin/pages/DashboardPage.tsx:108-113, 549-607` _(Design tokens (SCSS))_  
  Two silent missing-states. (1) The Low Stock card is rendered only when lowStockProducts.length > 0; there is no loading skeleton while useGetLowStockAnalyticsQuery is pending and no 'no low-stock items' positive-empty state — the card simply vanishes and the recent-orders card silently expands to full width (grid drops lg:grid-cols-2). (2) useGetAdminOrdersQuery / lowStock queries have no isError handling: only the top-level dashboard query has an error branch (161-179); if orders or low-stock fail, recent-orders shows the generic empty 'noRecentOrders' text (line 541) masking a real error as 'no data'.  
  **Fix:** Render the Low Stock card as a permanent half when not loading, with an explicit empty state (e.g. CheckCircle2 + 'Không có sản phẩm sắp hết hàng') so the bento stays balanced; add a lowStock loading skeleton. For recent orders, branch on the query isError to show a small inline error/retry instead of the empty-state text.

- **[STATES]** `features/admin/pages/DashboardPage.tsx:140-159, 304-447` _(Design tokens (SCSS))_  
  Loading-skeleton shape does not match the rendered layout. The skeleton (147-156) draws 3 equal cards then a 4-up row of h-20 tiles, but the real layout (304-447) is a 2/3 + 1/3 bento (lg:col-span-2) plus a quick-actions bar, charts, and a 2-col bottom row. The layout shift on load is large and the quick-actions/charts blocks have no skeleton at all, so they pop in.  
  **Fix:** Make the skeleton mirror the bento: lg:grid-cols-3 with first child lg:col-span-2, add a skeleton block for the quick-actions bar and a placeholder for DashboardCharts, to minimize CLS.

- **[STATES]** `features/admin/pages/InventoryPage.tsx:82-109,141-178` _(Lists catalog)_  
  Không có error-state cho query (useGetAdminProductsQuery) lẫn cho fetch PATCH stock — isError không được xử lý, lỗi tải danh sách rơi vào nhánh 'noData' gây hiểu nhầm 'không có sản phẩm' thay vì 'lỗi tải'. CategoriesPage/BrandsPage cũng thiếu error-state riêng nhưng Inventory nghiêm trọng hơn vì có inline-edit.  
  **Fix:** Thêm nhánh isError → block lỗi có icon + nút thử lại (refetch). Tối thiểu phân biệt error vs empty.

- **[STATES]** `features/admin/pages/orders/OrdersPage.tsx:440-623` _(Lists nhiều traffic)_  
  Bảng đơn hàng KHÔNG có empty-state đúng chuẩn: khi orders.length===0 chỉ render 1 <td colSpan=7> chữ xám 'noOrdersFound', không có icon + CTA như ProductsPage/UsersPage (cả 2 trang kia dùng block icon-gradient + tiêu đề + mô tả). Mobile card-list (block md:hidden) bọc trong điều kiện orders.length>0 nên khi rỗng KHÔNG hiển thị gì trên mobile → màn hình trắng hoàn toàn ở <768px. Vi phạm CONSISTENCY (3 trang khác kiểu) + STATES (mobile mất empty-state).  
  **Fix:** Tách empty-state ra ngoài, render chung cho cả desktop+mobile giống UsersPage: block icon ShoppingCart + tiêu đề + mô tả. Bỏ điều kiện orders.length>0 quanh khối mobile, để empty-state là nhánh riêng phủ cả 2 breakpoint.

- **[STATES / Silent-failure]** `features/admin/pages/catalog/CreateProductPage.tsx:562` _(Form & detail)_  
  ValidationAlerts được truyền missingFields={[]} hardcode rỗng — empty array luôn. Nghĩa là alert validation ở create KHÔNG bao giờ liệt kê được field nào còn thiếu, dù hook có getMissingFields (đã được alias bỏ đi thành _getMissingFields ở line 201). EditProductPage cùng component lại truyền getMissingFields() thật (line 757) → inconsistency UX: cùng 1 form mà create không show field thiếu, edit thì có.  
  **Fix:** Bỏ alias _getMissingFields, dùng getMissingFields và truyền missingFields={getMissingFields()} giống EditProductPage.

- **[TOKEN/COLOR]** `features/admin/pages/BrandsPage.tsx:414,431,442` _(Lists catalog)_  
  Nút pagination custom dùng hover:bg-white/5 — chỉ thấy ở dark mode, light mode vô hình. Ngoài ra BrandsPage tự cuộn pagination riêng thay vì <Pagination> dùng chung (DiscountCodesPage/InventoryPage đều dùng <Pagination>) → inconsistency + bug light mode.  
  **Fix:** Thay bằng <Pagination currentPage totalPages onPageChange> dùng chung như DiscountCodesPage line 522. Vừa fix light-mode vừa thống nhất.

- **[TOKEN/COLOR]** `features/admin/pages/CategoriesPage.tsx:293,318` _(Lists catalog)_  
  thead dùng bg-white/[0.02] và row hover dùng hover:bg-white/[0.03] — chỉ hợp dark mode; ở light mode white/[0.0x] gần như vô hình (nền sáng + lớp trắng mờ = không thấy). Cùng pattern ở BrandsPage (227,253), DiscountCodesPage (291,334,415,499), InventoryPage (329,365,415,499). Đây là pattern xuyên 4 trang.  
  **Fix:** Đổi sang token theme-aware: thead bg-[var(--bg-surface)] hoặc bg-black/[0.02] dark:bg-white/[0.02]; hover dùng hover:bg-[var(--bg-surface)] hoặc hover:bg-black/[0.02] dark:hover:bg-white/[0.03] để cả light/dark đều thấy.

- **[TOKEN/COLOR]** `styles/_tokens.scss:27-32` _(Design tokens (SCSS))_  
  Semantic colors (--color-info/success/danger/warning/violet) chỉ define 1 lần trong :root, KHÔNG có override trong .dark. emerald #10b981 / blue #3b82f6 / red #ef4444 trên nền dark #111111 có contrast OK cho fill nhưng khi dùng làm text trên surface tối thì #ef4444/#3b82f6 hơi tối. Thiếu dark-mode parity cho semantic palette.  
  **Fix:** Thêm khối .dark trong _tokens.scss với biến thể luminous: --color-success: #34d399; --color-danger: #f87171; --color-warning: #fbbf24; --color-info: #60a5fa; --color-violet: #a78bfa (Tailwind 400 thay vì 500) để contrast text trên dark đạt WCAG AA. Cần xác minh contrast thực tế bằng tool.

- **[TOKEN/COLOR]** `styles/_tokens.scss + features/admin/pages/DashboardPage.tsx + components/AdminStatCard.tsx:_tokens.scss:27-31` _(Design tokens (SCSS))_  
  Semantic tokens --color-info / --color-warning / --color-violet are defined ONLY on :root in _tokens.scss with no .dark override (only --color-danger and --color-success are partially re-declared in index.scss, also without dark variants). The dashboard uses these heavily for icon chips, sparklines, growth pills, quick-action tiles and StatusPill. Result: identical hex in light + dark mode. On the #111111-#161616 dark surfaces, info #3b82f6 and violet #8b5cf6 sit near the WCAG 3:1 non-text contrast floor and the value text colored var(--color-danger)/var(--color-info) etc. (DashboardPage line 423-426, lg text on dark card) risks failing 4.5:1. Verified: grep shows no .dark token override.  
  **Fix:** Add slightly-lightened dark-mode variants in the .dark block of index.scss/_tokens.scss (e.g. --color-info:#60a5fa, --color-warning:#fbbf24, --color-violet:#a78bfa, --color-danger:#f87171 in dark) so colored numbers/icons keep contrast on dark surfaces. Tailwind already has the 400-shade hexes available.

- **[TOKEN/COLOR]** `styles/index.scss:49-117 (light :root) vs 70-117 (.dark)` _(Design tokens (SCSS))_  
  Thiếu token --bg-hover / --bg-subtle cho hover states. Grep xác nhận 49 occurrence hardcode bg-white/[0.0x] (white opacity thấp) trong 13 file admin. White-at-low-opacity chỉ hợp dark mode; ở light mode (canvas trắng) nó gần như vô hình → hover state biến mất trong light mode. Đây là nguyên nhân gốc của hardcode rải rác.  
  **Fix:** Thêm cặp token theme-aware ở :root và .dark: --bg-hover (light: rgba(0,0,0,0.04), dark: rgba(255,255,255,0.06)) và --bg-subtle (light: rgba(0,0,0,0.02), dark: rgba(255,255,255,0.03)). Sau đó replace bg-white/[0.0x] → bg-[var(--bg-hover)] trong các file admin (việc replace nằm ngoài 2 file này nhưng token phải define ở đây trước).

- **[TOKEN/COLOR / CONSISTENCY]** `features/admin/components/AdminLayout.tsx:181,235,259,321,351` _(Design-system components)_  
  Hover state dùng hover:bg-white/5 ở nhiều nơi (nav item, user card, dropdown link, nút Menu, nút Bell). Trong light mode, overlay trắng 5% trên nền sáng gần như vô hình → mất feedback hover. Dark mode ổn, light mode hỏng.  
  **Fix:** Dùng token nền hover trung tính theo theme, vd hover:bg-[var(--bg-elevated)] hoặc class dùng chung, hoặc hover:bg-black/5 dark:hover:bg-white/5 để đảm bảo tương phản ở cả 2 theme.


### 🟢 P2

- **[A11Y]** `features/admin/components/AdminLayout.tsx:312-363` _(Design-system components)_  
  Greeting 'admin.welcome.greeting' render trong <div> với class text-base font-semibold, không phải landmark/heading thực. Trang admin có thể thiếu h1 ở header (AdminPageHeader có h1 riêng nên có thể ổn) — cần xác minh không có double-h1 hay thiếu heading.  
  **Fix:** Xác minh mỗi page admin có đúng 1 h1 (qua AdminPageHeader). Header greeting nên giữ là text, không nâng thành h1 để tránh trùng. Note để kiểm tra.

- **[A11Y]** `features/admin/components/AdminMobileCard.tsx:73-82` _(Design-system components)_  
  Dùng <dl>/<dt>/<dd> đúng semantic — tốt. Nhưng key React dùng index (`field-${idx}`) làm key; nếu fields reorder/thêm xóa động có thể gây reconcile sai. Trong context bảng tĩnh thì thấp rủi ro.  
  **Fix:** Nếu field có id/label ổn định, dùng làm key thay index. Mức thấp — chỉ đổi khi fields động.

- **[A11Y]** `features/admin/components/Sparkline.tsx:59-66, 32-46` _(Design tokens (SCSS))_  
  Decent baseline (empty-state has aria-label) but the populated SVG is aria-hidden='true' with no role/label, so the trend is invisible to assistive tech in the very case where data exists. Also the SVG has no <title>. Minor since it's decorative-adjacent, but the KPI it represents (revenue/users trend) is meaningful.  
  **Fix:** Optional: give the populated <svg> role='img' and an aria-label summarizing the trend (e.g. 'Xu hướng doanh thu 30 ngày'), or keep aria-hidden but ensure the numeric KPI beside it is the SR source of truth (it currently is).

- **[A11Y]** `features/admin/components/StatusPill.tsx:101-107` _(Design-system components)_  
  Dot indicator dùng background: currentColor và aria-hidden — màu là kênh duy nhất phân biệt variant (label vẫn có text nên ổn về nội dung). Nhưng pill ở /12 opacity bg + text màu đậm: cần xác minh contrast text/nền đạt AA, đặc biệt warning (#f59e0b) và info (#3b82f6) trên nền sáng.  
  **Fix:** Xác minh contrast bằng tool: text-[var(--color-warning)] (#f59e0b) trên nền warning/12 có thể <4.5:1. Nếu fail, tăng độ đậm text (dùng biến darker) hoặc tăng opacity nền. Cần xác minh số đo.

- **[A11Y]** `features/admin/pages/BrandsPage.tsx:415,443` _(Lists catalog)_  
  Nút pagination prev/next dùng aria-label="Previous"/"Next" hardcode tiếng Anh — không qua t(), không nhất quán i18n (phần còn lại đều t()).  
  **Fix:** Nếu giữ pagination custom: aria-label={t('common.previous')}/{t('common.next')}; tốt hơn là chuyển sang <Pagination> dùng chung (đã có a11y chuẩn).

- **[A11Y]** `features/admin/pages/UserDetailPage.tsx:267` _(Form & detail)_  
  Nút mở chi tiết đơn (order number) là <button> chỉ chứa text mã đơn, ổn; nhưng nút quay lại (icon-only ArrowLeft, line 73-75) variant=ghost size=icon KHÔNG có aria-label/title. Screen reader chỉ đọc được icon rỗng → không biết nút làm gì.  
  **Fix:** Thêm aria-label={t('admin.userDetail.backToList')} (hoặc title) vào Button icon-only ở line 73.

- **[A11Y]** `features/admin/pages/UserDetailPage.tsx:362` _(Form & detail)_  
  Activity list dùng key={index} (line 363) cho map searchHistories — anti-pattern React, gây lỗi reconciliation nếu list thay đổi thứ tự (mà list này có .sort() ngay trước). Nên dùng id ổn định.  
  **Fix:** Dùng key={s.id ?? `${s.createdAt}-${index}`} hoặc id thật từ search history record.

- **[A11Y]** `features/admin/pages/UsersPage.tsx:331-333, 443-445` _(Lists nhiều traffic)_  
  Avatar fallback (chữ cái đầu tên) dùng gradient nền trắng chữ. Cần xác minh contrast chữ trắng trên gradient from-[var(--accent)] (#2aaca7 teal) — teal sáng + chữ trắng có thể không đạt 4.5:1 ở vùng sáng của gradient. Cần xác minh bằng đo contrast thực tế.  
  **Fix:** Đo contrast chữ trắng trên màu accent teal; nếu <4.5:1 cân nhắc text màu đậm hơn hoặc thêm text-shadow/nền tối hơn. Cần xác minh.

- **[A11Y]** `features/admin/pages/UsersPage.tsx:127-128` _(Lists nhiều traffic)_  
  handleDelete dùng window.confirm() native cho xác nhận xóa user — khác hẳn ProductsPage dùng Dialog glass đẹp (deleteConfirmId + DialogContent). window.confirm phá vỡ design system (hộp thoại OS thô), không theme được, không nhất quán. Vi phạm CONSISTENCY + giảm chất lượng UI.  
  **Fix:** Thay window.confirm bằng Dialog xác nhận glass giống ProductsPage (state deleteConfirmId + DialogContent với icon Trash2 + nút destructive).

- **[A11Y]** `features/admin/pages/catalog/ProductsPage.tsx:680-699, 783-802` _(Lists nhiều traffic)_  
  Status Select trong mỗi row (đổi trạng thái sản phẩm) KHÔNG có aria-label. Đây là control tương tác quan trọng (thay đổi trạng thái live) nhưng SelectTrigger chỉ có SelectValue, screen reader không biết select này điều khiển cái gì (không có label liên kết). Áp dụng cho cả desktop và mobile.  
  **Fix:** Thêm aria-label vào SelectTrigger, vd aria-label={t('admin.products.table.status')} hoặc kèm tên sản phẩm: `Trạng thái ${product.name}`.

- **[A11Y]** `features/admin/pages/catalog/ProductsPage.tsx:922-957` _(Lists nhiều traffic)_  
  Nút pagination Previous/Next dùng aria-label='Previous'/'Next' (TIẾNG ANH hardcode) — vi phạm I18N và không khớp ngôn ngữ UI khi user dùng tiếng Việt. Các nút số trang không có aria-current để báo trang hiện tại cho screen reader.  
  **Fix:** Đổi aria-label sang t('common.previous')/t('common.next'). Thêm aria-current='page' cho nút trang đang active (isActive).

- **[A11Y]** `features/catalog/components/ProductFormSaveBar.tsx:40` _(Form & detail)_  
  renderAutosave trả về <span /> rỗng khi !autosaveStatus (edit mode). Layout justify-between dựa vào phần tử trái này; span rỗng ổn về layout nhưng trạng thái autosave là thông tin động không có aria-live, nên screen reader không thông báo khi chuyển saving→saved.  
  **Fix:** Bọc vùng autosave trong container có aria-live='polite' để SR đọc cập nhật trạng thái lưu (saving/saved).

- **[A11Y]** `styles/index.scss:1750` _(Design tokens (SCSS))_  
  .btn dùng focus:ring-2 nhưng là :focus (không phải :focus-visible) → ring hiện cả khi click chuột, gây nhiễu thị giác. Component khác trong file (.admin-checkbox 1230, .focus-ring 1370) đã dùng :focus-visible đúng → inconsistency a11y pattern.  
  **Fix:** Đổi .btn `focus:ring-2 focus:ring-offset-2` → `focus-visible:ring-2 focus-visible:ring-offset-2` để đồng bộ với phần còn lại của design system.

- **[BUG]** `features/admin/pages/catalog/ProductsPage.tsx:273-275` _(Lists nhiều traffic)_  
  calculateDisplayPrice dùng Math.min(...prices) với prices = variants.map(parseFloat). Nếu 1 variant có price không parse được (NaN) thì Math.min trả NaN → formatPrice(NaN) hiển thị sai. Không guard NaN. Quick View (line 1052) lại dùng calculatePriceRange (util khác) cho cùng dữ liệu → 2 cách tính giá khác nhau cho cùng sản phẩm, có thể lệch nhau.  
  **Fix:** Lọc NaN trước Math.min (prices.filter(Number.isFinite)) và fallback product.price khi rỗng. Cân nhắc dùng chung calculatePriceRange cho cả bảng và Quick View để nhất quán giá hiển thị.

- **[BUG]** `features/admin/pages/catalog/ProductsPage.tsx:1066-1078` _(Lists nhiều traffic)_  
  Trong Quick View, badge tồn kho: variant tính bằng ((stockQuantity ?? 0) || (stock ?? 0)) > 0 — biểu thức || sai logic: nếu stockQuantity=0 thì (0)||(stock??0) trả stock, đúng tình cờ; nhưng label hiển thị String(stockQuantity !== undefined ? stockQuantity : stock) — nếu stockQuantity=undefined và stock=undefined thì label='undefined' (chuỗi literal). Không guard undefined cho label.  
  **Fix:** Tính stockVal một lần (stockQuantity ?? stock ?? 0) dùng cho cả variant và label; label dùng String(stockVal) để tránh hiển thị 'undefined'.

- **[BUG / Edge-case]** `features/admin/pages/UserDetailPage.tsx:272` _(Form & detail)_  
  order.id.substring(0,8) (line 272) và selectedOrder.id?.substring(...) (line 404). Dòng 272 truy cập order.id.substring trực tiếp không optional-chain trong khi line 404 lại có ?. — nếu order.id undefined/null (data API động, type any) thì line 272 throw runtime error khi render bảng. Inconsistent null-safety.  
  **Fix:** Dùng order.id?.substring(0,8) ở line 272 nhất quán với line 404, hoặc fallback order.number trước.

- **[BUG / Silent-failure]** `features/admin/pages/catalog/EditProductPage.tsx:348` _(Form & detail)_  
  catch (_e) {} khi JSON.parse description thất bại (line 343-350) — nuốt lỗi hoàn toàn, chỉ comment 'giữ nguyên'. Đây là boundary parse hợp lệ (description có thể không phải JSON) nên fallback giữ nguyên là đúng ý đồ, nhưng catch trống không log gì khiến khó debug khi description thật sự hỏng định dạng.  
  **Fix:** Giữ fallback nhưng thêm log nhẹ (logger.debug/console.debug) hoặc comment rõ đây là expected non-JSON để không bị coi là swallow lỗi. Mức thấp vì hành vi hiện tại đúng.

- **[BUG/DEAD-CODE]** `features/admin/pages/catalog/ProductsPage.tsx:165, 1139` _(Lists nhiều traffic)_  
  Biến isFetchingForExport được khai báo qua useState nhưng KHÔNG bao giờ set (chỉ destructure getter, bỏ setter) → luôn false, là dead state. Truyền vào ProductExportModal isLoading={isFetchingForExport} nên prop loading export thực tế luôn false dù đang fetch. handleExportAll (async, có thể lâu với limit 99999) không phản ánh loading.  
  **Fix:** Hoặc bỏ state thừa và truyền trạng thái loading thật (vd dùng isLoading từ useLazyGetAdminProductsQuery nếu có), hoặc set true/false quanh handleExportAll. Hiện tại modal không biết khi nào export đang chạy.

- **[BUG/SILENT-FAILURE]** `features/admin/components/DashboardCharts.tsx:210-233` _(Dashboard charts)_  
  `handleExport` nuốt mọi lỗi trong `catch {}` (line 230) chỉ với comment, không báo gì cho user. Nếu export thất bại (401, network, server 500) người dùng bấm nút không thấy phản hồi nào — im lặng hoàn toàn. Vi phạm nguyên tắc fallback phải tường minh.  
  **Fix:** Trong catch hiển thị toast lỗi tiếng Việt qua hệ thống notification (`useNotifications`/ui-store) vd `t('admin.charts.exportFailed')`; có thể thêm trạng thái loading/disabled cho nút trong khi fetch.

- **[BUG/SILENT-FAILURE]** `features/admin/pages/DashboardPage.tsx:293-297, 251-258` _(Design tokens (SCSS))_  
  Quick-action badge renders {badge} where badge = pendingCount; guarded by `badge ? ... : null`. If pendingCount is 0 it correctly hides, but the badge has no max cap — a large pendingCount (e.g. 1000+) overflows the min-w-[18px] pill and breaks the tile layout. Low likelihood but unbounded.  
  **Fix:** Cap display, e.g. {badge > 99 ? '99+' : badge}.

- **[BUG/SILENT-FAILURE]** `styles/index.scss:1825` _(Design tokens (SCSS))_  
  .input-error dùng Tailwind class border-error-500 / focus:ring-error-100 / dark:focus:ring-error-900. Class 'error-*' là custom palette phải define trong tailwind.config — nếu config chỉ có 'red' (như .btn-danger dùng red-500 ở line 1774) thì 'error-500' không tồn tại → border đỏ không apply, validation error im lặng không hiện viền. Cần xác minh tailwind.config có scale error.  
  **Fix:** Xác minh tailwind.config.js có 'error' palette. Nếu không → đổi sang border-red-500/focus:ring-red-100 cho khớp .btn-danger, hoặc thêm 'error' alias trong config. Hiện là rủi ro silent-failure.

- **[CONSISTENCY]** `features/admin/components/AdminLayout.tsx:291,301` _(Design-system components)_  
  Sidebar desktop width w-60 (240px) nhưng Sheet mobile width w-[280px] — nội dung sidebar giống nhau, width lệch nhẹ gây cảm giác không nhất quán giữa 2 breakpoint.  
  **Fix:** Cân nhắc đồng bộ về 1 giá trị (vd cùng 280px hoặc cùng 256px/w-64) để nhịp ngang nhất quán. Mức delight, không bắt buộc.

- **[CONSISTENCY]** `features/admin/components/AdminPageHeader.tsx:32,40-51` _(Design-system components)_  
  Mô tả file ghi 'gradient signature teal→coral' nhưng gradient mesh nền thực tế là teal→blue (không coral). Tài liệu/intent lệch với màu thật.  
  **Fix:** Hoặc đổi blue→coral (var(--color-secondary) #ff755e) cho đúng signature mô tả, hoặc sửa comment cho khớp. Quyết định theo định hướng brand.

- **[CONSISTENCY]** `features/admin/components/DashboardCharts.tsx:83, 591` _(Dashboard charts)_  
  Tiêu đề chart không nhất quán: `ChartCardTitle` dùng `text-xs ... text-[var(--text-secondary)]` (line 83) còn header Top Products tự viết tay `text-[11px] ... text-[var(--text-tertiary)]` (line 591). Cùng vai trò 'chart card title' nhưng khác size + khác màu token.  
  **Fix:** Cho Top Products tái dùng `ChartCardTitle` (đã hỗ trợ icon+color+title) thay vì markup riêng; nếu cần action ở header thì mở rộng ChartCardTitle nhận `children` slot phải, giữ nguyên typography.

- **[CONSISTENCY]** `features/admin/components/StatusPill.tsx:23-79` _(Design-system components)_  
  Variant 'shipped' và 'purple' trùng hoàn toàn (đều --color-violet); 'delivered'='success', 'cancelled'='error', 'processing'='info'. Nhiều alias map về cùng style — đúng theo spec nhưng tạo bề mặt API dễ nhầm.  
  **Fix:** Không bắt buộc đổi. Cân nhắc comment ghi rõ alias (vd // alias semantic: delivered→success) để người dùng component biết. Mức dọn dẹp.

- **[CONSISTENCY]** `features/admin/pages/BrandsPage.tsx:570` _(Lists catalog)_  
  Nút Cancel của modal chỉ gọi setIsModalVisible(false), KHÔNG reset editingBrand/formData/formErrors như onOpenChange (line 485-491) và như CategoriesPage Cancel (line 732-737). Lần mở modal kế tiếp có thể giữ state cũ thoáng qua.  
  **Fix:** Cho onClick Cancel gọi cùng cleanup: setIsModalVisible(false); setEditingBrand(null); setFormData(initialFormData); setFormErrors({}).

- **[CONSISTENCY]** `features/admin/pages/CategoriesPage.tsx:441,449` _(Lists catalog)_  
  Nút Edit desktop dùng title={t('admin.common.actions')} ('Hành động') thay vì t('common.edit') — label sai nghĩa. Mobile (line 554) đã đúng t('common.edit'). Cùng lỗi ở BrandsPage line 306 (title={t('admin.common.actions')}).  
  **Fix:** Đổi title nút Edit desktop thành t('common.edit') ở cả CategoriesPage và BrandsPage.

- **[CONSISTENCY]** `features/admin/pages/DashboardPage.tsx:566-583` _(Design tokens (SCSS))_  
  Low-stock SKU line uses tabular-nums (line 581) but a SKU is alphanumeric, not a number column — tabular-nums has no effect on letters and signals intent inconsistently vs the product name above it. Minor.  
  **Fix:** Drop tabular-nums on the SKU <p>; keep it only on genuinely numeric fields (stock count, prices).

- **[CONSISTENCY]** `features/admin/pages/DashboardPage.tsx + components/AdminStatCard.tsx + components/Sparkline.tsx:DashboardPage:142,163,198 (root <div>); AdminStatCard:53; Sparkline:33` _(Design tokens (SCSS))_  
  Several consistency drifts: (1) DashboardPage loading/error/normal return a bare top-level <div> while other states differ in wrapper — and the section-number label '01 / TỔNG QUAN' is hardcoded Vietnamese (see i18n finding). (2) Radii are mixed: skeleton uses rounded-2xl/xl/lg, cards use admin-kpi-card (1.25rem), AdminStatCard skeleton uses rounded-[1.25rem] (arbitrary value) while loading card uses rounded-2xl — same visual target expressed two ways. (3) strokeWidth is 2.25 for most icons but 2.5 for the growth-pill arrow (line 70) and StatusPill text sizes range text-[9px]/[10px]/[11px] inconsistently.  
  **Fix:** Standardize KPI card skeleton radius to match admin-kpi-card (use rounded-2xl everywhere, drop the arbitrary rounded-[1.25rem] in AdminStatCard:53). Keep one icon strokeWidth (2.25) across pills. Consolidate the micro text sizes to a single scale (text-[10px]/[11px]).

- **[CONSISTENCY]** `features/admin/pages/DiscountCodesPage.tsx:733-737` _(Lists catalog)_  
  Nút submit hiển thị text t('common.loading') khi pending thay vì spinner <LoadingSpinner size="sm"> như CategoriesPage (line 746) và BrandsPage (line 578). Micro-inconsistency trong cùng nhóm.  
  **Fix:** Dùng {(isCreating||isUpdating) && <LoadingSpinner size="sm"/>} + nhãn create/update, thống nhất với 2 trang kia.

- **[CONSISTENCY]** `features/admin/pages/InventoryPage.tsx:391,484` _(Lists catalog)_  
  Chuỗi 'biến thể' hardcode tiếng Việt (`${product.variants.length} biến thể`) — không qua t(). Vi phạm i18n policy (gotcha §i18n: tất cả user-visible strings qua t()). Lặp ở cả desktop (391) và mobile (484).  
  **Fix:** Thêm key t('inventory.variantCount', { count: product.variants.length }) trong vi.json/en.json, thay 2 chỗ hardcode.

- **[CONSISTENCY]** `features/admin/pages/UsersPage.tsx:296, 320` _(Lists nhiều traffic)_  
  Giống OrdersPage: thead dùng 'bg-white/[0.02]' và row hover 'hover:bg-white/[0.03]' — chỉ hiện ở dark mode, light mode gần như không thấy hover/nền. Khác ProductsPage (có dark: variant + accent hover).  
  **Fix:** Đổi sang 'bg-[var(--bg-surface)] dark:bg-white/[0.02]' và hover 'hover:bg-[var(--accent)]/[0.05]' đồng bộ ProductsPage.

- **[CONSISTENCY]** `features/admin/pages/catalog/CreateProductPage.tsx:472` _(Form & detail)_  
  Container form ở cả 2 product page dùng `rounded-2xl ... p-5 shadow-sm` (create 472, edit 674) và error-state EditProductPage dùng rounded-2xl icon box; nhưng radii nội bộ trộn rounded-2xl (container), rounded-xl (stepper button, order table wrapper), rounded-lg (tab trigger), rounded-full (stepper dot/pill). Nhiều cấp radii là OK theo scale, nhưng cần xác nhận có scale token thống nhất — hiện đang là giá trị Tailwind rời rạc, dễ lệch khi thêm component mới.  
  **Fix:** Xác nhận/áp dụng radii scale token (vd --radius-card, --radius-control) thay vì rounded-* rải rác để đảm bảo consistency dài hạn. Cần xác minh có token sẵn chưa.

- **[CONSISTENCY]** `features/admin/pages/catalog/ProductsPage.tsx:908-961` _(Lists nhiều traffic)_  
  ProductsPage TỰ viết pagination thủ công (button Previous/Next + Array.from số trang) trong khi OrdersPage và UsersPage dùng component dùng chung <Pagination> từ @/components/common. Hai cơ chế pagination khác nhau giữa các trang admin → CONSISTENCY (UX, style nút, behavior khác nhau).  
  **Fix:** Dùng component <Pagination> dùng chung cho ProductsPage để đồng bộ với Orders/Users, trừ khi có lý do cụ thể (vd cần totalPages cap=7) thì document rõ.

- **[CONSISTENCY]** `features/admin/pages/orders/OrdersPage.tsx:572-573, 702, 1031` _(Lists nhiều traffic)_  
  Màu tiền/total dùng inline style={{ color: 'var(--color-info)' }} (xanh dương) cho giá trị tiền tệ — khác ProductsPage dùng text-[var(--text-primary)] cho giá. Dùng màu 'info' (xanh) cho tiền không nhất quán semantic và khác 2 trang còn lại. Ngoài ra dùng inline style thay vì class token.  
  **Fix:** Thống nhất màu hiển thị tiền giữa 3 trang (đề xuất text-[var(--text-primary)] hoặc 1 token tiền tệ riêng). Chuyển inline style sang className token để đồng bộ.

- **[CONSISTENCY]** `features/admin/pages/orders/OrdersPage.tsx:443, 533` _(Lists nhiều traffic)_  
  Bảng Orders dùng nền/hover Tailwind opacity literal 'bg-white/[0.02]' (thead) và 'hover:bg-white/[0.03]' (row) — chỉ hợp dark mode, ở light mode nền trắng/[0.02] gần như vô hình và hover không thấy. ProductsPage dùng 'bg-[var(--bg-surface)] dark:bg-white/[0.02]' (có biến thể light) và hover 'hover:bg-[var(--accent)]/[0.05]'. UsersPage cũng dùng bg-white/[0.02] + hover:bg-white/[0.03] (cùng lỗi). → light mode contrast/hover yếu + inconsistency với ProductsPage.  
  **Fix:** Đồng bộ theo ProductsPage: thead 'bg-[var(--bg-surface)] dark:bg-white/[0.02]', row hover 'hover:bg-[var(--accent)]/[0.05]' để có hover rõ ở cả light lẫn dark.

- **[CONSISTENCY]** `features/admin/pages/orders/OrdersPage.tsx:66-115` _(Lists nhiều traffic)_  
  OrdersPage tự định nghĩa STATUS_CONFIG/PAYMENT_STATUS_CONFIG (map màu+icon) bằng class token inline, trong khi đã có component StatusPill dùng chung (UsersPage + ProductsPage dùng StatusPill với variant pending/processing/shipped/delivered/cancelled/success/warning/error/info đã hỗ trợ sẵn). Orders không tái sử dụng StatusPill → trùng lặp logic màu trạng thái, dễ lệch style (StatusPill rounded-full text-[11px] border; Orders pill cũng tương tự nhưng định nghĩa riêng).  
  **Fix:** Tái sử dụng StatusPill cho badge trạng thái/thanh toán ở Orders (đã có variant trùng tên). Giữ icon qua label slot. Giảm trùng lặp + đảm bảo đồng bộ pill style giữa 3 trang.

- **[CONSISTENCY]** `styles/_tokens.scss:67-72` _(Design tokens (SCSS))_  
  --btn-view-bg dùng rgba(0,0,0,0.06) (đen) cho light mode nhưng .dark override sang rgba(255,255,255,0.14) (trắng) ở index? Không — _tokens.scss .dark (line 101-104) override đúng. Tuy vậy --btn-view-text:var(--text-primary) và --btn-view-text-hover:var(--text-primary) y hệt nhau (line 71-72) → token hover thừa, không tạo khác biệt visual nào.  
  **Fix:** Bỏ --btn-view-text-hover nếu luôn = --btn-view-text, hoặc set giá trị hover thật (vd var(--accent)) để hover có phản hồi màu. Hiện tại là dead/no-op token.

- **[CONSISTENCY]** `styles/index.scss:1646-1697` _(Design tokens (SCSS))_  
  Scale spacing/radii/shadow KHÔNG được token-hoá: không có --space-*, --radius-*, --shadow-* nào trong cả 2 file. Có --duration-*, --leading-*, --ease-* nhưng radius thì hardcode rải rác (0.75rem, 0.875rem, 1.25rem, 1.5rem, 1.75rem, 2rem) và shadow hardcode hoàn toàn ở mỗi class. Khó giữ consistency, mỗi card 1 kiểu radius/shadow.  
  **Fix:** Thêm scale token: --radius-sm:0.5rem; --radius-md:0.875rem; --radius-lg:1.25rem; --radius-xl:1.75rem; --radius-2xl:2rem; và --shadow-sm/md/lg/glass. Refactor các glass-card dùng token (out-of-scope cho 2 file này nhưng define token ở đây).

- **[CONSISTENCY]** `styles/index.scss:291-292, 311, 1320, 567` _(Design tokens (SCSS))_  
  Magic numbers blur/saturate lặp lại không token-hoá: blur(24px) saturate(2) (glass-card-lg), blur(20px) saturate(1.8) (glass-nav, admin-sticky-header, admin-kpi-card), blur(12px) saturate(1.8) (admin-btn-primary), blur(28px) saturate(2.2). Có --glass-blur/--glass-saturate (line 56-57) nhưng nhiều class bỏ qua, hardcode trực tiếp → inconsistency blur giữa các card.  
  **Fix:** Tạo thêm --glass-blur-sm/md/lg + --glass-saturate-md/strong và thay các literal blur()/saturate() trong index.scss bằng token tương ứng để đồng bộ.

- **[CONSISTENCY]** `styles/index.scss:2086-2094, 2143-2147` _(Design tokens (SCSS))_  
  .premium-button-ghost và .premium-button-outline hardcode #3b82f6 (blue) cho border+text thay vì token --color-info. Đồng thời ghost/outline GIỐNG HỆT nhau (cùng transparent bg + 2px solid #3b82f6) → 1 trong 2 là dead variant trùng lặp. Màu blue cũng lệch khỏi brand teal của primary.  
  **Fix:** Hợp nhất ghost/outline thành 1 class (xóa trùng), thay #3b82f6/#60a5fa bằng var(--color-info) hoặc var(--accent) cho nhất quán brand. Nếu cố ý 2 variant khác nhau thì phải cho chúng visual khác biệt.

- **[CONSISTENCY / Behavior]** `features/admin/pages/catalog/EditProductPage.tsx:692` _(Form & detail)_  
  Stepper ở EditProductPage KHÔNG truyền completedSteps và isStepAccessible (line 692) nên mọi bước hiện số thứ tự, không có ✓ done và không gate; còn CreateProductPage truyền đủ (line 490-495) → cùng component ProductFormStepper nhưng 2 trang hành xử khác hẳn (edit không bao giờ hiện trạng thái hoàn thành). TAB_ORDER (create) và TAB_KEYS (edit) cũng khác thứ tự (attributes/specifications/variants đảo vị trí) → trải nghiệm không nhất quán giữa tạo và sửa.  
  **Fix:** Thống nhất thứ tự bước giữa create/edit; nếu edit cố ý không gate thì vẫn nên truyền completedSteps để hiện ✓ cho bước đã hợp lệ, hoặc tài liệu hóa rõ lý do khác biệt. Cần xác minh ý đồ sản phẩm.

- **[CONSISTENCY / RESPONSIVE]** `features/admin/components/AdminMobileCard.tsx:75-80` _(Design-system components)_  
  Field value dùng truncate + text-right; label dùng shrink-0. Nếu label dài (i18n tiếng Việt thường dài hơn), label đẩy value xuống còn rất hẹp → value bị cắt sớm dù còn chỗ. Trên màn rất hẹp có thể mất thông tin.  
  **Fix:** Cho label cũng truncate/min-w-0 hoặc dùng layout 2 dòng (label trên, value dưới) khi chật. Tối thiểu thêm title attr / không truncate value quan trọng (giá VND). Cần xác minh với label dài thực tế.

- **[CONSISTENCY / strokeWidth]** `features/admin/pages/UserDetailPage.tsx:53` _(Form & detail)_  
  strokeWidth icon không nhất quán: error-state User icon dùng strokeWidth={1.5} (line 53) giống AlertCircle ở EditProductPage (1.5), nhưng các icon nhỏ trong cùng UserDetailPage (Crown w-3, Mail/Phone/Calendar w-4, tab icons w-3.5) KHÔNG set strokeWidth (mặc định 2) trong khi ArrowLeft/Eye/ExternalLink lại set 2.25. Ba mức (default 2 / 2.25 / 1.5) trộn lẫn trong 1 trang.  
  **Fix:** Chuẩn hóa strokeWidth theo size: icon hành động/nav dùng 2.25 đồng nhất, icon meta nhỏ để mặc định — thống nhất 1 quy ước thay vì 3 giá trị rải rác.

- **[CONSISTENCY/TOKEN]** `features/admin/components/DashboardCharts.tsx:461` _(Dashboard charts)_  
  Ghost line kỳ trước hardcode `stroke={isDark ? '#a1a1aa' : '#71717a'}`. `#a1a1aa` trùng đúng hằng `AXIS_DARK` đã khai báo (line 66) nhưng không tái dùng; `#71717a` là literal mới ngoài bảng màu chart-colors.ts. Hợp lệ về kỹ thuật (SVG cần hex) nhưng phá tính nhất quán token.  
  **Fix:** Khai báo hằng `GHOST_LINE_DARK`/`GHOST_LINE_LIGHT` (hoặc tái dùng `AXIS_DARK`) cạnh AXIS_* để mọi màu chart tập trung một nơi, dễ đổi đồng bộ với chart-colors.ts.

- **[DEAD-CODE]** `features/admin/pages/InventoryPage.tsx:150-164` _(Lists catalog)_  
  InventoryPage tự gọi fetch() thủ công tới /admin/products/:id/stock (import token-manager động) thay vì qua TanStack Query mutation + api-client như các trang khác. Bypass interceptor/cache → inconsistency kiến trúc + khó test. Cần xác minh có mutation hook sẵn không.  
  **Fix:** Tạo useUpdateStockMutation trong admin-product-api.ts dùng apiClient, invalidate adminProductKeys; thay fetch thủ công. Cần xác minh API hook tồn tại trước khi đổi.

- **[Dead-code / Orphan]** `features/admin/pages/catalog/CreateProductPage.tsx:440` _(Form & detail)_  
  Hàm _getTabLabelStyle (line 440-444) được định nghĩa nhưng không gọi ở đâu (TabsList là sr-only, styling tab do ProductFormStepper xử lý). Đáng chú ý: nó tham chiếu var(--color-success) đúng nhưng vẫn là code chết.  
  **Fix:** Xóa hàm _getTabLabelStyle.

- **[Dead-code / Orphan]** `features/admin/pages/catalog/CreateProductPage.tsx:124` _(Form & detail)_  
  3 state cụm orphan: _attributeGroups/_setAttributeGroups (124), _hierarchicalVariants/_setHierarchicalVariants (125), _specifications/_setSpecifications (126) — khai báo nhưng setter không bao giờ được gọi và state không bao giờ được đọc. Comment ghi 'nếu cần trong tương lai' (YAGNI).  
  **Fix:** Xóa 3 useState orphan này cùng import AttributeGroup nếu sau đó không còn dùng (AttributeGroup chỉ dùng ở đây).

- **[Dead-code / Orphan]** `features/admin/pages/catalog/EditProductPage.tsx:328` _(Form & detail)_  
  State _isDataLoaded/_setIsDataLoaded (line 328) khai báo nhưng không bao giờ set hay đọc. Orphan.  
  **Fix:** Xóa dòng useState _isDataLoaded.

- **[I18N]** `features/admin/pages/DashboardPage.tsx:144, 165, 213` _(Design tokens (SCSS))_  
  Section label '01 / TỔNG QUAN' is a hardcoded Vietnamese string in three places (skeleton, error, normal). Project rule requires all user-visible strings via t(). It will not switch to English when i18n.language === 'en' (the lastUpdated timestamp right beside it already localizes, making the mismatch visible).  
  **Fix:** Move to a translation key, e.g. {t('admin.dashboard.sectionLabel', { defaultValue: '01 / TỔNG QUAN' })}, present in both vi.json and en.json.

- **[I18N]** `features/admin/pages/catalog/CreateProductPage.tsx:458` _(Form & detail)_  
  sectionNumber='02 / TẠO SẢN PHẨM' hardcode tiếng Việt trực tiếp (không qua t()). Tương tự EditProductPage line 660 '02 / CHỈNH SỬA SẢN PHẨM' và UserDetailPage line 78 '06 / CHI TIẾT NGƯỜI DÙNG'. User switch sang en → vẫn hiện tiếng Việt.  
  **Fix:** Đưa các chuỗi sectionNumber qua t() (vd t('admin.products.create.sectionNumber')) và thêm key vào cả vi.json + en.json.

- **[I18N]** `features/admin/pages/catalog/ProductsPage.tsx:329, 352` _(Lists nhiều traffic)_  
  sectionNumber='05 / SẢN PHẨM' hardcode tiếng Việt (cũng có ở OrdersPage '02 / ĐƠN HÀNG' line 352, UsersPage '04 / NGƯỜI DÙNG' line 176). Chuỗi user-visible không qua t() → khi switch sang English vẫn hiện tiếng Việt. Áp dụng cả 3 trang.  
  **Fix:** Đưa phần chữ của sectionNumber qua i18n (giữ số, dịch nhãn), vd `05 / ${t('admin.products.title').toUpperCase()}` hoặc key riêng admin.products.sectionLabel.

- **[I18N]** `features/admin/pages/orders/OrdersPage.tsx:893, 936, 928` _(Lists nhiều traffic)_  
  Chuỗi 'N/A' hardcode user-visible (shippingPhone || 'N/A', paymentTransactionId || 'N/A') và paymentMethod.toUpperCase() hiển thị trực tiếp không qua t(). 'N/A' không qua i18n, không đổi theo ngôn ngữ.  
  **Fix:** Thay 'N/A' bằng t('common.notAvailable') (hoặc key tương đương đã có). Với paymentMethod literal khác 'cod', cân nhắc map qua i18n thay vì .toUpperCase() thô.

- **[I18N]** `styles/index.scss:1609` _(Design tokens (SCSS))_  
  Comment tiếng Anh 'Remove as per reference image' (line 1609) lẫn với phần còn lại comment tiếng Việt — vi phạm convention comment tiếng Việt của project. Minor, không ảnh hưởng runtime.  
  **Fix:** Đổi comment sang tiếng Việt: '// Ẩn theo ảnh tham chiếu' cho nhất quán.

- **[I18N / BUG]** `features/admin/pages/catalog/EditProductPage.tsx:319` _(Form & detail)_  
  console.error('Failed to update product:', error) — log message bằng tiếng Anh ở catch (line 319). Theo coding-standards log nội bộ nên tiếng Việt; quan trọng hơn, đây là log lập trình lẫn lộn (CreateProductPage lại không log lỗi submit ra console). Không phải lỗi bảo mật vì không lộ secret, nhưng inconsistency error-handling giữa 2 trang.  
  **Fix:** Đồng nhất cách xử lý lỗi giữa create/edit; nếu giữ log thì đổi sang tiếng Việt và thêm context (product id).

- **[MICRO-INTERACTION]** `features/admin/components/AdminLayout.tsx:112-148` _(Design-system components)_  
  Bộ animation entrance (container scale, sidebar slide, nav stagger, page transition) không tôn trọng prefers-reduced-motion. User nhạy cảm chuyển động sẽ thấy nhiều motion mỗi lần đổi route.  
  **Fix:** Bọc bằng useReducedMotion() của framer-motion để tắt/giảm transition khi prefers-reduced-motion: reduce. Áp ít nhất cho page transition (key=location.pathname) vì lặp mỗi điều hướng.

- **[MICRO-INTERACTION]** `features/admin/pages/CategoriesPage.tsx:139-149,151-157` _(Lists catalog)_  
  collapsedIds reset về Set rỗng mỗi lần component remount/refetch lớn? Không — state giữ ổn, nhưng khi categories thay đổi (xóa node cha đang collapsed) collapsedIds vẫn giữ id cũ (rò rỉ id chết trong Set). Không gây bug hiển thị nhưng Set phình dần. Cần xác minh mức ảnh hưởng (thấp).  
  **Fix:** Tùy chọn: prune collapsedIds theo ids hiện có trong useMemo, hoặc bỏ qua (ảnh hưởng không đáng kể). Cần xác minh.

- **[MICRO-INTERACTION]** `features/admin/pages/DashboardPage.tsx:276-299, 304-309` _(Design tokens (SCSS))_  
  Quick-action tiles and the recent-order rows use bare `transition` (no duration/easing/property) so they inherit the Tailwind default 150ms all — fine, but the framer-motion stagger/fadeUp is applied only to ROW 1 bento (304); quick-actions bar (225), pending alert, charts, and bottom row have no entrance motion, so the page animates the middle then statically shows the rest. Slightly uneven choreography for a 'bold' admin UI per the design ambition note.  
  **Fix:** Wrap the quick-actions bar and bottom row in the same motion variants={fadeUp} for a cohesive staggered entrance, or remove motion from the bento for consistency. Also specify transition-colors instead of bare transition on hover-only color changes.

- **[MICRO-INTERACTION]** `features/admin/pages/InventoryPage.tsx:309-323` _(Lists catalog)_  
  Search input filter thay đổi page=1 ngay mỗi keystroke (không debounce) → mỗi ký tự là 1 query. DiscountCodesPage đã debounce 300ms (line 102-107). Inconsistency + spam request.  
  **Fix:** Áp dụng debounce 300ms giống DiscountCodesPage useEffect; hoặc dùng use-debounce hook có sẵn trong src/hooks.

- **[MICRO-INTERACTION]** `features/admin/pages/catalog/ProductsPage.tsx:1000-1107` _(Lists nhiều traffic)_  
  Quick View modal dùng AnimatePresence + motion.div initial opacity nhưng KHÔNG có exit animation (chỉ initial+animate, thiếu exit). Khi đóng modal nội dung biến mất đột ngột thay vì fade out mượt. AnimatePresence không có tác dụng nếu child không khai báo exit.  
  **Fix:** Thêm exit={{ opacity: 0, y: 8 }} cho motion.div để AnimatePresence chạy đúng, hoặc bỏ AnimatePresence nếu không cần exit (Dialog đã có animation riêng của Radix).

- **[MICRO-INTERACTION]** `features/admin/pages/orders/OrdersPage.tsx:597-616` _(Lists nhiều traffic)_  
  Cụm action buttons trong row Orders desktop KHÔNG có hiệu ứng reveal-on-hover (opacity-60 group-hover:opacity-100) như ProductsPage (line 702). Ở Orders nút luôn hiện full opacity, ở Products nút mờ rồi rõ khi hover row → micro-interaction không nhất quán giữa các bảng.  
  **Fix:** Thống nhất 1 hành vi: hoặc cả 3 trang dùng reveal-on-hover (opacity-60 group-hover:opacity-100), hoặc cả 3 luôn hiện. Đề xuất đồng bộ theo ProductsPage hoặc bỏ hẳn để đơn giản (luôn hiện, tốt hơn cho touch/discoverability).

- **[MICRO-INTERACTION]** `styles/index.scss:177-182, 119-124` _(Design tokens (SCSS))_  
  prefers-reduced-motion CHỈ được honor cho view-transition (line 177-182). Universal transition (line 120), shimmer (421), marquee (747), animate-fadeIn/slideInTop, gradient-text-shine (375) KHÔNG có reduced-motion guard → user bật reduce-motion vẫn thấy shimmer/marquee/shine chạy liên tục (a11y vestibular).  
  **Fix:** Thêm 1 block @media (prefers-reduced-motion: reduce) { .shimmer, .marquee-track, .gradient-text-shine { animation: none !important; } *, *::before, *::after { transition-duration: 0.01ms !important; } }.

- **[MICRO-INTERACTION / CONSISTENCY]** `features/admin/pages/UserDetailPage.tsx:319` _(Form & detail)_  
  Address card dùng hover:shadow-md (line 319), order row dùng hover:bg-white/[0.03], tab dùng transition + data-[state=active] bg — các hover/transition không đồng nhất: card thì đổi shadow, row đổi nền, một số transition không khai báo duration/easing rõ ràng (chỉ 'transition'). Trong khi product pages dùng motion (Framer) cho row stagger ở UserDetailPage nhưng product form không có micro-interaction nào khi chuyển bước.  
  **Fix:** Chuẩn hóa hover/transition (duration + easing) cho card/row trong admin; cân nhắc transition mượt khi đổi TabsContent ở product form để đồng bộ chất lượng motion.

- **[MICRO-INTERACTION/A11Y]** `features/admin/components/DashboardCharts.tsx:177-180, 268, 354` _(Dashboard charts)_  
  transition không đồng nhất: preset buttons dùng `transition-colors` (268), compare select dùng `transition` (354), export buttons `transition` (375/383). Ngoài ra không thấy `focus-visible` ring rõ ràng trên các button/select filter (dựa vào focus mặc định trình duyệt). Có class tiện ích `.focus-ring` trong index.scss nhưng không dùng ở đây.  
  **Fix:** Chuẩn hóa cùng `transition-colors` cho nhóm filter. Thêm `focus-visible:ring-2 focus-visible:ring-[var(--accent)]` (hoặc class `.focus-ring`) cho preset/export buttons và select để keyboard nav thấy rõ focus.

- **[RESPONSIVE]** `features/admin/components/AdminLayout.tsx:289-297` _(Design-system components)_  
  Sidebar chỉ hiện ở lg (≥1024px); khoảng 768-1023px (tablet) không có sidebar cố định, chỉ còn nút Menu mở Sheet. Đúng ý đồ nhưng tablet rộng có thể tận dụng sidebar — cần xác minh có chủ đích.  
  **Fix:** Nếu muốn tablet có sidebar: đổi breakpoint hiển thị sang md:flex (cân nhắc width). Nếu cố ý giữ Sheet ở tablet thì không cần đổi — chỉ note.

- **[RESPONSIVE]** `features/admin/components/AdminPageHeader.tsx:40,51` _(Design-system components)_  
  actions container flex-wrap khi nhiều nút; trên mobile (flex-col) actions xuống dòng dưới title — ổn. Nhưng khi title rất dài + actions, ở sm:flex-row items-end có thể title chiếm hết đẩy actions sát mép. min-w-0 có ở title nên truncate ổn, cần xác minh với actions nhiều nút thực tế.  
  **Fix:** Cần xác minh với 2-3 nút action + title dài. Nếu chật, cho actions w-full sm:w-auto. Mức thấp.

- **[RESPONSIVE]** `features/admin/components/DashboardCharts.tsx:626, 690` _(Dashboard charts)_  
  Cắt tên bằng `substring(0,20)+'...'` (topProducts) và `substring(0,15)+'...'` (category) là cắt theo số ký tự cứng, không phải CSS ellipsis — với tên có dấu/ký tự rộng vẫn có thể tràn trong YAxis width=80 (line 645) trên màn hẹp. Hai ngưỡng cắt khác nhau (20 vs 15) cũng thiếu nhất quán.  
  **Fix:** Để Recharts/axis tự xử lý hoặc dùng tickFormatter thống nhất một ngưỡng; cân nhắc tăng YAxis width hoặc dùng `<title>` cho tên đầy đủ khi hover. Tối thiểu thống nhất ngưỡng cắt.

- **[RESPONSIVE]** `features/admin/pages/DashboardPage.tsx:388-438` _(Design tokens (SCSS))_  
  Customer Overview card packs 4 sub-KPI tiles in a fixed grid-cols-2 (never collapses to 1 col). Each tile holds an uppercase label, a large FlipNumber, a GrowthPill, AND a sparkline. On narrow viewports (<480px when this card is full-width on mobile, grid-cols-1 at the row level), two tiles per row plus wrapping growth pill (flex-wrap at line 422) can get cramped; the label uses leading-tight but long VI labels like 'ĐÃ HỦY THÁNG NÀY' may wrap to 3 lines causing uneven tile heights.  
  **Fix:** Verify on a 360-390px viewport; consider grid-cols-1 below xs for this inner grid, or reserve a min-height on the label so tiles stay equal height.

- **[RESPONSIVE]** `features/admin/pages/catalog/EditProductPage.tsx:689` _(Form & detail)_  
  Form 2 cột dùng grid lg:grid-cols-[240px_1fr] với aside stepper lg:sticky top-[88px] (cả create line 487-489 và edit line 689-691). Dưới breakpoint lg (<1024) stepper chuyển thành hàng ngang full-width phía trên (grid-cols-1) — với 9 bước, danh sách dọc 9 nút trên mobile chiếm rất nhiều chiều cao trước khi tới nội dung form, đẩy field xuống dưới màn hình. Stepper không có biến thể horizontal/scroll cho mobile.  
  **Fix:** Thêm biến thể compact (horizontal scroll hoặc collapse) cho ProductFormStepper ở <lg, tránh đẩy nội dung form xuống quá sâu. Cần xác minh trên thiết bị thật.

- **[RESPONSIVE]** `features/admin/pages/orders/OrdersPage.tsx:768-832` _(Lists nhiều traffic)_  
  Trong modal chi tiết đơn (Dialog), bảng thông tin cơ bản dùng <table> với td width cố định w-[200px] x4 cột. Trên màn hẹp (dialog max-w-800px nhưng mobile dialog co lại) bảng 4 cột x200px=800px gây overflow-x ngang trong dialog. Có overflow-x-auto nên không vỡ layout nhưng UX phải cuộn ngang để xem trạng thái/thanh toán trên mobile.  
  **Fix:** Trên mobile chuyển bảng 4 cột này sang layout dọc (grid-cols-1) hoặc dùng dl label/value stack giống AdminMobileCard, tránh cuộn ngang trong dialog.

- **[STATES]** `features/admin/components/AdminLayout.tsx:163-166,238` _(Design-system components)_  
  Avatar fallback dùng (fullName[0] || 'A') — khi fullName rỗng hiện 'A' cứng; greetingName cũng có thể rỗng → câu chào thiếu tên. Không phải lỗi nặng nhưng thiếu trạng thái rỗng nhất quán.  
  **Fix:** Cân nhắc fallback nhất quán: initial từ email khi thiếu tên (user?.email?.[0]) thay vì hằng 'A'; greeting có fallback generic ('Quản trị viên') khi cả hai rỗng.

- **[STATES]** `features/admin/pages/UsersPage.tsx:282-291` _(Lists nhiều traffic)_  
  Empty-state CHỈ có icon + tiêu đề t('common.noData') ('Không có dữ liệu'), THIẾU mô tả và CTA. ProductsPage empty-state đầy đủ (icon + title + description + nút 'Thêm sản phẩm'). Tiêu chí STATES yêu cầu empty-state = icon+message+CTA. Users không có nút tạo user là hợp lý, nhưng vẫn nên có description rõ hơn + (nếu đang filter) gợi ý xóa filter.  
  **Fix:** Thêm <p> mô tả (vd 'Không tìm thấy người dùng phù hợp bộ lọc') và nút phụ 'Xóa bộ lọc' khi filters.search/role đang active, đồng bộ độ hoàn chỉnh với ProductsPage.

- **[STATES]** `features/admin/pages/catalog/EditProductPage.tsx:604` _(Form & detail)_  
  Loading state khi tải sản phẩm chỉ là LoadingSpinner + text căn giữa (line 604-613), không có skeleton mô phỏng layout form 2 cột (stepper + content) như STATES yêu cầu. So với độ phức tạp của form, spinner trống gây cảm giác giật layout khi data về. Create page thì không có loading cho categories (chỉ truyền isLoading xuống ProductCategoryForm).  
  **Fix:** Cân nhắc skeleton 2 cột (stepper rail + card content) cho EditProductPage trong lúc isLoadingProduct, đồng bộ trải nghiệm với form thật.

- **[STATES]** `features/admin/pages/catalog/ProductsPage.tsx:325-343` _(Lists nhiều traffic)_  
  Error-state KHÔNG nhất quán giữa 3 trang: ProductsPage error có <h2> tiêu đề + nút retry nhưng KHÔNG có <p> mô tả; OrdersPage error có <p> mô tả + retry nhưng KHÔNG có <h2>; UsersPage KHÔNG có error-state riêng nào (chỉ dựa isEmpty). Ba kiểu khác nhau cho cùng 1 loại trạng thái → CONSISTENCY.  
  **Fix:** Chuẩn hóa 1 component error-state dùng chung (icon + title + description + retry) cho cả 3 trang. UsersPage cần bổ sung nhánh error (hiện useGetAllUsersQuery không destructure error nên lỗi tải bị nuốt im lặng).

- **[TOKEN/COLOR]** `features/admin/components/AdminPageHeader.tsx:37` _(Design-system components)_  
  Gradient mesh nền hardcode rgba literal (rgba(42,172,167,...) = --color-primary, rgba(24,144,255,...) ≈ legacy Ant blue khác --color-info #3b82f6). Lệch palette: dùng màu xanh dương cũ thay vì token info hiện tại → không nhất quán color system.  
  **Fix:** Thay literal bằng color-mix từ token: color-mix(in srgb, var(--color-primary) 12%, transparent) và var(--color-info) (#3b82f6) thay vì #1890ff. Hoặc dùng var(--color-secondary) để đúng signature teal→coral như mô tả.

- **[TOKEN/COLOR]** `features/admin/pages/UserDetailPage.tsx:73` _(Form & detail)_  
  hover:bg-white/5 (line 73) và nhiều chỗ dùng white/[0.02], white/[0.03], white/[0.04] (UserDetailPage line 241,264,319,413,424; SaveBar dark:bg-white/[0.04]; cả 2 product page container dark:bg-white/[0.03]). Các giá trị white/opacity này chỉ hợp ở dark theme; ở light theme nền sáng thì lớp trắng mờ gần như vô hình → hover/zebra/cover mất hiệu ứng. Không phải token, là magic alpha lặp lại nhiều lần.  
  **Fix:** Token hóa thành biến (vd --bg-hover, --bg-subtle) phản ứng đúng theo dark/light, thay cho bg-white/[0.0x] rải rác. Cần xác minh hành vi ở light theme bằng screenshot.

- **[TOKEN/COLOR]** `features/admin/pages/catalog/ProductsPage.tsx:94-108` _(Lists nhiều traffic)_  
  CAT_PALETTE hardcode 8 mã hex literal (#2aaca7, #8b5cf6, #f59e0b, #3b82f6, #ec4899, #06b6d4, #10b981, #ef4444) cho màu chip category — không dùng design token. Một số trùng giá trị token (#8b5cf6=--color-violet, #f59e0b=--color-warning, #3b82f6=--color-info, #10b981=--color-success, #ef4444=--color-danger) nhưng viết cứng. Khi đổi theme/token, các chip này không theo. Vi phạm token-driven.  
  **Fix:** Nếu cần palette ổn định theo tên thì giữ, nhưng nên trỏ về CSS var hoặc tối thiểu comment lý do không token-hóa (deterministic màu category). Cân nhắc dùng mảng var(--accent), var(--color-violet)... để đồng bộ theme.

- **[TOKEN/COLOR]** `styles/_tokens.scss:32` _(Design tokens (SCSS))_  
  --color-muted: #999 là giá trị cố định 1 màu, không theme-aware. #999 trên light (#fff) contrast ~2.85:1 (FAIL AA cho text); trên dark vừa phải. Dùng làm muted text sẽ fail contrast ở light mode.  
  **Fix:** Tách theme: light --color-muted: #71717a (zinc-500, ~4.6:1 trên trắng); dark --color-muted: #a1a1aa. Hoặc dùng sẵn --text-tertiary đã có để khỏi đẻ thêm token.

- **[TOKEN/COLOR]** `styles/index.scss:1378-1383, 1432-1452, 1500-1577` _(Design tokens (SCSS))_  
  Block .description-content hardcode hàng loạt hex màu (#374151, #1f2937, #4b5563, #6b7280) và Tailwind palette literal (text-blue-600, bg-blue-50, border-blue-100, bg-yellow-50, bg-red-50, text-gray-700...) thay vì token semantic. Không có dark-mode handling → product description trong admin (nếu hiển thị) sẽ là chữ xám trên nền tối, khó đọc.  
  **Fix:** Nếu .description-content render trong admin: thêm .dark .description-content override màu text/bg. Map text-blue-600 → var(--color-info), bg-red-50/text-red-800 (.warning-box) → token danger. Cần xác minh block này có dùng trong admin không (có thể chỉ storefront).

- **[TOKEN/COLOR]** `styles/index.scss:254, 891-894, 1289-1294` _(Design tokens (SCSS))_  
  Hardcode rgba(255,255,255,0.x) cho hover/border ở light-mode context: .glass-card:hover border-color rgba(255,255,255,0.25) (line 254) — viền trắng-mờ trên nền sáng gần như vô hình ở light mode; .collection-cta dùng white/0.15-0.5 (line 880-894) chỉ hợp trên ảnh tối. Cùng vấn đề token-hoá hover như P1 ở trên nhưng trong chính file styles.  
  **Fix:** Thay border-color hover của .glass-card bằng var(--glass-border-inner) hoặc token theme-aware thay vì rgba trắng cứng, để hover thấy được ở cả light mode.

- **[TOKEN/CONTRAST]** `features/admin/components/GlassTooltip.tsx:45` _(Dashboard charts)_  
  Tooltip dùng `glass-card-sm` (background `--glass-bg` = rgba(255,255,255,0.05) ở dark) dựa gần như hoàn toàn vào `backdrop-filter`. Recharts tooltip nổi trên vùng chart có gradient/area màu → ở dark mode nền tooltip có thể gần như trong suốt, giảm tương phản khối (text vẫn `--text-primary` nên đọc được, nhưng ranh giới tooltip mờ). Cần xác minh thực tế trên màn dark.  
  **Fix:** Cân nhắc tăng độ đục nền riêng cho tooltip (vd thêm `bg-[var(--bg-elevated)]/95` đè lên glass) để tooltip luôn có khối nền rõ bất kể nền chart phía sau. Verify bằng screenshot dark + light.

