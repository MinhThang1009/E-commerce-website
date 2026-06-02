# BÀN GIAO (HANDOFF) — KLTN TechStore + code

> Tài liệu bàn giao cho session sau hoàn thiện. Đủ chi tiết để agent mới chạy tiếp KHÔNG cần context cũ.
> Cập nhật lần cuối: phiên làm việc thêm role `staff` + sửa bug + cơ chế tự kiểm.

---

## 0. QUYẾT ĐỊNH ĐÃ CHỐT (KHÔNG mở lại)
- **Docs**: viết lại/cải thiện văn phong c1–c4 + sửa cấu trúc/sơ đồ + nhất quán thuật ngữ. Bám codebase thật.
- **Sơ đồ**: vẽ lại đúng **ký pháp UML từng loại** bằng **PlantUML** (`.tools/jdk-21.0.11+10-jre/bin/java -jar .tools/plantuml.jar -tpng -o <out> <file.puml>`) + mermaid-cli. **KHÔNG graphviz.** Verify từng sơ đồ với code TRƯỚC khi render.
- **Role mới `staff`** ("Nhân viên bán hàng"): **tách bạch hoàn toàn**, admin **xem-only** dashboard/analytics. Làm code + docs đầy đủ.
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
   - pre-commit chạy test liên quan (`.husky/pre-commit` bước 5); patch-coverage gate (BE+FE script + CI job `patch-quality`); knip (BE+FE, `check:unused`); `check:routes` (BE); Stryker (`test:mutation`). Scripts mới: `test:changed/related/coverage:changed`, `check:routes/patch-coverage/unused`, `test:mutation`.
   - manual mock `backend/src/middlewares/__mocks__/{admin-auth,authorize}.js` → đổi signature middleware chỉ sửa 1 file.
5. **Audit + validation** (đã chạy, kết quả ở task output): 15 bug CONFIRMED (đã fix 9 logic), 15 false-positive, 6 by-design.
6. **Docs**: Hình 3.1 usecase render lại (PlantUML, bỏ "banner"); chatbot survey chuyển C1→C2 (rename label c1→c2); xác minh **25 model** (text đúng; `system_architecture.png` ghi "26 bảng" SAI → sửa); 61 migration đúng.

## 2. CÒN DANG DỞ (Pha 0 — ưu tiên cao)
- [ ] **`cd backend && npm run db:migrate`** chạy migration staff (cần MySQL). Verify enum: `SHOW COLUMNS FROM users LIKE 'role'`.
- [ ] **Seed tài khoản staff demo**: thêm vào `backend/scripts/rebuild-db.js` (hoặc seeder) 1 user `role:'staff'`, isEmailVerified:true (vd staff@techstore.test / pass). Tìm chỗ tạo user admin hiện có để thêm cạnh.
- [ ] **Cập nhật test API/integration/E2E cho staff** (cần MySQL — CHURN LỚN NHẤT): các test gọi endpoint bán hàng đang dùng **admin token** → giờ 403. Sửa: tạo + dùng **staff token** cho endpoint sales (products/orders/inventory/discounts/reviews/attribute/catalog-write/payment-refund); giữ admin token cho users + analytics/user-growth. Kiểm bằng `npm run test:api`, `test:integration`, `test:e2e`.
- [ ] **UI role** (FE): (a) dropdown gán role ở `UsersPage`/`UserDetailPage` thêm option **'staff'** (hiện type có nhưng select chưa list); (b) "admin xem-only" — ẩn/disable nút Sửa/Tạo/Xóa ở trang sản phẩm/đơn/khuyến mãi khi `role==='admin'` (BE đã chặn 403 nhưng UI chưa ẩn). Dùng `useAuth().user.role`.
- [ ] Thêm test FE+BE cho role staff (admin-auth allow staff, requireRole, AdminRoute allowedRoles).

## 3. CÒN LẠI (Pha tiếp)
### A. Mục tiêu 100% coverage unit (user yêu cầu — ĐÁNH ĐỔI)
- BE: ngưỡng ở `backend/jest.config.js` (hiện stmt 99.7/branch 99.7/func 99.4/lines 99.7; thực tế ~99.98/99.81/99.91/100). Để 100%: nâng ngưỡng → 100 + viết test cho ~7 nhánh branch chưa phủ (module-level guards, short-circuit `||`/`&&` defensive). Nhánh KHÔNG thể trigger qua unit → cân nhắc `/* istanbul ignore next */` + comment lý do (đừng lạm dụng).
- FE: ngưỡng ở `frontend/jest.config.cjs` (global ~79%, per-file 100% chỉ auth/schema). Để 100% global = **rất nhiều** component test mới (effort lớn) — đây là phần nặng nhất; cân nhắc nâng dần (79→85→90→...) thay vì nhảy 100 ngay.
- **Tradeoff (ghi rõ cho hội đồng)**: 100% line/branch ép viết test cho defensive code/không-reachable → có thể giảm giá trị thực; chuẩn ngành 90-99% + patch-coverage. Nếu vẫn theo 100%: làm BE trước (gần rồi), FE sau.

