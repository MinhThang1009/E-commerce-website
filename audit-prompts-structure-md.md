# Audit STRUCTURE.md — Chia theo Phases

> Chạy từng phase theo thứ tự. Mỗi phase là 1 prompt riêng biệt gửi cho agent. Chờ phase trước hoàn tất rồi mới chạy phase tiếp theo.
>
> **Nguyên tắc xuyên suốt mọi phase:**
> - Khách quan, không assume trước rằng documentation đã đúng — nhiều số liệu, con số và mô tả tính năng trong file có thể đã bị cũ so với codebase hiện tại, cần đọc code thực tế để xác minh và update
> - Không được skip hoặc skim — mỗi section phải được audit đầy đủ từng dòng trước khi chuyển sang section tiếp theo
> - Mọi finding phải kèm: trích dẫn dòng cụ thể trong STRUCTURE.md, nội dung thực tế trong code, và mô tả sự khác biệt
> - Phát hiện thành phần đã bị xóa, renamed hoặc deprecated nhưng vẫn còn trong doc → ghi nhận là CONFLICT
> - Phát hiện thành phần MỚI trong codebase (modules, features, tables, env vars, aliases, dependencies) chưa có trong STRUCTURE.md → ghi nhận là GAP và bổ sung
> - Nếu phát hiện codebase đang có bugs → chủ động lập plan fix và thực hiện sửa luôn, không cần hỏi lại. Ghi nhận rõ: vấn đề gì, nguyên nhân, và đã fix như thế nào
> - Phát hiện số liệu hoặc mô tả đã outdated → update cho đúng với codebase hiện tại
> - Xuất kết quả mỗi phase ra file .md riêng

---

## Phase 1a — Lập kế hoạch audit

Đọc file STRUCTURE.md, liệt kê toàn bộ 10 sections (Tổng quan kiến trúc, Tech Stack, Cấu trúc thư mục, Backend Architecture, Frontend Architecture, Database Schema Overview, Data Flow, Cross-module Dependencies, Environment & Configuration, Module Aliases). Xác định file source code cần cross-check cho từng section. Xuất kế hoạch ra file audit-plan-structure.md.

---

## Phase 1b — Audit Tổng quan + Tech Stack (section 1 + 2)

Audit section 1 (Tổng quan kiến trúc) và section 2 (Tech Stack). Cross-check cụ thể: ASCII diagram (Browser → Vite → Express → MySQL/vector-db.json) phải phản ánh đúng luồng giao tiếp thực tế. Các con số (số modules, số features) phải khớp code — đếm thực tế trong `backend/src/modules/` và `frontend/src/features/`. Tech Stack phải khớp đúng technology và version với package.json của cả backend lẫn frontend — verify từng dòng trong bảng. Phát hiện technologies MỚI trong package.json chưa có trong bảng. Báo cáo từng item: PASS, CONFLICT hoặc GAP — kèm trích dẫn dòng cụ thể, giá trị thực tế trong code, mô tả khác biệt. Phân loại severity. Fix và update số liệu outdated. Xuất kết quả ra file.

---

## Phase 1c — Audit Cấu trúc thư mục (section 3)

Audit section 3 (Cấu trúc thư mục Root, Backend, Frontend). Cross-check cây thư mục trong doc với cây thư mục thực tế trên disk — chạy `find` hoặc `ls -R` để verify. Mọi file/folder được liệt kê phải tồn tại. Mọi file/folder quan trọng tồn tại trong codebase phải được liệt kê — phát hiện gaps. Phát hiện files/folders đã bị xóa nhưng vẫn còn trong doc. Phát hiện files/folders MỚI chưa có trong doc. Báo cáo: PASS, CONFLICT hoặc GAP kèm trích dẫn cụ thể. Phân loại severity. Fix và update. Xuất kết quả ra file.

---

## Phase 1d — Audit Backend Architecture (section 4)

Audit section 4 (Modular Monolith pattern, DI Pattern, Backend Modules, Shared Infrastructure). Cross-check cụ thể:
- Số lượng modules: lưu ý inconsistency hiện có — tiêu đề ghi "19 Backend Modules" nhưng bảng có thể khác, section 4.2 ghi "Full DI (13 modules)" + "Singleton (5 modules)" = 18 cũng không khớp. Verify TẤT CẢ con số này với `backend/src/modules/` thực tế. Phát hiện modules MỚI chưa có trong doc
- DI pattern mỗi module: Full DI hay Singleton — khớp với implementation trong module.js
- Base paths: khớp với routes.js thực tế
- Mô tả chức năng: khớp với controllers và services
- Shared Infrastructure (EventBus events, UnitOfWork API, AppError classes, Cron Jobs schedule + tasks): khớp `backend/src/shared/`, `backend/src/jobs/`. Phát hiện events/tasks MỚI chưa có trong doc

