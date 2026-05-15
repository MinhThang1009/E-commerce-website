# Agent Execution Rules — E-Commerce Codebase

Toàn bộ 32 rules bắt buộc áp dụng **mọi phase và mọi session**. Được tổ chức theo thứ tự ưu tiên P0→P6 — đọc từ đầu đến cuối trước khi bắt đầu bất kỳ phase nào.

> **Nguồn gốc:** rules này được trích từ AGENT EXECUTION GUIDELINES trong plan.md (Rules 1–32) và sau đó mở rộng thêm. **AGENT_RULES.md là authoritative source** — plan.md chỉ còn pointer 1 dòng trỏ đến file này.

---

## Project Context — Stack

- **Backend:** Node.js + Express + Sequelize ORM + MySQL (nhiều models, nhiều routes — đọc code để biết số chính xác)
- **Frontend:** React 18 + TypeScript + Vite + Redux Toolkit (nhiều pages — đọc code để biết số chính xác)
- **ID convention:** INT AUTO_INCREMENT (không dùng UUID)
- **Product data:** `backend/data/seed_data.sql` — đọc file để biết số lượng thực tế hiện tại
- **Quy tắc làm việc:** Hoàn thành và PASS toàn bộ Acceptance Criteria Phase N trước khi bắt đầu Phase N+1
- **Quy tắc về sai sót trong plan hoặc codebase:** Nếu phát hiện bất kỳ chỗ nào trong plan có thông tin sai, mô tả không chính xác, hoặc hướng dẫn có thể gây lỗi — **hoặc** phát hiện bug/sai sót trong codebase không thuộc phase hiện tại — phải: (1) dừng lại, chủ động báo cho user ngay, giải thích sai ở đâu và tại sao; (2) fix plan.md và/hoặc codebase luôn; (3) thêm ✅ Acceptance Criteria tương ứng vào phase liên quan; (4) double-check 100% AC pass trước khi push lên GitHub và trước khi sang phase mới.

**i18n bắt buộc toàn codebase:** NGHIÊM CẤM hardcode string user-visible bằng tiếng Việt hoặc tiếng Anh trực tiếp vào code. Mọi text hiển thị ra UI phải đi qua `t('key')` (trong React component) hoặc `i18next.t('key')` (ngoài React). Khi thêm string mới: (1) thêm key vào `frontend/src/locales/en.json`, (2) thêm cùng key vào `frontend/src/locales/vi.json`, (3) dùng `t('key')` trong code. Chi tiết tại section i18n trong plan.md (dùng `Grep "PHASE.*i18n\|i18n.*Full"` để tìm đúng phase).

---

## P0 — Execution Gates (làm TRƯỚC khi code bất kỳ dòng nào)

Sai ở nhóm này → mọi thứ còn lại đều vô nghĩa.

## Rule 32 — Phân loại phase: mức độ test bắt buộc (BẮT BUỘC ĐỌC TRƯỚC MỖI PHASE)

Không phải mọi phase đều cần automated test file. Xác định loại phase TRƯỚC khi bắt đầu implement:

**Loại A — Backend logic / API endpoints → BẮT BUỘC có file .test.js**
Phase thêm/sửa controller, service, route, middleware xử lý business logic quan trọng.
Phases thuộc Loại A: 1, 2, 3, 7, 9, 10, 11, 13, 14, 16, 17, 18, 19, 35.
Checklist: [ ] file `*.phase{N}.test.js` tồn tại; [ ] ≥3 test cases/endpoint; [ ] npm test pass.

**Loại B — UI / i18n / design / SEO → Layer 2 đủ, không cần test file Jest**
Phase chỉ thay đổi frontend component, CSS, i18n keys, SEO tags, responsive layout.
Phases thuộc Loại B: 5, 20, 21, 24, 28, 29, 37.
Checklist: [ ] tsc --noEmit pass; [ ] Layer 2 B1-B6, C1-C4.

**Loại C — Schema / config / migration / infra → test case-by-case**
Nếu có thêm endpoint mới → áp dụng Loại A. Nếu chỉ refactor/rename → Layer 2 đủ.
Phases thuộc Loại C: 4, 6, 8, 12, 15, 22, 23, 25, 31, 38.
Checklist: [ ] Nếu có endpoint mới → test file; [ ] npm test pass (regression); [ ] Layer 2.

**Loại D — Feature completeness / audit / reporting → Layer 2 + manual demo**
Phase kiểm tra toàn bộ feature set, chuẩn bị demo, hoặc audit tổng thể.
Phases thuộc Loại D: 26, 27, 30, 32, 33, 34, 36, 39.
Checklist: [ ] npm test pass; [ ] manual demo AC quan trọng; [ ] Layer 2.