### B. Tự động hóa thêm (chống thủ công/stale — user yêu cầu)
- **Stale docs**: đã có `backend/scripts/check-docs.js` (`npm run check-docs`) + `scripts/verify-doc-nodes.js` + `verify-doc-evidence.py` (verify DIAGRAMS.md vs code). → wire vào CI (job informational) để bắt CLAUDE.md/DIAGRAMS.md lệch code.
- **i18n parity**: `frontend/scripts/check-i18n.js` + `backend` i18n — thêm vào pre-push/CI.
- Cân nhắc: auto-CHANGELOG từ Conventional Commits; "definition-of-done" checklist; CI chạy `check:routes`+`check:unused` định kỳ (nightly) báo cáo.

### C. Dọn API thừa (đã có `npm run check:routes` liệt kê — review trước khi xóa)
- [ ] Gỡ catalog product-write dup (`POST/PUT/DELETE /api/products`) — FE chỉ dùng `/admin/products`. (Đụng catalog routes + controller methods + test catalog.)
- [ ] Hợp nhất restock dup (`/admin/products/:id/restock` vs `/inventory/.../restock`).
- [ ] Gỡ unused: `GET /chatbot/recommendations`, `POST /chatbot/analytics`, `/chatbot/session/latest` + `/session/:id/history`. Chuẩn hóa verb hủy đơn (POST).
- Lưu ý: chạy `check:routes` lại sau role để không gỡ nhầm endpoint staff dùng.

### D. Pha 1 — Sơ đồ + bố cục + phụ lục (docs)
- [ ] Vẽ lại ~15 sơ đồ ĐÚNG KÝ PHÁP UML (component/sequence/state/ERD crow's-foot/activity) bằng PlantUML. **Verify nội dung vs code TRƯỚC khi render** (đã có spec từ verify-diagrams workflow — xem §5).
- [ ] Sửa `docs/figures/c3/system_architecture.png`: "26 bảng" → **25**; ký pháp component đúng + đủ module chính/phụ.
- [ ] Thêm sơ đồ thiếu: sequence (upload, admin product, token refresh), state (product, user), 4 component diagram, usecase phân rã (§2 DIAGRAMS.md). **Cập nhật usecase tổng quan thành 4 actor (thêm staff).**
- [ ] **Bảng đặc tả ca sử dụng** (UC code/actor/tiền-hậu điều kiện/luồng chính-phụ) — KLTN đang thiếu.
- [ ] Hình cho C2 (`figures/c2/RAG.png` đang bỏ không + thêm sơ đồ RAG/tech-stack). `[H]`→`[htbp]` toàn bộ (C3 ~11, C4 ~18 hình + 4 bảng); chuẩn hóa kích thước; gom 17 screenshot C4 hợp lý.
- [ ] **Phụ lục**: tạo `docs/chapters/appendix.tex`, chuyển 4 code listing trong C4 sang, wire `\input` vào `docs/thesis.tex` (trước bibliography).

### E. Pha 2 — Minh chứng test + hiệu năng (nhúng VÀO báo cáo)
- [ ] Chạy 5 tầng test (cần MySQL) → chụp output/coverage → nhúng **hình** vào C4 (không chỉ bảng số). Số đã verify: BE unit 158/3745, FE 21/758.
- [ ] `npm i -g autocannon` (hoặc npx) → load test endpoint CRUD (NFR <200ms, <100 user) → bảng p50/p95/p99 + req/s → section §hiệu năng + minh chứng. Cần BE chạy + MySQL.

### F. Pha 3 — Viết lại prose c1-c4
- [ ] Gộp trùng C2 §"Kiểm thử và công cụ" vs C4 §"Kiểm thử hệ thống" (C2 giữ lý thuyết, C4 giữ kết quả).
- [ ] Nhất quán thuật ngữ: `Chatbot`/`chatbot`, `Hybrid Search`/`hybrid search` (viết hoa lẫn lộn).
- [ ] Thêm mục **thiết kế role/RBAC 4 actor** (guest/customer/staff/admin) — phản ánh code mới.
- [ ] Cập nhật mọi số liệu khớp code (25 model, 17 module, 13 feature, 61 migration, các ngưỡng RAG 0.45/0.05/0.15, MAX_SESSIONS=500/TTL30/MAX_HISTORY_TURNS=10, bcrypt 12...).

## 4. TOOLCHAIN & LỆNH
```
BE test:        cd backend && npm run test:fast        # unit nhanh
                npm run test / test:ci                 # + coverage
                npm run test:integration|api|e2e       # cần MySQL
                npm run check:routes / check:unused / check:patch-coverage / test:mutation
FE:             cd frontend && npm run typecheck / test / check:unused / check:patch-coverage
PlantUML:       .tools/jdk-21.0.11+10-jre/bin/java.exe -jar .tools/plantuml.jar -tpng -o <outdir> <file.puml>
mermaid:        npx (mermaid-cli local: mermaid-cli-11.15.0/)
db:             cd backend && npm run db:migrate / db:seed
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

## 7. GIT (chưa commit)
- Branch: `refactor/admin-glass-redesign`. ~97 file tracked đổi (gồm WIP có sẵn trước phiên + việc phiên này) + file mới.
- Đã gitignore rác (.tools/, mermaid-cli-*, unpacked/, *.tmp/*.pptx/*.bak, .~lock*).
- **Khuyến nghị**: `git add -u` + add file mới (scripts, configs, mocks, migration, plan.md, QUALITY_CHECKS.md) → tách commit logic (fix/feat-role/chore-quality/docs) → push branch → PR/merge vào main. KHÔNG `git add .` (kéo rác). Pre-commit hook sẽ chạy lint+tsc+related-tests.