Báo cáo: PASS, CONFLICT hoặc GAP kèm trích dẫn cụ thể. Phân loại severity. Fix và update. Xuất kết quả ra file.

---

## Phase 1e — Audit Frontend Architecture (section 5)

Audit section 5 (Feature-Based pattern, Frontend Features, State Management). Cross-check cụ thể:
- Số lượng features và tên: khớp `frontend/src/features/` thực tế. Phát hiện features MỚI chưa có trong doc
- Bảng API hooks và pages mỗi feature: khớp với code trong từng feature folder. Phát hiện hooks/pages MỚI
- Zustand stores (số lượng, tên, dữ liệu quản lý, persistence strategy): khớp `frontend/src/stores/`. Phát hiện stores MỚI
- TanStack Query config (staleTime, gcTime, retry, refetchOnWindowFocus): khớp `frontend/src/lib/query-client.ts`
- Axios interceptors (request attach token, response 401 handle): khớp `frontend/src/lib/api-client.ts`

Báo cáo: PASS, CONFLICT hoặc GAP kèm trích dẫn cụ thể. Phân loại severity. Fix và update. Xuất kết quả ra file.

---

## Phase 1f — Audit Database Schema (section 6)

Audit section 6 (Core tables, Junction & Log tables). Cross-check từng table, model name, column, mô tả, relationship với `backend/data/migration.sql` và Sequelize models trong `backend/src/models/`. Đặc biệt verify danh sách "models đã xóa" — kiểm tra từng model trong danh sách xem có còn file trên disk không, có còn trong index.js associations không. Phát hiện tables/columns MỚI trong migration.sql hoặc models chưa có trong doc. Báo cáo: PASS, CONFLICT hoặc GAP kèm trích dẫn cụ thể. Phân loại severity. Fix và update. Xuất kết quả ra file.

---

## Phase 1g — Audit Data Flow (section 7)

Audit section 7 (Request lifecycle, AI/RAG pipeline, Event-driven flows). Cross-check cụ thể:
- Request lifecycle: middleware stack và thứ tự phải khớp `backend/src/app.js` — verify từng middleware theo đúng thứ tự khai báo. Phát hiện middlewares MỚI chưa có trong doc
- AI/RAG pipeline — đây là core, audit cẩn thận nhất:
  - Indexing: enrichProductData, buildEmbeddingText, embedding chain, vector-db.json
  - Query: hybridSearch parameters, scoring weights, thresholds
  - Auto-rebuild trigger: ngưỡng 5%, hàm checkVectorStoreSync, điều kiện so sánh activeCount vs vectorCount
  - Phát hiện bước/logic MỚI trong pipeline chưa có trong doc
- Event-driven flows: verify từng event type, publisher module, subscriber module, handler logic khớp EventBus implementation thực tế. Phát hiện events MỚI chưa có trong doc

Báo cáo: PASS, CONFLICT hoặc GAP kèm trích dẫn cụ thể. Phân loại severity. Fix và update. Xuất kết quả ra file.

---

## Phase 1h — Audit Cross-module + Env + Aliases (section 8 + 9 + 10)

Audit section 8 (Cross-module Dependencies) — verify từng dependency arrow khớp actual imports, DI injections, event subscriptions trong code. Phát hiện dependencies MỚI hoặc đã thay đổi.

Audit section 9 (Environment & Configuration) — verify từng biến môi trường, giá trị mặc định, required/optional status với `.env.example` và code sử dụng thực tế (tìm `process.env.XXX`). Phát hiện env vars MỚI trong code chưa có trong doc.

Audit section 10 (Module Aliases) — verify khớp `backend/package.json` (`_moduleAliases`), `backend/jest.config.js` (`moduleNameMapper`), `frontend/vite.config.ts` (`resolve.alias`). Phát hiện aliases MỚI hoặc đã xóa.

Báo cáo: PASS, CONFLICT hoặc GAP kèm trích dẫn cụ thể. Phân loại severity. Fix và update. Xuất kết quả ra file.

---

## Phase 1i — Cross-check với CLAUDE.md + Tổng kết

Cross-check STRUCTURE.md với các file CLAUDE.md liên quan — đảm bảo nhất quán về: số lượng modules, tên, chức năng, base path, DI pattern, dependencies, tech stack, data flow. Mọi inconsistency giữa 2 nguồn documentation phải được ghi nhận kèm trích dẫn từ cả 2 file, và fix.

Tổng kết toàn bộ audit: tổng số section PASS / CONFLICT / GAP, phân loại severity (critical / minor), đề xuất cách fix cụ thể cho từng vấn đề còn lại.

Verification chống false positive: với mỗi finding, trực tiếp đọc lại STRUCTURE.md và source code liên quan để xác nhận true positive hay false positive. Loại bỏ toàn bộ false positives. Chỉ giữ findings đã verify bằng evidence cụ thể từ code. Xuất báo cáo cuối cùng ra file .md.
