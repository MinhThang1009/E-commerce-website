'use strict';

// Migration: Hoàn tất audit — rename indexes, CHECK constraints còn lại + table comment
//   Item 2: Rename 6 non-standard index names → idx_/uq_ prefix
//   Item 3: Rename 10 CHECK constraints → chk_ prefix
//   Item 4: Thêm table comment cho product_reviews
//
// Idempotent: mỗi operation check exists trước khi execute

// ── Helper functions ────────────────────────────────────────────────────────

async function tableExists(qi, table) {
  const [rows] = await qi.sequelize.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    { replacements: [table] },
  );
  return rows.length > 0;
}

async function indexExists(qi, table, indexName) {
  const [rows] = await qi.sequelize.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    { replacements: [table, indexName] },
  );
  return rows.length > 0;
}

async function checkConstraintExists(qi, name) {
  const [rows] = await qi.sequelize.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'
     LIMIT 1`,
    { replacements: [name] },
  );
  return rows.length > 0;
}

// ── Item 2: Non-standard indexes cần rename ─────────────────────────────────
// [table, oldName, newName, columns, isUnique]
const INDEX_RENAMES = [
  [
    'product_variants',
    'product_variants_is_available_idx',
    'idx_product_variants_is_available',
    'is_available',
    false,
  ],
  [
    'product_warranties',
    'product_warranties_product_id_idx',
    'idx_product_warranties_product_id',
    'product_id',
    false,
  ],
  [
    'product_warranties',
    'product_warranties_warranty_package_id_idx',
    'idx_product_warranties_warranty_package_id',
    'warranty_package_id',
    false,
  ],
  ['users', 'google_id', 'uq_users_google_id', 'google_id', true],
  [
    'warranty_packages',
    'warranty_packages_is_active_idx',
    'idx_warranty_packages_is_active',
    'is_active',
    false,
  ],
  [
    'warranty_packages',
    'warranty_packages_sort_order_idx',
    'idx_warranty_packages_sort_order',
    'sort_order',
    false,
  ],
];

// ── Item 3: Inline CHECK constraints cần chuyển thành named constraints ──────
// MariaDB 10.4: inline CHECK trên column không thể DROP CONSTRAINT — cần MODIFY COLUMN bỏ CHECK,
// sau đó ADD CONSTRAINT với tên chuẩn chk_ prefix.
// [table, column, newConstraintName, expression, modifyColumnSQL (không CHECK), modifyColumnSQL_withCheck (có inline CHECK cho rollback)]
const CHECK_RENAMES = [
  [
    'cart_items',
    'warranty_package_ids',
    'chk_cart_items_warranty_package_ids',
    'json_valid(`warranty_package_ids`)',
    '`warranty_package_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_array()',
    '`warranty_package_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_array() CHECK (json_valid(`warranty_package_ids`))',
  ],
  [
    'import_logs',
    'error_detail',
    'chk_import_logs_error_detail',
    'json_valid(`error_detail`)',
    '`error_detail` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL',
    '`error_detail` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`error_detail`))',
  ],
  [
    'order_items',
    'attributes',
    'chk_order_items_attributes',
    'json_valid(`attributes`)',
    '`attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_object()',
    '`attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_object() CHECK (json_valid(`attributes`))',
  ],
  [
    'order_items',
    'warranty_package_ids',
    'chk_order_items_warranty_package_ids',
    'json_valid(`warranty_package_ids`)',
    '`warranty_package_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL',
    '`warranty_package_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`warranty_package_ids`))',
  ],
  [
    'product_attributes',
    'values',
    'chk_product_attributes_values',
    'json_valid(`values`)',
    '`values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT json_array()',
    '`values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT json_array() CHECK (json_valid(`values`))',
  ],
  [
    'product_reviews',
    'rating_value',
    'chk_product_reviews_rating_value',
    '`rating_value` >= 1 AND `rating_value` <= 5',
    '`rating_value` int(11) DEFAULT NULL',
    '`rating_value` int(11) DEFAULT NULL CHECK (`rating_value` >= 1 AND `rating_value` <= 5)',
  ],
  [
    'product_variants',
    'dimensions',
    'chk_product_variants_dimensions',
    'json_valid(`dimensions`)',
    '`dimensions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL',
    '`dimensions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`dimensions`))',
  ],
  [
    'reviews',
    'images',
    'chk_reviews_images',
    'json_valid(`images`)',
    '`images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_array()',
    '`images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_array() CHECK (json_valid(`images`))',
  ],
  [
    'warranty_packages',
    'coverage',
    'chk_warranty_packages_coverage',
    'json_valid(`coverage`)',
    '`coverage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_array()',
    '`coverage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_array() CHECK (json_valid(`coverage`))',
  ],
  [
    'warranty_packages',
    'terms',
    'chk_warranty_packages_terms',
    'json_valid(`terms`)',
    '`terms` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_object()',
    '`terms` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_object() CHECK (json_valid(`terms`))',
  ],
];

