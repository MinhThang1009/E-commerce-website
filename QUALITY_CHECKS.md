# Cơ chế tự kiểm khi thêm/sửa/xóa tính năng & fix bug

> Bổ sung để PHÁT HIỆN sớm vấn đề khi thay đổi code. Mỗi cơ chế nhắm một loại "thiếu sót" khác nhau.

## Tổng quan — dùng khi nào

| Tình huống | Cơ chế bắt được | Lệnh / nơi chạy |
|---|---|---|
| **Sửa/fix** làm vỡ logic cũ | Pre-commit chạy test liên quan | tự động khi `git commit` (hoặc `npm run test:related -- <file>`) |
| **Thêm** code mới quên viết test | Patch-coverage gate (BE **và** FE) | CI job `patch-quality` trên PR (hoặc `npm run check:patch-coverage` ở mỗi package) |
| **Xóa** tính năng để lại file/export chết | knip (dead code) — BE **và** FE | `cd frontend && npm run check:unused` · `cd backend && npm run check:unused` |
| **Xóa/đổi** API để lại endpoint không ai gọi | check:routes | `cd backend && npm run check:routes` |
| Test **yếu** (phủ nhưng assert hời hợt) | Stryker mutation | `cd backend && npm run test:mutation` (định kỳ, chậm) |
| **.md stale** (module đổi code, CLAUDE.md không cập nhật) | doc-freshness check | tự động (pre-commit, warn) · `node scripts/check-doc-freshness.mjs` |

## Chi tiết

### 1. Pre-commit: chạy test liên quan
`.husky/pre-commit` (bước 5): với file `*.js` (backend) / `*.ts(x)` (frontend) đang staged →
chạy `jest --findRelatedTests`. Test vỡ → **chặn commit**. Bắt regression ngay lúc sửa/fix.
Bỏ qua khi thật cần: `git commit --no-verify`.

### 2. Patch-coverage gate (CI, PR) — cả BE và FE
`backend/scripts/check-patch-coverage.mjs` + `frontend/scripts/check-patch-coverage.mjs` + job CI `patch-quality`.
Chỉ xét file source **đổi so với base**, chạy test liên quan + đo coverage,
**FAIL nếu file đổi < 80% lines hoặc không có test nào phủ**.
→ Chặn "thêm tính năng/sửa code mà quên test" ở cả 2 phía. Chỉnh ngưỡng: `PATCH_COV_THRESHOLD`.
Local: `PATCH_BASE=main npm run check:patch-coverage` (chạy trong `backend/` và `frontend/`).

### 3. knip — dead code (cả BE và FE)
`frontend/knip.json` + `backend/knip.json`, `npm run check:unused` mỗi package. Liệt kê file/export/dependency
**không còn ai dùng** → phát hiện rác khi xóa tính năng. Informational (`--no-exit-code`).
FP thường gặp: shadcn/ui re-exports (FE); CommonJS + interface/DTO patterns (BE noisier — đã ignore bớt qua `knip.json`).

### 4. check:routes — API thừa/orphan (backend)
`backend/scripts/check-unused-routes.mjs` + `npm run check:routes`. Đối chiếu endpoint backend với
cách gọi ở frontend → báo endpoint **không nơi nào gọi** (loại webhook/oauth/cron). Heuristic — review trước khi xóa.
Cũng chạy trong CI job `patch-quality` (informational).

### 6. doc-freshness — chống .md stale
`scripts/check-doc-freshness.mjs` (wire trong `.husky/pre-commit` bước 6, warn-only). Khi file trong
`backend/src/modules/<m>/**` hoặc `frontend/src/features/<f>/**` đổi mà **CLAUDE.md của module/feature đó
KHÔNG nằm trong changeset** → nhắc xem lại. **KHÔNG auto-sync** (auto-rewrite docs dễ drift sai) — chỉ phát hiện.
CI: chạy với `CHECK_BASE=origin/main`. Gate cứng: `DOC_FRESH_STRICT=1`.
> Auto-sync thật (regenerate .md từ code) cố tình KHÔNG làm — review thủ công an toàn hơn.

### 5. Stryker — mutation testing (backend, định kỳ)
`backend/stryker.conf.json` (break=null, báo cáo) + `backend/stryker.critical.conf.json` (break=70, FAIL pipeline).
Đột biến code (đổi `>` thành `>=`, xóa dòng...) rồi chạy test; nếu test **vẫn pass** → test yếu, chưa thực sự assert.
**Chậm** → chạy định kỳ, không pre-commit.

**Chạy per-module (gotcha — BẮT BUỘC đọc trước khi chạy):**
```bash
npx stryker run stryker.critical.conf.json --mutate "<ĐƯỜNG-DẪN-FILE-CHÍNH-XÁC>" --coverageAnalysis off
```
- `--coverageAnalysis off` **bắt buộc**: test dùng `jest.mock(path, factory)` inline → `perTest` instrument
  chèn `stryCov_` vào factory → babel-plugin-jest-hoist từ chối → dry-run sập.
- `--mutate` phải dùng **path file chính xác** (vd `src/modules/auth/services/auth-service.js`), KHÔNG dùng
  glob `**/*.js`: CLI `--mutate` **override** (drop) exclusion `!*.test.js` của config → nuốt cả file test
  làm mutation target → Stryker instrument `jest.mock` factory → lỗi "second argument must be an inline function".
  Nhiều file → liệt kê comma-separated exact paths.
- `enableFindRelatedTests: true` giới hạn test theo file mutate → không quá chậm dù `coverageAnalysis off`.

## Công thức 6 bước verify chất lượng test (chống "test pass nhưng vẫn có bug")

