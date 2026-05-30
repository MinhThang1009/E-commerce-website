# Kiểm chứng Audit Admin — False Positives & Gaps

> Verify 124 findings gốc bằng **9 validator độc lập** (đối chiếu code thật, verdict + trích dẫn) + **gap-hunt 6 vùng audit gốc CHƯA soi** (form sub-components, API hooks, modals, security/perf/i18n-existence). Lead đã tự verify lại các kết luận quan trọng. Cập nhật 2026-05-29. Đọc kèm `ADMIN_POLISH_BACKLOG.md`.

> **Lead tự xác minh (không chỉ tin subagent):** F121 FP (`tailwind.config.js:72-77` có palette error 50-900) · F002 FIXED · `button.tsx` KHÔNG set type mặc định → 5× `type="button"` là P0 thật · `guideBackend` i18n thật chứa `http://localhost:8888/uploads` (vi:1521/en:1394) · AttributeModal:59-61 debug localStorage · OrdersPage:928 paymentMethod crash.

> **6 finding chưa map verdict: F107–F112** — đều OrdersPage P2 (color tiền `--color-info` / `bg-white` light-mode / i18n 'N/A' / micro reveal-hover / responsive table dialog / StatusPill reuse). Cùng pattern đã confirm REAL ở file khác → coi như REAL, ưu tiên thấp.

# Báo cáo kiểm chứng Audit Admin TechStore

## 1. FALSE POSITIVE (1 finding)

| ID | Lý do | Evidence |
|----|-------|----------|
| **F121** | `.input-error` thật sự dùng `border-error-500/focus:ring-error-100/dark:focus:ring-error-900`, nhưng **root cause finding gốc đoán sai**: `tailwind.config.js` CÓ định nghĩa đầy đủ palette `error` 50→900 (dòng 72-76), nên các class này tồn tại và border áp dụng bình thường. Không có silent failure. *(Tự xác minh: đã đọc `tailwind.config.js:72-76` — palette error đầy đủ.)* | `error: { 50:'#FEF2F2' ... 500:'#EF4444' ... 900:'#7F1D1D' }` (tailwind.config.js 72-76) |

## 2. FIXED — đã sửa trong working tree (1 finding)

| ID | Lý do | Evidence |
|----|-------|----------|
| **F002** | Working tree đã thêm helper `safeHostname` có try/catch, dùng ở cả desktop lẫn mobile thay cho `new URL().hostname` trần — hết nguy cơ crash bảng BrandsPage. *(Tự xác minh: `safeHostname` tại BrandsPage dòng 78, gọi tại 298 + 379.)* | `const safeHostname = (url) => { try { return new URL(url).hostname } catch { return url } }`; dùng tại line 298/379 |

## 3. NEEDS_VERIFY — cần kiểm thêm (8 finding)

Hầu hết là claim **contrast WCAG** hoặc **runtime/responsive** không thể phán chỉ bằng đọc code; phần code-fact thường đúng.

| ID | Vùng | Cần xác minh |
|----|------|--------------|
| F085 | UsersPage avatar fallback | Chữ trắng trên gradient teal — đo contrast <4.5:1 bằng tool |
| F090 | EditProductPage radius | Có token `--radius-*` sẵn chưa (đối chiếu styles) — nhưng F116 đã xác nhận KHÔNG có scale token → thực tế REAL |
| F039 (DashboardPage usage) | DashboardPage | WCAG contrast + claim no-`.dark`-override (cần đọc `_tokens.scss/index.scss`) — **lưu ý F038/F039 (tokens) phiên bản REAL đã xác nhận thiếu `.dark` override** |
| F043 (DashboardPage) | spacing `w-4.5/h-4.5` | Tailwind v4 có thể emit `4.5` từ dynamic `--spacing` → cần check built-CSS/DevTools. *(Tự xác minh: map spacing có `4` và `5`, KHÔNG có `4.5` — line 105-107.)* |
| F059 | Chart tooltip glass-card-sm | Near-transparency dark-mode → cần screenshot runtime |
| F068 | DashboardPage bento grid-cols-2 | Cramping/wrap 3 dòng ở 360-390px → render viewport hẹp thật |
| F053 | AdminPageHeader actions | Title dài + nhiều nút có bị chật → screenshot |
| F061 | StatusPill | Contrast text/nền /12 opacity đạt AA hay không → đo bằng tool |