**How to apply:** Khi bắt đầu phase N, xác định loại A/B/C/D → áp dụng checklist tương ứng thay vì áp dụng Rule 30+31 đồng đều cho mọi phase.

**Tạo file test mới hay cập nhật file hiện có?**

Quy tắc áp dụng cho Loại A (và Loại C có endpoint mới):

- **Endpoint/service mới hoàn toàn** → tạo file mới `<area>.phase{N}.test.js` (ví dụ: `order.phase26.test.js`)
- **Endpoint cũ bị sửa logic** → cập nhật file test gần nhất của area đó (ví dụ: sửa logic order ở phase 26 → cập nhật `order.phase25.test.js` hoặc file test mới nhất của order); KHÔNG tạo file mới nếu chỉ sửa behavior cũ
- **File quá lớn (>15 test cases)** → tạo thêm `<area>.phase{N}b.test.js` (suffix `b`, `c`...)
- **NGHIÊM CẤM** sửa test file từ phase cũ hơn nếu không cần thiết — tránh làm xáo trộn coverage history và có thể vô tình break suite cũ

## Rule 3 — Đọc toàn bộ rules trước mỗi phase (BẮT BUỘC)

File này (AGENT_RULES.md) chứa đầy đủ toàn bộ 32 rules với full content — **không cần đọc AGENT EXECUTION GUIDELINES trong plan.md**. Đọc hết file này từ P0 đến P6 là đủ. Không bỏ sót rule nào — đây là bước đầu tiên, không phải tùy chọn.

Nếu cần tra cứu thêm chi tiết một rule cụ thể theo số (ví dụ cross-reference "xem Rule 11"): dùng `Grep "## Rule 11" AGENT_RULES.md` để tìm đúng section trong file này.

**Không được bỏ qua bất kỳ rule nào dù cảm thấy rule đó không liên quan đến phase đang làm — một rule bị bỏ sót có thể gây bug hàng loạt.**

## Rule 31 — Verify 2 lớp trước khi commit (BẮT BUỘC — không được bỏ qua)

Sau khi implement xong mọi task trong một phase, **bắt buộc thực hiện đủ 2 lớp verify theo thứ tự** trước khi commit và push lên GitHub.

---

### Lớp 1 — Automated tests

- `cd backend && npm test` → phải pass 100%, không có test nào fail
- `cd frontend && npx tsc --noEmit` → phải pass 0 TypeScript errors mới (pre-existing errors trong file không chỉnh sửa được ghi nhận và bỏ qua)
- Nếu bất kỳ test nào fail → bắt buộc fix trước, không được commit

---

### Lớp 2 — Đọc lại code thực tế (đây là lớp hay bị bỏ qua nhất)

Với **mỗi file đã sửa hoặc tạo mới** trong phase, kiểm tra từng mục theo nhóm:

#### A. Backend — controllers, services, routes, models, middleware, migrations

**A1. Blocking I/O** — chạy, phải = 0 kết quả:
```
grep -rn "execSync\|spawnSync\|readFileSync\|writeFileSync\|appendFileSync" backend/src/
```
Một call duy nhất đủ freeze toàn server. Exception duy nhất: `backend/scripts/` (standalone scripts, không chạy trong server process).

**A2. Missing `await` trên async writes** — đọc từng file đã sửa:
Mọi call `.create()`, `.update()`, `.destroy()`, `.bulkCreate()`, `.decrement()`, `.increment()`, `.upsert()`, `.save()`, `sendMail()`, `redis.set()`, `redis.del()`, external API write → phải có `await` phía trước. Exception duy nhất được phép: fire-and-forget logging không critical — phải có comment `// fire-and-forget: không cần đợi kết quả`.

**A3. Multi-step DB write thiếu transaction:**
Mọi operation ghi vào ≥2 bảng hoặc có ≥2 INSERT/UPDATE/DELETE có quan hệ logic → phải bọc trong `sequelize.transaction(async (t) => { ... })` và truyền `{ transaction: t }` vào **mọi** query bên trong, không bỏ sót dòng nào.

**A4. Race condition — thiếu SELECT FOR UPDATE:**
Pattern "đọc giá trị → kiểm tra → ghi lại" (check stock → decrement, check balance → deduct, check quota → increment, check availability → reserve) → phải có `lock: t.LOCK.UPDATE` khi `findByPk`/`findOne` bên trong transaction. Thiếu → 2 request đọc cùng giá trị rồi cùng ghi đè → corrupt data.

