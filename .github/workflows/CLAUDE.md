# GitHub Workflows — TechStore

← Quay lại [`CLAUDE.md`](../../CLAUDE.md)

> 1 workflow chính: `ci.yml` — chạy trên push/PR. Dependabot tự động mở PRs mỗi tuần.

## Mục lục

- [1. CI Pipeline](#1-ci-pipeline)
  - [1.1 Triggers](#11-triggers)
  - [1.2 Jobs](#12-jobs)
  - [1.3 Coverage thresholds](#13-coverage-thresholds)
  - [1.4 Artifacts](#14-artifacts)
  - [1.5 Concurrency](#15-concurrency)
- [2. Dependabot](#2-dependabot)
- [3. Husky Hooks](#3-husky-hooks)
  - [3.1 pre-commit](#31-pre-commit)
  - [3.2 commit-msg](#32-commit-msg)
  - [3.3 pre-push](#33-pre-push)
- [4. Gotchas](#4-gotchas)

---

# 1. CI Pipeline

File: `.github/workflows/ci.yml`

## 1.1 Triggers

| Event | Branches | paths-ignore |
|---|---|---|
| `push` | `main`, `phase-*`, `feat/*`, `fix/*`, `refactor/*` | `**.md`, `docs/**`, `.github/ISSUE_TEMPLATE/**`, `.gitignore`, `LICENSE` |
| `pull_request` | target `main` | `**.md`, `docs/**` |

## 1.2 Jobs

3 jobs: `backend` và `frontend` chạy song song, `summary` chờ cả 2.

**Node version:** 22 (cả backend và frontend)

### Job: backend

`name: Backend (lint + test + coverage)`, `timeout-minutes: 20`, `runs-on: ubuntu-latest`

Steps theo thứ tự:

1. `actions/checkout@v4`
2. **Setup Node.js 22** — lưu npm từ `backend/package-lock.json`
3. **Install backend deps** — `npm ci` trong `backend/`
4. **Lint backend** — `npm run lint:strict` (zero warnings)
5. **Lint migrations** — `bash scripts/lint-migrations.sh` (chạy ở root, không có `working-directory: backend`)
6. **Security audit** — `npm audit --audit-level=high --omit=dev` — `continue-on-error: true`
7. **Run tests + coverage** — `npx jest --ci --runInBand --forceExit --coverage --coverageReporters=text-summary --coverageReporters=json-summary`
8. **Enforce coverage thresholds** — Node script check `coverage/coverage-summary.json`
9. **Upload artifact** — `backend-coverage` (7 ngày)

**Env vars trong CI:** `NODE_ENV=test`, `DB_NAME=techstore_test`, `DB_USER=root`, `DB_PASSWORD=''`, `DB_HOST=localhost`, `LLM_API_KEY=demo-key`, `EMAIL_USERNAME=test@test.com`, `EMAIL_PASSWORD=test`, `JWT_SECRET` và `JWT_REFRESH_SECRET` từ GitHub secrets (fallback hardcoded với 32+ chars).

**Lưu ý:** không có MySQL service trong CI → Integration/API/E2E tests KHÔNG chạy. Chỉ unit tests.

### Job: frontend

`name: Frontend (lint + typecheck + test + build)`, `timeout-minutes: 15`, `runs-on: ubuntu-latest`

Steps theo thứ tự:

1. `actions/checkout@v4`
2. **Setup Node.js 22** — lưu npm từ `frontend/package-lock.json`
3. **Install frontend deps** — `npm ci` trong `frontend/`
4. **Lint frontend** — `npm run lint`
5. **Typecheck** — `npm run typecheck` (`tsc --noEmit`)
6. **Run tests + coverage** — `npm run test:ci` — 21 suites, threshold gate (79% global, 100% per-file auth/schema)
7. **Security audit** — `npm audit --audit-level=high --omit=dev` — `continue-on-error: true`
8. **Build** — `npm run build` với `VITE_API_URL=http://localhost:8888/api`
9. **Bundle size check** — fail nếu `dist/` > 10MB (`du -sm dist/`)
10. **Upload artifact** — `frontend-dist` (3 ngày)

**FE coverage thresholds** (trong `frontend/jest.config.cjs`):

| Metric | Global floor | Per-file (auth pages + schema) |
|---|---|---|
| Statements | ≥ 79% | 100% |
| Branches | ≥ 67% | 100% |
| Functions | ≥ 69% | 100% |
| Lines | ≥ 79% | 100% |

### Job: summary

`needs: [backend, frontend]`, `if: always()`. Fail nếu backend hoặc frontend fail.

## 1.3 Coverage thresholds

CI fail nếu backend coverage dưới ngưỡng (kiểm tra `coverage/coverage-summary.json`):

| Metric | Threshold (CI) | Threshold (local jest.config.js) |
|---|---|---|
| Statements | ≥ 97% | 99% |
| Lines | ≥ 97% | 99% |
| Branches | ≥ 85% | 97% |
| Functions | ≥ 95% | 99% |

CI threshold thấp hơn local để buffer cho edge cases trong unit test environment.

## 1.4 Artifacts

| Artifact | Path | Retention |
|---|---|---|
| `backend-coverage` | `backend/coverage/coverage-summary.json` | 7 ngày |
| `frontend-dist` | `frontend/dist/` | 3 ngày |

## 1.5 Concurrency

```yaml
group: ${{ github.workflow }}-${{ github.ref }}
cancel-in-progress: ${{ github.event_name == 'pull_request' || !contains(github.ref, 'refs/heads/main') }}
```

- Cùng branch + workflow → cancel run cũ, chỉ giữ run mới nhất.
- Push lên `main` **không cancel** (để giữ đủ history).

---

# 2. Dependabot

File: `.github/dependabot.yml`

Tự động mở PRs mỗi tuần thứ Hai khi có dependency updates:

| Target | Ecosystem | Schedule | PR limit | Labels |
|---|---|---|---|---|
| `frontend/` | npm | weekly (Monday) | 5 | `dependencies`, `frontend` |
| `backend/` | npm | weekly (Monday) | 5 | `dependencies`, `backend` |
| `/` (GitHub Actions) | github-actions | weekly | 3 | `dependencies`, `ci` |

**Grouping:** minor và patch updates của frontend và backend được gom vào 1 PR để giảm noise (group `minor-and-patch`). Major updates tạo PR riêng.

---

# 3. Husky Hooks

Husky hooks trong `.husky/` — chạy local, không chạy trong CI.

## 3.1 pre-commit

File: `.husky/pre-commit`

Chạy theo thứ tự khi `git commit`:

1. **Secret scanning** — grep staged files theo patterns: AWS keys (`AKIA...`), Stripe live keys (`sk_live_...`), GitHub tokens (`ghp_...`), Slack tokens (`xox[abprs]-...`), private key blocks (`-----BEGIN`), hardcoded passwords. Block `.env` files (trừ `.env.example`).
2. **Architecture audit** — `bash scripts/audit-architecture.sh`: block service import Sequelize trực tiếp, controller access ORM, cross-module deep import.
3. **Frontend lint-staged** — ESLint + Prettier chỉ cho staged `*.{ts,tsx}` và `*.{css,scss}` files.
4. **Frontend TypeScript check** — `npx tsc --noEmit`.
5. **Backend lint-staged** — ESLint + Prettier chỉ cho staged `src/**/*.js` files.

**Bypass:** KHÔNG dùng `--no-verify`. Fix violation thay vì skip.

## 3.2 commit-msg

File: `.husky/commit-msg`

Validate Conventional Commits format:

```
<type>(<scope>): <description>
```

- **Type** (English): `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **Subject** phải có ít nhất 1 ký tự
- **Subject length** ≤ 72 chars (warn only, không block)
- Cho phép: Merge commits (`Merge ...`) và Revert commits (`Revert ...`)

## 3.3 pre-push

File: `.husky/pre-push`

Chạy trước mỗi `git push`:

1. **Frontend build check** — `npm run build` (fail nếu production build lỗi)
2. **Backend tests** — `npm test` (fail nếu unit tests fail)
3. **Frontend tests** — `npm test` (fail nếu component tests fail)
4. **npm audit** — `--audit-level=high --omit=dev` cho cả backend + frontend (warn only, không block)
5. **Bundle size check** — warn nếu `dist/` > 10MB (không block)

---

# 4. Gotchas

- **Integration/API/E2E tests KHÔNG chạy trong CI** — CI không có MySQL service. Chỉ chạy local.
- **`npm run lint:strict`** (backend) khác `npm run lint` (frontend) — backend dùng `--max-warnings 0`, frontend cũng dùng `--max-warnings 0` nhưng script tên khác.
- **`scripts/lint-migrations.sh`** chạy ở root level — CI step không có `working-directory: backend`.
- **`npm audit`** dùng `continue-on-error: true` — audit thất bại không block CI (chỉ warning).
- **Frontend có test step trong CI** — `npm run test:ci` với coverage threshold gate (step 6 trong frontend job). Jest chạy 21 suites, fail nếu dưới threshold.
- **`DB_PASSWORD=''` trong CI** — empty string, không phải undefined. Sequelize với XAMPP local dev cũng dùng empty password.
- **GitHub secrets:** `JWT_SECRET` và `JWT_REFRESH_SECRET` cần ≥32 chars. Fallback hardcoded trong CI đủ dài.
- **Dependabot PRs:** cần review manual trước khi merge, đặc biệt major version bumps.