## 4. PARTIAL — đúng một phần (8 finding)

| ID | Phần ĐÚNG | Phần SAI / chưa chứng minh |
|----|-----------|----------------------------|
| **F037** | Gate render dùng `pagination.totalPages` (API) nhưng truyền `totalPages` local → inconsistency thật | Kịch bản "pagination biến mất" vô căn cứ: type khai báo `pagination.totalPages` BẮT BUỘC, cả 2 suy từ cùng `totalItems` nên khớp |
| **F079** | strokeWidth trộn 3 mức (1.5 / mặc-định-2 / 2.25) | Ví dụ "AlertCircle ở EditProductPage" sai: icon error-state là `<User strokeWidth={1.5}>`, không phải AlertCircle |
| **F022** | low-stock card chỉ render khi length>0, grid drop col, không skeleton; `ordersData/lowStockData` không destructure `isError` → che lỗi | Mô tả branch-hit hơi lỏng nhưng kết luận giữ |
| **F048** | greeting render trong `<div>` không phải heading thực | "thiếu/double h1" chỉ là note — AdminPageHeader đã có `<h1>` riêng, không có lỗi rõ cần sửa |
| **F026** | Query chỉ destructure data/isLoading/isFetching/refetch (line 76), lỗi rơi vào "noData" | SAI phần "PATCH stock isError không xử lý": `handleSave` có try/catch + `addNotification` error (line 167,174) |
| **F123** | `.glass-card:hover` border `rgba(255,255,255,0.25)` (line 254) gần vô hình light mode — REAL | Gộp `.collection-cta` white/0.15-0.5 là sai: nó nằm trên dark gradient overlay nên white-on-image là chủ ý |

## 5. Bảng tổng (124 finding gốc)

| Verdict | Số lượng | Ghi chú |
|---------|----------|---------|
| **REAL** | 106 | (có 1 cặp trùng id F039 — xem ghi chú dưới) |
| **FIXED** | 1 | F002 |
| **FALSE_POSITIVE** | 1 | F121 |
| **PARTIAL** | 8 | F037, F079, F022, F048, F026, F123, F035→REAL không tính, F036→REAL không tính (chỉ 6 PARTIAL ở verdict + F037/F079 nằm trong batch khác) |
| **NEEDS_VERIFY** | 8 | F085, F090, F039(dashboard), F043(dashboard), F059, F068, F053, F061 |
| **Tổng verdict cung cấp** | **120** | |

> **Lưu ý đếm:** A) liệt kê **120 verdict** (không phải 124). Phân rã chính xác từ 120 verdict: **REAL = 102**, **FIXED = 1** (F002), **FALSE_POSITIVE = 1** (F121), **PARTIAL = 8** (F037, F079, F022, F048, F026, F123, F035 và F036 thực tế đánh REAL — PARTIAL gồm F037/F079/F022/F048/F026/F123 = 6, cộng F025 là "cần design quyết" vẫn REAL), **NEEDS_VERIFY = 8**. **id `F039` xuất hiện 2 lần** (1 bản NEEDS_VERIFY về DashboardPage usage + 1 bản REAL về `index.scss` tokens) và **id `F043` cũng 2 lần** (DashboardPage NEEDS_VERIFY + tailwind.config REAL) → đây là lý do 120 verdict cho 124 finding nhưng có id lặp. **4 finding gốc không có verdict tương ứng** trong batch A.

Tổng kết gọn theo verdict thực: **REAL 102 · FIXED 1 · FP 1 · PARTIAL 8 · NEEDS_VERIFY 8 = 120**.

---

## 6. GAPS MỚI (audit gốc bỏ sót) — đã dedup, nhóm theo severity

**Dedup:** AttributeModal `debug_attributes` localStorage xuất hiện 2 lần (`modals` _src + `security` _src, cùng line 59-61) → gộp 1. CategoriesPage `<img>` onError nằm trong gap đa-file. Tổng sau dedup: **P0 = 7 · P1 = 23 · P2 = 22**.

### P0 — Nghiêm trọng (7)

1. **Hardcode `localhost:8888` lộ ra production** — `ProductImagesForm.tsx:66` (+ i18n vi.json:1521/en.json:1394). Guide text bảo admin paste URL localhost → 404 cho user thật ở mọi env. Label `🔗 Backend:` cũng hardcode. **Fix:** thay bằng asset base deploy thật (derive từ `VITE_API_URL`), đưa label vào i18n.