**A5. Cache invalidation không đủ variant + không cache sensitive data:**
```
grep -rn "cache\.set\|redis\.set\|\.setex\b\|cacheMiddleware" backend/src/
```
Với mỗi key được set, tìm **tất cả** write endpoints liên quan → xác nhận xóa đủ **mọi variant** của key (theo ID, theo slug, theo filter, theo list). Thiếu một variant → stale data không bị clear.
**NGHIÊM CẤM** cache bất kỳ endpoint nào trả về sensitive data: user profile, cart, orders, payment info, session token.

**A6. HTTP status codes sai — so sánh với AC:**
Từng `res.status(X)` trong file đã sửa phải khớp đúng với AC trong plan.md:
`201` create thành công · `200` update/read · `422` validation error · `400` business logic error · `401` unauthenticated · `403` unauthorized · `404` not found · `409` conflict.

**A7. Route mới thiếu auth middleware:**
Đọc từng route mới trong `backend/src/routes/` → route cần xác thực phải có `authenticate` hoặc `adminAuthenticate` đặt đúng vị trí. Thiếu → security hole, không bị automated test phát hiện.

**A8. Response format không nhất quán:**
```
grep -n "res\.json(" <file vừa sửa>
```
Mọi `res.json()` trong endpoint mới phải dùng `{ status: 'success', data: ... }` cho success và `{ status: 'error', message: ... }` cho error — đúng convention toàn codebase.

**A9. N+1 queries:**
```
grep -n "findAll\|findOne" <file vừa sửa>
```
Nếu call nằm trong `for`, `forEach`, `.map()`, `Promise.all(array.map(...))` → vi phạm. Dùng `include:` eager loading hoặc single `WHERE id IN (ids)` query.

**A10. Unbounded query trên list endpoint:**
```
grep -n "findAll\|findAndCountAll" <file vừa sửa>
```
Mọi call trong user-facing endpoint phải có `limit:` + `offset:`. Không có → unbounded query khi data tăng → timeout/OOM.

**A11. Sensitive data trong logs:**
```
grep -n "console\.\|logger\." <file vừa sửa>
```
Không được log `req.body`, `req.headers`, `password`, `token`, `otp`, `secret`, object user đầy đủ, thông tin thanh toán, hay bất kỳ PII nào.

**A12. Input không được validate trước khi dùng:**
```
grep -n "req\.body\.\|req\.params\.\|req\.query\." <file vừa sửa>
```
Mọi field từ request phải đi qua `validateRequest(schema, 422)` trước khi dùng trong logic hoặc DB query. Không validate → untrusted data vào DB.

**A13. Migration thiếu `down()`, FK thiếu `onDelete`, hoặc `migration_full.sql` chưa cập nhật:**
Migration mới phải có cả `up()` và `down()`. Mọi FK constraint (`references:`) phải kèm `onDelete:` tường minh (`CASCADE`, `RESTRICT`, `SET NULL`):
```
grep -n "references:" <migration file vừa tạo>
```
→ mỗi `references:` phải có `onDelete:` ngay bên dưới. Sau khi thêm/sửa bảng → cập nhật `migration_full.sql`. Mọi `CREATE TABLE` trong file đó phải là `CREATE TABLE IF NOT EXISTS`:
```
grep -c "^CREATE TABLE \`" backend/data/migration_full.sql
```
→ phải = 0 kết quả.

**A14. ORM static method bypass hooks:**
Nếu model có hooks (`afterUpdate`, `afterCreate`, `beforeDestroy`…) xử lý cache invalidation, computed field, audit log, search index → KHÔNG dùng `Model.update({...}, { where })` static method — phải dùng `instance.update({...})`. Static method không trigger hooks.

**A15. External service thiếu timeout:**
```
grep -n "axios\.\|fetch(\|nodemailer\|\.connect(\|\.publish(" <file vừa sửa>
```
Mọi call ra ngoài process phải có `timeout:` tường minh. Phải có try/catch với fallback value hoặc `AppError` rõ ràng — không được silent return null/undefined mà không log warning.

**A16. Data flow field name mismatch giữa các nguồn:**
Nếu function nhận data từ ≥2 nguồn (DB + cache, DB + external API, DB + queue, DB + request body) → grep field names ở TỪNG nguồn để xác nhận tên giống nhau trước khi dùng. Dùng `??` fallback (`obj.fieldA ?? obj.fieldB`) khi tên có thể khác nhau giữa nguồn.

**A17. Function parameter khai báo nhưng không dùng:**
Đọc signature của mỗi function mới/sửa — mỗi parameter phải được dùng thực sự trong body. Dấu hiệu: parameter có default value nhưng body hardcode cùng giá trị đó → parameter bị ignore hoàn toàn.