module.exports = {
  async up(queryInterface) {
    // ══════════════════════════════════════════════════════════════════════════
    // Item 2: Rename non-standard indexes
    // MySQL hỗ trợ ALTER TABLE ... RENAME INDEX trực tiếp
    // ══════════════════════════════════════════════════════════════════════════
    for (const [table, oldName, newName, cols, isUnique] of INDEX_RENAMES) {
      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" không tồn tại`);
        continue;
      }
      if (await indexExists(queryInterface, table, newName)) {
        console.log(`  EXISTS: ${newName}`);
        continue;
      }
      // MariaDB không hỗ trợ RENAME INDEX — dùng ADD mới rồi DROP cũ
      // Thứ tự ADD trước DROP: tránh lỗi FK constraint cần index
      const colList = cols
        .split(',')
        .map((c) => `\`${c.trim()}\``)
        .join(', ');
      const keyword = isUnique ? 'UNIQUE INDEX' : 'INDEX';
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD ${keyword} \`${newName}\` (${colList})`,
      );
      if (await indexExists(queryInterface, table, oldName)) {
        await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${oldName}\``);
      }
      console.log(`  RENAMED INDEX: ${table}.${oldName} → ${newName}`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Item 3: Chuyển inline CHECK constraints → named constraints (chk_ prefix)
    // MariaDB 10.4: inline CHECK không thể DROP CONSTRAINT — cần MODIFY COLUMN
    // bỏ inline CHECK, rồi ADD CONSTRAINT với tên chuẩn.
    // ══════════════════════════════════════════════════════════════════════════
    for (const [table, column, newName, expr, modifyNoCheck] of CHECK_RENAMES) {
      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" không tồn tại`);
        continue;
      }
      if (await checkConstraintExists(queryInterface, newName)) {
        console.log(`  EXISTS: ${newName}`);
        continue;
      }
      // Bước 1: MODIFY COLUMN bỏ inline CHECK (constraint tên theo column tự biến mất)
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN ${modifyNoCheck}`,
      );
      // Bước 1b: MariaDB có thể chuyển inline CHECK thành named constraint thay vì xóa
      // Drop constraint tên theo column nếu vẫn còn tồn tại
      if (await checkConstraintExists(queryInterface, column)) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP CONSTRAINT \`${column}\``,
        );
      }
      // Bước 2: ADD named constraint
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${newName}\` CHECK (${expr})`,
      );
      console.log(`  RENAMED CHECK: ${table}.${column} → ${newName}`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Item 4: Thêm table comment cho product_reviews
    // ══════════════════════════════════════════════════════════════════════════
    if (await tableExists(queryInterface, 'product_reviews')) {
      await queryInterface.sequelize.query(
        "ALTER TABLE `product_reviews` COMMENT = 'Đánh giá sản phẩm (module reviews mới)'",
      );
      console.log('  ADDED COMMENT: product_reviews');
    }
  },

  async down(queryInterface) {
    // ── Rollback table comment ────────────────────────────────────────────
    if (await tableExists(queryInterface, 'product_reviews')) {
      await queryInterface.sequelize.query("ALTER TABLE `product_reviews` COMMENT = ''");
      console.log('  REMOVED COMMENT: product_reviews');
    }

    // ── Rollback CHECK constraints: named → inline ──────────────────────
    for (const [table, column, newName, expr, modifyNoCheck, modifyWithCheck] of CHECK_RENAMES) {
      if (!(await tableExists(queryInterface, table))) continue;
      if (await checkConstraintExists(queryInterface, newName)) {
        // Bước 1: DROP named constraint
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP CONSTRAINT \`${newName}\``,
        );
        // Bước 2: MODIFY COLUMN với inline CHECK (khôi phục trạng thái ban đầu)
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` MODIFY COLUMN ${modifyWithCheck}`,
        );
        console.log(`  ROLLBACK CHECK: ${newName} → inline ${column}`);
      }
    }

    // ── Rollback indexes ──────────────────────────────────────────────────
    for (const [table, oldName, newName, cols, isUnique] of INDEX_RENAMES) {
      if (!(await tableExists(queryInterface, table))) continue;
      if (await indexExists(queryInterface, table, newName)) {
        // ADD cũ trước, DROP mới sau — tránh lỗi FK constraint
        const colList = cols
          .split(',')
          .map((c) => `\`${c.trim()}\``)
          .join(', ');
        const keyword = isUnique ? 'UNIQUE INDEX' : 'INDEX';
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` ADD ${keyword} \`${oldName}\` (${colList})`,
        );
        await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${newName}\``);
        console.log(`  ROLLBACK INDEX: ${newName} → ${oldName}`);
      }
    }
  },
};
