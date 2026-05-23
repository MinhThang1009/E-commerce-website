# Audit 72 file CLAUDE.md — Chia theo Phases

> Chạy từng phase theo thứ tự. Mỗi phase là 1 prompt riêng biệt gửi cho agent. Chờ phase trước hoàn tất rồi mới chạy phase tiếp theo.
>
> **Context:** Đây là large-scale TypeScript/TSX codebase. Hệ thống CLAUDE.md được tổ chức phân cấp — file root CLAUDE.md điều hướng đến từng module, tạo thành cấu trúc giúp AI assistant navigate codebase.
>
> **Nguyên tắc xuyên suốt mọi phase:**
> - Khách quan, không assume trước rằng documentation đã đúng
> - Không được skip hoặc skim — mỗi file phải được audit đầy đủ từng dòng trước khi chuyển sang file tiếp theo
> - Mọi finding phải kèm: trích dẫn dòng cụ thể trong CLAUDE.md, nội dung thực tế trong code (.ts/.tsx), và mô tả sự khác biệt
> - Phát hiện references đến code đã bị xóa, renamed hoặc deprecated → ghi nhận là CONFLICT
> - Phát hiện code MỚI trong codebase (endpoints, functions, modules, types, configs) chưa có trong CLAUDE.md → ghi nhận là GAP và bổ sung
> - Cross-check bao gồm cả code được reference hoặc import từ các module khác
> - Nếu phát hiện codebase đang có bugs → chủ động lập plan fix và thực hiện sửa luôn, không cần hỏi lại. Ghi nhận rõ: vấn đề gì, nguyên nhân, và đã fix như thế nào
> - Xuất kết quả mỗi phase ra file .md riêng

---

## Phase 1a — Lập kế hoạch audit

Đọc file CLAUDE.md ở root, hiểu cấu trúc điều hướng. Sau đó quét toàn bộ codebase để tìm và liệt kê tất cả file CLAUDE.md. Verify tổng số đúng 72 file hay không — nếu số lượng khác 72, báo cáo ngay kèm danh sách thực tế. Liệt kê từng file CLAUDE.md kèm module/package tương ứng. Nếu có module quan trọng chưa có CLAUDE.md, ghi nhận để bổ sung ở Phase 1i. Verify rằng mọi liên kết trong root CLAUDE.md trỏ đúng đến file tồn tại, không có broken references. Xuất kế hoạch ra file audit-plan-claude.md.

---

## Phase 1b — Audit CLAUDE.md root + shared infrastructure

Audit file CLAUDE.md ở root và các file CLAUDE.md trong shared infrastructure (shared/, services/, middlewares/, utils/, config/, jobs/, constants/, locales/). Đọc kỹ từng dòng, cross-check với source code .ts/.tsx thực tế trong cùng folder — bao gồm cả code reference/import từ module khác. Xác minh mọi thông tin: API, function signatures, parameters, return types, dependencies, imports, configuration, environment variables, architecture, data flow, behavioral descriptions, error handling, coding conventions, file/folder structure. Phát hiện functions/configs MỚI trong code chưa có trong CLAUDE.md. Báo cáo từng file: PASS, CONFLICT hoặc GAP — kèm trích dẫn dòng cụ thể, code thực tế, mô tả khác biệt. Phân loại severity (critical / minor). Fix nếu có vấn đề, không cần hỏi lại. Xuất kết quả ra file.

---

## Phase 1c — Audit backend modules: auth, users, catalog, cart

Audit file CLAUDE.md của 4 modules: auth, users, catalog, cart. Với mỗi file, đọc từng dòng rồi cross-check với source code .ts/.tsx thực tế — module.js, routes.js, controllers/, services/, repositories/, validators/. Xác minh API endpoints, function signatures, parameters, return types, DI dependencies, business logic, error handling, middleware usage. Phát hiện endpoints/functions MỚI trong code chưa có trong CLAUDE.md. Phát hiện references đến code đã bị xóa, renamed hoặc deprecated. Báo cáo từng file: PASS, CONFLICT hoặc GAP — kèm trích dẫn cụ thể. Phân loại severity. Fix nếu có vấn đề. Xuất kết quả ra file.

---

## Phase 1d — Audit backend modules: orders, payment, inventory, reviews