**A18. `require()` nằm trong function body:**
```
grep -n "= require(" <file vừa sửa>
```
`require()` trong function body → chuyển lên top of file. Exception duy nhất được phép: lazy-require tránh circular dependency — phải có comment giải thích rõ.

**A19. Webhook/callback handler thiếu idempotency check:**
```
grep -rn "webhook\|callback\|notify" backend/src/routes/ backend/src/controllers/
```
Mọi handler nhận event từ hệ thống ngoài phải check idempotency bằng external reference ID trước khi xử lý. Không có → retry từ provider gây duplicate processing.

**A20. Raw SQL dùng PostgreSQL syntax trong MySQL project:**
```
grep -rn "ILIKE\|::[a-z]\|RETURNING\b" backend/src/
```
→ phải = 0 kết quả. Dùng MySQL equivalent: `LIKE`, `CAST()`, `CONCAT()`, `DATEDIFF()`.

**A21. Async route handler thiếu try/catch và next(err):**
```
grep -rn "async (req, res)" backend/src/controllers/
```
Mọi kết quả phải có try/catch với `next(err)` trong catch block (hoặc dùng `asyncHandler` wrapper).

**A22. `process.env.*` dùng trực tiếp không có fallback hoặc startup validation:**
```
grep -rn "process\.env\." backend/src/
```
Mọi `process.env.X` phải có: (a) `|| 'default'` / `?? value` cho optional vars, hoặc (b) validate/throw tường minh lúc startup cho required vars.

**A23. File upload thiếu MIME type, size validation, và path traversal:**
```
grep -rn "multer\|upload\.single\|upload\.array\|upload\.fields" backend/src/
```
Mọi multer instance phải có `limits: { fileSize }` và `fileFilter` kiểm tra `mimetype`. Khi `req.params.*` dùng trong `path.join()`:
```
grep -rn "path\.join.*req\.\|path\.resolve.*req\." backend/src/
```
→ phải dùng `path.basename()` để sanitize + verify resolved path nằm trong expected directory.

**A24. Deprecated API — `new Buffer()` thay bằng `Buffer.from()`:**
```
grep -rn "new Buffer(" backend/src/
```
→ phải = 0 kết quả. Thay bằng `Buffer.from(data, encoding)`.

**A25. Sensitive fields bị trả về trong API response:**
Với mỗi query trả Model ra `res.json()` — nếu model chứa sensitive data (password, token, OTP, secret key…) → phải có `attributes: { exclude: [...] }` hoặc `.toSafeJSON()` tường minh.
```
grep -n "findByPk\|findAll\|findOne" <file vừa sửa>
```

**A26. Error message chứa internal details trả về API response:**
```
grep -n "res\.json.*err\.\|err\.message.*res\.\|err\.stack" <file vừa sửa>
```
Không được trả trực tiếp `err.message`, `err.stack`, hay Sequelize error text ra `res.json()` — lộ tên bảng, tên cột, internal paths. Pattern đúng: dùng `next(err)` để chuyển sang error middleware, hoặc trả message chung. Exception: `process.env.NODE_ENV !== 'production'` guard cho dev debug.

---

#### B. Frontend — components, pages, hooks, slices, utils

**B1. Stale closure sau `await`:**
Biến từ `useSelector(...)` hay `useState(...)` được khai báo TRƯỚC `await` → sau `await` biến đó stale. Fix: dùng `useRef` để luôn trỏ giá trị hiện tại, hoặc dispatch action thay vì merge thủ công.

**B2. Side effects trong Redux reducers:**
```
grep -n "localStorage\|sessionStorage\|fetch\|axios\|Date\.now\|Math\.random\|console\." <*Slice.ts vừa sửa>
```
→ phải = 0 kết quả. Reducer phải là pure function — side effects đặt trong thunk hoặc `useEffect`.

**B3. Double submission — form trigger 2 lần:**
Form có `onSubmit` handler → button submit KHÔNG được có thêm `onClick` handler riêng. Nếu cần `onClick` → dùng `type="button"`.

**B4. `useEffect` thiếu cleanup:**
```
grep -n "useEffect\|setInterval\|setTimeout\|addEventListener\|\.on(" <file vừa sửa>
```
Mọi `useEffect` khởi tạo subscription, listener, timer, WebSocket → phải có `return () => { cleanup }`.

