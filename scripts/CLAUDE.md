# Root Scripts — TechStore

← Quay lại [`CLAUDE.md`](../CLAUDE.md)

> Maintenance scripts ở cấp root (không thuộc backend/frontend riêng). Chạy từ project root.

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. Scripts](#2-scripts)
  - [2.1 audit-architecture.sh](#21-audit-architecturesh)
  - [2.2 check-i18n.js](#22-check-i18njs)
  - [2.3 lint-migrations.sh](#23-lint-migrationssh)
  - [2.4 new-module.mjs](#24-new-modulemjs)
  - [2.5 fix-commit-msg.sh](#25-fix-commit-msgsh)
  - [2.6 msg-editor.py](#26-msg-editorpy)
  - [2.7 seq-editor.py](#27-seq-editorpy)
  - [2.8 rewrite-commits.py](#28-rewrite-commitspy)
- [3. Integration với CI & Husky](#3-integration-với-ci--husky)
- [4. Key Gotchas](#4-key-gotchas)

---

# 1. Tổng quan

| File | Mục đích | Khi nào dùng |
|---|---|---|
| `audit-architecture.sh` | Pre-commit hook — chặn vi phạm modular monolith | Auto via Husky pre-commit; hoặc manual |
| `check-i18n.js` | Verify keys khớp giữa `vi.json` ↔ `en.json` (cả BE + FE) | Khi thêm/xóa i18n keys |
| `lint-migrations.sh` | Kiểm tra: migration có `down()`, rollback | CI + trước khi PR |
| `new-module.mjs` | Tạo backend module mới từ template | Khi thêm module mới |
| `fix-commit-msg.sh` | Helper sửa commit message theo Conventional Commits | Khi commit message sai format |
| `msg-editor.py` | Edit commit message trong interactive rebase | Git history cleanup |
| `seq-editor.py` | Edit todo sequence trong interactive rebase | Git history cleanup |
| `rewrite-commits.py` | Rewrite commit history (filter-branch wrapper) | Git history cleanup |

---

# 2. Scripts

## 2.1 audit-architecture.sh

Pre-commit hook chính — chạy tự động mỗi `git commit` via `.husky/pre-commit`.

**4 rules được kiểm tra:**

| Rule | Pattern bị block | Severity |
|---|---|---|
| RULE 1 | Service `require('sequelize')` hoặc `Model.findAll()` trực tiếp trong `modules/*/services/*.js` | Block commit |
| RULE 2 | Controller `require('sequelize')` hoặc `Model.findAll()` trong `modules/*/controllers/*.js` | Block commit |
| RULE 3 | Cross-module deep import: `require('../../{otherModule}/services\|repositories\|domain')` từ bất kỳ file trong `modules/` | Block commit |
| RULE 4 | Frontend deep import bypass barrel: `from '@/features/{name}/components\|pages\|hooks\|api\|store'` từ feature khác | Warn only |

```bash
# Cách dùng
# Auto: chạy khi git commit
git commit -m "feat(orders): ..."

# Manual: kiểm tra trước khi commit
bash scripts/audit-architecture.sh
```

**Bypass:** KHÔNG dùng `git commit --no-verify`. Fix violation, không skip.

## 2.2 check-i18n.js

Kiểm tra tất cả i18n keys có mặt trong cả 2 locale files.

```bash
node scripts/check-i18n.js
# Output: list keys thiếu trong vi.json hoặc en.json
```

**Scope kiểm tra:**
- `frontend/src/locales/vi.json` ↔ `frontend/src/locales/en.json`

**Khi nào chạy:**
- Trước khi commit khi thêm/xóa i18n keys
- Khi merge branch có thể conflict trong locale files

**Lưu ý:** kiểm tra key parity — không phát hiện dead keys (key có trong JSON nhưng không dùng trong code).

## 2.3 lint-migrations.sh

Kiểm tra tất cả migration files trong `backend/src/migrations/`.

```bash
bash scripts/lint-migrations.sh
# Output: migrations thiếu down() rollback
# ✅ Tất cả N migrations đều có rollback method
```

**Kiểm tra:** có `async down` / `exports.down` / `down:` trong mỗi file migration.

**Chạy trong CI:** `.github/workflows/ci.yml` → step "Lint migrations" — fail CI nếu có migration thiếu `down()`.

## 2.4 new-module.mjs

Tạo backend module mới từ template. **Luôn dùng script này thay vì copy thủ công.**

```bash
node scripts/new-module.mjs --name=<name> --type=simple|ddd-lite
```

**Output (ddd-lite):**
```
backend/src/modules/<name>/
  module.js                              ← DI factory
  routes.js                              ← Express router
  controllers/<name>-controller.js
  services/<name>-service.js
  repositories/i-<name>-repository.js   ← Interface
  repositories/sequelize-<name>-repository.js
  dtos/<name>-dto.js
  validators/<name>-validator.js
  CLAUDE.md
```

**Types:**

| Type | Mô tả | Khi nào dùng |
|---|---|---|
| `simple` | Module nhỏ: 1 service, 1 controller, 1 router, không DI repository | Feature đơn giản, không query DB phức tạp |
| `ddd-lite` | Full DI pattern: Controller/Service/Repository/Module factory | Recommended cho hầu hết modules |

**Sau khi scaffold:**
1. Thêm module vào `backend/src/app.js` (DI wiring + `subscribeEvents()` + mount router)
2. Thêm vào `backend/CLAUDE.md` bảng modules
3. Tạo tests (unit + integration)
4. Cập nhật root `CLAUDE.md` section 1.1 và 9

**Validation:** script reject nếu name trùng existing module hoặc dùng term cấm theo Domain Glossary (`customer`, `buyer`, `coupon`, `purchase`, `transaction`...).

## 2.5 fix-commit-msg.sh

Helper sửa commit message cuối cùng (amend) hoặc batch fix cho Conventional Commits format.

```bash
bash scripts/fix-commit-msg.sh
```

## 2.6 msg-editor.py

Edit commit message trong interactive rebase (`GIT_SEQUENCE_EDITOR`).

```bash
GIT_SEQUENCE_EDITOR="python scripts/msg-editor.py" git rebase -i HEAD~10
```

## 2.7 seq-editor.py

Edit todo sequence trong interactive rebase — tự động squash/reword commits.

```bash
GIT_SEQUENCE_EDITOR="python scripts/seq-editor.py" git rebase -i HEAD~10
```

## 2.8 rewrite-commits.py

Wrapper `git filter-branch` để rewrite subject cũ → Conventional Commits format.

```bash
python scripts/rewrite-commits.py
```

**Cảnh báo:** chỉ dùng trên branch chưa push lên remote. Không rewrite history đã share — xem `git-workflow.md §Forbidden Commands`.

---

# 3. Integration với CI & Husky

```
.husky/pre-commit
  ├→ bash scripts/audit-architecture.sh    ← RULE 1-4: block commit nếu vi phạm kiến trúc
  ├→ npx lint-staged (frontend)            ← ESLint + Prettier cho staged FE files
  ├→ npx tsc --noEmit (frontend)           ← TypeScript check
  └→ npx lint-staged (backend)             ← ESLint + Prettier cho staged BE files

.husky/commit-msg
  └→ validate Conventional Commits format ← không gọi scripts/ trực tiếp

.husky/pre-push
  ├→ npm run build (frontend)              ← Build check
  ├→ npm test (backend)                    ← Unit tests
  └→ npm test (frontend)                   ← Component tests

.github/workflows/ci.yml
  └→ bash scripts/lint-migrations.sh       ← Step "Lint migrations" trong CI backend job
     (chạy ở repo root, không trong backend/)
```

---

# 4. Key Gotchas

- **Path làm việc:** tất cả bash/python scripts phải chạy từ **project root**, không từ `scripts/`. CI cũng chạy từ root (không có `working-directory: scripts`).
- **Python scripts:** cần Python 3.8+. Windows: `python` (không phải `python3`). Git Bash trên Windows: `python3` hoặc `py`.
- **Bash scripts trên Windows:** chạy qua Git Bash hoặc WSL. Native CMD không support bash.
- **`new-module.mjs`:** chỉ tạo backend module. Frontend feature scaffold làm thủ công (chưa có script).
- **`audit-architecture.sh`** scan `backend/src/` — chỉ áp dụng cho backend JS files. Frontend không có architecture audit pre-commit (chỉ lint-staged).
- **`check-i18n.js`** kiểm tra keys parity — không kiểm tra keys có được dùng trong code (dead keys vẫn pass).
- **Thêm script mới:** cập nhật bảng "Tổng quan" ở mục 1 và section mô tả tương ứng. Nếu script được gọi từ CI/Husky → thêm vào mục 3.