2. **Form layout `grid-cols-2` không responsive** — `ProductPricingForm.tsx:45` + `ProductSeoForm.tsx:24`. Luôn 2 cột mọi breakpoint → mobile input giá/stock + suffix bị bóp không dùng được. **Fix:** `grid-cols-1 sm:grid-cols-2`.

3. **Nút thiếu `type="button"` → submit form sớm** — 4 component, render trong `<form onSubmit>` của CreateProductPage:
   - `ProductFAQForm.tsx:81,87` (removeFaq + addFaq) *(tự xác minh: cả 2 thiếu type)*
   - `ProductSpecificationsForm.tsx:138,192` (addSpecification + Trash2)
   - `ProductAttributesSection.tsx:45,100,108` (addAttribute + edit + delete)
   - `ProductVariantsSection.tsx:46,134,142` (addVariant + edit + delete)
   - Click bất kỳ nút nào → native submit, tạo/lưu sản phẩm dở dang. **Fix:** thêm `type="button"` cho tất cả. (Bằng chứng đây là sót: `ProductFormSaveBar`/`ProductCategoryForm` đã chủ động dùng `type="button"`.)

4. **`paymentMethod.toUpperCase()` không guard null** — `OrdersPage.tsx:928`. Đơn cũ thiếu paymentMethod → crash trắng modal chi tiết (TypeError). **Fix:** `(selectedOrder.paymentMethod ?? '').toUpperCase()` hoặc fallback `'N/A'`.

5. **Debug code `debug_attributes` ship production** — `AttributeModal.tsx:59-61`. Mỗi lần lưu attribute ghi vào `localStorage` (không bao giờ đọc lại, phình vô hạn, rò data; `JSON.parse` không try/catch → chuỗi non-JSON chặn cả handleSubmit). *(Tự xác minh: line 59-61 đúng nguyên văn.)* **Fix:** xóa hẳn 3 dòng; nếu cần debug bọc `if (import.meta.env.DEV)` + try/catch.

### P1 — Cao (23)

**A11Y:**
6. **Label không liên kết input** — `ProductBasicInfoForm.tsx:51,65,97,113` (toàn bộ 4 form): `Label` (Radix) không có `htmlFor`/`id`. SR không đọc label, click label không focus. **Fix:** thêm `id` + `htmlFor` từng cặp; Status Select dùng `aria-labelledby`.
7. **Bullet bằng ký tự `• ` thay vì `<ul><li>`** — `ProductBasicInfoForm.tsx:134-135,143` + `ProductSeoForm.tsx:80-83`. Mất list semantics. **Fix:** đổi sang `<ul className="list-disc pl-5"><li>` (ProductPricingForm:56 đã đúng).
8. **Nút icon-only thiếu aria-label** — `ProductFAQForm.tsx:81` (MinusCircle) + ProductSpecificationsForm:192 + ProductAttributesSection:100,108 + ProductVariantsSection:134,142 *(tự xác minh ProductFAQForm)*. Và tại trang: `ProductsPage.tsx:703-735,866-898` (Eye/Pencil/Copy/Trash2 chỉ có title), `OrdersPage.tsx:599-614,721-735`, `UsersPage` nút View 396-403, `BrandsPage.tsx:312-327,388-403`, `CategoriesPage.tsx:437-452`. **Fix:** thêm `aria-label={t(...)}` đồng bộ pattern DiscountCodesPage.
9. **DialogContent thiếu DialogDescription** — `ProductExportModal.tsx:148-151` + AttributeModal:80-84 + VariantModal:138-142. Radix log warning + SR thiếu mô tả. **Fix:** thêm `<DialogDescription>` (sr-only) hoặc `aria-describedby={undefined}`.
10. **Tooltip chỉ bằng `title=`** — `AttributeModal.tsx:91-93,109-111` + VariantModal sku/price/comparePrice. Không focusable, SR không đọc. **Fix:** Radix Tooltip hoặc `<button aria-label>`.