> Bối cảnh: coverage 99.7%+ KHÔNG đảm bảo code đúng (bug class F1/F2 lọt qua hàng nghìn test
> vì test assert "method được gọi" thay vì OUTCOME nghiệp vụ). 6 bước dưới mỗi bước bắt một
> loại thiếu sót khác nhau, dùng cho logic critical (tiền/kho/trạng-thái/thanh-toán):

1. **Invariant (oracle người duyệt)** — viết bất biến nghiệp vụ dạng `WHEN … THEN <outcome đo được>`,
   HUMAN duyệt (không tự seed từ code → tránh vòng tự-tham-chiếu). Nguồn: [`verify-workflow/invariants.ecommerce.md`](verify-workflow/invariants.ecommerce.md) (25 invariant GATE-A).
2. **Unit OUTCOME** — test assert **kết quả** (số tiền/tồn kho/status), KHÔNG tautological
   ("method called"). Vd: `qty===stock → cho đặt`; `categoryIds:[] → categoryId=null`.
3. **Integration (MySQL thật)** — gọi service THẬT + transaction + `SELECT FOR UPDATE` thật,
   assert outcome trong DB. Bắt lỗi tx/lock mà mock che mất. Vd: cancel → `stock += qty` thật.
4. **Property-based (fast-check)** — sinh HÀNG NGÀN input random, assert invariant với oracle
   độc lập (công thức cộng dồn thuần). Bắt edge case người viết test không nghĩ tới.
   Mẫu: `*-service.property.test.js` (cart `subtotal=Σ`, orders `total=Σ−discount+ship`, discount cap,
   inventory `restock cộng thuần` + `variant SUM-sync`). Verify "có răng": tạm mutate production
   (vd `+`→`-`) → property phải FAIL ngay; nếu vẫn pass = property vacuous.
5. **Mutation (Stryker)** — đột biến code rồi chạy test; survivor = test yếu. Đo ĐỘ MẠNH test.
   Xem §5 dưới + bảng baseline per-module.
6. **Review người** — survivor critical (tiền/kho/status) phải có người phân xử *code-sai hay test-yếu*;
   survivor display/plumbing/log-string → chấp nhận hoặc `// Stryker disable` có lý do.

**Thứ tự ưu tiên áp dụng:** module càng critical (tiền/kho) → càng cần đủ 6 bước. Module CRUD đơn giản
(wishlist/content/search-history/upload/image) → unit + integration là đủ; property dễ thành tautological.

## Bảng mutation score baseline per-module (đo 2026-06-04 → 2026-06-05)

> Gate `stryker.critical.conf.json` break=70. Đo TỪNG FILE/nhóm nhỏ (`--mutate` exact path, `--coverageAnalysis off`).
> Số là **mutation score %** (mutant bị giết / tổng mutant non-equivalent). Coverage line/branch ~100% toàn bộ.

**Module nghiệp vụ (17) + admin — tất cả ≥90%:**

| Module | Score | Module | Score | Module | Score |
|---|---|---|---|---|---|
| cart | 99.08 | auth | 98.71 | reviews | 99.43 |
| orders | 91.30 | users | 92.68 | wishlist | 95.89 |
| inventory | 100 | catalog | 94.75 | upload | 91.53 |
| discount-code | 100 | content | 100 | image | 91.92 |
| payment-service | 97.01 | attribute | 100 | momo | 92.06 |
| search-history | 100 | | | vnpay | 93.55 |

**Admin (7 file):** user-service 99.33 · order-service 100 · product-service 92.14 · product-import 93.59 · import-controller 96.34 · stats 99.58 · analytics 99.55.

**Module ai (11 file) — 2 nhóm rõ rệt:**

| File | Score | File | Score |
|---|---|---|---|
| language-detector | 100 | ai-service | 96 |
| ai-controller | 100 | fuzzy-expander | 77 ⚠️ |
| product-name-generator | 99 | chatbot-service | 69 ⚠️ |
| translate | 97 | keyword-fallback | 63 ⚠️ |
| prompt-builder | 96 | response-parser | 60 ⚠️ |
| | | ai-policy | 55 ⚠️ |

⚠️ = **trần cứng <90% do mật độ equivalent-mutant cao** (regex anchor/quantifier, fuzzy-match internal, string-variant) — KHÔNG phải test yếu: coverage 100%, hành vi verify đủ (abbrev/intent/injection OWASP). Giết tiếp = brittle-chase input bệnh lý. Thước đo đúng cho nhóm regex/thuật-toán = "hành vi verify đủ", không phải mutation %.

**Cross-cutting / infra:**

| Target | Score | Target | Score |
|---|---|---|---|
| src/services email | 75 | shared (errors+event-bus+uow) | 95 |
| src/services embedding | 94 | utils | 86 |
| src/services vector-store | 83 | middlewares + jobs | 85 |

**Bài học kill THẬT (assert OUTCOME, không tautological):** golden-string (pure fn output), `test.each` (regex/i18n/abbrev), assert request-shape (axios body/headers/timeout), `jest.isolateModules`+env (module-level const), winston capture-transport (KHÔNG spy `process.stdout` — flaky), fake-timers (date threshold). Verify survivor bằng offset col-1 CRLF-aware từ `mutation.json` (KHÔNG eyeball clean-sed) — xem [[project-stryker-false-survival]].

## Lưu ý
- Coverage threshold toàn cục (jest.config) vẫn còn — bắt tụt coverage tổng. Patch-coverage bổ sung cho code MỚI.
- Pre-push (`.husky/pre-push`) vẫn chạy full test BE+FE + build trước khi push.
- Các cơ chế informational (knip, check:routes) **không** chặn build — để review, tránh nhiễu FP làm kẹt CI.
