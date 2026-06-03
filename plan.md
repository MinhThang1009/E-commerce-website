# BÀN GIAO (HANDOFF) — KLTN TechStore + code

> Tài liệu bàn giao cho session sau hoàn thiện. Đủ chi tiết để agent mới chạy tiếp KHÔNG cần context cũ.
> Cập nhật lần cuối: phiên làm việc thêm role `staff` + sửa bug + cơ chế tự kiểm.

---

## 0. QUYẾT ĐỊNH ĐÃ CHỐT (KHÔNG mở lại)
- **Docs**: viết lại/cải thiện văn phong **c1–c4** (chương 1–4 báo cáo KLTN) + sửa cấu trúc/sơ đồ + nhất quán thuật ngữ. Bám codebase thật.
- **Sơ đồ — tool chốt theo loại** (tiêu chí: tôi vẽ được + user chỉnh được + phổ biến + chuyên dụng nhất; bám code; **KHÔNG graphviz**):
  - UML use case / sequence / state / component / activity / deployment → **PlantUML**:
    - `plantuml.jar` + Java để **NGOÀI repo** (`C:\Users\Admin\plantuml\`, đã tải v1.2026.5).
    - Layout engine = **graphviz** (đã cài `winget Graphviz.Graphviz` v15.0.0 — đẹp + đúng luồng nhất cho state/component/deployment; là engine mặc định). Shell chưa có dot trong PATH → `export GRAPHVIZ_DOT="C:\Program Files\Graphviz\bin\dot.exe"`.
    - ⚠️ graphviz ở đây CHỈ là layout engine nền PlantUML — KHÁC "vẽ sơ đồ DOT" đã bỏ (`diagrams_dot/` vẫn xóa). ELK/smetana = fallback zero-install nhưng layout kém hơn. Use case/sequence KHÔNG cần graphviz.
  - ERD → **DBML → dbdiagram.io** (auto từ DB, chỉnh trên web real-time).
  - RAG pipeline (§6) + flow nói chung → **Mermaid** mặc định (`npx mmdc`; phổ biến + render inline); **D2** khi cần 1 sơ đồ thật đẹp (vẫn as-code, dùng riêng lẻ — KHÔNG thay cả hệ Mermaid).
  - Testing pyramid → **draw.io** (qua MCP, chỉnh GUI).
  - Bảng NFR/chức năng → **LaTeX `booktabs` + `tabularx`** (KHÔNG render HTML→PNG).
  - Verify từng sơ đồ với code TRƯỚC khi render.
- **Role mới `staff`** ("Nhân viên bán hàng"): **tách bạch hoàn toàn**, admin **xem-only** dashboard/analytics. Làm code + docs đầy đủ.
  - **Bảng RBAC canonical** (1 nguồn — FE+BE phải khớp; chi tiết guard ở §1.2):
    | Nhóm chức năng | guest | customer | staff | admin |
    |---|---|---|---|---|
    | Storefront (xem SP, giỏ, đặt/hủy/repay đơn của mình) | xem | ✅ | — | — |
    | Back-office **XEM** (dashboard/stats/analytics/reports/list/chatbot-stats) | — | — | ✅ | ✅ (xem-only) |
    | Back-office **THAO TÁC** (CRUD products/orders-status/reviews/discount/inventory-restock/catalog-write/payment-refund/attribute) | — | — | ✅ | ❌ |
    | Quản lý **users** + analytics/user-growth | — | — | ❌ | ✅ |
- **Bug**: sửa hết 9 bug đã confirm (XONG) + dọn API thừa.
- **Test**: minh chứng số liệu thật (chạy test) + nhúng vào báo cáo (chưa làm phần nhúng).
- **Perf**: **autocannon**. MySQL: đang chạy (dùng cho integration/API/E2E + load test). Được phép cài dependency.
- **Coverage**: user muốn **100% FE+BE unit** (chấp nhận đánh đổi) — xem §3.A.
- Thực thi: phân pha có duyệt.

## 1. ĐÃ XONG (verified) phiên này
1. **9 bug logic — FIX + unit 158 suites/3745 PASS**:
   - cancelOrder lock order (`findOrderForCancel` nhận transaction + `lock {level, of: Order}`); restore tồn kho `.increment()` atomic; inventory `sumVariantStockByProductId` forward options; `handleVnPayReturn` lock TRƯỚC `_canProcessPayment`; discount `findActiveDiscountCode` lock FOR UPDATE; chatbot giữ `lowConfidence` trong catch; `verifyRefreshToken` thêm `algorithms:['HS256']`; `optionalAuthenticate` log token lỗi.
   - Test mock cập nhật: orders-service (LOCK.UPDATE), orders-repository (increment), payment-service (lockOrder).
2. **Role `staff` BE — XONG (unit 3745 PASS)**:
   - migration `backend/src/migrations/2026060201-add-staff-role.js` (ENUM thêm 'staff', **CHƯA chạy db:migrate**).
   - `user.js` enum `('customer','staff','admin')`.
   - `admin-auth.js`: `BACKOFFICE_ROLES=['admin','staff']`, `adminAuthenticate` cho cả 2 vào panel, `requireRole(...)`, `requireSuperAdmin=requireRole('admin')`.
   - `admin/routes.js`: guard per-route — `adminOnly`(users, analytics/user-growth), `staffOnly`(products/orders/reviews/discount CRUD), `backoffice`(dashboard/stats/analytics/list/reports/chatbot-stats — admin xem-only).
   - cross-module `authorize('admin')`→ staff: catalog (category/brand/product write), inventory (restock=staff, logs=admin+staff), payment refund=staff, orders `/admin/all`=admin+staff `/admin/:id/status`=staff, attribute (router.use staff), reviews (admin/all=admin+staff, verify=staff).
   - 22 test mock admin-auth thêm `requireRole`/`requireSuperAdmin`.
3. **FE role core — XONG (typecheck PASS)**:
   - `AdminRoute` cho admin+staff + prop `allowedRoles`; `/admin/users*` lồng `AdminRoute allowedRoles={['admin']}` (AppRoutes); sidebar (`AdminLayout`) ẩn mục `users` với staff (item.roles=['admin'] + lọc); login redirect admin+staff→`/admin`; type `User.role`, `UserFormData`, `UpdateUserRequest` thêm 'staff'.
4. **Cơ chế tự kiểm (QUALITY_CHECKS.md)** — đối xứng BE/FE:
   - pre-commit chạy test liên quan (`.husky/pre-commit` bước 5); patch-coverage gate (BE+FE script + CI job `patch-quality`); knip (BE+FE, `check:unused`); `check:routes` (BE); Stryker (`test:mutation`). Scripts mới: `test:changed`, `test:related`, `test:coverage:changed` (KHÔNG phải `coverage:changed`), `check:routes`, `check:patch-coverage`, `check:unused`, `test:mutation`.
   - manual mock `backend/src/middlewares/__mocks__/{admin-auth,authorize}.js` → đổi signature middleware chỉ sửa 1 file.
5. **Audit + validation** (đã chạy, kết quả ở task output): 15 bug CONFIRMED (đã fix 9 logic), 15 false-positive, 6 by-design.
6. **Docs**: Hình 3.1 usecase render lại (PlantUML, bỏ "banner"); chatbot survey chuyển C1→C2 (rename label c1→c2); xác minh **25 model** (text đúng; `system_architecture.png` ghi "26 bảng" SAI — **phát hiện, png CHƯA sửa, việc sửa ở §D**); 62 migration đúng.

## 2. ✅ PHA 0 DONE (verified 2026-06-02 — toàn bộ đã làm ở session trước, phiên này chạy lại xác nhận)
- [x] **Migration staff enum**: `users.role = enum('customer','staff','admin')` trên **CẢ** `techstore` + `techstore_test` (verified `SHOW COLUMNS`). ⚠️ KHÔNG dùng `db:migrate` (SequelizeMeta rỗng) — enum đã có sẵn trong snapshot `data/migration.sql` + live DB.
- [x] **Seed tài khoản staff demo**: seeder `backend/scripts/seeders/2026010104-seed-staff.js` (`staff@techstore.vn` / `Staff@123`, bcrypt 10, isEmailVerified+isActive=1, INSERT IGNORE idempotent), wired qua `.sequelizerc` seeders-path → `db:seed:all`. Cả 2 DB đã có 1 user role=staff.
- [x] **Test API/integration/E2E staff token**: sales endpoints (catalog/inventory/discount/attribute/orders-status/catalog-write) dùng `role:'staff'`; users+analytics giữ admin. **Verified xanh: API 39/700, integration 37/199, e2e 5/100** (con số "integration 184" cũ là STALE — thực tế 199, khớp CLAUDE.md §8).
- [x] **UI role (FE)**: dropdown `SelectItem value="staff"` ở `UsersPage` (L270/L622); "admin xem-only" qua `useAuth().isStaff()` + `ViewOnlyBanner` ở 6 trang CRUD (Products/Orders/Inventory/Discount/Categories/Brands); sidebar `AdminLayout` lọc theo `item.roles`; `AdminRoute allowedRoles`. (typecheck PASS)
- [x] **Test FE+BE role staff**: BE `src/middlewares/admin-auth.test.js` (adminAuthenticate: customer→403/admin→pass/staff→pass; requireSuperAdmin: staff→403; requireRole(staff): staff→pass/admin→403; requireRole(admin,staff)); FE `src/__tests__/admin-role.test.tsx`. **BE unit 158/3767, FE 22/766 PASS.**

## 3. CÒN LẠI (Pha tiếp)
### A. Mục tiêu 100% coverage unit (user yêu cầu — ĐÁNH ĐỔI)
- BE: ngưỡng ở `backend/jest.config.js` (hiện stmt 99.7/branch 99.7/func 99.4/lines 99.7; thực tế ~99.98/99.81/99.91/100). Để 100%: nâng ngưỡng → 100 + viết test cho ~7 nhánh branch chưa phủ (module-level guards, short-circuit `||`/`&&` defensive). Nhánh KHÔNG thể trigger qua unit → cân nhắc `/* istanbul ignore next */` + comment lý do (đừng lạm dụng).
- FE: ngưỡng ở `frontend/jest.config.cjs` (global ~79%, per-file 100% chỉ auth/schema). Để 100% global = **rất nhiều** component test mới (effort lớn) — đây là phần nặng nhất; cân nhắc nâng dần (79→85→90→...) thay vì nhảy 100 ngay.
- **Tradeoff (ghi rõ cho hội đồng)**: 100% line/branch ép viết test cho defensive code/không-reachable → có thể giảm giá trị thực; chuẩn ngành 90-99% + patch-coverage. Nếu vẫn theo 100%: làm BE trước (gần rồi), FE sau.
- ⚠️ **Coverage cao PHẢI đi kèm chất lượng (gate §D.1):** đạt 100% bằng test **assert OUTCOME nghiệp vụ**, KHÔNG đắp bằng test tautological / lạm dụng `istanbul ignore`. Coverage 99.7% + assert rỗng = đúng bug class F1/F2 đã lọt. Coverage là điều kiện CẦN, không ĐỦ.

### B. Tự động hóa thêm (chống thủ công/stale — user yêu cầu)
- **[XONG] doc-freshness** `scripts/check-doc-freshness.mjs` (pre-commit warn + CI `patch-quality`): phát hiện .md stale — module/feature CLAUDE.md **VÀ** root docs (DIAGRAMS/STRUCTURE/TESTING_STRATEGY/README/RAG_*/backend+frontend CLAUDE.md) khi code liên quan đổi mà doc không. KHÔNG auto-sync (an toàn). Xem QUALITY_CHECKS.md §6.
- **[CÒN] Cập nhật các .md doc-freshness vừa flag** (do role + order changes): backend `admin/auth/orders/payment` CLAUDE.md + **`CLAUDE.md` GỐC** (migration 61→62, role ENUM 3-actor `customer/staff/admin`, bỏ gotcha role `'manager'`) + **`STRUCTURE.md`** (cross-module deps, RBAC) + DIAGRAMS.md/TESTING_STRATEGY.md (số liệu role/4-actor, test count) — xem lại nội dung cho khớp code mới.
- **[CÒN] Wire thêm**: `backend/scripts/check-docs.js` + `scripts/verify-doc-nodes.js`/`verify-doc-evidence.py` + `check-i18n.js` vào CI/pre-push; cân nhắc nightly `check:routes`+`check:unused`, auto-CHANGELOG.

### C. Dọn API thừa (đã có `npm run check:routes` liệt kê — review trước khi xóa)
- [ ] Gỡ catalog product-write dup (`POST/PUT/DELETE /api/products`) — FE chỉ dùng `/admin/products`. (Đụng catalog routes + controller methods + test catalog.)
- [ ] Hợp nhất restock dup (`/admin/products/:id/restock` vs `/inventory/.../restock`).
- [ ] Gỡ unused: `GET /chatbot/recommendations`, `POST /chatbot/analytics`, `/chatbot/session/latest` + `/session/:id/history`. Chuẩn hóa verb hủy đơn (POST).
- Lưu ý: chạy `check:routes` lại sau role để không gỡ nhầm endpoint staff dùng.

### D. Pha 1 — Sơ đồ + bố cục + phụ lục (docs)
- [ ] **Sơ đồ → xem [§D.1] (kế hoạch chi tiết: **28 sơ đồ NHÓM A** sai ký pháp + **14 NHÓM B** = **42 tổng**, naming, output) + [§D.2] (audit-log per module + gate verify).** Item này thay cho mọi ước lượng cũ.
- [ ] **Bảng đặc tả ca sử dụng** (UC code/actor/tiền-hậu điều kiện/luồng chính-phụ) — KLTN đang thiếu. Làm sau khi vẽ xong use case §1/§2.
- [ ] Sửa `docs/figures/c3/system_architecture.png`: "26 bảng" → **25** (đúng 25 model); thay bằng `deployment-01-system` + `component-*` chuẩn từ §D.1 (4 actor, đủ module chính/phụ).
- [ ] Hình cho C2 (`figures/c2/RAG.png` đang bỏ không + sơ đồ RAG/tech-stack). `[H]`→`[htbp]` toàn bộ (C3 ~11, C4 ~18 hình + 4 bảng); chuẩn hóa kích thước; gom 17 screenshot C4 hợp lý.
- [ ] **Phụ lục**: tạo `docs/chapters/appendix.tex`, chuyển **các code listing (≥5 block `lstlisting` trong C4 — xác nhận số khi làm)** sang, wire `\input{chapters/appendix}` **TRƯỚC `\input{chapters/conclusion}`** trong `docs/thesis.tex`.

### D.0 — WORKFLOW verify-then-draw (đã xây — DÙNG để vẽ các sơ đồ dưới)

Quy trình vẽ sơ đồ 3 tầng (code đúng nghiệp vụ → sơ đồ khớp code → ký pháp+readability), đóng gói 2 nơi:
- **Plugin** `verify-then-draw@minhthang-plugins` (dotclaude marketplace, cài scope user): skill auto-trigger "vẽ sơ đồ" / `/verify-then-draw:draw <module>`; agent `diagram-verifier` (T1 audit cross-module) + `test-strengthener` (T0 mutation loop). Chi tiết xem `plugins/verify-then-draw/`.
- **Project instance** `verify-workflow/`: `FRAMEWORK.md` (khung) + `PROJECT.yaml` + `invariants.ecommerce.md` (GATE-A) + `diagram-manifest.yaml` (42 sơ đồ + status). Scripts enforce: `npm run wf:gate` (lint-config + invariants + ledger-staleness), `wf:routes` (denominator 167), `wf:mutation-survivors`.
- **Trạng thái:** strict 9.0/portable 8.5 — **AT PRACTICAL CEILING (5 vòng audit). ĐỪNG audit/tối ưu workflow lại** (diminishing). Mutation discount-code = 100% (mẫu mutation-driven loop).

**Việc workflow CẦN HUMAN (chưa làm):**
- [ ] **GATE-D**: ký 3 sơ đồ order đã vẽ + verify (`diagrams/state/state-01-order`, `diagrams/usecase/usecase-12-orders-customer`, `usecase-14-orders-admin`) → bump `diagram-manifest.yaml` status `drawn`→`signed`.
- [ ] **GATE-A**: duyệt `verify-workflow/invariants.ecommerce.md` (20 invariant `[ ]`) trước khi audit tầng-0 module mới.
- [ ] **BƯỚC 0 (§D.1) ĐÃ XONG**: `diagrams/` đã nested + `_legacy/`; mẫu `usecase-01` chuẩn. usecase-01 = signed.
- Known-issue (không block): full critical mutation ~2-4h chỉ verify scope nhỏ (test-strength backlog); `jest.stryker.config.js` sync tay với `jest.config.js`.

### D.1 — KẾ HOẠCH VẼ LẠI SƠ ĐỒ (chi tiết — thay cho ước lượng "~15" ở D)

**Thư mục output** (nested theo loại, source + ảnh cạnh nhau).
⚠️ **THỰC TẾ FILESYSTEM (đã verify):** `mermaid/` cũ **đã đổi tên thành `diagrams/`** — `diagrams/` HIỆN chứa ~40 artifacts CŨ ngay ở root (`.mmd/.png/.html` + `uc_*.puml` + `usecase_guest.puml` mẫu). File mẫu `state_order.puml` **đã MẤT** (chỉ còn `usecase_guest.puml`).
**BƯỚC 0 bắt buộc trước khi vẽ:** move toàn bộ artifacts cũ ở root `diagrams/` → `diagrams/_legacy/` (giữ tham khảo, xóa sau khi vẽ lại xong); rồi tạo nested subdir; move `diagrams/usecase_guest.puml` → `diagrams/usecase/usecase-01-overview-guest.puml`.
```
diagrams/
  _legacy/    (≈40 artifacts cũ — move vào đây trước, dọn sau)
  usecase/    *.puml + *.png   (§1 tổng quát + §2 phân rã)
  sequence/   *.puml + *.png   (§3)
  state/      *.puml + *.png   (§7)
  component/  *.puml + *.png   (§8)
  deployment/ *.puml + *.png   (§5 → deployment chuẩn)
  erd/        *.dbml + *.png   (§4)
  pipeline/   *.mmd  + *.png   (§6)
  misc/       *.drawio + *.png (testing pyramid — draw.io)
```

**Naming convention** (BẮT BUỘC, không đặt bừa): `<type>-<NN>-<scope>.<ext>`
- `type` = usecase | sequence | state | component | deployment | erd | pipeline
- `NN` = STT 2 chữ số, theo **thứ tự xuất hiện trong DIAGRAMS.md**, đếm riêng từng loại
- `scope` = kebab-case English, mô tả ngắn (module/đối tượng)
- File `.png` cùng tên `.puml`/`.mmd`/`.dbml` (chỉ khác đuôi)

**Render (3 định dạng — quy trình CHỐT 2026-06-03):**
```
# bash: dùng forward-slash cho path (backslash bị nuốt)
export GRAPHVIZ_DOT="C:/Program Files/Graphviz/bin/dot.exe"
# 1) PNG preview — ⚠️ BẮT BUỘC -DPLANTUML_LIMIT_SIZE=16384 (default 4096 CẮT sơ đồ cao như uc-02/03!)
java -DPLANTUML_LIMIT_SIZE=16384 -jar "C:/Users/Admin/plantuml/plantuml.jar" -charset UTF-8 -tpng <file>.puml
# 2) SVG = file TẠM (trung gian để ra pdf — Inkscape không đọc .puml). gitignored, KHÔNG commit.
java -jar "C:/Users/Admin/plantuml/plantuml.jar" -charset UTF-8 -tsvg <file>.puml
# 3) PDF VECTOR để CHÈN LATEX (scale tự do, không vỡ pixel, font tiếng Việt OK):
#    svg -> pdf bằng Inkscape, --export-text-to-path biến chữ thành đường (KHÔNG lỗi font)
"C:/Program Files/Inkscape/bin/inkscape.exe" <file>.svg --export-type=pdf --export-text-to-path --export-filename=<file>.pdf
# rm <file>.svg   # xóa svg tạm sau khi có pdf
```
- ⚠️ **KHÔNG** dùng PlantUML `-tpdf` (Batik/FOP **lỗi font tiếng Việt**). PHẢI svg→pdf qua Inkscape.
- ⚠️ PNG xuất THẲNG từ .puml (`-tpng`), KHÔNG qua svg. svg và png là 2 nhánh song song từ .puml.
- LaTeX chèn: `\includegraphics[width=\linewidth]{diagrams/<type>/<file>.pdf}` — vector, scale tùy ý, nét mọi cỡ (KHÔNG gò 1 tỉ lệ như PNG raster). **Giữ 3 đuôi/sơ đồ:** `.puml`(nguồn) `.pdf`(chèn LaTeX) `.png`(preview). `.svg` là tạm (gitignored).

#### NHÓM A — SAI KÝ PHÁP (bắt buộc vẽ lại bằng PlantUML — 28 sơ đồ)

Use case (`diagrams/usecase/`) — flowchart giả → actor/oval/association chuẩn:
| STT | DIAGRAMS.md | Tên file |
|---|---|---|
| 01 | §1.1 Guest | `usecase-01-overview-guest.puml` ✅ (mẫu, cần rename+move) |
| 02 | §1.2 Customer | `usecase-02-overview-customer.puml` |
| 03 | §1.3 Admin | `usecase-03-overview-admin.puml` |
| 04 | §2.1a Auth | `usecase-04-auth.puml` |
| 05 | §2.1b User | `usecase-05-user.puml` |
| 06 | §2.2a Catalog duyệt | `usecase-06-catalog-browse.puml` |
| 07 | §2.2b Catalog chi tiết & lọc | `usecase-07-catalog-detail.puml` |
| 08 | §2.2c Catalog danh mục & brand | `usecase-08-catalog-category-brand.puml` |
| 09 | §2.2d Catalog admin CRUD | `usecase-09-catalog-admin.puml` |
| 10 | §2.3a Cart | `usecase-10-cart.puml` |
| 11 | §2.3b Checkout | `usecase-11-checkout.puml` |
| 12 | §2.4a Orders khách | `usecase-12-orders-customer.puml` |
| 13 | §2.4b Payment | `usecase-13-payment.puml` |
| 14 | §2.4c Orders admin | `usecase-14-orders-admin.puml` |
| 15 | §2.5 Reviews | `usecase-15-reviews.puml` |
| 16 | §2.6 Inventory | `usecase-16-inventory.puml` |
| 17 | §2.7 AI chatbot & search | `usecase-17-ai-chatbot.puml` |
| 18 | §2.8 Wishlist/Upload/Discount | `usecase-18-wishlist-upload-discount.puml` |
| 19 | §2.8b Attribute | `usecase-19-attribute.puml` |
| 20 | §2.9 Content | `usecase-20-content.puml` |
| 21 | §2.10a Admin analytics | `usecase-21-admin-analytics.puml` |
| 22 | §2.10b Admin users | `usecase-22-admin-users.puml` |
| 23 | §2.10c Admin products | `usecase-23-admin-products.puml` |
| 24 | §2.10d Admin import/discount/reviews | `usecase-24-admin-misc.puml` |

Component (`diagrams/component/`) — flowchart giả → UML component (lollipop/port):
| STT | DIAGRAMS.md | Tên file |
|---|---|---|
| 01 | §8a Orders·Payment·Inventory | `component-01-orders-payment-inventory.puml` |
| 02 | §8b AI Pipeline | `component-02-ai-pipeline.puml` |
| 03 | §8c Auth·Users·Admin | `component-03-auth-users-admin.puml` |
| 04 | §8d Shared Infrastructure | `component-04-shared-infra.puml` |

#### NHÓM B — đúng loại nhưng nâng lên tool chốt cho thesis

| STT | DIAGRAMS.md | Tên file | Tool |
|---|---|---|---|
| state 01 | §7.1 Order | `state-01-order.puml` (⚠️ VẼ MỚI — mẫu cũ đã mất khi rename mermaid→diagrams) | PlantUML |
| state 02 | §7.2 Payment | `state-02-payment.puml` | PlantUML |
| state 03 | §7.3 Product | `state-03-product.puml` | PlantUML |
| state 04 | §7.4 User | `state-04-user.puml` | PlantUML |
| seq 01 | §3.1 Đăng nhập | `sequence-01-auth-login.puml` | PlantUML |
| seq 02 | §3.2 Checkout | `sequence-02-checkout.puml` | PlantUML |
| seq 03 | §3.3 AI RAG | `sequence-03-ai-chatbot-rag.puml` | PlantUML |
| seq 04 | §3.4 Upload | `sequence-04-upload.puml` | PlantUML |
| seq 05 | §3.5 Admin product | `sequence-05-admin-product.puml` | PlantUML |
| seq 06 | §3.6 Token refresh | `sequence-06-token-refresh.puml` | PlantUML |
| erd 01 | §4 (`models/index.js` require **25 model** — gồm `ProductImage`; `Image` KHÔNG qua index.js. ⚠️ 25 bảng / 1 ảnh quá rậm → **tách 3-5 sub-image** theo **5 nhóm DIAGRAMS.md §4.1–§4.5** (KHÔNG rớt nhóm nào): `erd-01-users`, `erd-02-product`, `erd-03-order-payment`, `erd-04-content-support`, `erd-05-ai-log` — theo Nguyên tắc 2) | `erd-*.dbml` | DBML→dbdiagram.io |
| deploy 01 | §5 Kiến trúc | `deployment-01-system.puml` | PlantUML |
| pipe 01 | §6a Input | `pipeline-01-rag-input.mmd` | Mermaid (giữ) |
| pipe 02 | §6b Retrieval+Gen | `pipeline-02-rag-retrieval.mmd` | Mermaid (giữ) |

#### NHÓM C — artifact báo cáo khác (tool §0 chốt, KHÔNG nằm trong 42 sơ đồ)
- [ ] **Testing pyramid** → **draw.io** (MCP) → `diagrams/misc/testing-pyramid.drawio` + PNG, thay `testing_pyramid*.png/.html` cũ. Nhúng C4.
- [ ] **Bảng NFR** + **bảng yêu cầu chức năng** → **LaTeX `booktabs`+`tabularx`** nhúng THẲNG vào C3/C4 (thay `nfr_table`/`functional_req` `.html/.png` cũ — đang là HTML→PNG, §0 cấm). Xóa file cũ sau khi convert. *(các bảng khác: `node_table`, `rag_eval_table`, `testing_tables` cũng HTML→PNG → cân nhắc convert cùng.)*

#### ⚠️ CHUỖI PHỤ THUỘC (làm sai tầng dưới → tầng trên vẽ lại)
```
Tầng 0: Logic code đúng yêu cầu nghiệp vụ?   ← NỀN TẢNG (code = ground truth)
Tầng 1: Sơ đồ khớp code (đầy đủ + chính xác)?
Tầng 2: Sơ đồ đúng ký pháp + đẹp?
```
- **Giảm rủi ro:** dùng **as-code** → fix code sau thì sửa `.puml` + re-render (rẻ), KHÔNG vẽ tay lại.
- **Phân tầng rủi ro loại sơ đồ:** use case/component/ERD ít phụ thuộc logic chi tiết → vẽ khớp code hiện tại an toàn. State/sequence phụ thuộc logic FSM/luồng → nếu nghi ngờ logic module (order FSM, payment IPN) thì audit logic module đó TRƯỚC.
- Test cao (~5.487, cov 99.7%, CI pass, 9 bug fixed) chỉ đảm bảo "code chạy đúng như viết", KHÔNG đảm bảo "đúng yêu cầu nghiệp vụ".
- **TIÊU CHÍ "đúng" (user chốt):** behavior chuẩn khi vận hành thực tế + đúng logic nghiệp vụ + KHÔNG bug. Riêng **RAG**: code phải tuân **quy chuẩn đã có** (`RAG_CHATBOT_PIPELINE.md` 7 bước + 53 edge case, `PIPELINE_TRACE_EXAMPLES.md` 22 path/43 node) TRƯỚC khi vẽ §6.
- **Gate per-diagram (user chốt):** mỗi sơ đồ → (1) audit logic vùng code liên quan theo tiêu chí trên → (2) phát hiện sai/bug thì **SỬA CODE** cho đúng → (3) **VERIFY ĐÚNG CÁCH** (xem dưới) → (4) mới vẽ. ⚠️ Scope nở sang **sửa code**, không chỉ vẽ.
- **⚠️ VERIFY phải BẮT ĐƯỢC BUG (bài học order: unit mock + cov 99.7% VẪN lọt F1/F2):**
  1. Unit test phải assert **OUTCOME nghiệp vụ** (stock count, total tiền, status...), KHÔNG chỉ "method X được gọi" (= tautological, lọt bug).
  2. **BẮT BUỘC integration test gọi SERVICE THẬT + MySQL thật, assert outcome** cho mỗi logic vừa sửa. Unit mock một mình KHÔNG đủ coi là "verified" (F1/F2 chỉ bị `orders-edge-cases.integration.test.js` bắt). Test phải FAIL nếu revert fix.
  3. Chạy đủ: `npm run test` (unit, cov ≥99.7%) + `npm run test:integration -- --testPathPattern=<module>` + `npm run lint`.
  4. **Cập nhật DOC khớp code vừa fix — tới khi pre-commit doc-freshness KHÔNG còn flag.** Hook `check-doc-freshness.mjs` check (verified): BE `modules/<X>/CLAUDE.md` (17) + FE `features/<X>/CLAUDE.md` (13) + root `CLAUDE.md`/`STRUCTURE.md`/`DIAGRAMS.md`/`TESTING_STRATEGY.md`/`RAG_CHATBOT_PIPELINE.md`/`README.md`. ⚠️ Hook KHÔNG check `PIPELINE_TRACE_EXAMPLES.md` + `QUALITY_CHECKS.md` → cập nhật **THỦ CÔNG** nếu liên quan (vd module `ai` đổi → cả 2 RAG doc + PIPELINE_TRACE). Tránh `.md` stale tích lũy qua **30 CLAUDE.md con + root .md**.
- **Bắt đầu:** module `order` (✅ DONE) → theo thứ tự roadmap §D.2.

#### NGUYÊN TẮC SỐ 1: VERIFY NỘI DUNG TRƯỚC, VẼ 1 LẦN
Tránh vẽ đi vẽ lại: lúc vẽ PlantUML phải bám CODE để đúng cả **nội dung + đầy đủ + ký pháp** ngay từ đầu. KHÔNG copy mù nội dung từ DIAGRAMS.md cũ (phần chưa audit có thể sai/thiếu).

#### NGUYÊN TẮC SỐ 2: SƠ ĐỒ PHẢI ĐỌC ĐƯỢC (readability)
Nếu sơ đồ quá nhiều node → render ảnh bị nhỏ/khó nhìn → xử lý (vẫn giữ flow ĐÚNG):
- Chọn **node CHÍNH** (bắt buộc, cốt lõi flow) — lược node phụ/vụn.
- Hoặc **GỘP node** hợp lý, tinh tế (gom nhiều bước nhỏ thành 1 node tổng, nhãn rõ).
- Hoặc **TÁCH** thành nhiều sơ đồ con (như §2 phân rã, §6a/§6b đã làm).
- ⚠️ BẮT BUỘC: vẫn **phản ánh ĐÚNG logic flow** — không bóp méo/mất bước quan trọng. Ảnh cuối phải nhìn + hiểu được flow.
- Ngưỡng tham khảo: >~15–20 node hoặc nhãn chồng chéo → cân nhắc gộp/tách.

**⚠️ Trạng thái audit — PHÂN BIỆT 2 TẦNG (đừng nhầm — đây là gốc rễ rủi ro vẽ lại):**
- **Tầng 1 = sơ đồ KHỚP code** (theo memory `project-diagrams-audit-pending`, 2 ngày, xác nhận lại bằng git): ✅ per-element §1 use case, §3 sequence, §5 kiến trúc, §6 RAG; ❌ chưa §2, §7, §8.
- **Tầng 0 = LOGIC CODE đúng nghiệp vụ** (theo roadmap §D.2): ✅ chỉ `order`; ❌ 16 module còn lại.
- ⚠️ **"Tầng 1 đã verify" KHÔNG suy ra "tầng 0 đúng".** Order có 246 test khớp (tầng 1) nhưng logic vẫn sai F1/F2 (tầng 0). → sơ đồ §3 sequence "đã khớp code" vẫn có thể sai nếu code logic chưa audit.

**Tooling audit tầng 1** (đã build sẵn): invoke `verify-doc-nodes.js` qua **Claude Code Workflow tool** (KHÔNG phải shell): `Workflow({scriptPath:"scripts/verify-doc-nodes.js", args:{docPath, batches, sourceNote, gotchas, quorum:3, strict:true}})` → lưu result JSON → shell: `python scripts/verify-doc-evidence.py --results <json> --root .`

#### Thứ tự vẽ — BÁM ROADMAP MODULE §D.2 (KHÔNG vẽ rời theo loại sơ đồ)
**Quy tắc:** sơ đồ của 1 module CHỈ vẽ SAU khi module đó qua **gate tầng 0** (audit logic + fix + verify đúng cách). Sơ đồ thuộc module nào → audit tầng 1 (vs code) khi tới module đó.
1. **`order` DONE** → vẽ ngay sơ đồ THUỘC RIÊNG order: `usecase-12` (orders khách) + `usecase-14` (orders admin), `state-01-order`. ⚠️ `sequence-02-checkout` span order+cart+payment → **HOÃN đến sau gate `payment`** (#2), đừng vẽ sớm.
2. **Use case TỔNG QUÁT §1 (01–03)** — mức chức năng, ít phụ thuộc logic chi tiết → vẽ sớm để **duyệt style**, nhưng phải phản ánh 4 actor + RBAC đã chốt (staff).
3. Tiếp **theo roadmap §D.2**: payment → auth → cart → catalog... Mỗi module qua gate tầng 0 → vẽ use case/state/sequence/component CỦA module đó (kèm audit tầng 1 sơ đồ liên quan).
4. Quyết định loại thiếu (class/activity/deployment) → vẽ nếu GVHD cần.
5. Cuối: ERD §4 (auto từ DB sau khi schema ổn) → pipeline §6 (sau gate `ai`).

#### Tiêu chí DONE (mỗi sơ đồ)
- [ ] **Nội dung verify vs CODE** (§2/§7/§8 audit xong; §1/§3 đã có) — GỘP với ký pháp, vẽ 1 lần.
- [ ] Đầy đủ **logic flow** so với code (không thiếu bước/trạng thái/chức năng QUAN TRỌNG); chi tiết vụn được gộp/lược theo Nguyên tắc 2 nếu vượt ngưỡng readability — miễn flow vẫn đúng + đọc được.
- [ ] Đúng ký pháp loại (use case: actor + oval + association; component: lollipop; state: initial/final/transition).
- [ ] File source + `.png` đúng `diagrams/<type>/`, tên theo convention; render KHÔNG lỗi; tiếng Việt đúng dấu.
- [ ] **(Use case)** có **bảng đặc tả UC** kèm theo (mã UC / actor / tiền-hậu điều kiện / luồng chính + phụ) — KLTN đang thiếu (chỉ `usecase_chatbot_spec` cũ có); làm cùng từng use case, KHÔNG để rời cuối.

### D.2 — AUDIT LOG: logic code per module (gate TRƯỚC khi vẽ)

Quy trình (D.1 tầng 0): audit logic → fix code → VERIFY đúng cách (gate §D.1) → mới vẽ. Log findings + status từng module để không mất dấu.

**Roadmap 17 module** (tên dir backend số NHIỀU: `orders`/`reviews`/`users`...; thứ tự gate: logic-heavy + có state/sequence trước; status cập nhật dần):
| # | Module | Sơ đồ liên quan / lý do | Status |
|---|---|---|---|
| 1 | `order` | FSM §7.1, checkout §3.2, use case §2.4 — logic đậm nhất | ✅ DONE (F1–F5) |
| 2 | `payment` | IPN, paymentStatus sync, discount usedCount; state §7.2, use case §2.4b | ✅ DONE tầng 0 (P1 fixed; P2/P3 noted) — sơ đồ chưa vẽ |
| 3 | `auth` | JWT/OTP/OAuth; state user §7.4, sequence login §3.1, use case §2.1a | ✅ DONE tầng 0 (A6 fixed) — sơ đồ chưa vẽ |
| 4 | `cart` | merge guest, variant pricing; use case §2.3a | ✅ DONE tầng 0 (C1 fixed) — sơ đồ chưa vẽ |
| 5 | `catalog` | product/variant/category; state product §7.3, use case §2.2 | ✅ DONE tầng 0 (không bug code) — sơ đồ chưa vẽ |
| 6 | `inventory` | stock log, subscribe `order.cancelled`; use case §2.6 | ✅ DONE tầng 0 (INV-1 đã fix; INV-2 defer) — sơ đồ chưa vẽ |
| 7 | `discount-code` | validate/apply, usedCount timing (+ P3 over-redemption) | ✅ DONE tầng 0 (logic đúng; P3 = accepted risk) — sơ đồ chưa vẽ |
| 8 | `reviews` | hasUserPurchased; use case §2.5 | ✅ DONE tầng 0 (logic đúng) — sơ đồ chưa vẽ |
| 9 | `ai` | RAG tuân quy chuẩn `RAG_CHATBOT_PIPELINE.md`; pipeline §6, sequence §3.3 | ⏳ PARTIAL — ai-policy verified; full RAG (chatbot-service 1004 dòng + 53 edge case) cần session chuyên sâu |
| 10 | `users` | profile/address; use case §2.1b | ✅ DONE tầng 0 (không bug code) — sơ đồ chưa vẽ |
| 11 | `wishlist` | use case §2.8 | ✅ DONE tầng 0 (WL-1 i18n fixed) — sơ đồ chưa vẽ |
| 12 | `upload` | magic bytes; sequence §3.4 | ✅ DONE tầng 0 (U1 fixed) — sơ đồ chưa vẽ |
| 13 | `attribute` | nhóm thuộc tính; use case §2.8b | ✅ DONE tầng 0 (logic đúng; AT-doc fixed; AT-1 i18n→backlog §D.3) — sơ đồ chưa vẽ |
| 14 | `content` | feedback only; use case §2.9 | ✅ DONE tầng 0 (sạch, không bug) — sơ đồ chưa vẽ |
| 15 | `search-history` | use case §2.7 | ✅ DONE tầng 0 (logic đúng; SH-1 i18n→§D.3) — sơ đồ chưa vẽ |
| 16 | `image` | proxy/CDN bypass | ⏳ |
| 17 | `admin` | dashboard/CRUD/analytics (phụ thuộc nhiều module); use case §2.10, component §8c | ⏳ (cuối) |

**⚠️ GATE FE (bổ sung — roadmap trên là BACKEND).** Sơ đồ KLTN chủ yếu BE-centric, nhưng vài loại phụ thuộc FE → audit FE feature liên quan TRƯỚC khi vẽ:
- **Use case role-based** (§1.2 customer, §1.3 admin, §2.10 admin) → FE RBAC (`AdminRoute`/sidebar/redirect/dropdown role) phải khớp **bảng RBAC §0** + BE guard. ⚠️ **FE role UI (§2 Pha 0) PHẢI DONE TRƯỚC** (dropdown thêm 'staff' + ẩn nút "admin xem-only") — kẻo vẽ use case 4-actor sai.
- **Sequence FE→BE** (§3.1 login, §3.2 checkout, §3.5 admin product) → đọc FE feature (`features/<name>/api/` + hooks + Zustand store) để vẽ đúng nhánh client; audit nếu FE logic sai.
- **Verify FE:** `cd frontend && npm run typecheck && npm test` — assert OUTCOME (render/state/redirect), KHÔNG tautological (758 component test hiện cùng rủi ro mock-heavy như BE).
- **Mapping FE↔BE (để đi qua ĐỦ 13 FE feature, KHÔNG sót — mapping KHÔNG 1-1):**
  - **12 FE trùng tên BE** (`admin/ai/auth/cart/catalog/content/orders/payment/reviews/upload/users/wishlist`) → audit cùng gate module BE đồng tên.
  - **`checkout` (FE-only, KHÔNG có BE module)** → audit khi gate `orders` + `payment` + `cart` (checkout flow span 3 module BE).
  - **5 BE-only** (`attribute/discount-code/image/inventory/search-history` — KHÔNG có FE feature riêng) → FE quản qua feature **`admin`** (CRUD dashboard) → audit phần admin liên quan khi gate 5 module này.

**Module `order`** — audit 2026-06-02 (đọc trực tiếp service+repo+validator+routes+jobs; baseline 246 tests):
| ID | Sev | Vấn đề | Vị trí | Status |
|---|---|---|---|---|
| F1 | 🔴 | `cancelPendingOrdersByUser` không restore stock → leak kho | repo `cancelPendingOrdersByUser` (~L189) | ✅ FIXED (restore trong tx, 246 tests xanh) |
| F2 | 🟠 | `updateOrderStatus` (staff) cancel không restore stock | service `updateOrderStatus` (~L570) | ✅ FIXED (restore khi pending/processing→cancelled, có lock+tx, +2 tests, 248 xanh) |
| F3 | 🟠 | `shippingCost` tin FE, không enforce phí (validator đã chặn âm) | service `createOrder` shippingCost (~L270) | ✅ FIXED (server enforce ngưỡng free + clamp ≥0; giữ FE value cho phí km khi chưa đủ ngưỡng; +2 tests) |
| F4 | 🟡 | `previousStatus` dead var + không validate transition | service `updateOrderStatus` previousStatus (~L581) | ✅ dead-var fix qua F2; validate transition = intentional (staff tự do back-office) |
| F5 | 🟡 | `confirmReceived` message nhắc "đã giao hàng" (sai, code từ chối delivered) | service `confirmReceived` (~L650) | ✅ FIXED (bỏ "đã giao hàng" khỏi message) |
| F6 | 🟢 | `order.created` event không subscriber | service `createOrder` event (~L359) | ℹ️ không bug |
| F7 | 🟠 | `repayOrder` cho repay đơn `cancelled` (đã hoàn kho) → reactivate KHÔNG trừ kho lại = leak tồn kho (ngược F1). Nhánh phi chuẩn + dormant (FE không nối nút repay) | service `_canRepay` (~L24) + `repayOrder` (~L628) | ✅ FIXED 2026-06-03 (Option 2 — phát hiện khi audit T0 lúc vẽ sơ đồ) |
| F8 | 🟠 | `admin updateOrderStatus` set `cancelled` KHÔNG chặn `delivered` → hủy đơn đã giao + hoàn kho = tồn ảo. Route `/cancel` (`adminCancelOrder`) chặn đúng, route `/status` thì không — bất nhất. Cùng họ F7. | `admin-order-service.js:222` `updateOrderStatus` | ✅ FIXED 2026-06-03 (commit `dea23f0d` — phát hiện khi verify-then-draw uc-14/state-01) |
| F9 | 🟠 | **shipped→cancelled hoàn kho BẤT NHẤT:** admin (`updateOrderStatus`+`adminCancelOrder`) CÓ hoàn kho cho đơn `shipped`, `orders-service.updateOrderStatus` KHÔNG → tồn ảo + 2 endpoint cùng staff cho kết quả khác nhau. GAP (invariant chưa định nghĩa shipped). | `admin-order-service.js:222/270` vs `orders-service.js:593` | ✅ FIXED 2026-06-03 (Phase 5 hợp nhất M — admin delegate orders-service; shipped KHÔNG hoàn mọi path, INV-STK-6) |
| F10 | 🟠 | **Payment hồi sinh đơn `cancelled`:** `_canProcessPayment` không check `order.status`; late success IPN/return trên đơn đã hủy (kho đã hoàn) → `processing`+`paid`, không trừ lại kho = **oversell**. Vi phạm INV-ORD-8. | `payment-service.js:14-17,160,234,284` | ✅ FIXED 2026-06-03 (Phase 2 — guard `status==='cancelled'` 3 nhánh IPN/return; INV-PAY-3) |
| F11 | 🟠 | **Admin hoàn kho phi atomic + KHÔNG SELECT FOR UPDATE:** read-modify-write (`update({stock: x+qty})`) + đọc Order ngoài tx → lost-update/double-restore race với `cancelOrder` (orders-service dùng atomic increment + lock). | `admin-order-service.js:228-243,273-289` | ✅ FIXED 2026-06-03 (Phase 5 M — admin delegate → dùng atomic increment + lock của orders-service; INV-STK-7) |
| F12 | 🟡 | **cancelPendingOrdersByUser SAI thứ tự:** gọi SAU vòng decrement đơn mới → đơn pending cũ giữ unit cuối, re-order cùng variant: `lockVariant` thấy stock=0 → throw `stockInsufficient` TRƯỚC khi restore → **báo hết hàng sai** (deterministic). Vi phạm INV-STK-2. | `orders-service.js:280` (cần TRƯỚC L173) | ✅ FIXED 2026-06-03 (Phase 3 — move lên trước decrement loop; +test F12) |
| F13 | 🟠 | **orders-service.updateOrderStatus cho `delivered`→`cancelled`** im lặng (không 400) — F8 chỉ fix 2 path admin, **sót path PATCH `/api/orders/admin/:id/status`**. Vi phạm INV-STK-3. | `orders-service.js:584` | ✅ FIXED 2026-06-03 (Phase 4 — guard delivered→cancelled 400; +i18n key) |
| F14 | 🟡 | **updateOrderStatus cho `cancelled`→non-cancelled** (set status tự do) không re-decrement kho → phantom stock; cả orders-service lẫn admin. Vi phạm INV-ORD-8 (cancelled terminal). | `orders-service.js:584` + `admin-order-service.js:222` | ✅ FIXED 2026-06-03 (Phase 4 — guard cancelled→* 422; admin fix qua delegation M) |

**🔧 F9-F14 FIX (2026-06-03) — audit toàn diện ma trận cancel×stock×status + HỢP NHẤT path (Workflow fan-out, neo invariant, verify đối nghịch + review độc lập).** GATE-B chốt: shipped KHÔNG hoàn kho; refund chưa-giao hoàn kho; phạm vi = fix + hợp nhất M. Đã thêm invariant INV-STK-6/7, INV-PAY-3/4 (GATE-A 25/25). Thực hiện theo plan `merry-knitting-tarjan.md` 7 phase:
- **Phase 2 (F10):** 3 nhánh payment success (`handleMomoIPN`/`handleVnPayReturn`/`handleVnPayIPN`) thêm guard `order.status==='cancelled'` (trong tx sau lock) → KHÔNG mark paid + log refund thủ công. +3 integration (cancel→late IPN→giữ cancelled).
- **Phase 3 (F12):** `cancelPendingOrdersByUser` move lên TRƯỚC vòng decrement trong `createOrder`. +1 integration (re-order đơn pending giữ unit cuối → thành công).
- **Phase 4 (F13/F14):** `orders-service.updateOrderStatus` thêm guard delivered→cancelled (400) + cancelled→non-cancelled (422); +2 i18n key. +2 integration.
- **Phase 5 (F9/F11/K — HỢP NHẤT M):** `admin-order-service.updateOrderStatus`/`adminCancelOrder` DELEGATE sang `ordersService` (setter inject qua `app.js`, tiền lệ attribute) — bỏ logic hoàn kho/guard trùng. `orders-service.updateOrderStatus` mở rộng nhận `paymentStatus/note` + publish `order.cancelled` (audit K). Admin nay tự có guard delivered/shipped + atomic increment + SELECT FOR UPDATE. **Rework 27 test admin** (11 xóa logic-đã-chuyển + 16 assert delegation). orders/admin/payment module + app.js wiring.
- **Phase 6 (H/INV-PAY-4):** `createRefund` đơn pending/processing → delegate `updateOrderStatus({status:'cancelled', paymentStatus:'refunded'})` (hoàn kho + cancel); shipped/delivered → chỉ refunded. payment nhận `ordersService` qua DI. +2 integration (processing→hoàn / delivered→không).
- **Verify:** BE unit **4079 pass + coverage branches 99.74%** (orders/admin/payment-service 100%); **integration 207 pass**; lint:strict sạch; architecture hook qua; **review độc lập (code-reviewer, no edit-intent): 0 bug chặn merge, mọi invariant thỏa**. Dead vars dọn (sequelize/ProductVariant tôi tạo + Sequelize/Order/Review pre-existing, user duyệt).
- **Mutation test-strengthening (orders+payment core):** 79.20% → **93.48%** (payment-service 97.01%, orders-service ~90%); **money/status-logic survivor = 0** (payment gating chặn discount/cart/email khi đơn cancelled/lệch tiền/idempotent; cap discount L259 — đều kill bằng test assert OUTCOME); 7 equivalent disabled có lý do (tax=0, float boundary). +~315 test. Còn 63 survivor = plumbing/display/guard-artifact (chấp nhận, không brittle-chase).
- **✅ Blocker mutation full-critical ĐÃ GIẢI QUYẾT (2026-06-03):** nguyên nhân = `jest.mock(path, factory)` inline; perTest instrument chèn `stryCov_` vào body factory → `babel-plugin-jest-hoist` từ chối. **Fix = `coverageAnalysis: "off"`** trong `stryker.critical.conf.json` (verify chạy full 5 module OK, dry-run 1326 test pass). `enableFindRelatedTests` giữ scope theo file nên không quá chậm (~22 phút). Refactor `jest.mock`→manual `__mocks__` (đã tạo 6 mock: logger/email/vector-store/product-helpers/rate-limiter/authenticate) để bật lại perTest = pha sau (plan `majestic-baking-yao.md`).
- **📊 BASELINE MUTATION 5 module critical (2026-06-03, coverageAnalysis off, 1921 mutant):** **All files 84.11%** (1610 killed / 305 survived / 4 timeout). Per-file: `discount-code-service` **100%** (mẫu — đã strengthen) · `payment-service` 97.01% (11 sv) · `orders-service` 91.30% (52 sv) · `cart-service` **79.33%** (93 sv) · `inventory-service` 73.61% (19 sv) · `vnpay-service` 58.06% (39 sv) · `momo-service` 47.62% (33 sv). (dto/validator/module/routes của discount = 0% do mutate scope gồm cả file không có service-test — noise.)
- **🎯 SURVIVOR CRITICAL (test-mù logic tiền/kho/status — ưu tiên strengthen Phase 3):**
  - `cart-service:111/114/272/275` `stockQuantity < quantity` → `<= quantity` SỐNG → **off-by-one biên tồn kho** (tồn = đúng qty đặt không assert). Họ F1/F2.
  - `cart-service:41` `sum + (stockQuantity||0)` → `sum - ...` SỐNG → tổng tồn kho variant **không assert giá trị**.
  - `inventory-service:14` `qty <= 0` → `qty < 0` SỐNG → restock qty=0 không bị test chặn.
  - momo/vnpay survivor đa số = HMAC/URL/string (ít critical). cart/inventory/orders = nơi đáng strengthen nhất.
- **✅ 3 sơ đồ FAIL đã VẼ LẠI + KÝ GATE-D 2026-06-03 (T0+T1+T2 done, status `signed`; verify độc lập 3 diagram-verifier = MATCH 0 blocker):**
  - `state-01-order`: +cung `shipped→cancelled` (KHÔNG hoàn kho, staff-only, INV-STK-6) + cung CHẶN `delivered→cancelled` (đỏ nét đứt, từ chối 400, F13) + note `cancelled→*` 422 terminal (F14) & INV-PAY-3. Verify vs `orders-service.updateOrderStatus` L578 (13 transition đối chiếu file:line).
  - `uc-02-overview-customer` (15 UC): +UC "Xem & xóa lịch sử tìm kiếm" (`search-history/routes.js:52-54`) + "Xem SP đã xem gần đây" (`catalog/routes.js:313` recently-viewed, authenticate); note feedback là endpoint CÔNG KHAI (`content/routes.js:20`).
  - `uc-03-overview-admin` (9 UC staff): +UC "Quản lý danh mục & thương hiệu (CRUD)" (`catalog/routes.js:100-189` authorize('staff')) + "Nhập SP hàng loạt (import CSV)" (`admin/routes.js:167/169` staffOnly). Export=backoffice đã gộp vào UC analytics.
  - ("4 sơ đồ FAIL" ở handoff cũ là đếm lỏng — thực tế 3 sơ đồ; uc-01-guest đã có "Gửi phản hồi" nên không cần sửa.)
  - ✅ ĐÃ commit `6788bf9` (docs(diagram): vẽ lại + ký GATE-D state-01-order, uc-02, uc-03).

- **✅ RE-VERIFY 6 SƠ ĐỒ USE CASE đã signed (2026-06-03 — 6 diagram-verifier song song, đọc code độc lập):** kết quả 3 MATCH thẳng (uc-03/uc-12/uc-13), 1 MATCH-after-review (uc-14: finding "thiếu admin–UC_filter" = FALSE-POSITIVE — `<<extend>>` UC KHÔNG nối actor trực tiếp, admin nối UC_all đã đủ), 2 có gap public/customer thật → ĐÃ SỬA:
  - `uc-01-overview-guest` 9→**10 UC**: +UC "Xem đánh giá SP" (`reviews/routes.js:85` public) + UC1 đổi nhãn "Duyệt sản phẩm, danh mục & thương hiệu" (gộp browse category/brand `catalog/routes.js:94,172` public). "Tra cứu đơn" giữ ở uc-12 (cố ý). Re-render OK.
  - `uc-02-overview-customer` 15→**16 UC**: +UC "Tải ảnh lên (avatar/ảnh đánh giá)" (`upload/routes.js:58-59` authenticate). shipping-estimate đã ở uc-12, chatbot cart-add ở uc-17 → ghi note. Re-render OK.
  - 0 UC SAI/THỪA ở cả 6 sơ đồ (chỉ MISSING ở 2 overview). Bài học: diagram-verifier chạy isolated → false-positive khi (a) capability đã model ở sơ đồ per-module khác, (b) hiểu sai semantics `<<extend>>`.

**🔧 F7 FIX (2026-06-03) — repay đúng nghiệp vụ + wire UI:** `_canRepay` = `status==='pending' && paymentStatus!=='paid' && paymentMethod!=='cod'` (bỏ nhánh `cancelled` → `cancelled` thành **terminal**, hết leak; loại COD). `repayOrder` chỉ reset `paymentStatus` (failed→pending), **KHÔNG đổi `order.status`** → repay không phải transition. FE: un-dead `handleRepayOrder` + thêm nút "Thanh toán lại" ở `OrdersPage` (lấp UX gap đơn online pending chưa trả). Verify: BE unit (rewrite 3: cancelled/COD→422, pending+momo→ok) **3805 + coverage pass**; integration gate `repay cancelled → throw` (fail nếu revert) trong `orders-edge-cases`; FE +3 test (`cart-orders-pages`); typecheck+lint BE/FE sạch. Doc: `orders/CLAUDE.md §3.5/§3.10` (BE) + FE CLAUDE.md + `DIAGRAMS.md §7.1`. Sơ đồ `state-01-order` re-render (cancelled terminal, bỏ repay arrow).

**🔧 F8 FIX (2026-06-03) — chặn hủy đơn đã giao qua admin `/status`:** Thêm guard `if (order.status === 'delivered') throw 400` trong `updateOrderStatus` nhánh `status==='cancelled'`, đồng bộ `adminCancelOrder` (route `/cancel` đã chặn delivered từ trước). Trước fix: `PUT /admin/orders/:id/status {status:'cancelled'}` trên đơn delivered → hủy + hoàn kho ảo (hàng đã giao mà cộng lại kho). Verify: +1 test guard (`admin-controller.edge-cases-5.test.js`: delivered→cancelled qua /status = 400, không hoàn kho); **563 test admin pass**; pre-commit hook qua. Code ở `admin` module (admin-order-service.js) nhưng là logic hủy đơn → log chung findings order. Phát hiện qua **2 verifier độc lập** (uc-14 + state-01) lúc verify-then-draw. Commit `dea23f0d`.

**✅ ORDER GATE DONE (tầng 0):** F1–F5 fixed (+ F7, F8 fixed 2026-06-03). Verify: **3750** unit tests (= 3745 baseline + 5 mới: F2 +2 restore, F3 +2 shippingCost, +1 repo `findOrderByPkWithItemsAndUser` lock-option) + coverage 99.7% + lint sạch; **8 integration tests CỦA ORDER** (4 cũ + 4 mới `orders-edge-cases.integration.test.js` gọi service THẬT + MySQL thật, assert stock outcome — bắt được bug mà unit mock bỏ lọt; tổng integration toàn dự án = 184). → đủ điều kiện vẽ state-order/use-case order.

**Test-quality TODO (task refactor RIÊNG — làm SAU khi xong gate logic các module, đừng xen giữa):**
- **Nguyên tắc gộp test:** 1 file / 1 đối tượng test. **GỘP** khi cùng loại + cùng đối tượng + chia theo coverage-gap (`-2/-3/-4` = số thứ tự vô nghĩa). **GIỮ TÁCH** theo *layer* (service/controller/repo — khác đối tượng) + theo *loại* (unit/integration/api — khác config/env). File >~800 dòng → tách theo *sub-feature có TÊN NGHĨA* (`.concurrency.test.js`), KHÔNG phải số.
- **Orders:** gộp 6 file unit `orders-service.*` (`.test`+`.unit.test`+`edge-cases`+`-2/-3/-4`) → 1 (hoặc core+edge). Giữ tách `orders-controller`/`orders-repository`/integration. Bớt lặp `buildService/mkProduct` (~70 dòng × 6).
- `orders.integration.test.js` core **tautological** (thao tác Model trực tiếp, không gọi service) → dọn/gộp vào file gọi service thật (`orders-edge-cases.integration.test.js` đã có `makeService()`).
- ⚠️ **Gộp PHẢI kèm nâng chất lượng:** bỏ test tautological + bổ sung assert OUTCOME nghiệp vụ. Gộp suông = dời chỗ, KHÔNG sửa chất lượng (vấn đề cốt lõi user nêu).

**Doc stale phát hiện (sửa khi đụng, không phải fix logic):**
- CLAUDE.md gốc (L261 "Role ENUM chỉ customer/admin" + L301 "61 migrations") → thực tế có **staff** + **62 migration** (→ task cập nhật ở **§3.B**).
- `orders/CLAUDE.md §5.2`: claim `users` module gọi `cancelPendingOrdersByUser` — SAI (chỉ `orders.createOrder` gọi).
- **⚠️ Do F1–F5 (pre-commit hook đã flag tại `d5946f5a`) — CẦN cập nhật:** `orders/CLAUDE.md` (cancelPendingOrdersByUser giờ HOÀN kho; updateOrderStatus hoàn kho khi cancel pending/processing; shippingCost server enforce ngưỡng free), `DIAGRAMS.md` (§7.1 state-order, §5.2), `TESTING_STRATEGY.md` (BE unit 3745→3750). Cập nhật khi vẽ sơ đồ order.

**Use case order (4 actor khi vẽ):** customer (tạo/hủy/repay/nhận/xem), **staff** (xem all + cập nhật trạng thái), **admin** (xem all — only), guest (track public).

**Module `payment`** — audit 2026-06-02 (đọc service+repo+routes+validator; baseline unit 125, integration cũ tautological):
| ID | Sev | Vấn đề | Vị trí | Status |
|---|---|---|---|---|
| P1 | 🟡 | `handleVnPayReturn` mark paid KHÔNG verify số tiền (IPN có check RspCode 04) — lệch defense | service `handleVnPayReturn` (~L213) | ✅ FIXED (thêm amount check + redirect failed&code=04, guard `Number.isFinite` giữ tương thích; +3 unit, +integration test FAIL nếu revert) |
| P2 | 🟡 | `createRefund` không lock/transaction → 2 refund đồng thời có thể double-call gateway | service `createRefund` (~L294) | ⚠️ NOTED (defer): fix đúng phải giữ lock qua HTTP gateway (anti-pattern) hoặc claim-compensation; rủi ro thấp (admin/staff hiếm + VNPay idempotent transRef). Ghi gotcha CLAUDE.md |
| P3 | 🟡 | Discount over-redemption: online payment kiểm usageLimit lúc apply, tăng usedCount lúc pay không re-check → race vượt limit | cross-module (orders apply / payment increment) | ⚠️ DEFER → gate `discount-code` (#7) |
| P4 | 🟢 | Side-effect post-payment (increment/clearCart/email) fire-and-forget ngoài tx | service (~L171) | ℹ️ intentional (documented) |
| P5 | 🟢 | Refund set `paymentStatus=refunded` nhưng không đổi `order.status`/restore stock | service `createRefund` (~L316) | ℹ️ business decision — chưa đổi |
| P6 | 🟠 | `payment.integration.test.js` tautological (thao tác Model trực tiếp, không gọi service) — đúng lớp F1/F2 | `__integration__/payment.integration.test.js` | ✅ Bổ sung `payment-edge-cases.integration.test.js` gọi service THẬT (10 test, assert outcome). File cũ dọn ở test-quality phase |

**✅ PAYMENT GATE tầng 0 DONE:** P1 fixed; verify unit **3761** (payment-service 100% cov) + lint sạch + **integration 37/198** (4 cũ payment + 10 mới gọi service thật, assert paid/idempotency/amount-mismatch/discount/refund). Docs payment/CLAUDE.md + root §8 + TESTING_STRATEGY cập nhật. → đủ điều kiện vẽ sơ đồ payment (state-02, sequence, use case §2.4b). **Sơ đồ tầng 1/2 CHƯA vẽ** (thuộc pha §D drawing).

**Module `auth`** — audit 2026-06-02 (đọc service+repo+module+routes; baseline unit 158):
| ID | Sev | Vấn đề | Vị trí | Status |
|---|---|---|---|---|
| A1 | — | Reset password token có check expiry không? | repo `findByResetToken` (~L46) | ✅ OK — repo filter `resetPasswordExpires > now`, không bug |
| A6 | 🟡 | `googleLogin` KHÔNG check `email_verified` trước auto-create/link theo email → chiếm tài khoản (link Google vào account password với email Google chưa verify) | service `googleLogin` (~L95) | ✅ FIXED (reject 401 khi `email_verified === false`; guard giữ tương thích payload thiếu field; +1 unit, auth-service 100% cov) |
| A3 | 🟢 | `register` lộ email-đã-tồn-tại (enumeration) — khác forgot/resend dùng generic | service `register` (~L28) | ℹ️ đánh đổi UX — note CLAUDE.md |
| A8 | 🟢 | Refresh token không revoke server-side (stateless) | service `refreshToken` | ℹ️ documented tradeoff |
| A9 | 🟢 | Reset token + OTP lưu plaintext trong DB | service/model | ℹ️ low (entropy + TTL + clear sau dùng) — note |

**✅ AUTH GATE tầng 0 DONE:** A6 fixed; verify unit **3762** (auth-service 100% cov) + lint sạch + **auth integration 14 + API 53 PASS** (login/register/otp/refresh/reset qua full stack — không regression). A3/A8/A9 ghi nhận known limitation ở auth/CLAUDE.md §6. Code còn lại đúng (idempotency OTP timing-safe, reset token expiry, JWT HS256-pinned). **Sơ đồ tầng 1/2 CHƯA vẽ.**

**Module `cart`** — audit 2026-06-02 (đọc service+repo+model; baseline unit 158):
| ID | Sev | Vấn đề | Vị trí | Status |
|---|---|---|---|---|
| C1 | 🟡 | `mergeCart` ghi `existingUserItem.price`/`sessionItem.price` nhưng CartItem chỉ có cột `unitPrice` (không có `price`) → Sequelize bỏ qua → "refresh giá tránh stale" VÔ HIỆU | service `mergeCart` (~L426/L431) | ✅ FIXED (`.price`→`.unitPrice`; +2 unit + 1 integration gọi service THẬT assert unitPrice persist DB — phát hiện test merge integration CŨ tautological "Simulate merge logic") |
| C2 | 🟢 | `getCart` inline-merge KHÔNG cap stock + không refresh giá (khác `mergeCart` explicit có cap) | service `getCart` (~L144) | ℹ️ caught downstream (order SELECT FOR UPDATE + validateCart) — inconsistency nhỏ, note |
| C3 | — | Ownership/stock/variant-pricing | service | ✅ OK (đúng: _assertOwnership 403, _assertStock variant-first, validateCart phát hiện priceChanged/outOfStock/quantityExceedsStock) |

**✅ CART GATE tầng 0 DONE:** C1 fixed; verify unit **3764** (cart-service 100% cov) + lint sạch + **integration 12** (thêm 1 test merge gọi service THẬT assert unitPrice=giá hiện tại persist DB — FAIL nếu revert; test merge cũ tautological đánh dấu dọn ở test-quality phase). Docs cart/CLAUDE.md + counts cập nhật. **Sơ đồ tầng 1/2 CHƯA vẽ.**

**Module `catalog`** — audit 2026-06-02 (đọc product-methods + repo + routes; module lớn nhất, read-heavy, test rất dày 5 API + 2 integration):
| ID | Sev | Vấn đề | Status |
|---|---|---|---|
| K1 | — | Read logic (price/ratings/variant-resolution/filter/COALESCE-sort) | ✅ OK — _pickDisplayPrice/_calcRatings/getAllProducts đúng; COALESCE sort là rule cứng (giữ) |
| K2 | 🟢 | `sort`/`order` truyền vào `[[sort,order]]` (fallback) — sort lạ → "Unknown column" 500 | ℹ️ KHÔNG injection (Sequelize quote identifier + validate direction); robustness LOW — không fix để khỏi phá sort theo column hợp lệ FE đang dùng |
| K3 | 🟡 doc | catalog/CLAUDE.md §4 route tables ghi `authorize('admin')` cho product/category/brand write — thực tế routes.js đã `authorize('staff')` (Pha 0) | ✅ FIXED (9 chỗ → staff) |

**✅ CATALOG GATE tầng 0 DONE:** KHÔNG có bug code tầng-0 (read-heavy, logic đúng, writes guarded staff + tx + slated §3.C removal). Chỉ sửa doc K3. Không đổi code → không cần verify test (catalog test dày sẵn, không regression).

**⚠️ DOC STALE BATCH (Pha 0 — route-table guards):** per-module CLAUDE.md route tables còn lại cần kiểm: `orders`, `attribute`. (catalog ✅, inventory ✅, reviews ✅ đã sửa; discount-code admin CRUD ghi `adminAuthenticate` chung — không sai.) Sửa khi gate từng module.

**Module `inventory`** — audit 2026-06-02 (đọc service+repo+routes):
| ID | Sev | Vấn đề | Status |
|---|---|---|---|
| INV-1 | — | `sumVariantStockByProductId` forward opts (SUM trong tx) | ✅ ĐÃ FIX code (phiên 9-bug); doc §6 gotcha stale → đã sửa |
| INV-2 | 🟡 | `restockProduct` load+modify+save stock KHÔNG `SELECT FOR UPDATE` → 2 restock đồng thời lost-update | ⚠️ NOTED defer: admin/staff thủ công hiếm đồng thời + self-correcting; fix đúng = lock variant trong tx (giống orders decrement). Ghi gotcha inventory/CLAUDE.md §6 |
| INV-3 | 🟡 doc | route table + prose ghi `authorize('admin')`; thực tế restock=staff, logs=admin+staff | ✅ FIXED doc |

**✅ INVENTORY GATE tầng 0 DONE:** không đổi code (INV-1 đã fix sẵn + verify repo forward opts; INV-2 defer low-risk). Chỉ sửa doc (gotcha INV-1 + route table INV-3). Stock decrement vẫn đúng pattern (orders SELECT FOR UPDATE); restore khi cancel đã fix F1/F2.

**Module `discount-code`** — audit 2026-06-02 (đọc service+repo+routes; singleton function-exports):
| ID | Sev | Vấn đề | Status |
|---|---|---|---|
| DC-logic | — | applyDiscountCode validate (active/start/end/usageLimit/minOrder) + tính discount (percent cap maxDiscount, fixed) + cap orderAmount; `incrementUsedCount` = `.increment()` atomic | ✅ OK đúng |
| P3 (DC-1) | 🟡 | Over-redemption: usageLimit kiểm lúc apply, usedCount tăng lúc pay không re-check → cửa sổ race vượt limit | ✅ RESOLVED = **accepted risk có chủ đích** (CLAUDE.md §3.3: discount ≠ critical inventory). Đã ghi công thức fix-nếu-cần (conditional atomic UPDATE + affectedRows). KHÔNG fix (tôn trọng quyết định nghiệp vụ + scope freeze P6) |
| DC-2 | 🟢 | `getAllDiscountCodes` sort `[[sortBy,order]]` | ℹ️ Sequelize-protected (giống catalog K2), không injection |

**✅ DISCOUNT-CODE GATE tầng 0 DONE:** logic đúng, KHÔNG đổi code. P3 (đã flag từ payment gate) → resolved là accepted business risk + ghi recipe siết. Admin CRUD guard = staffOnly (admin/routes.js, Pha 0 — đã đúng). Chỉ bổ sung doc §3.3.

**Module `reviews`** — audit 2026-06-02 (đọc service+repo+routes):
| ID | Sev | Vấn đề | Status |
|---|---|---|---|
| REV-logic | — | createReview (verified-purchase delivered + upsert 1/user/product), update/delete owner-only, sort **allowlisted** (sortMapping, không injection), _refreshProductRating | ✅ OK đúng |
| REV-2 | 🟢 | `verifyReview` reject (isVerified=false) KHÔNG loại review khỏi rating; `getProductRatingsAggregate` đếm TẤT CẢ review | ℹ️ design: reject = tắt badge, không ẩn review (nhất quán: review đã verified-purchase, list mặc định hiện tất cả + rating khớp). Không bug |
| REV-4 | 🟡 doc | §4 route table ghi `authorize('admin')`; thực tế /admin/all=admin+staff, verify=staff | ✅ FIXED doc |

**✅ REVIEWS GATE tầng 0 DONE:** logic đúng (verified-purchase enforce, owner-only, sort allowlisted = mẫu AN TOÀN injection nên áp dụng), KHÔNG đổi code. Chỉ sửa doc REV-4. Admin delete review qua admin module (staffOnly), reviews module delete = owner-only — by design.

**Module `ai`** — audit 2026-06-02 (PARTIAL):
| Phần | Status |
|---|---|
| `ai-policy.js` (pure rules: validate, expandAbbreviations, classifyIntent priority, isPromptInjection 15 loại OWASP LLM01 EN+VI, MAX_MESSAGE_LENGTH=500) | ✅ verified — chất lượng cao, đúng, không bug |
| `ai-service.js` orchestration (4 core + 5 session delegators) | ✅ đọc, đúng (delegate + addToCart stock guard) |
| **`chatbot-service.js` (1004 dòng): RAG retrieval/generation, ngưỡng 0.45/0.05/0.15, fallback keyword, session LRU 500/TTL30/10-turn, LLM rotation+timeout budget, _enrichQueryFromHistory, injection early-return** | ⏳ **CHƯA audit đầy đủ** — cần đối chiếu `RAG_CHATBOT_PIPELINE.md` (7 bước + 53 edge case) + `PIPELINE_TRACE_EXAMPLES.md` (22 path/43 node) ở **session chuyên sâu** (centerpiece KLTN, không audit vội ở context sâu) |

**⏳ AI GATE PARTIAL:** policy + orchestration verified đúng. Full RAG pipeline (chatbot-service) defer — đây là phần quan trọng + phức tạp nhất, cần fresh context để check đủ 53 edge case, tránh lọt bug đúng kiểu F1/F2.

**Module `upload`** — audit 2026-06-02 (đọc service+module+routes+FE ImageUpload; stateless fs, không DB; baseline unit 71 file/3764 toàn dự án):
| ID | Sev | Vấn đề | Vị trí | Status |
|---|---|---|---|---|
| U1 | 🟡 | `processSingleUpload`/`processMultipleUpload` KHÔNG validate `uploadType` → type lạ rơi vào multer fallback (`uploadDirs[type] \|\| products`, module.js:52) lưu file vào `products/` nhưng `buildFileUrl` build URL theo type raw → ảnh 404. Lệch defense với `deleteFile` (đã check type) | service `processSingleUpload`/`processMultipleUpload` (~L57/L85) | ✅ FIXED (reject 400 `upload.invalidType` + xóa file đã lưu; +2 unit assert OUTCOME: throw 400 + deleteFile gọi + KHÔNG đọc magic. Swagger enum routes.js sửa `avatar/product` số ít → `reviews/products/users/categories/brands/avatars/temp` số nhiều) |
| U2 | — | Magic bytes (JPEG/PNG/WebP signatures), path traversal `deleteFile` (`path.basename`+`startsWith` guard), admin-only delete | service | ✅ OK — signatures đúng, anti-traversal chắc, guard đúng vị trí (U1 trước magic check) |
| U3 | 🟢 | `deleteFile` = `user.role !== 'admin'` → **chỉ admin**, staff không xóa được file (RBAC mới staff=CRUD products) | service `deleteFile` (~L119) | ✅ FIXED (user chốt mở cho staff: `DELETE_ALLOWED_ROLES=['admin','staff']`; +1 unit staff xóa OK, customer giữ 403; doc §3.3/§4.1/gotcha cập nhật). FE chưa gọi endpoint này nhưng RBAC nay nhất quán |

**✅ UPLOAD GATE tầng 0 DONE:** U1 + U3 fixed; verify unit **3767** (158 suites, +3 OUTCOME test upload: 2 invalidType + 1 staff delete) + lint sạch (eslint EXIT=0). Module stateless fs (không DB) → unit mock OUTCOME đủ verify guard thuần (khác F1/F2 order cần MySQL tx). FE `ImageUpload` type union số nhiều khớp `uploadDirs` keys → U1 không phá upload thật. Docs upload/CLAUDE.md cập nhật (§3.1/§3.2 validate type + gotcha U1 + valid types; §3.3/§4.1/gotcha U3 deleteFile admin/staff). U3 user chốt mở cho staff. **Sơ đồ tầng 1/2 CHƯA vẽ** (sequence §3.4 upload). **CHƯA commit.**

**Module `users`** — audit 2026-06-02 (đọc service+repo+controller+validator+routes+middleware validate-request; baseline unit 80 file/5 suites):
| ID | Sev | Vấn đề | Vị trí | Status |
|---|---|---|---|---|
| US-IDOR | — | Ownership address: `findAddressByIdAndUserId(id, userId)` = `findOne({where:{id,userId}})` → update/delete/setDefault đều filter cả id+userId | repo `findAddressByIdAndUserId` (~L40) | ✅ OK — KHÔNG IDOR (test cover `address không thuộc user → 404`) |
| US-MASS | — | `updateAddress` `Object.assign(address, addressData)` mass-assignment? | service `updateAddress` (~L90) | ✅ OK — `validateRequest` replace `req.body=result.data` (Zod strip unknown); `addressSchema` không có `userId`/`id` → an toàn |
| US-1 | 🟢 | addAddress/updateAddress/deleteAddress/setDefaultAddress: `clearDefaultAddresses` + create/save KHÔNG transaction → race 2 request đồng thời có thể 2-default (hoặc 0) | service (~L64-127) | ℹ️ NOTED defer low-risk: per-user action hiếm đồng thời + self-correcting (setDefault sau clear hết); chỉ UX flag, không mất tiền/data (giống INV-2/P2/DC-1) |
| US-2 | 🟢 | `updateProfile` avatar `avatar \|\| user.avatar` truthy → không xóa avatar được (set '' bị bỏ), khác `phone` cho phép '' | service `updateProfile` (~L32) | ℹ️ minor — intentional (FE không có nút xóa avatar); không fix |
| US-3 | 🟢 | `changePassword` không revoke session/refresh sau đổi pass | service `changePassword` | ℹ️ = A8 auth tradeoff (JWT stateless, documented) |

**✅ USERS GATE tầng 0 DONE:** logic đúng (ownership/IDOR enforced cả id+userId, mass-assignment chặn qua Zod strip, password hash qua Sequelize hook, deleteAddress auto-promote default đúng), KHÔNG đổi code → không cần verify test mới (users test dày: 80 unit + integration + 2 API, cover ownership 404). Doc users/CLAUDE.md khớp code (route table không guard admin/staff vì self-service customer; gotchas GET/me-absent + avatar flow số nhiều `avatars` khớp upload U1). US-1 defer low-risk. **Sơ đồ tầng 1/2 CHƯA vẽ** (use case §2.1b).

**Module `wishlist`** — audit 2026-06-02 (đọc service+repo+routes+model+error-handler; baseline unit 60 file/4 suites):
| ID | Sev | Vấn đề | Vị trí | Status |
|---|---|---|---|---|
| WL-1 | 🟡 | 2 chỗ `throw new AppError('Sản phẩm không tồn tại'/'...không có trong danh sách yêu thích', 404)` HARDCODE tiếng Việt (các message khác dùng key `wishlist.*`). error-handler `translateMessage = t(msg) \|\| msg` → raw VN không match key → fallback giữ nguyên → **user tiếng Anh thấy lỗi tiếng Việt** | service `addToWishlist` (~L57), `removeFromWishlist` (~L72) | ✅ FIXED (→ key `wishlist.productNotFound`/`wishlist.notInWishlist`; thêm 2 key vào vi+en.json; nâng 2 unit test thêm assert `message` để bắt regression; i18n parity 2986/2986) |
| WL-IDOR | — | Ownership: `findItem(userId, productId)` = `findOne({where:{userId,productId}})` → remove/check filter cả userId; clearByUserId/findByUserIdWithProducts scope userId | repo `findItem` (~L47) | ✅ OK — không IDOR |
| WL-2 | 🟢 | `addToWishlist` check `findItem` rồi `createItem` (read-then-write) → race 2 add đồng thời cùng product | service `addToWishlist` (~L60) | ℹ️ OK — unique constraint `uq_wishlists_user_product` (model `indexes`) bảo vệ → create thứ 2 = SequelizeUniqueConstraintError → 409, KHÔNG duplicate data |

**✅ WISHLIST GATE tầng 0 DONE:** WL-1 fixed (i18n); verify unit **3767** (158 suites, +0 test mới — nâng 2 assertion sẵn có) + lint sạch + i18n parity OK + grep xác nhận không nơi nào (api/integration/module) assert chuỗi VN cũ → an toàn MySQL test. Ownership enforced, race chặn bởi DB unique constraint, getWishlist transform read-only đúng. **Sơ đồ tầng 1/2 CHƯA vẽ** (use case §2.8).

**Module `attribute`** — audit 2026-06-02 (đọc service+controller+routes+repo; singleton + setter-inject nameGenerator; baseline test dày 9 file):
| ID | Sev | Vấn đề | Vị trí | Status |
|---|---|---|---|---|
| AT-logic | — | CRUD groups/values + soft-delete (`isActive=false`) + name-gen delegate (`_nameGenerator` inject) + `getPopularAttributeCombinations` catch→[] | service | ✅ OK đúng |
| AT-doc | 🟡 doc | CLAUDE.md §4 route table header + §6 gotcha ghi `authorize('admin')`; routes.js:139 = `authorize('staff')` (Pha 0) | CLAUDE.md §4/§6 | ✅ FIXED doc (admin→staff, +giải thích RBAC) |
| AT-doc2 | 🟢 doc | CLAUDE.md §7 liệt kê `validators/attribute-validator.test.js` nhưng dir `validators/` KHÔNG tồn tại | CLAUDE.md §7 | ✅ FIXED doc (xóa dòng) |
| AT-1 | 🟡 | i18n hardcode VN: service 8 `throw AppError('<VN>')` + controller ~16 success/error message VN → user EN thấy VN (namespace `attribute.*` locale ĐÃ có key `cannot*` nhưng KHÔNG dùng) | service+controller | → **backlog §D.3** (user chốt defer, sweep toàn backend 1 lượt) |
| AT-2 | 🟢 | CRUD routes KHÔNG `validateRequest` → input không validate + `model.update(req.body)` mass-assign | routes.js | ℹ️ NOTED: staff trusted + Sequelize chỉ ghi model fields → low (robustness gap giống K2, không fix); ghi gotcha CLAUDE.md §6 |

**✅ ATTRIBUTE GATE tầng 0 DONE:** logic đúng (CRUD + soft-delete + name-gen delegate qua setter tránh circular). KHÔNG đổi code → không cần verify test (test attribute dày: 4 unit + 2 integration + 3 API). Fix 2 doc stale (AT-doc guard staff, AT-doc2 validator phantom). AT-1 i18n → §D.3 backlog. AT-2 mass-assign low-risk note. **Sơ đồ tầng 1/2 CHƯA vẽ** (use case §2.8b).

**Module `content`** — audit 2026-06-02 (đọc service+controller+routes; feedback-only, ~50 dòng):
| ID | Sev | Vấn đề | Status |
|---|---|---|---|
| CT-logic | — | `sendFeedback` validate required → throw key `content.requiredFieldsMissing`; createFeedback status=pending; email notify fire-and-forget catch+log (không fail request) | ✅ OK đúng |
| CT-i18n | — | Service throw KEY (`content.requiredFieldsMissing`); controller success = `t('content.feedbackReceived', req.locale)` — **dùng i18n key chuẩn cả 2 lớp** (KHÔNG dính AT-1 sweep) | ✅ OK — module i18n sạch |
| CT-valid | — | Route `validateRequest(feedbackSchema, 422)` (Zod strip + 422); public endpoint (no auth, đúng — form liên hệ) | ✅ OK |

**✅ CONTENT GATE tầng 0 DONE:** module sạch nhất — logic đúng, i18n dùng key chuẩn (service + controller), validate qua Zod 422, email fail-silent documented. KHÔNG đổi code → không verify test mới. Doc CLAUDE.md khớp. **Sơ đồ tầng 1/2 CHƯA vẽ** (use case §2.9).

**Module `search-history`** — audit 2026-06-02 (đọc service+repo+routes; singleton, ~34 dòng service):
| ID | Sev | Vấn đề | Status |
|---|---|---|---|
| SH-logic | — | dedup 1h (`findDuplicate` keyword+userId/sessionId+since), saveSearch optional-auth (guest sessionId), getHistory order DESC | ✅ OK đúng |
| SH-IDOR | — | `deleteOne` qua `findOneByUserAndId({id,userId})` = `findOne({where:{id,userId}})`; findByUser/destroyByUser scope userId | ✅ OK — không IDOR |
| SH-1 | 🟡 | `deleteOne` throw `'Không tìm thấy lịch sử tìm kiếm'` hardcode VN (1 chỗ) | → **§D.3 backlog** (defer) |
| SH-2 | 🟢 | `getHistory` limit không max cap (parseInt) | ℹ️ low — authenticated user xem history của chính mình, không phải DoS; note CLAUDE.md đã có |

**✅ SEARCH-HISTORY GATE tầng 0 DONE:** logic đúng (dedup + ownership enforced + guest sessionId flow), KHÔNG đổi code (SH-1 i18n → sweep §D.3). Doc CLAUDE.md khớp. **Sơ đồ tầng 1/2 CHƯA vẽ** (use case §2.7).

### D.3 — I18N HARDCODE SWEEP (task refactor RIÊNG — defer, user chốt 2026-06-02)
**Phát hiện khi gate `attribute`:** class bug i18n diện rộng — `throw new AppError('<chuỗi tiếng Việt>')` thay vì i18n key + controller `res.json({message:'<VN>'})` hardcode. error-handler `translateMessage = t(msg) || msg` → chuỗi VN không match key → **fallback giữ nguyên → user `?lang=en` thấy lỗi/thông báo tiếng Việt**. Các gate logic tầng 0 trước CHỈ soi logic, KHÔNG soi i18n → bug còn ở cả module đã DONE.

**Định lượng `new AppError('<VN có dấu cách>')` (grep, chưa kể controller success messages):**
| Module | # | Gate |
|---|---|---|
| admin | 34 | chưa (#17) |
| image | 14 | chưa (#16) |
| cart | 13 | ✅ DONE (logic) |
| discount-code | 9 | ✅ DONE (logic) |
| attribute | 9 | ✅ DONE (logic) |
| orders | 3 | ✅ DONE (logic) |
| upload | 2 | ✅ DONE (logic) |
| ai | 2 | partial |
| search-history | 1 | chưa (#15) |
| **Tổng** | **~87** | + controller messages (riêng attribute ~16) |

**Quy trình sweep (làm SAU gate logic, đừng xen):**
1. Mỗi chuỗi VN → key namespace `<module>.<camelCaseKey>`; tái dùng key đã có (vd `attribute.cannot*`, `attribute.baseNameRequired` đã tồn tại nhưng controller chưa dùng).
2. Thêm cặp key vào **cả** vi.json + en.json; chạy `node scripts/check-i18n.js` (parity).
3. Đổi service + controller dùng key; **nâng test assert `message: '<key>'`** (bắt regression — như WL-1 đã làm).
4. ⚠️ Grep test api/integration assert chuỗi VN cũ TRƯỚC khi đổi (kẻo vỡ MySQL test) — `grep -rn '<chuỗi VN>' src/__api__ src/__integration__`.
5. Verify: `npm run test` (unit) + lint + `check-i18n` mỗi module sweep xong.
- **Đã fix mẫu trong gate:** `wishlist` (WL-1, 2 chỗ) + `upload` (đã dùng key sẵn). Dùng làm mẫu cho sweep.
- ⚠️ **KHÔNG ép sai chuẩn:** một số AppError 500 internal (vd `attribute` "Name generator chưa khởi tạo") gần như không reach user runtime — vẫn i18n hóa cho nhất quán nhưng ưu tiên thấp.

### E. Pha 2 — Minh chứng test + hiệu năng (nhúng VÀO báo cáo)
- [ ] Chạy 5 tầng test (cần MySQL) → chụp output/coverage → nhúng **hình** vào C4 (không chỉ bảng số). Số đã verify: BE unit 158/3745, FE 21/758.
- [ ] `npm i -g autocannon` (hoặc npx) → load test endpoint CRUD (NFR <200ms, <100 user) → bảng p50/p95/p99 + req/s → section §hiệu năng + minh chứng. Cần BE chạy + MySQL.

### F. Pha 3 — Viết lại prose c1-c4
- [ ] Gộp trùng C2 §"Kiểm thử và công cụ" vs C4 §"Kiểm thử hệ thống" (C2 giữ lý thuyết, C4 giữ kết quả).
- [ ] Nhất quán thuật ngữ: `Chatbot`/`chatbot`, `Hybrid Search`/`hybrid search` (viết hoa lẫn lộn).
- [ ] Thêm mục **thiết kế role/RBAC 4 actor** (guest/customer/staff/admin) — phản ánh code mới.
- [ ] Cập nhật mọi số liệu khớp code (25 model, 17 module, 13 feature, 62 migration, các ngưỡng RAG 0.45/0.05/0.15, MAX_SESSIONS=500/TTL30/MAX_HISTORY_TURNS=10, bcrypt 12...).
- [ ] **Kiểm các `.tex` NGOÀI c1-c4** trong `docs/chapters/` (`abtract_en/vi`, `glossary`, `introduction`, `method`, `evaluation`, `conclusion`, `acknowledgement`, `assurance`) — cập nhật nếu đụng **số liệu** (abstract) / **thuật ngữ** (glossary) / RBAC. ⚠️ Xác nhận `docs/thesis.tex` `\input` để biết file nào ACTIVE trước (grep `\input` rỗng → kiểm cú pháp include thật).

### G. Pha — CHẤT LƯỢNG TEST / MUTATION (NEW 2026-06-03 — chống "test pass nhưng có bug")

**Bối cảnh:** coverage 99.7% nhưng KHÔNG đảm bảo đúng (F1/F2 lọt). Mục tiêu: dùng **mutation** (đo độ mạnh test) + **assert OUTCOME** + **integration MySQL thật** + **property-based/invariant** (oracle độc lập) + review người. Plan refactor mutation chi tiết: [`majestic-baking-yao.md`](../../.claude/plans/majestic-baking-yao.md). Stack 6 lớp đã có ~80% (27 invariant GATE-A, 6 integration edge-cases, mutation, fast-check ^4.8.0); gap chính = **property-based chỉ phủ discount-code**.

**Trạng thái khi ghi:** Phase 0 DONE (baseline 84.11% — xem §D.2). 6 manual mock đã tạo. fuzzy:93 test đã thêm. **CHƯA commit** (stryker config + 6 mock + fuzzy test).

#### G.1 — Commit checkpoint in-flight (làm NGAY, chờ user duyệt commit)
- [ ] Commit: `stryker.critical.conf.json` (coverageAnalysis off + note) + 6 manual mock (`src/{utils,services,services/vector-store,middlewares}/__mocks__/*.js`) + `fuzzy-expander.test.js` (+test fuzzy:93). Message `test(mutation): unblock Stryker (coverageAnalysis off) + manual mocks + fuzzy:93`.

#### G.2 — Refactor jest.mock → manual __mocks__ (bật lại perTest, nhanh hơn 20-100×) — majestic plan Phase 1-2
- [ ] Convert factory UNIFORM → bare `jest.mock(path)` trong 11 file critical (dùng 6 mock đã tạo). Verify TỪNG file: `npm test` giữ 167 suite/4079 xanh + coverage ≥ threshold. File rep: `payment/services/{momo-service,vnpay-service.unit}.test.js`, `orders/services/orders-service.edge-cases-{3,4}.test.js`, `cart/services/cart-service.edge-cases-{2,3}.test.js`, `inventory/{repositories,services}/*.test.js`, `discount-code/{repositories/*,routes}.test.js`, `payment/controllers/payment-controller.unit.test.js`.
  - vnpay: `jest.mock('axios', ()=>({post:jest.fn()}))` → bare `jest.mock('axios')` (auto-mock).
  - momo: logger factory → bare; phần re-mock-in-body (`jest.resetModules`+`jest.mock` trong `it()`) là runtime → kiểm có cần đụng không.
- [ ] Factory CUSTOM rủi ro cao (`@config/sequelize` transaction callback, `@models` mockTx+`require('sequelize')`): đánh giá từng cái — manual mock được thì làm (sequelize: `transaction: jest.fn(cb=>cb(mockTx))`), KHÔNG an toàn thì giữ inline + để module đó chạy `coverageAnalysis off`. momo re-mock-in-body: KHÔNG refactor (backlog).
- [ ] Module nào test đã sạch factory → thử `coverageAnalysis: perTest` riêng scope đó, verify dry-run qua + nhanh hơn.

#### G.3 — Mạnh hóa SURVIVOR critical (lõi chống F1/F2 — ưu tiên CAO NHẤT, dùng OUTCOME + property-based)
- [x] **cart-service** (79.33%→**80.22%**, verified 2026-06-03): +4 OUTCOME test biên `qty===stock → CHO đặt` (addToCart base/variant L111/114 + updateCartItem base/variant L272/275). **4 survivor stock-boundary GIẾT** (commit `e391c47e`). Còn 89 sv = display/plumbing (L41 sum variant-stock cho inStock display = medium; price-format, response-shape = thấp). KHÔNG chase tới 90% (brittle-chase trivial). L41 sum: cân nhắc 1 test assert variantStock trong getCart response nếu muốn.
- [ ] **inventory-service** (73.61%, 19 sv): ⚠️ L14 `<=0`→`<0` = **EQUIVALENT** (`!qty` đã bắt qty=0 ở vế `||` đầu → không input nào phân biệt → KHÔNG killable, để nguyên/disable). Survivor thật còn lại: L99 pagination `*`→`/` (offset sai — medium), L102/103 filter `if(x)`→`if(true)` (where sai khi thiếu param — medium). Đều list/display, không phải money/stock → ưu tiên thấp.
- [ ] **vnpay-service** (58%, 39 sv) + **momo-service** (47.62%, 33 sv): phần lớn survivor = HMAC/URL/string. Lọc survivor THẬT critical (verify signature, amount, resultCode) → strengthen; còn lại (format URL) chấp nhận hoặc disable có lý do.
- [ ] **orders-service** (91.30%, 52 sv) + **payment-service** (97%, 11 sv): review survivor còn lại, giết cái về money/stock/status, bỏ qua plumbing/display.
- [ ] ⚠️ Mọi test mới PHẢI assert OUTCOME nghiệp vụ (số/kho/status), KHÔNG tautological. Re-run mutation sau mỗi module để xác nhận giết thật.

#### G.4 — Hoàn tất coverage 4 file <100% branch ("làm tất cả") ✅ DONE (commit `dcf019c1`, 2026-06-03)
- [x] `fuzzy-expander:93` — OUTCOME test thêm rồi (branch 92.18→93.75%).
- [x] `admin-product-service:483` — **2 test thật** cả 2 nhánh: `categoryIds:[]`→`categoryId===null` + `categoryIds:[id]`→`categoryId===id` (admin-controller.edge-cases.test.js).
- [x] `chatbot-service:475` — **test thật** 2 nhánh enrich (đại từ "đó" → Pronoun; query ngắn không brand → Implicit follow-up).
- [x] **Quyết định 2026-06-03 (user chốt):** nhánh REACH được → **test thật** thay vì ignore. Đã cover thật: `keyword:218` (negation term ≤2 ký tự → excludedTerms rỗng), `chatbot:540` (catch refined-search throw → giữ lowConfidence — GỠ ignore), `fuzzy:115` (sort comparator: prefix mơ hồ 2 SP → chọn term ngắn nhất). Chỉ GIỮ istanbul-ignore cho 4 nhánh THỰC SỰ không reach qua public API: `fuzzy:80/126` (default param hàm internal), `fuzzy:172-173` (nullish trên giá trị đảm bảo truthy), `keyword:310` (guard luôn đúng). Không có dead code cần xóa.
- [x] Verify: `npm test` → **4091 test xanh** (+7), global **statements/branch/lines 100%** (funcs 99.91% — file ngoài scope). Lint sạch. Threshold giữ 99.7% (KHÔNG bump lên 100 tránh brittle).

#### G.5 — Mở rộng stack 6 lớp (lấp gap — làm SAU G.2/G.3)
- [ ] **Property-based (fast-check)** mở rộng từ discount-code → orders/cart/inventory/payment, dùng **27 invariant GATE-A** làm oracle: `stock_sau = stock_trước − qty`, `cancel→hoàn kho`, `cart merge: total=Σ(item)`, `total = subtotal + ship − discount`. fast-check sinh qty/giá/seq ngẫu nhiên phá invariant. Mẫu: `discount-code-service.property.test.js`.
- [ ] **Thêm `inventory-edge-cases.integration.test.js`** (lớp 3 còn thiếu — 6 module khác đã có) gọi service thật + MySQL assert outcome restock/log.
- [ ] (Tùy) **Testcontainers MySQL** (`@testcontainers/mysql`) → integration ephemeral reproducible trong CI (hiện phụ thuộc MySQL thủ công).
- [ ] Document **công thức 6 bước** (invariant→unit OUTCOME→integration→property→mutation→review) vào `QUALITY_CHECKS.md` làm chuẩn dự án.

#### G.6 — Doc/memory test-quality
- [ ] Cập nhật memory `project-mutation-stryker-jestmock-blocker` (blocker đã giải bằng coverageAnalysis off + manual mocks).
- [ ] `QUALITY_CHECKS.md`: thêm quy trình chạy mutation (`coverageAnalysis off`, scope critical, đọc survivor), bảng baseline 84.11%.
- [ ] `TESTING_STRATEGY.md`: thêm tầng mutation + property-based + bảng mutation score per-module.

**Thứ tự đề xuất:** G.1 (commit) → G.3 (survivor critical — giá trị cao nhất, chống F1/F2) → G.4 (coverage, nhanh) → G.2 (refactor perTest — tối ưu tốc độ) → G.5 (property-based — lấp gap oracle) → G.6 (doc). KHÔNG mở >1 thread song song.

## 4. TOOLCHAIN & LỆNH
```
BE test:        cd backend && npm run test:fast        # unit nhanh
                npm run test / test:ci                 # + coverage
                npm run test:integration|api|e2e       # cần MySQL
                npm run check:routes / check:unused / check:patch-coverage / test:mutation
FE:             cd frontend && npm run typecheck / test / check:unused / check:patch-coverage
PlantUML:       export GRAPHVIZ_DOT="C:/Program Files/Graphviz/bin/dot.exe"; \
                java -DPLANTUML_LIMIT_SIZE=16384 -jar "C:/Users/Admin/plantuml/plantuml.jar" -charset UTF-8 -tpng <file.puml>  # -D...=16384 BẮT BUỘC (4096 cắt!); -tsvg cho vector
svg->pdf LaTeX: "C:/Program Files/Inkscape/bin/inkscape.exe" <file>.svg --export-type=pdf --export-text-to-path --export-filename=<file>.pdf  # vector chèn LaTeX, font VN OK (KHÔNG dùng plantuml -tpdf: lỗi font)
mermaid:        npx -y @mermaid-js/mermaid-cli mmdc -i <file.mmd> -o <file.png>                   # npx tự tải, KHÔNG để trong repo
ERD (DBML):     npx -y @dbml/cli db2dbml mysql "<conn>" -o erd-01-schema.dbml                     # auto từ DB thật; rồi import dbdiagram.io
db:             cd backend && npm run db:migrate / db:seed
MySQL:          cần chạy (port 3306). DB unit=mock; integration/api/e2e dùng `techstore_test`
                (`npm run db:sync-test` copy techstore→techstore_test). Verify: netstat thấy :3306 LISTENING
Nguồn sơ đồ:    DIAGRAMS.md (§1 usecase, §2 phân rã, §3 sequence x6, §4 ERD, §5 kiến trúc, §6 RAG, §7 state x4, §8 component x4)
```

## 5. FILE/OUTPUT THAM KHẢO
- verify-diagrams (spec đúng vs code, 17 sơ đồ): task `w9pjm7c3o` output (trong .claude/.../tasks/). audit: `w3ys0ii2s`. validation: `w82fvvhw2`. **Lưu ý: output trong /tmp có thể mất ở session mới → cần chạy lại verify-diagrams nếu cần spec.**
- Backup: `docs/chapters/c1/c1_introduction.tex.bak`, `c2_chapter.tex.bak` (đã gitignore *.bak).

## 6. GOTCHAS
- Test mock admin-auth: dùng bare `jest.mock('@middlewares/admin-auth')` (manual mock đủ export). Override user: `req.__mockUser`. Custom (x-test-admin header / __overrideUser) giữ factory riêng.
- `transaction.LOCK.UPDATE` trong unit test: mock `runInTransaction(work => work({ LOCK:{ UPDATE:'FOR UPDATE' }}))`.
- knip BE noisy (CommonJS) — informational, đã ignore interface/DTO.
- Stryker chậm — chạy định kỳ, scope `--mutate`.

## 7. GIT — ĐÃ COMMIT + PUSH (feature branch)
- Branch `refactor/admin-glass-redesign` đã push lên origin. 3 commit phiên này (HEAD=`7e0abb8b`):
  - `f9800184` feat(auth): role staff RBAC + sửa 9 bug đồng thời
  - `4c9b8dae` chore(docs): bàn giao + doc-freshness check + cập nhật tài liệu
  - `7e0abb8b` chore(test): cập nhật checkout-payment-pages test (WIP)
- Đã gitignore rác (.tools/, mermaid-cli-*, unpacked/, *.tmp/*.pptx/*.bak, .~lock*). Working tree sạch.
- Untracked CHƯA commit: `diagrams/` (mermaid/ cũ đã đổi tên thành diagrams/ — chứa ~40 artifacts cũ + `usecase_guest.puml` mẫu), `PROMPT_PPTX.md`. Quyết định commit tùy session sau. (`diagrams_dot/` + `render_diagrams.sh` graphviz đã XÓA. ⚠️ Còn thay đổi CHƯA commit phiên này: order fix F1–F5 + tests + PLAN.md.)

### 7b. GỘP VỀ 1 NHÁNH `main` (user yêu cầu — CHƯA làm, cần confirm vì xóa nhánh)
- **Topology (đã verify)**: `origin/main` →(177 commit)→ `origin/main-latest` →(64 commit)→ `feature(HEAD)`. Feature là **hậu duệ tuyến tính**, chứa TẤT CẢ main-latest + main. → gộp **fast-forward sạch**, không mất gì, không conflict.
- **Cách an toàn (review từng bước, có thể bị branch protection chặn)**:
  ```
  git push origin refactor/admin-glass-redesign:main   # FF main → feature (hoặc: checkout main && merge --ff-only && push)
  git push origin --delete main-latest                  # main-latest đã nằm trong main → xóa an toàn
  git push origin --delete refactor/admin-glass-redesign; git branch -d refactor/admin-glass-redesign
  git checkout main && git pull
  ```
  → còn DUY NHẤT `main` chứa toàn bộ.
- ⚠️ Nếu `origin/main` có branch protection (CI required) → `push :main` có thể bị từ chối → dùng PR thay thế. Verify `git rev-list --left-right --count origin/main...HEAD` (kỳ vọng `0  <n>` = FF được) trước khi push.