**B5. TypeScript required field không khớp backend response:**
Required field (không có `?`) trong interface phải LUÔN được backend gán. Optional array → backend phải trả `[]` không phải `null`. Sau khi sửa:
```
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

**B6. `dangerouslySetInnerHTML` không qua DOMPurify:**
```
grep -rn "dangerouslySetInnerHTML" frontend/src/
```
Mọi kết quả phải dùng `{ __html: DOMPurify.sanitize(content) }`.

---

#### C. Shared — mọi file

**C1. Hardcoded string user-visible — i18n violation:**
```
grep -n "\"[^\"]\{3,\}\"\|'[^']\{3,\}'" <file .tsx/.ts vừa sửa>
```
Bất kỳ string tiếng Việt/Anh user-visible nằm ngoài `t(...)` → vi phạm. Key mới phải tồn tại trong CẢ `en.json` VÀ `vi.json`.

**C2. Comment không phải tiếng Việt:**
```
grep -n "//" <file vừa sửa>
```
Comment tiếng Anh thuần → dịch sang tiếng Việt. Không xóa — chỉ dịch.

**C3. Endpoint mới thiếu test — Rule 30:**
```
grep -rn "<path endpoint>" backend/src/__tests__/
```
Phải có ≥3 tests: happy path (200/201), validation boundary (422/400), auth check (401).

**C4. Reference cũ còn sót sau rename:**
```
grep -rn "<tên cũ>" backend/src/ frontend/src/
```
Phải = 0 kết quả.

---

**Chỉ sau khi cả 2 lớp pass hoàn toàn** → mới được commit và push lên GitHub.

**Lý do Layer 2 tồn tại:** Automated tests chạy qua mock và chỉ verify behavior đã được dự đoán — chúng không phát hiện stale closure, race condition, N+1 query, missing await, blocking I/O, cache miss, hay unused param. Mọi item trong Layer 2 tương ứng với ít nhất một bug đã thực sự xảy ra trong project này.

---

## P1 — Security (không có ngoại lệ — vi phạm = breach hoặc data corruption)

## Rule 17 — NGHIÊM CẤM log sensitive data (BẮT BUỘC)

Trong mọi file server (controllers, services, middleware, routes):
- **NGHIÊM CẤM:** `console.log`, `console.error`, hoặc bất kỳ logger nào với data chứa: password, token, OTP, secret key, thông tin thanh toán, hoặc PII (email, số điện thoại, địa chỉ)
- **NGHIÊM CẤM:** log toàn bộ `req.body` hoặc `req.headers`
- **BẮT BUỘC:** nếu cần log để debug → whitelist từng field không nhạy cảm

**Cách phát hiện:** `grep -rn "console\.log\|console\.error" backend/src/` → review từng kết quả.

## Rule 21 — Validate input tại API boundaries trước khi xử lý (BẮT BUỘC)

Mọi data từ `req.body`, `req.params`, `req.query` đều không tin cậy — phải validate trước khi đưa vào business logic hoặc DB.

- **BẮT BUỘC:** kiểm tra required fields tồn tại và đúng kiểu trước khi dùng — return 400/422 nếu thiếu hoặc sai
- **NGHIÊM CẤM:** truyền trực tiếp `req.body.*` vào query DB mà không check

**Cách phát hiện vi phạm:** Grep `req\.body\.\|req\.params\.\|req\.query\.` trong controllers — nếu field được dùng ngay trong query/create mà không có kiểm tra trước đó → cần thêm validation.

---

## P2 — Data Integrity (silent data loss nếu vi phạm)

## Rule 15 — DB schema changes phải dùng migration (BẮT BUỘC)

- **BẮT BUỘC:** tạo migration file trong `backend/src/migrations/` — format: `YYYYMMDDnn-mô-tả-ngắn.js`; phải có cả `up` và `down`
- **BẮT BUỘC:** `YYYYMMDD` = ngày thực tế hôm nay (không phải ngày mai hay ngày tương lai); `nn` = số thứ tự 2 chữ số tăng dần trong cùng ngày (01, 02, 03…). Nếu đã có `2026050405` thì tiếp theo là `2026050406` — KHÔNG nhảy sang `2026050501`
- **CŨNG BẮT BUỘC:** cập nhật `backend/data/migration_full.sql`
- **NGHIÊM CẤM:** bật lại `sequelize.sync()` trong server.js (đã tắt vì lỗi "Too many keys")
- **NGHIÊM CẤM:** sửa schema bằng `ALTER TABLE` thủ công không có migration

## Rule 16 — Transaction cho mọi multi-step DB write (BẮT BUỘC)

Khi một operation thực hiện ghi vào ≥2 bảng hoặc ≥2 câu INSERT/UPDATE/DELETE có quan hệ logic với nhau:
- **BẮT BUỘC:** bọc toàn bộ trong `sequelize.transaction(async (t) => { ... })`
- **BẮT BUỘC:** truyền `{ transaction: t }` vào **mọi** query bên trong block

**Concurrent read-then-write:** thêm `lock: t.LOCK.UPDATE` khi `findByPk`/`findOne` bên trong transaction để tránh race condition.

## Rule 27 — Bắt buộc await mọi async write (BẮT BUỘC)

Mọi lời gọi async có side effect phải được `await`. Exception duy nhất: fire-and-forget analytics không critical — phải có comment `// fire-and-forget: không cần đợi kết quả`.