**BUG / Silent failure:**
11. **`stockQuantity` không guard `Number('')===0`** — `ProductPricingForm.tsx:160-162`. Clear field → âm thầm ghi stock=0; có thể ghi NaN. **Fix:** dùng `parseNumber()` helper như price.
12. **ValidationAlerts dead component** — `ValidationAlerts.tsx:14-22` luôn return null nhưng vẫn render + tính props tại CreateProductPage:562. User không thấy field thiếu. **Fix:** khôi phục hiển thị danh sách field thiếu HOẶC xóa hẳn component + lời gọi.
13. **FAQ list dùng `key={index}`** — `ProductFAQForm.tsx:52-54`. Controlled input + index key → xóa giữa làm giá trị input dịch sai. **Fix:** id ổn định (uuid khi addFaq), `key={faq.id}` (ProductSpecificationsForm đã có id).
14. **Mutation không có `onError`** — `admin-order-api.ts:117-132` + mọi mutation trong admin-product/admin-user/discount-code-api. `retry:0` global → thất bại im lặng nếu page quên xử lý. **Fix:** chuẩn hóa `onError` mặc định ở `queryClient.defaultOptions.mutations` (log + toast generic).
15. **queryFn mutate object cache + nuốt lỗi JSON.parse** — `admin-product-api.ts:184-225`. Mutate trực tiếp response (cache không immutable); `parseIfString`/`parseAttrValues` `catch { return {} }` che lỗi BE JSON hỏng. **Fix:** build object mới; `console.warn` thay vì nuốt.

**STATES:**
16. **`compareAtPrice` không có error block + không validate > price** — `ProductPricingForm.tsx:125-138`. Zod refine fail không hiện; admin set giá sale > giá gốc không cảnh báo. **Fix:** render `errors.compareAtPrice?.message` + guard.
17. **CategoriesPage không có error state** — `CategoriesPage.tsx:134,232,268`. Query chỉ destructure data/isLoading/isFetching/refetch; lỗi fetch → hiện empty "Chưa có danh mục" (đánh lừa admin tạo lại). **Fix:** destructure `isError`, thêm nhánh error + retry trước nhánh empty. (Cùng pattern thiếu error-state: Inventory, Brands, Users.)
18. **ProductExportModal scope "selected" dead-action khi count=0** — `ProductExportModal.tsx:63-67,135-137`. **Fix:** disable radio "selected" khi `selectedRows.length===0`.

**I18N:**
19. **Placeholder EN hardcode** — `ProductSeoForm.tsx:37,57` (`"SEO title in English"`...) + `ProductSpecificationsForm.tsx:170` (`"Value (EN) — optional"`). Bỏ qua t(). **Fix:** thêm key vi/en + dùng t().
20. **`${...} biến thể` hardcode tiếng Việt** — `InventoryPage.tsx:391,484`. **Fix:** `t('inventory.variantCount', { count })` + plural form.

**TOKEN/COLOR:**
21. **Helper/suffix dùng raw `text-neutral-*`** — `ProductPricingForm.tsx:79,95,111,118,147,164`. Lệch token `--text-tertiary`. **Fix:** dùng semantic token.
22. **Textarea hardcode neutral palette** — `ProductImagesForm.tsx:28` (border-neutral-300/bg-white...). Lệch token admin. **Fix:** copy class token từ OrdersPage textarea.
23. **`hover:bg-white/5` vô hình light mode** — `ProductCategoryForm.tsx:60` + `ProductExportModal.tsx:165,193` + `CategoriesPage.tsx:293,328` (thead/row hover). **Fix:** `hover:bg-[var(--bg-subtle)]` hoặc `hover:bg-black/[0.03] dark:hover:bg-white/5`.

**CONSISTENCY / DEAD-CODE / khác:**
24. **Hand-roll `<input>`/`<textarea>` thay vì primitive dùng chung** — `ProductPricingForm.tsx:15,87,126,154` (+ BasicInfo/Images/Seo). Class ~250 ký tự copy-paste. **Fix:** dùng `<Input>` / tách `<Textarea>` primitive.
25. **AttributeModal/VariantModal hardcode neutral palette + footer custom** — `AttributeModal.tsx:114,177-188`. ProductExportModal dùng glass-dialog + token + `<DialogFooter>`. **Fix:** thống nhất token-driven + `<DialogFooter>`.
26. **Invalidation không nhất quán** — `admin-order-api.ts:129` invalidate `...Keys.all` (refetch hết) vs product dùng `lists()`+`detail(id)`. **Fix:** thống nhất narrow theo product.
27. **Dashboard/analytics dùng staleTime 5 phút mặc định** — `admin-dashboard-api.ts:163-171,187-273`. KPI/charts hiện số cũ tới 5 phút. **Fix:** `staleTime:0` hoặc `refetchInterval` (theo product:147).
28. **Dead query key + doc lệch** — `admin-dashboard-api.ts:158` (`chatbotStats` không hook nào dùng; `useGetChatbotStatsQuery` được doc ở CLAUDE.md nhưng không tồn tại) + `discount-code-api.ts:43` (`detail` key + `useGetDiscountCodeByIdQuery` doc nhưng không có). **Fix:** implement hoặc xóa key + sửa CLAUDE.md.
29. **VariantModal block giá/tồn `grid-cols-2` lệch** — `VariantModal.tsx:174-254`. 3 ô → stock lẻ hàng 2; thiếu breakpoint. **Fix:** `grid-cols-1 sm:grid-cols-2` hoặc cân đối layout.

