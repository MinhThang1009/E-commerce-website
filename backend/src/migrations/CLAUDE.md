# Migrations — TechStore Backend

> 71 Sequelize migration files tại `src/migrations/`. Schema hiện tại: `backend/data/migration_full.sql`.

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Lưu ý đọc file](#1-lưu-ý-đọc-file)
- [2. Naming convention](#2-naming-convention)
- [3. Danh sách tất cả migrations](#3-danh-sách-tất-cả-migrations)
- [4. Migration phases](#4-migration-phases)
- [5. Migrations gần nhất (cuối cùng)](#5-migrations-gần-nhất-cuối-cùng)
- [6. Sequence gaps đã biết](#6-sequence-gaps-đã-biết)
- [7. Commands](#7-commands)
- [8. Pattern chuẩn cho migration mới](#8-pattern-chuẩn-cho-migration-mới)
- [9. Constraints quan trọng](#9-constraints-quan-trọng)
- [10. Schema snapshot](#10-schema-snapshot)

---

# 1. Lưu ý đọc file

**KHÔNG đọc hết** 71 files — chỉ đọc khi cần trace schema change cụ thể. Dùng tên file (date prefix) để xác định file cần xem. Toàn bộ schema hiện tại ở `data/migration_full.sql`.

---

# 2. Naming convention

`YYYYMMDDNN-kebab-case-description.js`

- `YYYYMMDD` = ngày tạo (YYYY = year, MM = month, DD = day)
- `NN` = sequence trong ngày (01, 02, ..., 15, 16...)
- Ví dụ: `2026051611-i18n-column-per-locale.js`

**Sequelize CLI** track migrations đã chạy trong bảng `SequelizeMeta` (chứa tên file).

---

# 3. Danh sách tất cả migrations

```
2024010101-initialize-schema.js
2024071501-create-warranty-package-table.js
2024121501-add-name-affecting-columns-to-attribute-values.js
2024121901-add-laptop-fields.js
2025011601-add-isActive-to-users.js
2025011602-add-sku-status-to-products.js
2025011701-add-stripe-customer-id-to-users.js
2025070901-update-price-precision.js
2025070902-fix-price-precision.js
2025071501-create-product-warranty-table.js
2025071502-create-product-specifications-table.js
2025071503-update-product-attributes-table.js
2025071601-add-variant-fields.js
2025071801-create-images-table.js
2025122401-add-faqs-to-products.js
2026031701-add-otp-to-users.js
2026031702-fix-too-many-keys-error.js
2026031801-add-new-features-tables.js
2026031802-add-loyalty-and-recently-viewed.js
2026031803-create-banners.js
2026050201-product-status-to-english.js
2026050301-add-soft-delete-to-reviews.js
2026050401-add-stock-quantity-to-products.js
2026050402-rename-price-to-unit-price.js
2026050403-add-discount-fields-to-orders.js
2026050404-add-indexes.js
2026050405-create-inventory-logs.js
2026050406-add-ai-chatbot-fields.js
2026050407-add-chatmessage-ai-fields.js
2026050408-create-audit-logs.js
2026050409-add-FK-constraint-names.js
2026050410-rename-search-history-table.js
2026050411-create-import-logs.js
2026050412-add-soft-delete-columns.js
2026050501-rename-snake-case.js
2026050502-add-FK-constraints.js
2026050503-decimal-precision.js
2026050504-varchar-lengths.js
2026050505-default-values.js
2026050506-null-consistency.js
2026050507-check-constraints.js
2026050508-soft-delete-columns-2.js
2026050509-timestamp-to-datetime.js
2026050510-add-missing-columns.js
2026050511-fix-snake-case-remaining.js
2026050512-cleanup-indexes.js
2026051601-fix-remaining-indexes.js
2026051602-optimize-varchar.js
2026051603-rename-recently-viewed.js
2026051605-add-table-comments.js
2026051606-drop-columns-rename-indexes-checks.js
2026051607-rename-remaining-indexes.js
2026051608-standardize-column-types.js
2026051609-final-varchar-cleanup.js
2026051610-remove-support-chat.js
2026051611-i18n-column-per-locale.js
2026051612-add-missing-faqs-column.js
2026051613-add-specifications-en.js
2026051614-add-table-comments.js
2026051615-cleanup-db-orphans.js
2026051700-add-value-en-to-product-specifications.js
2026051701-add-attributes-en-to-product-variants.js
2026051702-restore-images-table.js
2026051703-rename-reviews-to-product-reviews.js
2026051704-drop-brand-categories.js
2026052001-drop-import-logs.js
2026052002-drop-newsletter-email-campaign.js
2026052003-drop-collections.js
```

---

# 4. Migration phases

| Phase                | Files (prefix)            | Nội dung chính                                                                                                                                                                                            |
| -------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Init**             | `2024010101`              | Schema ban đầu: sync từ Sequelize models, không tạo FK constraints để tránh "Too many keys"                                                                                                               |
| **Early schema**     | `2024121501`–`2025071801` | Add laptop fields, price precision, images table, variant fields, product-warranty, product-specifications                                                                                                |
| **Phase 5–6**        | `2026050201`–`2026050406` | Product status → English, reviews soft-delete, stock_quantity to products, schema naming standards (price→unit_price rename, discount fields), indexes, inventory_logs, AI chatbot fields, audit_logs     |
| **Phase 8–10**       | `2026050406`–`2026050408` | ChatMessage AI fields (provider, tokens), ChatMessage status fields, audit_logs table                                                                                                                     |
| **Phase 35–38**      | `2026050409`–`2026050412` | FK constraint names, rename search_history table, import_logs, soft-delete columns                                                                                                                        |
| **Phase 40**         | `2026050501`–`2026050512` | Massive cleanup: snake_case toàn bộ, FK constraints chuẩn, decimal precision DECIMAL(15,2), varchar lengths, default values, null consistency, check constraints, soft-delete columns, timestamp→datetime |
| **i18n**             | `2026051611`              | Column-per-locale: `name_vi`/`name_en`, `description_vi`/`description_en` cho 6 bảng (products, categories, brands, news, banners)                                                                        |
| **Cleanup**          | `2026051601`–`2026051615` | Index/constraint rename, optimize varchar, recently-viewed rename, table comments, drop columns, standardize column types, remove support_chat, add specifications_en                                     |
| **Specs & variants** | `2026051700`–`2026051704` | `value_en` to product_specifications, `attributes_en` to product_variants, restore images table, rename reviews → product_reviews, drop brand_categories                                                  |
| **Drop phase**       | `2026052001`–`2026052003` | Drop `import_logs`, drop `email_campaigns`+`newsletter_subscribers`, drop `collections`+`product_collections`                                                                                             |

---

# 5. Migrations gần nhất (cuối cùng)

| File                                              | Nội dung                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `2026052003-drop-collections.js`                  | Drop `product_collections` và `collections` (module đã xóa khỏi codebase) |
| `2026052002-drop-newsletter-email-campaign.js`    | Drop `email_campaigns`, `newsletter_subscribers`                          |
| `2026052001-drop-import-logs.js`                  | Drop `import_logs`                                                        |
| `2026051704-drop-brand-categories.js`             | Drop bảng `brand_categories`                                              |
| `2026051703-rename-reviews-to-product-reviews.js` | Rename `reviews` → `product_reviews`                                      |

**Models đã drop hoàn toàn:** `Collection`, `EmailCampaign`, `NewsletterSubscriber`, `ImportLog` — không reference lại trong code mới.

---

# 6. Sequence gaps đã biết

- `2026051604` — không tồn tại (số bị bỏ qua khi tạo, không có migration bị xóa)

---

# 7. Commands

```bash
# Từ thư mục backend/
npm run db:migrate                               # Chạy tất cả pending migrations
npm run db:migrate:undo                          # Undo migration gần nhất
npx sequelize-cli db:migrate:status              # Xem danh sách đã/chưa chạy
npx sequelize-cli db:migrate:undo --name <file>  # Undo migration cụ thể
```

**Sau khi thêm migration mới và chạy:**

```bash
mysqldump --no-data techstore > backend/data/migration_full.sql
```

Cập nhật `data/migration_full.sql` để giữ schema snapshot đồng bộ.

---

# 8. Pattern chuẩn cho migration mới

```js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Ví dụ: thêm column
    await queryInterface.addColumn('products', 'new_field', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
      after: 'existing_field', // MySQL: đặt sau column nào
      comment: 'Mô tả field',
    });

    // Ví dụ: tạo index
    await queryInterface.addIndex('products', ['new_field'], {
      name: 'idx_products_new_field',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('products', 'idx_products_new_field');
    await queryInterface.removeColumn('products', 'new_field');
  },
};
```

**Quy tắc:**

- Mỗi migration **bắt buộc có `down()`** để rollback — CI script `scripts/lint-migrations.sh` sẽ fail nếu thiếu
- Thêm column `NOT NULL` trên table có data → cần `defaultValue` hoặc backfill trước (2 migrations: add nullable → backfill → alter to NOT NULL)
- Tên column: **snake_case** (theo Phase 40 chuẩn hóa)
- DECIMAL: dùng `DECIMAL(15, 2)` (Phase 40 standard), không phải `DECIMAL(10, 2)`
- String: VARCHAR với length rõ ràng (255, 100, 500...), không dùng `STRING` mặc định (Sequelize mặc định VARCHAR(255) nhưng không explicit)
- Index name format: `idx_<table>_<column>` hoặc `uq_<table>_<column>` cho unique
- FK constraint name format: `fk_<child_table>_<parent_table>` hoặc `fk_<child_table>_<column>`
- Table comment: thêm vào `queryInterface.sequelize.query()` với `COMMENT = '...'`

---

# 9. Constraints quan trọng

- **KHÔNG bao giờ re-enable `sequelize.sync()`** — gây lỗi "Too many keys" với MySQL InnoDB (limit 64 index per table). Migration `2026031702-fix-too-many-keys-error.js` đã remove sync.
- **KHÔNG chỉnh sửa migration đã chạy** — tạo migration mới để alter (Sequelize track executed migrations trong bảng `SequelizeMeta`).
- **KHÔNG tạo FK constraints trong `initialize-schema.js`** (migration đầu tiên) — chỉ tạo tables, FK constraints thêm vào trong migrations riêng để tránh circular dependency và 64-key limit.
- **Migration filename phải unique** — Sequelize dùng tên file làm khóa trong `SequelizeMeta`.
- **`scripts/lint-migrations.sh`** — CI script kiểm tra mọi migration có `down()` rollback. Fail CI nếu thiếu.

---

# 10. Schema snapshot

File `backend/data/migration_full.sql` chứa toàn bộ schema hiện tại (sau khi chạy tất cả migrations). Dùng để:

- Tham chiếu nhanh không cần chạy migrations
- Khởi tạo DB trên môi trường mới
- Verify schema drift so với models (`npm run db:verify`)

Để rebuild DB từ đầu:

```bash
npm run db:seed   # = node scripts/rebuild-db.js && npx sequelize-cli db:seed:all
```

Để verify schema vs models:

```bash
npm run db:verify   # node scripts/db-verify.js
```