Audit file CLAUDE.md của 4 modules: orders, payment, inventory, reviews. Quy trình tương tự Phase 1c. Đặc biệt orders và payment có logic phức tạp (transaction, EventBus, IPN webhook, SELECT FOR UPDATE, discount usedCount timing) — audit cẩn thận từng flow, từng branching logic, từng side effect. Phát hiện endpoints/logic MỚI chưa có trong CLAUDE.md. Báo cáo từng file: PASS, CONFLICT hoặc GAP kèm trích dẫn cụ thể. Phân loại severity. Fix nếu có vấn đề. Xuất kết quả ra file.

---

## Phase 1e — Audit backend modules: ai, admin, discount-code, content, wishlist

Audit file CLAUDE.md của 5 modules: ai, admin, discount-code, content, wishlist. Đặc biệt module ai là core RAG pipeline — audit với mức độ chi tiết cao nhất: cross-check từng tham số (topK, minScore, temperature, max_tokens, TTL, rate limit, timeout, MAX_SESSIONS), mọi branching logic, mọi fallback mechanism, embedding chain, provider rotation với implementation thực tế. Phát hiện features/endpoints MỚI chưa có trong CLAUDE.md. Báo cáo từng file: PASS, CONFLICT hoặc GAP kèm trích dẫn cụ thể. Phân loại severity. Fix nếu có vấn đề. Xuất kết quả ra file.

---

## Phase 1f — Audit backend modules: upload, image, attribute, search-history + remaining

Audit file CLAUDE.md của các modules còn lại: upload, image, attribute, search-history, và bất kỳ module nào chưa được audit ở các phase trước. Quy trình tương tự Phase 1c. Phát hiện code MỚI chưa có trong CLAUDE.md. Báo cáo từng file: PASS, CONFLICT hoặc GAP kèm trích dẫn cụ thể. Phân loại severity. Fix nếu có vấn đề. Xuất kết quả ra file.

---

## Phase 1g — Audit frontend CLAUDE.md files

Audit tất cả file CLAUDE.md trong frontend (features/, components/, stores/, hooks/, utils/, lib/, routes/, config/). Cross-check với source code .ts/.tsx thực tế — API hooks, components, pages, types, state management, Zustand stores, routing, Axios interceptors, TanStack Query config. Phát hiện components/hooks/features MỚI trong code chưa có trong CLAUDE.md. Phát hiện references đến code đã bị xóa, renamed hoặc deprecated. Báo cáo từng file: PASS, CONFLICT hoặc GAP kèm trích dẫn cụ thể. Phân loại severity. Fix nếu có vấn đề. Xuất kết quả ra file.

---

## Phase 1h — Cross-file consistency + Liên kết

Kiểm tra cross-file consistency: các file CLAUDE.md có nhất quán với nhau không — ví dụ module A mô tả interface khác với cách module B reference nó, hoặc shared dependency được mô tả khác nhau ở 2 nơi. Verify toàn bộ liên kết giữa các file CLAUDE.md (từ root đến module, giữa module với nhau) — không có broken references. Ghi nhận mọi inconsistency kèm trích dẫn cụ thể từ cả 2 file liên quan. Fix. Xuất kết quả ra file.

---

## Phase 1i — Bổ sung CLAUDE.md cho modules thiếu

Dựa trên kết quả Phase 1a, bổ sung file CLAUDE.md cho những module/package quan trọng chưa có. File mới phải theo đúng format và conventions của các file CLAUDE.md hiện có, phản ánh chính xác code thực tế. Cập nhật liên kết trong root CLAUDE.md để trỏ đến file mới. Xuất danh sách file đã bổ sung ra file.

---

## Phase 1j — Verification + Tổng kết

Thực hiện verification cuối cùng: với mỗi finding từ tất cả phases trước, trực tiếp đọc lại file CLAUDE.md và source code liên quan để xác nhận finding đó là true positive hay false positive. Loại bỏ toàn bộ false positives. Chỉ giữ lại findings đã verify bằng evidence cụ thể từ code. Tổng kết: tổng số file PASS / CONFLICT / GAP, phân loại severity (critical / minor), đề xuất cách fix cụ thể cho từng vấn đề còn lại. Xuất báo cáo cuối cùng ra file .md.