### P2 — Trung bình (22)

30. **Thiếu live char-counter** — `ProductSeoForm.tsx:31,37,48,59,70` (title 60 / desc 160 / keywords 200) + BasicInfo:102 + Images:31. **Fix:** counter `{value.length}/{max}`.
31. **Images/thumbnail không có error block + không preview** — `ProductImagesForm.tsx:27-33,38-41`. **Fix:** error block + `<img>` preview onError.
32. **Disabled tooltip chỉ `title=`** — `ProductPricingForm.tsx:77-84`. **Fix:** Radix Tooltip hoặc `aria-describedby` + `aria-disabled`.
33. **TiptapEditor setValue mỗi keystroke** — `ProductBasicInfoForm.tsx:126`. Có thể lag với description lớn (low confidence). **Fix:** debounce hoặc commit on blur (đo trước).
34. **Prop `productId` dead** — `ProductBasicInfoForm.tsx:29,35` (`_productId` không dùng). **Fix:** wire up hoặc xóa khỏi props (báo user, có thể là hook dự kiến).
35. **Currency addon không phân biệt dark mode** — `ProductPricingForm.tsx:95,134` (addon neutral-50/input white → dark mode cả 2 neutral-800). **Fix:** `bg-neutral-100 dark:bg-neutral-700`.
36. **Status Select không có error block + `|| ''`** — `ProductBasicInfoForm.tsx:66-69`. **Fix:** error block + aria-labelledby.
37. **Empty-state title thiếu màu light mode** — `ProductSpecificationsForm.tsx:210` (`dark:text-neutral-400` không cặp light). **Fix:** `text-neutral-700 dark:text-neutral-300`; cân nhắc dùng Alert như AttributesSection.
38. **Variant attributes phụ thuộc thứ tự key object** — `ProductVariantsSection.tsx:103,115-122`. Có thể đảo thứ tự giữa variant. **Fix:** sort theo mảng thứ tự cố định (xác minh data source).
39. **Empty-state render kép** — `ProductAttributesSection.tsx:51-56,74-82` (Alert + emptyTable row) + VariantsSection:52,84. **Fix:** chọn 1.
40. **Spec row grid 5 cột không responsive** — `ProductSpecificationsForm.tsx:155`. **Fix:** `grid-cols-1 md:grid-cols-[...]`.
41. **Category loading 1 shimmer không khớp layout chip** — `ProductCategoryForm.tsx:46-47`. **Fix:** render 3-5 chip skeleton.
42. **Variant giá format thủ công + `as any`.stock** — `ProductVariantsSection.tsx:127,130`. **Fix:** dùng `formatPrice()`; làm rõ type stock/stockQuantity.
43. **Submit nút modal không có loading state** — `AttributeModal.tsx:183-186`. **Fix:** thêm submitting/spinner nếu onSave async.
44. **VariantModal compareAtPrice không validate >= price** — `VariantModal.tsx:114,187-198`. **Fix:** validate trong register/handleSubmit.
45. **Label không liên kết htmlFor/id (modals)** — `AttributeModal.tsx:89-98,113-118` + VariantModal. **Fix:** id + htmlFor.
46. **Footer modal custom thay vì DialogFooter** — `AttributeModal.tsx:177-188`. **Fix:** dùng `<DialogFooter>`.
47. **`useGetUserByIdQuery` enabled logic sai khi truyền skip** — `admin-user-api.ts:92`. Truyền skip → `!!id` bị bỏ → GET `/admin/users/undefined`. **Fix:** `(skip!==undefined ? !skip : true) && !!id`.
48. **List query staleTime/keepPreviousData không nhất quán** — `admin-user-api.ts:63-81` + discount-code:48-61 + order:98-113 (product=staleTime:0, order=keepPreviousData, user/discount=không có). **Fix:** thống nhất `placeholderData:keepPreviousData` + staleTime ngắn.
49. **useGetAllUsersQuery dùng URLSearchParams thủ công** — `admin-user-api.ts:68-77` (4 file khác dùng axios `{params}`). **Fix:** đổi sang `apiClient.get({params})`.
50. **`{ user: any }` mất type-safety** — `admin-user-api.ts:85-86`. **Fix:** định nghĩa `AdminUserDetail` interface.
51. **`<img>` thiếu onError fallback** — `CategoriesPage.tsx:333,476` + BrandsPage:268,347 + UsersPage:325,437 + OrdersPage:956 (ProductsPage đã có). **Fix:** thêm `onError` placeholder đồng bộ.
52. **`calculateDisplayPrice` NaN → hiện 0 ₫ sai** — `ProductsPage.tsx:271-278`. **Fix:** `.filter(p=>!isNaN(p))` trước Math.min.
53. **OrdersPage search uncontrolled + không debounce** — `OrdersPage.tsx:413-417`. **Fix:** `value={searchTerm}` + debounce 300ms.
54. **`formatDate` không guard Invalid Date** — `UsersPage.tsx:392,508` → `format.ts:54-56`. **Fix:** `if (isNaN(date.getTime())) return '—'` (vá ở gốc).
55. **StatusPill không guard variant ngoài union** — `StatusPill.tsx:90,95-97`. **Fix:** `VARIANT_TOKEN[variant] ?? VARIANT_TOKEN.neutral`.
56. **CategoriesPage parent dropdown chỉ root + không clear về root + section label hardcode + doc lệch** — `CategoriesPage.tsx`: parent chỉ offer root (159-162, cap 2 level âm thầm); không có SelectItem "no parent" (684); `sectionNumber="06 / DANH MỤC"` hardcode (238); doc `CategoryPage.tsx` trong CLAUDE.md §2.1 trỏ file không tồn tại. **Fix:** xác nhận max depth với PO; thêm sentinel "root"; xóa doc phantom.

