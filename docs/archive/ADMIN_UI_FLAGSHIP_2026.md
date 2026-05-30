# TechStore Admin — Flagship UI/UX Design System 2025–2026

> Bản thiết kế premium hoàn chỉnh cho admin panel. Vai trò: Senior Product Designer.
> Nguyên tắc nền: **kế thừa & nâng cấp** design language hiện có (teal brand, Liquid Glass, dark/light) — không tạo hệ rời rạc.
> Tài liệu này là **source of truth** để implement. Mọi giá trị token đều ánh xạ về `frontend/src/styles/_tokens.scss` + `index.scss`.

---

## Mục lục
1. [Design Philosophy](#1-design-philosophy)
2. [Design Tokens](#2-design-tokens)
3. [Foundations: Layout, Grid, Density](#3-foundations)
4. [Core Components (spec chi tiết)](#4-core-components)
5. [Motion & Micro-interactions](#5-motion--micro-interactions)
6. [State System (loading/empty/error)](#6-state-system)
7. [Page Archetypes (redesign chi tiết)](#7-page-archetypes)
8. [Per-page Notes (8 trang)](#8-per-page-notes)
9. [Accessibility](#9-accessibility)
10. [Responsive](#10-responsive)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

## 1. Design Philosophy

**Định hướng:** "Calm, dense, deep" — admin tool dùng nhiều giờ/ngày, nên ưu tiên **đọc nhanh, thao tác ít click, thẩm mỹ có chiều sâu nhưng không ồn**.

5 nguyên tắc chủ đạo:

| # | Nguyên tắc | Ý nghĩa thực thi |
|---|---|---|
| P1 | **Hierarchy by depth, not borders** | Phân tầng bằng elevation/blur/shadow (Liquid Glass) thay vì kẻ ô. Giảm đường kẻ, tăng khoảng thở. |
| P2 | **One accent, semantic rest** | Teal là accent thương hiệu duy nhất cho hành động chính & data nổi bật. Màu khác chỉ mang nghĩa trạng thái (success/warning/error/info). |
| P3 | **Data is the hero** | Số liệu dùng `tabular-nums`, font-weight cao, size lớn ở KPI. Chrome (viền, label) lùi về `text-tertiary`. |
| P4 | **Motion = feedback, not decoration** | Mọi animation phải giải thích một thay đổi trạng thái (enter, hover, select). Tôn trọng `prefers-reduced-motion`. |
| P5 | **Consistency is the product** | 1 loại nội dung = 1 component. Bảng/KPI/header/filter dùng chung primitive. Không "page-special". |

**Định vị thị giác 2025–2026:** Bento layout • Liquid Glass 2.0 (noise + specular + glow) • soft depth shadows • aurora accent (dark) • count-up numerics • segmented controls • command palette • sticky contextual toolbars • icon-led headers (Lucide).

---

## 2. Design Tokens

### 2.1 Color — Brand & Accent
```
--accent (light)        #2aaca7   teal — primary action, focus, active nav, data hero
--accent (dark)         #4bbcb8   luminous teal
--accent-glow           rgba(teal, .35/.40)
--color-secondary       #ff755e   coral — CHỈ cho điểm nhấn marketing, KHÔNG dùng trong data table
```

### 2.2 Color — Semantic (CHUẨN HOÁ — đang lệch, cần thống nhất)
> ⚠️ Hiện trạng có 2 hệ green (`--admin-success #52c41a` Ant vs `--chart-green #10b981` emerald) và info/blue khác chart-blue. **Quyết định FINAL:** dùng 1 bộ semantic thống nhất cho cả UI lẫn chart.

| Token | Hex | Dùng cho |
|---|---|---|
| `--success` | `#10b981` (emerald) | Hoạt động, đã giao, còn hàng, growth + |
| `--warning` | `#f59e0b` (amber) | Chờ xử lý, sắp hết, draft |
| `--error` | `#ef4444` (red) | Đã hủy, hết hàng, xóa, growth − |
| `--info` | `#3b82f6` (blue) | Đang xử lý, thông tin trung tính |
| `--violet` | `#8b5cf6` | Đã gửi (shipped), user growth |

→ Recharts dùng đúng các hex này (đã có trong `chart-colors.ts`), UI dùng CSS var. **Bỏ `--admin-*` Ant palette** để hết lệch.

### 2.3 Color — Surface (giữ nguyên, đã tốt)
```
                Light          Dark
--bg-base       #ffffff        #111111
--bg-surface    #fafafa        #161616
--bg-elevated   #f4f4f5        #1f1f1f
--bg-sunken     #f0f0f0        #0a0a0a
--text-primary  #09090b        #fafafa
--text-secondary#52525b        #a1a1aa
--text-tertiary #a1a1aa        #52525b
--border-default#e4e4e7        #27272a
```

### 2.4 Typography
```
Heading: Montserrat   — display-heading (900, tracking -0.03em) cho page title
Body:    Inter        — toàn bộ UI

Scale (rem):
  display   1.75   / 700-900 / -0.02em   → page title
  h2        1.125  / 600                 → card title
  label     0.6875 / 600 / uppercase / tracking .14em / text-tertiary  → table head, KPI label
  body      0.875  / 400-500
  caption   0.75   / 400 / text-tertiary
  numeric   tabular-nums LUÔN cho mọi số (giá, kho, %, count)
```

### 2.5 Spacing / Radius / Elevation
```
Spacing: 4-point scale (4,8,12,16,20,24,32)   — gap card: 16; padding card: 20
Radius:  pill 9999 • control .75rem • card 1.25rem • hero 1.75rem • modal 1rem
Shadow (elevation):
  e1 card rest:    0 1px 3px /.04 + 0 4px 16px /.06
  e2 card hover:   0 8px 24px /.10 + 0 20px 60px /.08   (+ teal glow ở accent card)
  Dark: thay alpha bằng 0.2–0.5, thêm inset top highlight rgba(255,255,255,.08)
Glass: blur(20–24px) saturate(1.6–1.8) + 1px border glass + specular ::after
```

### 2.6 Iconography
- **Lucide React** duy nhất. Stroke `2.25`, size 16/18/20.
- Mọi header (page/card/section) **bắt buộc** có icon chip: ô bo `rounded-lg w-7 h-7`, nền `color/12%`, icon `color`.

---

## 3. Foundations

### 3.1 App shell
```
┌────────────────────────────────────────────────────────────┐
│ [Sidebar floating glass]  │  [Sticky frosted header]         │
│  - logo + role            │  greeting · ⌘K search · noti · θ │
│  - nav groups (3)         ├──────────────────────────────────┤
│  - user card (bottom)     │  [Page content — max-w-[1440px]] │
│                           │   AdminPageHeader                 │
│                           │   (StatStrip?)                    │
│                           │   FilterBar (sticky on scroll)    │
│                           │   DataTable / Bento / Form        │
└────────────────────────────────────────────────────────────┘
```
- Sidebar: giữ floating glass (`glass-card` radius 1.5rem), width 240px, active item = teal pill + left accent bar.
- Header: `admin-sticky-header` (frosted opaque, đã fix) — z-40, không để content xuyên qua.
- Content padding: 24px; gap dọc giữa khối: 16–20px.

### 3.2 Density
2 chế độ (toggle ở header, lưu localStorage):
- **Comfortable** (default): row-height 56px, padding-y 12px.
- **Compact**: row-height 40px, padding-y 8px. (admin xem nhiều data thích compact.)

### 3.3 Light vs Dark
- Light: nền `page-canvas` gradient rất nhạt; card opaque `bg-base`.
- Dark: nền near-black neutral; card glass `rgba(255,255,255,.03)` + **aurora orbs** sau hero (chỉ dark). Đây là nơi "wow" đậm nhất.

---

## 4. Core Components

> Mỗi component: **Anatomy → Variants → States → Spec**. Đây là 6 primitive dùng lại toàn panel.

### 4.1 `AdminPageHeader`
- **Anatomy:** gradient-mesh card › section-number ("02 / SẢN PHẨM") › title (display) + icon › subtitle › actions slot (phải).
- **Variants:** `sparkle?`, `stats?` (gắn StatStrip ngay dưới).
- **Spec:** radius 1.75rem; mesh = 2 radial-gradient teal+info opacity .6; title `display-heading`; actions = Button cluster.
- *(Đã build — `AdminPageHeader.tsx`.)*

### 4.2 `AdminStatCard` (KPI)
- **Anatomy:** glass card › top accent bar (3px, màu theo metric) › [icon chip | label] › **value lớn count-up** › trend pill (▲/▼ %) + "vs kỳ trước" › optional sparkline 24px.
- **Variants:** màu accent (teal/info/success/warning/violet); `hasSparkline`, `hasTrend`.
- **States:** loading = shimmer; hover = lift e2 + glow.
- **Spec:** padding 20; value `text-3xl font-bold tabular-nums`; count-up dùng `FlipNumber`; chuẩn hoá để Dashboard + Users + Inventory **dùng chung** (hết lệch hiện tại).

```
┌─────────────────────────┐
│ ▔▔▔▔ (accent bar)        │
│ [💲] TỔNG DOANH THU      │
│ 24.990.000₫    ▲ 12.4%  │
│ ╱╲╱‾╲╱ (sparkline)  vs.. │
└─────────────────────────┘
```

### 4.3 `AdminDataTable` ⭐ (component quan trọng nhất — thay 7 bảng phẳng)
- **Anatomy:** glass card › [sticky FilterBar] › header row (label uppercase, sortable) › body rows › [BulkActionBar nổi khi chọn] › footer pagination.
- **Cell types chuẩn:** `MediaCell` (thumbnail + tên + dòng phụ), `ChipCell` (category chip màu), `MoneyCell` (tabular-nums, phải), `StockCell` (mini bar + số), `StatusCell` (StatusPill / inline select), `ActionsCell` (icon hiện khi hover row).
- **Variants:** `selectable`, `density`, `viewMode: table | grid`.
- **States:**
  - row hover: nền `accent/5` + **left accent bar reveal** (2px) + actions fade-in.
  - selected: nền `accent/8` + checkbox teal.
  - loading: 6 shimmer rows.
  - empty: illustration + CTA (xem §6).
- **Spec API (đề xuất):**
```ts
<AdminDataTable
  columns={[{ key, header, align, sortable, width, cell:(row)=>JSX }]}
  rows={products} rowKey={r=>r.id}
  selectable selectedKeys onSelectionChange
  sortBy sortOrder onSort
  bulkActions={<…/>} emptyState={<…/>} density="comfortable"
/>
```
- **Grid mode (flagship):** toggle table⇄grid; grid = card sản phẩm (ảnh 4:3, tên, giá, status chip, action overlay khi hover) — `glass-product-card` reuse.

### 4.4 `AdminFilterBar`
- **Anatomy:** glass row › search (instant, debounce 300ms, icon trái, ⌘K hint) › filter selects › sort select › right slot (export/view-toggle).
- **Spec:** **instant search mọi nơi** (bỏ nút search ở Discount); sticky `top-[76px]` khi scroll; chip "đang lọc" hiển thị filter active + nút clear-all.

### 4.5 `StatusPill` (giữ + chuẩn hoá)
- Variants: success/warning/error/info/violet/neutral. `showDot`, size sm/md.
- **Luôn dùng semantic token §2.2.** Có thể kèm icon (Clock/Truck/CheckCircle…) cho order status.

### 4.6 `AdminModal` (chuẩn hoá trên Radix Dialog)
- Dùng `.glass-dialog` (đã fix — KHÔNG set position, giữ canh giữa).
- **Anatomy:** header (icon chip + title + close) › body sections (mỗi section = card con bo 0.75rem) › sticky footer actions.
- Variants: `sm 420 / md 560 / lg 720 / xl 960`; danger = viền error.
- Modal chi tiết Đơn hàng/User hiện đã đạt chuẩn này → dùng làm mẫu.

### 4.7 Buttons (giữ hệ hiện có)
- Primary teal (filled) · Outline · Ghost · Destructive · size sm/md/icon. Hover lift 1px + glow nhẹ.

---

## 5. Motion & Micro-interactions

| Sự kiện | Animation | Spec |
|---|---|---|
| Page enter | fade + slide-up 12px | 0.3s `easeOutQuart [0.22,1,0.36,1]` |
| Card/row stagger | children fade-up | stagger 0.04–0.06s |
| KPI value | count-up | FlipNumber, 0.8s ease-out |
| Row hover | bg + left-bar + actions fade | 0.2s |
| Chart draw-in | path reveal + dots | recharts default + viewport trigger |
| Bulk-bar | slide-down + fade | 0.2s, AnimatePresence |
| Modal | scale 0.96→1 + fade | 0.2s |
| Theme switch | circular reveal (View Transitions) | đã có |

Tất cả wrap `@media (prefers-reduced-motion: reduce)` → tắt. Backdrop-blur giới hạn ≤ 2 lớp/viewport để không lag.

---

## 6. State System

**Empty state (mọi list):** illustration glass (icon trong khối gradient + blur halo) + tiêu đề + mô tả + CTA chính. *(Products đã làm — chuẩn hoá ra mọi trang.)*

**Loading:** shimmer skeleton đúng shape (KPI = 3 block; table = 6 row; chart = 2 block 80px). KHÔNG spinner toàn trang trừ lần đầu.

**Error:** card center, icon error trong khối `error/10`, message tiếng Việt generic, nút "Thử lại".

**Sparse data:** khi data ít (1–2 điểm) → chart hiện hint "Cần thêm dữ liệu" + ghost baseline thay vì 1 khối bè to.

---

## 7. Page Archetypes

> 11 trang quy về **4 archetype**. Thiết kế archetype = thiết kế xong cả nhóm.

### 7.1 Archetype DASHBOARD (overview)
- Row hero: 3 card Bento (Doanh thu hero + Đơn gần đây + Khách) — card doanh thu **rộng hơn** (true bento, không đều).
- Aurora orbs sau hero (dark).
- Alert strip (đơn chờ xử lý).
- Charts: 6 chart, mỗi card có icon chip header (đã làm), palette teal-led.
- Bottom: Top sản phẩm + Sắp hết hàng.
- ⭐ Thêm: KPI count-up, sparkline trong card doanh thu.

### 7.2 Archetype LIST (Products/Orders/Users/Categories/Brands/Discount/Inventory)
**Canonical layout:**
```
AdminPageHeader (title + actions)
StatStrip (3-4 AdminStatCard)            ← nếu có aggregate data
AdminFilterBar (search + filters + view-toggle)   [sticky]
[BulkActionBar khi chọn]
AdminDataTable (MediaCell · ChipCell · StatusCell · ActionsCell)
Pagination
```
- Row premium: thumbnail + tên + dòng phụ; category **chip màu**; stock **mini-bar**; actions hover-reveal.
- View toggle table⇄grid (ít nhất cho Products).

### 7.3 Archetype DETAIL (UserDetail / Order detail-modal)
- 2 cột: trái = profile card (cover gradient + avatar + meta + status); phải = tabbed content (Tabs glass).
- Section = card con. Số liệu count-up. *(UserDetail đã gần chuẩn — nâng KPI strip + tab polish.)*

### 7.4 Archetype FORM (Product create/edit)
**Redesign wizard 9-tab → 2 lựa chọn (đề xuất A):**
- **A. Vertical stepper trái + nội dung phải** (desktop): cột trái sticky list 9 bước có ✓/trạng thái, cột phải form. Rõ tiến độ, không cramped.
- **B. Single-scroll + section nav nổi** (mobile-first).
- **Sticky save bar** dưới: trạng thái lưu + nút Lưu nháp / Xuất bản. Autosave indicator.
- Mỗi step = card glass; field group rõ; inline validation.

---

## 8. Per-page Notes (điểm sửa cụ thể)

| Trang | Giữ | Sửa |
|---|---|---|
| **Dashboard** | Bento, charts có icon, dark đẹp | KPI count-up + sparkline; bento doanh thu rộng hơn; aurora đậm hơn (dark) |
| **Products** | thumbnail, filter, modal | Row premium + chip màu + stock-bar + grid toggle + StatStrip (tổng/active/sắp hết/hết) |
| **Orders** | bảng đủ cột, modal detail tốt | Áp DataTable; status = pill+icon; StatStrip (chờ/đang xử lý/đã giao/hủy + doanh thu) |
| **Users** | có 4 KPI | **Đổi 4 KPI phẳng → AdminStatCard** (hết lệch); áp DataTable |
| **Categories** | — | Hiển thị **tree thật** (indent + connector); bỏ cột THỨ TỰ rỗng hoặc cho drag-reorder; thumbnail thật |
| **Brands** | có logo | **Bỏ cột WEBSITE rỗng** (hoặc thêm field); áp DataTable; grid logo đẹp hơn |
| **Discount** | — | **Bỏ nút search riêng → instant**; StatStrip (đang chạy/hết hạn/lượt dùng); card-style mã |
| **Inventory** | expandable variant rows | **Thêm StatStrip** (tổng tồn/sắp hết/hết); stock-bar; đưa search vào FilterBar |

---

## 9. Accessibility

- Contrast ≥ 4.5:1 cho text (kiểm token dark/light).
- Focus visible ring teal 2px offset 2px (`.focus-ring`) trên MỌI control (kể cả icon-button).
- Mọi icon-button có `aria-label` (đã làm phần lớn).
- Table: `<th scope>`, sortable header là `<button aria-sort>`.
- Modal: focus trap (Radix lo), ESC đóng, return focus.
- Keyboard: ⌘K mở command palette; Tab order hợp lý; row actions reachable.
- `prefers-reduced-motion` tắt animation.
- Status KHÔNG chỉ bằng màu → luôn kèm text/icon.

---

## 10. Responsive

| Breakpoint | Hành vi |
|---|---|
| `≥1280 xl` | Sidebar cố định + content max-w-1440; bảng full cột; bento 3 cột |
| `1024–1280 lg` | Như trên, gap giảm |
| `768–1024 md` | Sidebar → Sheet (hamburger); bảng ẩn cột phụ (SKU, ngày) → gộp vào MediaCell; bento 2 cột |
| `<768 sm` | DataTable → **card list** (mỗi row = card dọc); filter collapse vào drawer; KPI 2 cột; form single-scroll |

Quy tắc: bảng KHÔNG scroll ngang trên mobile → chuyển card list.

---

## 11. Implementation Roadmap

> Phased, mỗi phase: `typecheck`+`lint`+screenshot light/dark, không vỡ trang khác.

| Phase | Nội dung | Output |
|---|---|---|
| **0. Tokens** | Chuẩn hoá semantic palette §2.2 (bỏ `--admin-*` Ant, thống nhất green), density var | `_tokens.scss`, `index.scss` |
| **A. Primitives** | `AdminStatCard`, `AdminDataTable`, `AdminFilterBar` (+ `AdminPageHeader` đã có) | 4 component |
| **B. Products canonical** | Dựng Products đầy đủ archetype LIST (row premium + chip + stock-bar + grid toggle + StatStrip) → **duyệt look** | 1 trang mẫu |
| **C. Rollout LIST** | Orders, Users, Categories(tree), Brands, Discount, Inventory dùng primitive | 6 trang |
| **D. Dashboard polish** | count-up, sparkline, bento rộng, aurora | dashboard |
| **E. Form** | Product create/edit → vertical stepper + sticky save | form |
| **F. Command palette** | ⌘K thật (nav + entity search) — biến nút giả thành feature | header |
| **G. QA** | a11y pass, responsive (mobile card list), reduced-motion, screenshot toàn bộ | — |

**Thứ tự đề xuất:** 0 → A → B (gate duyệt) → C → D → E → F → G.
Ước lượng: B là cột mốc "thấy được flagship"; C trở đi là nhân rộng nhanh nhờ primitive.

---

### Phụ lục — Checklist "chỉn chu" (Definition of Done mỗi trang)
- [ ] Dùng đủ primitive chung (không markup table/KPI tự chế).
- [ ] Icon chip ở mọi header. Số dùng tabular-nums.
- [ ] Empty/loading/error đúng chuẩn §6.
- [ ] Hover/selected/focus states đầy đủ.
- [ ] Light + Dark đều kiểm bằng screenshot thật.
- [ ] Responsive: bảng→card list <768.
- [ ] a11y: focus ring + aria-label + sort semantics.
- [ ] `typecheck` + `lint --max-warnings 0` xanh.