**Cách phát hiện:** Grep `^\s*[a-zA-Z].*Service\.[a-zA-Z]*\(` trong `backend/src/` — nếu dòng không bắt đầu bằng `await` và là write operation → vi phạm.

## Rule 28 — ORM static method vs instance method — hook behavior khác nhau (BẮT BUỘC)

- **`Model.update({ ... }, { where })`** — static method: **KHÔNG trigger** `beforeUpdate`/`afterUpdate` hooks
- **`instance.update({ ... })`** — instance method: trigger hooks bình thường
- **Nếu hooks chứa logic quan trọng** (cache invalidation, computed field, audit log) → **BẮT BUỘC dùng instance method**

## Rule 11 — Data flow consistency (BẮT BUỘC)

Khi function nhận data từ nhiều nguồn (DB + external API, DB + cache…):
1. Liệt kê tất cả data sources
2. Grep field names ở TỪNG nguồn — không giả định tên giống nhau
3. Dùng `??` fallback: `obj.fieldA ?? obj.fieldB`
4. Verify cả 2 nhánh

## Rule 24 — Idempotency cho external callback handlers (BẮT BUỘC)

Handler nhận callback từ hệ thống ngoài (payment webhook, email bounce…):
- **BẮT BUỘC:** check idempotency bằng external reference ID trước khi xử lý
- **BẮT BUỘC:** nếu đã xử lý → return sớm, không xử lý lại

---

## P3 — Testing Gates (bằng chứng code hoạt động đúng)

## Rule 30 — Test bắt buộc cho mọi API endpoint mới (BẮT BUỘC)

- **BẮT BUỘC:** mỗi endpoint mới → ≥3 test cases: happy path (200/201), input không hợp lệ (400/422), unauthorized (401/403)
- **BẮT BUỘC:** test edge cases: 404 (not found), 409 (conflict), 429 (rate limit) — tùy endpoint
- **NGHIÊM CẤM:** commit endpoint mới mà không có test

**Cách kiểm tra:** Grep tên route path trong `backend/src/__tests__/` — không tìm thấy → vi phạm.

## Rule 14 — Integration tests cho endpoint/service mới (BẮT BUỘC)

1. Thêm test vào `backend/src/__tests__/`
2. Chạy `cd backend && npm test` — phải pass 100% trước khi commit
3. Cover: happy path, error path, edge cases

## Rule 22 — Test isolation: mỗi test tự setup và teardown (BẮT BUỘC)

- **BẮT BUỘC:** dùng `beforeEach`/`afterEach` để seed và cleanup test data
- **NGHIÊM CẤM:** test phụ thuộc vào data từ test khác hoặc phụ thuộc vào thứ tự chạy

---

## P4 — Code Quality (discipline hàng ngày)

## Rule 8 — Comment code (BẮT BUỘC)

**Ngôn ngữ: BẮT BUỘC tiếng Việt.** Khi sửa file có comment tiếng Anh: dịch ngay trong cùng lần sửa.

**Phải comment khi:** function ≥5 dòng, logic phức tạp, workaround/hack, API endpoint, TypeScript interface phức tạp, mọi `sequelize.literal()`/raw SQL/regex phức tạp.

**KHÔNG ghi số bug/phase trong ngoặc:** xóa `(Fix 9.xx)` nhưng PHẢI GIỮ nội dung giải thích.

## Rule 9 — Cập nhật references khi đổi tên (BẮT BUỘC)

1. `Grep` toàn bộ `backend/src/` và `frontend/src/` tìm tên cũ
2. Cập nhật từng reference
3. Verify lại bằng `Grep` lần nữa — phải = 0 kết quả tên cũ

## Rule 10 — Phát hiện bug → fix ngay, cập nhật plan.md (BẮT BUỘC)

1. Dừng ngay công việc đang làm
2. Báo cáo ngay cho user
3. Cập nhật plan.md — thêm mô tả bug và fix
4. Fix bug hoàn toàn — không để "TODO: fix sau"
5. Verify 100% — không có regression
6. Không tiếp tục phase mới khi còn bug chưa fix

## Rule 12 — TypeScript interface completeness (BẮT BUỘC)

