# Scripts — Maintenance & Data Operations — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../CLAUDE.md)

## Mục lục

- [1. Quick reference](#1-quick-reference)
- [2. DB operations](#2-db-operations)
  - [2.1 rebuild-db.js](#21-rebuild-dbjs)
  - [2.2 db-cleanup.js](#22-db-cleanupjs)
  - [2.3 db-cleanup-test-data.js](#23-db-cleanup-test-datajs)
  - [2.4 db-verify.js](#24-db-verifyjs)
- [3. AI / Vector search](#3-ai--vector-search)
  - [3.1 index-products.js](#31-index-productsjs)
- [4. Audit & verify scripts](#4-audit--verify-scripts)
- [5. Translate scripts](#5-translate-scripts)
- [6. Seeders](#6-seeders)
- [7. Gotchas](#7-gotchas)

---

# 1. Quick reference

| Script | Lệnh npm | Lệnh trực tiếp | Mô tả |
|---|---|---|---|
| `index-products.js` | `npm run ai:rebuild-vectors` | — | Re-index sản phẩm vào AI vector store |
| `rebuild-db.js` | `npm run db:seed` | `node scripts/rebuild-db.js` | DROP + recreate DB từ SQL dumps |
| `db-cleanup.js` | — | `node scripts/db-cleanup.js` | Xóa hết data, giữ schema (dev) |
| `db-cleanup-test-data.js` | `npm run db:cleanup-test-data` | — | Xóa data prefix `__INT_TEST_`, `__HTTP_`, `__E2E_` |
| `sync-products.js` | — | `node scripts/sync-products.js` | Sync `data/products.json` → DB |
| `export-products-json.js` | `npm run db:export:json` | — | Export sản phẩm DB → `data/products.json` |
| `import-products.js` | `npm run db:import` | — | Import products từ `data/products.json` vào DB |
| `export-seed.js` | `npm run db:export-seed` | — | Export seed data hiện tại |
| `db-verify.js` | `npm run db:verify` | — | Kiểm tra DB integrity (counts, samples) |

---

# 2. DB operations

## 2.1 rebuild-db.js

DROP database → CREATE database → import `data/migration_full.sql` → import `data/seed_data.sql`.

```bash
node scripts/rebuild-db.js
# Hoặc:
npm run db:seed
```

**CHỈ DÙNG TRONG DEV** — DROP hoàn toàn database `$DB_NAME`. Không bao giờ chạy trên staging/prod.

Nếu cần seeders Sequelize CLI sau rebuild:
```bash
npx sequelize-cli db:seed:all
```

## 2.2 db-cleanup.js

Xóa hết data (DELETE, không DROP schema) trong transaction, disable FK checks trước. Dùng để reset dev data về trạng thái sạch mà không cần rebuild toàn bộ schema.

```bash
node scripts/db-cleanup.js
```

## 2.3 db-cleanup-test-data.js

Xóa test data còn sót sau khi integration/API/E2E tests fail giữa chừng. Tìm records có prefix `__` (double underscore) trong các cột chính (email, name_vi, title_vi, number).

```bash
npm run db:cleanup-test-data
```

Tự động reseed news nếu `news` table bị xóa sạch sau cleanup.

## 2.4 db-verify.js

Kiểm tra DB health: row counts, sample data, FK integrity.

```bash
npm run db:verify
```

---

# 3. AI / Vector search

## 3.1 index-products.js

Re-index tất cả sản phẩm `status='active'` vào vector store (`data/vector-db.json`).

```bash
npm run ai:rebuild-vectors
```

**Bắt buộc có `require('module-alias/register')` ở đầu file** — không xóa dòng này. Aliases `@models`, `@services` cần được register trước khi `require('../src/models')`.

Quy trình:
1. Backup `vector-db.json` → `vector-db.json.bak`
2. Clear index cũ
3. Index từng sản phẩm tuần tự (để dễ debug)
4. Save vào `vector-db.json`

Log "Rebuilding vector store..." khi server khởi động là bình thường nếu vector count lệch >5% so với active products.

---

# 4. Audit & verify scripts

| Script | Lệnh | Mô tả |
|---|---|---|
| `audit-repo-attributes.js` | `node scripts/audit-repo-attributes.js` | So sánh Sequelize model attributes với DB columns (INFORMATION_SCHEMA) — output report |
| `audit-schema-drift.js` | `node scripts/audit-schema-drift.js` | Phát hiện 4 loại drift: model column ∉ DB, paranoid ∉ DB, DB column ∉ model, type mismatch |
| `compare-locales.js` | `node scripts/compare-locales.js` | So sánh keys giữa `frontend/src/locales/vi.json` và `en.json` — tìm missing/extra keys |

---

# 5. Translate scripts

Dùng DeepL + OpenRouter để batch translate nội dung Vi→En (cần API key trong `.env`):

| Script | Lệnh | Mô tả |
|---|---|---|
| `translate-content.js` | `node scripts/translate-content.js --table=products` | Translate `nameVi`, `descriptionVi` → `nameEn`, `descriptionEn`. Hỗ trợ `--table=products\|categories\|brands`, `--dry-run` |
| `translate-spec-values.js` | `node scripts/translate-spec-values.js` | Translate specification values của product variants |
| `translate-variant-attributes.js` | `node scripts/translate-variant-attributes.js` | Translate variant attribute values |
| `migrate-i18n-columns.js` | — | **One-time helper** cho i18n migration (Phase 51). Không tái dùng |

---

# 6. Seeders

Nằm tại `scripts/seeders/`. Chạy qua **Sequelize CLI** — **idempotent** (INSERT IGNORE, an toàn khi chạy nhiều lần):

```bash
# Từ thư mục backend/
npx sequelize-cli db:seed:all                                    # Seed tất cả (theo thứ tự timestamp)
npx sequelize-cli db:seed:undo:all                               # Rollback tất cả
npx sequelize-cli db:seed --seed 20260101000003-seed-admin-user.js  # Chỉ seed admin
```

**Thứ tự seeders (phải chạy theo thứ tự timestamp):**

| Seeder | Thứ tự | Dữ liệu |
|---|---|---|
| `20260101000001-seed-categories.js` | 1 | 5 categories: Điện thoại (slug `dien-thoai`), Tablet, Laptop, Smartwatch, Đồng hồ |
| `20260101000002-seed-brands.js` | 2 | 12 brands: Apple, Samsung, Xiaomi, OPPO, Vivo, Realme, Nokia, Huawei, LG, ASUS, Acer, CITIZEN |
| `20260101000003-seed-admin-user.js` | 3 | 1 admin: `admin@techstore.vn` / `Admin@123` (bcrypt hash, cost 10) |
| `20260101000004-seed-news.js` | 4 | Tin tức công nghệ mẫu (~10 bài viết) — DELETE trước khi INSERT (không dùng INSERT IGNORE) |

**CẢNH BÁO:** Đổi password admin trước khi deploy production. Hash trong seeder là `Admin@123`.

Seeder dùng thư mục riêng `scripts/seeders/` thay vì `src/seeders/` — đây là **design choice** để tách biệt maintenance scripts khỏi source code chính.

---

# 7. Gotchas

- **`index-products.js`** phải có `require('module-alias/register')` ở đầu file — không xóa. Module aliases (`@models`, `@services`) không tự load ngoài Jest context
- **`rebuild-db.js`** DROP database hoàn toàn — **chỉ dev**, không bao giờ trên staging/prod
- **`sync-products.js`** cần file `data/products.json` tồn tại — export trước bằng `export-products-json.js`
- **`translate-content.js`** hỗ trợ `--dry-run` để preview không ghi DB — luôn dry-run trước khi translate thật
- **`db-cleanup.js`** dùng `FOREIGN_KEY_CHECKS = 0` — không an toàn với concurrent connections, chỉ chạy khi dev server tắt
- **Sequelize CLI config** dùng `src/config/sequelize.js` — đảm bảo `.env` được load trước khi chạy seeders
