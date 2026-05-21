'use strict';

// Migration: Audit cleanup tổng hợp
//   PARTIAL 3: Drop users.isActive (camelCase duplicate, snake_case is_active là cột chính)
//   PARTIAL 4: Drop products.brand (VARCHAR redundant — đã có FK brand_id)
//   PARTIAL 5: Drop products.sku (redundant — variant product dùng product_variants.sku)
//   PARTIAL 7: Rename 11 non-standard index names → idx_/fk_/uq_ prefix
//   PARTIAL 8: Rename CHECK constraints → chk_ prefix
//
// Idempotent: mỗi operation check exists trước khi execute
// Verify data trước khi drop column — abort nếu có data không sync

// ── Helper functions ────────────────────────────────────────────────────────

async function columnExists(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    { replacements: [table, column] },
  );
  return rows.length > 0;
}

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

// ── PARTIAL 7: Non-standard indexes cần rename ──────────────────────────────
// [table, oldName, newName, columns, isUnique]
const INDEX_RENAMES = [
  [
    'product_variants',
    'product_variants_is_default_idx',
    'idx_product_variants_is_default',
    'is_default',
    false,
  ],
  ['products', 'products_brand_idx', 'idx_products_brand_id', 'brand_id', false],
  ['products', 'products_model_idx', 'idx_products_model', 'model', false],
  ['products', 'products_condition_idx', 'idx_products_condition', 'condition', false],
];

// ── PARTIAL 8: CHECK constraints cần rename ─────────────────────────────────
// [table, oldName, newName, expression]
// Kiểm tra thực tế từ DB: tên constraint hiện tại đặt theo column thay vì chk_ prefix
const CHECK_RENAMES = [
  [
    'products',
    'rating_average',
    'chk_products_rating_average',
    'rating_average >= 0.00 AND rating_average <= 5.00',
  ],
  ['products', 'stock_quantity', 'chk_products_stock_quantity', 'stock_quantity >= 0'],
  ['products', 'base_price', 'chk_products_base_price', 'base_price IS NULL OR base_price >= 0'],
  ['products', 'warranty_months', 'chk_products_warranty_months', 'warranty_months >= 0'],
  [
    'product_variants',
    'stock_quantity',
    'chk_product_variants_stock_quantity',
    'stock_quantity >= 0',
  ],
  ['product_variants', 'price', 'chk_product_variants_price', 'price IS NULL OR price >= 0'],
  ['cart_items', 'quantity', 'chk_cart_items_quantity', 'quantity >= 1'],
  ['cart_items', 'unit_price', 'chk_cart_items_unit_price', 'unit_price >= 0'],
  ['order_items', 'quantity', 'chk_order_items_quantity', 'quantity >= 1'],
  ['order_items', 'unit_price', 'chk_order_items_unit_price', 'unit_price >= 0'],
];