1. Grep tên TypeScript interface tương ứng trong `frontend/src/`
2. Liệt kê mọi **required field** (không có `?`)
3. Grep backend xác nhận từng required field LUÔN được gán
4. Sau thay đổi: chạy `cd frontend && npx tsc --noEmit 2>&1 | head -50`

## Rule 23 — API response format nhất quán (BẮT BUỘC)

**TRƯỚC KHI** viết endpoint mới: Grep convention hiện tại. Dùng `{ status: 'success', data: ... }` cho success, `{ status: 'error', message: ... }` cho error — **NGHIÊM CẤM** tự đặt format riêng.

---

## P5 — Performance & Correctness at Scale

## Rule 13 — Không dùng blocking I/O trên server main thread (BẮT BUỘC)

**NGHIÊM CẤM:** `execSync`, `spawnSync`, `readFileSync`, `writeFileSync`, `appendFileSync` trong bất kỳ file load bởi server. Exception: `backend/scripts/*.js`.

**Cách detect:** `grep -rn "execSync\|spawnSync\|readFileSync\|writeFileSync\|appendFileSync" backend/src/` → phải = 0.

## Rule 18 — Dùng eager loading, tránh N+1 query (BẮT BUỘC)

**NGHIÊM CẤM:** gọi query DB bên trong `for`, `forEach`, `.map()`. **BẮT BUỘC:** dùng `include: [{ model: RelatedModel }]`.

## Rule 19 — Pagination bắt buộc cho mọi list endpoint (BẮT BUỘC)

Mọi `findAll`/`findAndCountAll` trong user-facing controller phải có `limit` + `offset`. `limit` phải có default và max cap.

```js
const limit = Math.min(parseInt(req.query.limit) || 20, 100);
```

## Rule 25 — Raw SQL phải dùng đúng MySQL syntax (BẮT BUỘC)

**NGHIÊM CẤM dùng trong MySQL project:**
- `ILIKE` → dùng `LIKE` hoặc `LOWER(field) LIKE LOWER(?)`
- `::type` casting → dùng `CAST(field AS UNSIGNED)`, `CAST(field AS CHAR)`
- `RETURNING` clause → dùng `LAST_INSERT_ID()`
- `||` để nối chuỗi → dùng `CONCAT(a, b)`
- `date1 - date2` → dùng `DATEDIFF(date1, date2)`

**Cách phát hiện:** `grep -rn "ILIKE\|::[a-z]\|RETURNING\|sequelize\.query\|sequelize\.literal" backend/src/`

## Rule 20 — Async error handling: mọi route handler phải dùng try/catch (BẮT BUỘC)

Mọi `async (req, res` trong controllers phải có `next` và bọc trong try/catch với `next(err)` trong catch. Hoặc dùng `asyncHandler` wrapper.

## Rule 26 — Cache invalidation sau mọi write operation (BẮT BUỘC)

Sau mọi create/update/delete → xóa đủ **mọi variant** của cache key liên quan. **NGHIÊM CẤM** thêm cache cho read endpoint mà không thêm invalidation vào write endpoints tương ứng.

## Rule 29 — External service calls phải có timeout và graceful fallback (BẮT BUỘC)

Mọi HTTP call ra ngoài phải có `timeout` tường minh. Bọc trong try/catch với: (a) fallback value, hoặc (b) `AppError` rõ ràng. **NGHIÊM CẤM** silent return null/undefined mà không log warning.

---

## P6 — Workflow Tools (efficiency, không phải correctness)

## Rule 1 — Đọc file: tối thiểu hóa token

Luôn `Grep`/`Glob` trước để xác định file + dòng cụ thể. Dùng `Read` với `offset` + `limit` — không đọc file >150 dòng/lần.

## Rule 2 — Quy trình sửa từng file

```
Grep → Read offset/limit → Edit → Verify (grep lại)
```
Không đọc nhiều file cùng lúc rồi tổng hợp.

## Rule 4 — Double-check gate (BẮT BUỘC — 2 bước theo thứ tự)

**Bước 1 — Self-review TRƯỚC khi chạy AC:**
- [ ] Comments & i18n: không có comment tiếng Anh, không có hardcoded string
- [ ] Data flow consistency: field names đúng ở TỪNG nguồn, dùng `??` fallback
- [ ] HTTP status codes: khớp đúng với AC trong plan.md
- [ ] TypeScript required fields: mọi required field LUÔN được gán
- [ ] Code paths đầy đủ: trace từng nhánh end-to-end
- [ ] Blocking I/O: `grep -rn "execSync\|spawnSync\|readFileSync\|writeFileSync\|appendFileSync" backend/src/` = 0
- [ ] Backend tests pass: `cd backend && npm test` pass 100%
- [ ] Frontend TypeScript: `cd frontend && npx tsc --noEmit` pass 0 errors

