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

## 2. CÒN DANG DỞ (Pha 0 — ưu tiên cao)
- [ ] **`cd backend && npm run db:migrate`** chạy migration staff (cần MySQL). Verify enum: `SHOW COLUMNS FROM users LIKE 'role'`.
- [ ] **Seed tài khoản staff demo**: thêm vào `backend/scripts/rebuild-db.js` (hoặc seeder) 1 user `role:'staff'`, isEmailVerified:true (vd staff@techstore.test / pass). Tìm chỗ tạo user admin hiện có để thêm cạnh.
- [ ] **Cập nhật test API/integration/E2E cho staff** (cần MySQL — CHURN LỚN NHẤT): các test gọi endpoint bán hàng đang dùng **admin token** → giờ 403. Sửa: tạo + dùng **staff token** cho endpoint sales (products/orders/inventory/discounts/reviews/attribute/catalog-write/payment-refund); giữ admin token cho users + analytics/user-growth. Kiểm bằng `npm run test:api`, `test:integration`, `test:e2e`. **DONE = baseline pass-count xanh: API 700, integration 184, e2e 100 (CLAUDE.md §8).**
- [ ] **UI role** (FE): (a) dropdown gán role ở `UsersPage`/`UserDetailPage` thêm option **'staff'** (hiện type có nhưng select chưa list); (b) "admin xem-only" — ẩn/disable nút Sửa/Tạo/Xóa ở trang sản phẩm/đơn/khuyến mãi khi `role==='admin'` (BE đã chặn 403 nhưng UI chưa ẩn). Dùng `useAuth().user.role`.
- [ ] Thêm test FE+BE cho role staff (admin-auth allow staff, requireRole, AdminRoute allowedRoles).

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

**Render:** `export GRAPHVIZ_DOT="C:\Program Files\Graphviz\bin\dot.exe"; java -jar C:\Users\Admin\plantuml\plantuml.jar -charset UTF-8 -tpng diagrams/<type>/<file>.puml`

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
| 4 | `cart` | merge guest, variant pricing; use case §2.3a | ⏳ NEXT |
| 5 | `catalog` | product/variant/category; state product §7.3, use case §2.2 | ⏳ |
| 6 | `inventory` | stock log, subscribe `order.cancelled`; use case §2.6 | ⏳ |
| 7 | `discount-code` | validate/apply, usedCount timing | ⏳ |
| 8 | `reviews` | hasUserPurchased; use case §2.5 | ⏳ |
| 9 | `ai` | RAG tuân quy chuẩn `RAG_CHATBOT_PIPELINE.md`; pipeline §6, sequence §3.3 | ⏳ |
| 10 | `users` | profile/address; use case §2.1b | ⏳ |
| 11 | `wishlist` | use case §2.8 | ⏳ |
| 12 | `upload` | magic bytes; sequence §3.4 | ⏳ |
| 13 | `attribute` | nhóm thuộc tính; use case §2.8b | ⏳ |
| 14 | `content` | feedback only; use case §2.9 | ⏳ |
| 15 | `search-history` | use case §2.7 | ⏳ |
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

**✅ ORDER GATE DONE (tầng 0):** F1–F5 fixed. Verify: **3750** unit tests (= 3745 baseline + 5 mới: F2 +2 restore, F3 +2 shippingCost, +1 repo `findOrderByPkWithItemsAndUser` lock-option) + coverage 99.7% + lint sạch; **8 integration tests CỦA ORDER** (4 cũ + 4 mới `orders-edge-cases.integration.test.js` gọi service THẬT + MySQL thật, assert stock outcome — bắt được bug mà unit mock bỏ lọt; tổng integration toàn dự án = 184). → đủ điều kiện vẽ state-order/use-case order.

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

### E. Pha 2 — Minh chứng test + hiệu năng (nhúng VÀO báo cáo)
- [ ] Chạy 5 tầng test (cần MySQL) → chụp output/coverage → nhúng **hình** vào C4 (không chỉ bảng số). Số đã verify: BE unit 158/3745, FE 21/758.
- [ ] `npm i -g autocannon` (hoặc npx) → load test endpoint CRUD (NFR <200ms, <100 user) → bảng p50/p95/p99 + req/s → section §hiệu năng + minh chứng. Cần BE chạy + MySQL.

### F. Pha 3 — Viết lại prose c1-c4
- [ ] Gộp trùng C2 §"Kiểm thử và công cụ" vs C4 §"Kiểm thử hệ thống" (C2 giữ lý thuyết, C4 giữ kết quả).
- [ ] Nhất quán thuật ngữ: `Chatbot`/`chatbot`, `Hybrid Search`/`hybrid search` (viết hoa lẫn lộn).
- [ ] Thêm mục **thiết kế role/RBAC 4 actor** (guest/customer/staff/admin) — phản ánh code mới.
- [ ] Cập nhật mọi số liệu khớp code (25 model, 17 module, 13 feature, 62 migration, các ngưỡng RAG 0.45/0.05/0.15, MAX_SESSIONS=500/TTL30/MAX_HISTORY_TURNS=10, bcrypt 12...).
- [ ] **Kiểm các `.tex` NGOÀI c1-c4** trong `docs/chapters/` (`abtract_en/vi`, `glossary`, `introduction`, `method`, `evaluation`, `conclusion`, `acknowledgement`, `assurance`) — cập nhật nếu đụng **số liệu** (abstract) / **thuật ngữ** (glossary) / RBAC. ⚠️ Xác nhận `docs/thesis.tex` `\input` để biết file nào ACTIVE trước (grep `\input` rỗng → kiểm cú pháp include thật).

## 4. TOOLCHAIN & LỆNH
```
BE test:        cd backend && npm run test:fast        # unit nhanh
                npm run test / test:ci                 # + coverage
                npm run test:integration|api|e2e       # cần MySQL
                npm run check:routes / check:unused / check:patch-coverage / test:mutation
FE:             cd frontend && npm run typecheck / test / check:unused / check:patch-coverage
PlantUML:       export GRAPHVIZ_DOT="C:\Program Files\Graphviz\bin\dot.exe"; \
                java -jar C:\Users\Admin\plantuml\plantuml.jar -charset UTF-8 -tpng <file.puml>   # jar+graphviz NGOÀI repo
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