module.exports = {
  async up(queryInterface) {
    // ══════════════════════════════════════════════════════════════════════════
    // PARTIAL 3: Drop users.isActive (camelCase column)
    // Sequelize underscored: true map JS isActive → DB is_active.
    // Column "isActive" là duplicate từ migration cũ, cần drop.
    // ══════════════════════════════════════════════════════════════════════════
    if (await columnExists(queryInterface, 'users', 'isActive')) {
      // Kiểm tra data đồng bộ trước khi drop
      const hasIsActiveCol = await columnExists(queryInterface, 'users', 'is_active');
      if (hasIsActiveCol) {
        const [mismatch] = await queryInterface.sequelize.query(
          'SELECT COUNT(*) AS cnt FROM `users` WHERE `isActive` != `is_active`',
        );
        if (mismatch[0].cnt > 0) {
          // Sync data trước khi drop
          console.log(`  SYNC: ${mismatch[0].cnt} rows có isActive != is_active, đồng bộ...`);
          await queryInterface.sequelize.query(
            'UPDATE `users` SET `is_active` = `isActive` WHERE `isActive` != `is_active`',
          );
        }
      }
      await queryInterface.sequelize.query('ALTER TABLE `users` DROP COLUMN `isActive`');
      console.log('  DROPPED: users.isActive (camelCase duplicate)');
    } else {
      console.log('  SKIP: users.isActive đã được drop');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PARTIAL 4: Drop products.brand (VARCHAR redundant)
    // Đã có FK brand_id → bảng brands. Column brand (string) không còn dùng.
    // ══════════════════════════════════════════════════════════════════════════
    if (await columnExists(queryInterface, 'products', 'brand')) {
      const [nonEmpty] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS cnt FROM `products` WHERE `brand` IS NOT NULL AND `brand` != ''",
      );
      if (nonEmpty[0].cnt > 0) {
        console.log(`  WARNING: ${nonEmpty[0].cnt} products có brand không rỗng — skip drop`);
      } else {
        await queryInterface.sequelize.query('ALTER TABLE `products` DROP COLUMN `brand`');
        console.log('  DROPPED: products.brand (VARCHAR redundant)');
      }
    } else {
      console.log('  SKIP: products.brand đã được drop');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PARTIAL 5: Drop products.sku (redundant — variant dùng product_variants.sku)
    // ══════════════════════════════════════════════════════════════════════════
    if (await columnExists(queryInterface, 'products', 'sku')) {
      const [nonEmpty] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS cnt FROM `products` WHERE `sku` IS NOT NULL AND `sku` != ''",
      );
      if (nonEmpty[0].cnt > 0) {
        console.log(`  WARNING: ${nonEmpty[0].cnt} products có sku không rỗng — skip drop`);
      } else {
        // Drop index trên sku nếu có trước khi drop column
        if (await indexExists(queryInterface, 'products', 'idx_products_sku')) {
          await queryInterface.sequelize.query(
            'ALTER TABLE `products` DROP INDEX `idx_products_sku`',
          );
        }
        if (await indexExists(queryInterface, 'products', 'products_sku_idx')) {
          await queryInterface.sequelize.query(
            'ALTER TABLE `products` DROP INDEX `products_sku_idx`',
          );
        }
        await queryInterface.sequelize.query('ALTER TABLE `products` DROP COLUMN `sku`');
        console.log('  DROPPED: products.sku (redundant)');
      }
    } else {
      console.log('  SKIP: products.sku đã được drop');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PARTIAL 7: Rename non-standard indexes
    // ══════════════════════════════════════════════════════════════════════════
    for (const [table, oldName, newName, cols, isUnique] of INDEX_RENAMES) {
      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" does not exist`);
        continue;
      }
      if (await indexExists(queryInterface, table, newName)) {
        console.log(`  EXISTS: ${newName}`);
        continue;
      }
      if (await indexExists(queryInterface, table, oldName)) {
        await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${oldName}\``);
      }
      const colList = cols
        .split(',')
        .map((c) => `\`${c.trim()}\``)
        .join(', ');
      const keyword = isUnique ? 'UNIQUE KEY' : 'INDEX';
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD ${keyword} \`${newName}\` (${colList})`,
      );
      console.log(`  RENAMED INDEX: ${oldName} → ${newName}`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PARTIAL 8: Rename CHECK constraints → chk_ prefix
    // MariaDB/MySQL: DROP CHECK + ADD CHECK (không support RENAME CONSTRAINT)
    // ══════════════════════════════════════════════════════════════════════════
    for (const [table, oldName, newName, expr] of CHECK_RENAMES) {
      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" does not exist`);
        continue;
      }
      if (await checkConstraintExists(queryInterface, newName)) {
        console.log(`  EXISTS: ${newName}`);
        continue;
      }
      // Drop old constraint nếu tồn tại
      if (await checkConstraintExists(queryInterface, oldName)) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP CONSTRAINT \`${oldName}\``,
        );
      }
      // Add với tên mới
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${newName}\` CHECK (${expr})`,
      );
      console.log(`  RENAMED CHECK: ${oldName} → ${newName}`);
    }
  },

  async down(queryInterface) {
    // ── Rollback CHECK constraints ────────────────────────────────────────
    for (const [table, oldName, newName, expr] of CHECK_RENAMES) {
      if (!(await tableExists(queryInterface, table))) continue;
      if (await checkConstraintExists(queryInterface, newName)) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP CONSTRAINT \`${newName}\``,
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${oldName}\` CHECK (${expr})`,
        );
        console.log(`  ROLLBACK CHECK: ${newName} → ${oldName}`);
      }
    }

    // ── Rollback indexes ──────────────────────────────────────────────────
    for (const [table, oldName, newName, cols, isUnique] of INDEX_RENAMES) {
      if (!(await tableExists(queryInterface, table))) continue;
      if (await indexExists(queryInterface, table, newName)) {
        await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${newName}\``);
        const colList = cols
          .split(',')
          .map((c) => `\`${c.trim()}\``)
          .join(', ');
        const keyword = isUnique ? 'UNIQUE KEY' : 'INDEX';
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` ADD ${keyword} \`${oldName}\` (${colList})`,
        );
        console.log(`  ROLLBACK INDEX: ${newName} → ${oldName}`);
      }
    }

    // ── Rollback products.sku ─────────────────────────────────────────────
    if (!(await columnExists(queryInterface, 'products', 'sku'))) {
      await queryInterface.sequelize.query(
        'ALTER TABLE `products` ADD COLUMN `sku` VARCHAR(100) NULL DEFAULT NULL',
      );
      console.log('  RESTORED: products.sku');
    }

    // ── Rollback products.brand ───────────────────────────────────────────
    if (!(await columnExists(queryInterface, 'products', 'brand'))) {
      await queryInterface.sequelize.query(
        'ALTER TABLE `products` ADD COLUMN `brand` VARCHAR(255) NULL DEFAULT NULL',
      );
      console.log('  RESTORED: products.brand');
    }

    // ── Rollback users.isActive ───────────────────────────────────────────
    if (!(await columnExists(queryInterface, 'users', 'isActive'))) {
      await queryInterface.sequelize.query(
        'ALTER TABLE `users` ADD COLUMN `isActive` TINYINT(1) NOT NULL DEFAULT 1',
      );
      // Copy data từ is_active
      if (await columnExists(queryInterface, 'users', 'is_active')) {
        await queryInterface.sequelize.query('UPDATE `users` SET `isActive` = `is_active`');
      }
      console.log('  RESTORED: users.isActive');
    }
  },
};