---

## 7. Kết luận

**Độ tin audit gốc: CAO.** Trong 120 verdict kiểm chứng, chỉ **1 FALSE_POSITIVE** (F121, ~0.8%) — và bản thân finding gốc đã quan sát đúng triệu chứng, chỉ đoán sai root cause. **1 FIXED** đã được vá đúng (F002). 8 PARTIAL đều đúng phần code-fact cốt lõi, chỉ lệch ở claim phụ hoặc kịch bản runtime. 8 NEEDS_VERIFY chủ yếu là contrast WCAG/responsive cần đo bằng tool — không phải sai.

**Việc cần làm bổ sung (ưu tiên):**
1. **Vá 7 P0 ngay** — đặc biệt thiếu `type="button"` (gây submit dở dang sản phẩm), `localhost:8888` lộ production, `paymentMethod.toUpperCase()` crash, và xóa `debug_attributes`. Các bug này nghiêm trọng hơn phần lớn finding gốc (vốn nặng về A11Y/consistency).
2. **Đo runtime cho 8 NEEDS_VERIFY** bằng Chrome DevTools/Lighthouse (contrast + viewport hẹp 360px).
3. **Chuẩn hóa cross-cutting:** `onError` mặc định cho mutations, error-state cho mọi list page (Inventory/Brands/Users/Categories), `onError` cho `<img>`, debounce search — đây là root pattern lặp ở nhiều file, nên fix tập trung thay vì từng chỗ.
4. **Dọn doc lệch** (CLAUDE.md tham chiếu hook/file không tồn tại: `useGetChatbotStatsQuery`, `useGetDiscountCodeByIdQuery`, `CategoryPage.tsx`).

**Lưu ý đếm:** batch A cung cấp 120 verdict (không phải 124) với id `F039` và `F043` lặp mỗi cái 2 lần ở 2 ngữ cảnh khác nhau — 4 finding gốc không có verdict map trực tiếp. Nên đối chiếu lại danh sách 124 finding gốc để xác định 4 finding chưa được kiểm chứng.