**Bước 2 — Chạy tất cả AC checks:** Fail → fix trước, không chuyển phase.

## Rule 4.1 — Git commit & push format (BẮT BUỘC)

**Prefix hợp lệ:**
| Prefix | Dùng khi nào |
|---|---|
| `Hoàn thành Phase N — <tên>` | Hoàn thành toàn bộ một phase |
| `Bugfix Phase N — <mô tả>` | Sửa bug sau khi phase đã commit |
| `Fix Phase N — <mô tả>` | Fix nhỏ trong phase |
| `Cập nhật <thứ gì> — <mô tả>` | Cập nhật file meta: plan.md, AGENT_RULES.md |
| `Thêm <thứ gì> — <mô tả>` | Thêm thứ mới nhỏ lẻ |
| `Bổ sung <thứ gì> — <mô tả>` | Bổ sung vào thứ đã tồn tại |

**Quy tắc bắt buộc:**
- **Separator:** BẮT BUỘC dùng ` — ` (em dash). NGHIÊM CẤM dùng `:` hay `-`
- **Subject:** tối đa 72 ký tự, tiếng Việt, không dấu chấm cuối
- **Dòng 2:** để trống nếu có body
- **Body phase completion:** subsections `N.X. Tên nhóm`, mỗi section ≥1 bullet `-`
- **Body commit nhỏ:** số thứ tự `1.` `2.` `3.`, không dùng subsections
- **Git user BẮT BUỘC:** `MinhThang1009`
- **KHÔNG thêm Co-Authored-By Claude**
- `git add` từng file cụ thể — KHÔNG dùng `git add -A`
- Sau commit: `git push origin main`

## Rule 5 — Context management

Sau mỗi phase: `/compact`. Session mới: paste đúng section "PHASE X" từ plan.md. **Không cần paste toàn bộ plan.md — chỉ paste phase đang làm.**

## Rule 6 — Lệnh Claude Code CLI

- `/compact` — nén context khi sắp đầy
- `/clear` — xóa toàn bộ context
- `Ctrl+C` — interrupt command đang chạy quá lâu
- `/cost` — xem token usage hiện tại

## Rule 7 — Khi gặp blocker

Server crash → `git checkout -- <file>` ngay. Không chắc → dừng, hỏi user. Context >80% → `/compact`.

## Rule 33 — Module mới phải dùng generator (Phase 42 sustainability)

Khi cần thêm module backend mới (vd `referrals`, `subscriptions`): **DÙNG `node scripts/new-module.mjs --name=<name> --type=simple|ddd-lite`**. KHÔNG copy thủ công folder hoặc tạo tay từng file.

- Generator validate trùng module name + Domain Glossary forbidden term + tạo cấu trúc 3-layer chuẩn (controllers, services, repositories với interface + impl, models, routes, validators, dtos, module.js).
- `--type=ddd-lite` thêm `domain/{aggregates, events, policies}/` cho 5 module phức tạp (orders/payment/ai/inventory/chat).
- Sau generate: implement TODO trong files, viết integration test theo Rule 30, mount module router trong `server.js` theo hướng dẫn console output.

## Rule 34 — Pre-commit hook KHÔNG được bypass (`--no-verify`)

Hook `.husky/pre-commit` chạy `scripts/audit-architecture.sh` block 3 violation: service import Sequelize/Model, controller touch ORM, cross-module deep import.

- Nếu hook fail: **fix root cause**, KHÔNG bypass `git commit --no-verify`.
- Exception duy nhất: hot-fix production khẩn cấp khi user explicit yêu cầu — phải document lý do trong commit message.
- Bypass mà không có lý do = vi phạm Rule 4 double-check gate.

## Rule 35 — Pattern kiến trúc mới phải document + tooling

Khi thêm pattern mới (vd CQRS, Event Sourcing, GraphQL layer):

1. UPDATE `docs/NAMING_CONVENTION.md` (hoặc 1 trong 3 file con `docs/naming/*.md`) với convention.
2. UPDATE `docs/MODULE_GUIDE.md` (nếu có) hoặc tạo mới với folder structure đích.
3. THÊM ESLint rule tương ứng vào `backend/eslint.config.js` hoặc `frontend/.eslintrc.cjs`.
4. THÊM check vào `scripts/audit-architecture.sh` nếu enforce được qua git diff.

KHÔNG "smuggle" pattern mới mà không document — code reviewer/future-self không biết intent → drift sẽ xảy ra ngay.
