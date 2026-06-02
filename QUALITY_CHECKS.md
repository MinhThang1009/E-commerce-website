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
`backend/stryker.conf.json` + `npm run test:mutation`. Đột biến code (đổi `>` thành `>=`, xóa dòng...)
rồi chạy test; nếu test **vẫn pass** → test yếu, chưa thực sự assert. **Chậm** → chạy định kỳ, không pre-commit.
Scope mặc định: `services/**` + `shared/**`. Giới hạn: `npm run test:mutation -- --mutate 'src/modules/orders/**/*.js'`.

## Lưu ý
- Coverage threshold toàn cục (jest.config) vẫn còn — bắt tụt coverage tổng. Patch-coverage bổ sung cho code MỚI.
- Pre-push (`.husky/pre-push`) vẫn chạy full test BE+FE + build trước khi push.
- Các cơ chế informational (knip, check:routes) **không** chặn build — để review, tránh nhiễu FP làm kẹt CI.
