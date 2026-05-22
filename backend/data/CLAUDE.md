# Backend Data — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../CLAUDE.md)

## Mục lục

- [1. Files](#1-files)
- [2. migration_full.sql](#2-migration_fullsql)
- [3. seed_data.sql](#3-seed_datasql)
- [4. products.json](#4-productsjson)
- [5. vector-db.json](#5-vector-dbjson)
- [6. Gotchas](#6-gotchas)

---

# 1. Files

```
data/
├── migration_full.sql     ← Full schema (35 bảng active) — dump trước các drop migrations
├── seed_data.sql          ← Bulk seed data (products, variants, images, attributes)
├── products.json          ← Snapshot sản phẩm JSON (~317KB, dùng cho import/export)
├── vector-db.json         ← Vector embeddings active (~1.2MB, auto-generated)
└── vector-db.json.bak     ← Backup tự động trước mỗi rebuild
```

---

# 2. migration_full.sql

Full schema MySQL snapshot. Chứa các `CREATE TABLE` statements — một số bảng legacy đã bị drop bởi migrations sau (`collections`, `product_collections`, `email_campaigns`, `import_logs`, `newsletter_subscribers`, `banners`, `news`, `loyalty_histories`, `warranty_packages`, `product_warranties`). Schema active thực tế có **27 bảng**.

**Dùng khi:**
- Setup DB nhanh cho dev mới (không cần chạy từng migration)
- `rebuild-db.js` dùng file này để restore schema sau DROP
- Reference ERD khi viết tài liệu hoặc debug schema

**Cập nhật sau mỗi đợt migration mới:**
```bash
mysqldump --no-data techstore > backend/data/migration_full.sql
# Hoặc qua rebuild-db workflow: migrations → export mới
```

**Lưu ý:** `rebuild-db.js` tự xử lý `utf8mb4_0900_ai_ci` → `utf8mb4_unicode_ci` và CONSTRAINT names khi import để tránh lỗi MySQL 1215 / 1022.

---

# 3. seed_data.sql

Dữ liệu mẫu bulk insert cho dev/demo. Bao gồm:
- ~50 sản phẩm: laptop, điện thoại, smartwatch, tablet
- ProductVariants, ProductSpecifications, ProductAttributes
- Categories (5), Brands (12)

**Reset DB hoàn toàn:**
```bash
npm run db:seed
# = node scripts/rebuild-db.js (DROP + schema + seed)
# Sau đó nếu cần seeders:
npx sequelize-cli db:seed:all
```

**Binding với schema:** `seed_data.sql` bind chặt với schema hiện tại. Sau khi có migration đổi column name/type → phải re-export seed data.

---

# 4. products.json

Snapshot sản phẩm hiện tại theo format JSON (~317KB). Không phải SQL — dùng cho import/export qua scripts.

**Export DB → JSON:**
```bash
npm run db:export:json
# = node scripts/export-products-json.js
# Output: data/products.json
```

**Import JSON → DB:**
```bash
npm run db:import
# = node scripts/import-products.js
# Đọc data/products.json, upsert vào DB
```

**Dùng khi:**
- Transfer sản phẩm giữa environments
- Backup/restore product catalog mà không cần full SQL dump
- Sync từ data source khác (legacy system, spreadsheet)

---

# 5. vector-db.json

File persistence cho vector store service (`src/services/vector-store/vector-store.js`). Là JSON array phẳng, mỗi item có dạng:
```json
{
  "vector": [1024 floats...],
  "text": "chuỗi text đã embed (≤1500 chars)",
  "metadata": {
    "id": 42,
    "name": "iPhone 15 Pro",
    "slug": "iphone-15-pro",
    "price": 28990000,
    "compareAtPrice": 30000000,
    "thumbnail": "uploads/products/...",
    "inStock": true,
    "stockQuantity": 50,
    "category": "Điện thoại",
    "baseName": "Apple",
    "shortDescription": "...",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Auto-rebuild trigger:** khi server khởi động và vector count lệch >5% so với `Product.count({ where: { status: 'active' } })`. Log "Rebuilding vector store..." là **bình thường**.

**Rebuild thủ công:**
```bash
npm run ai:rebuild-vectors
# = node scripts/index-products.js
# Backup .bak → clear index → re-index từng product → save
```

`vector-db.json.bak` được tạo **tự động** trước mỗi rebuild — restore nếu rebuild fail:
```bash
cp backend/data/vector-db.json.bak backend/data/vector-db.json
```

---

# 6. Gotchas

- **KHÔNG commit `vector-db.json` đè lên** mà chưa verify backup `.bak` còn tốt — mất vector store nếu rebuild lỗi giữa chừng
- **`seed_data.sql` bind với schema hiện tại** — sau migration thay đổi cấu trúc table, phải re-generate seed file mới
- **Không commit dữ liệu thật từ production** — chỉ dùng mock/sample data. PII từ production không được lưu ở đây
- **File `.bak` không commit** — thêm vào `.gitignore` nếu chưa có (file ~1.2MB có thể bloat git history)
- **`migration_full.sql` dùng `utf8mb4_unicode_ci`** — không phải `utf8mb4_0900_ai_ci` (MySQL 8.0 default). `rebuild-db.js` tự convert khi import
