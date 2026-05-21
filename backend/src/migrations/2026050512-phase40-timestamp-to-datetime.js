'use strict';

// Phase 40.9 GAP fix — Convert 18 TIMESTAMP columns ở Group A tables sang DATETIME
// để match migration_full.sql v3.0 (đã unified DATETIME từ commit e0c3256)
// Idempotent: skip nếu column đã DATETIME
//
// Lý do unify (per plan.md): DATETIME không bị ảnh hưởng bởi timezone conversion,
// phù hợp Sequelize default behavior; TIMESTAMP có range 1970-2038 (Y2K38 problem).
//
// Group A tables (Phase 40.9 plan): brands, categories, products, product_variants,
// product_images, product_reviews. 6 tables × 3 columns (created_at, updated_at, deleted_at) = 18 cols.

// Format: [table, column, default, extra]
// default: 'CURRENT_TIMESTAMP' | 'NULL' (literal NULL — không có default)
// extra: '' | 'on update CURRENT_TIMESTAMP'
const COLUMNS = [
  // brands — current state có DEFAULT NULL cho cả 3 cột (không có current_timestamp)
  ['brands', 'created_at', 'NULL', ''],
  ['brands', 'updated_at', 'NULL', ''],
  ['brands', 'deleted_at', 'NULL', ''],

  // categories — created/updated có current_timestamp; deleted_at NULL
  ['categories', 'created_at', 'CURRENT_TIMESTAMP', ''],
  ['categories', 'updated_at', 'CURRENT_TIMESTAMP', 'on update CURRENT_TIMESTAMP'],
  ['categories', 'deleted_at', 'NULL', ''],

  // products
  ['products', 'created_at', 'CURRENT_TIMESTAMP', ''],
  ['products', 'updated_at', 'CURRENT_TIMESTAMP', 'on update CURRENT_TIMESTAMP'],
  ['products', 'deleted_at', 'NULL', ''],

  // product_variants
  ['product_variants', 'created_at', 'CURRENT_TIMESTAMP', ''],
  ['product_variants', 'updated_at', 'CURRENT_TIMESTAMP', 'on update CURRENT_TIMESTAMP'],
  ['product_variants', 'deleted_at', 'NULL', ''],

  // product_images
  ['product_images', 'created_at', 'CURRENT_TIMESTAMP', ''],
  ['product_images', 'updated_at', 'CURRENT_TIMESTAMP', 'on update CURRENT_TIMESTAMP'],
  ['product_images', 'deleted_at', 'NULL', ''],

  // product_reviews
  ['product_reviews', 'created_at', 'CURRENT_TIMESTAMP', ''],
  ['product_reviews', 'updated_at', 'CURRENT_TIMESTAMP', 'on update CURRENT_TIMESTAMP'],
  ['product_reviews', 'deleted_at', 'NULL', ''],
];

async function getColumnDataType(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] },
  );
  return rows[0] ? rows[0].DATA_TYPE : null;
}

module.exports = {
  async up(queryInterface) {
    for (const [table, column, defaultExpr, extra] of COLUMNS) {
      const currentType = await getColumnDataType(queryInterface, table, column);
      if (!currentType) continue;
      if (currentType.toLowerCase() === 'datetime') continue; // Idempotent

      const defaultClause =
        defaultExpr === 'NULL' ? 'NULL DEFAULT NULL' : `NULL DEFAULT ${defaultExpr}`;
      const extraClause = extra ? ` ${extra}` : '';
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` DATETIME ${defaultClause}${extraClause}`,
      );
    }
  },

  async down(queryInterface) {
    // Revert về TIMESTAMP — same defaults
    for (const [table, column, defaultExpr, extra] of COLUMNS) {
      const currentType = await getColumnDataType(queryInterface, table, column);
      if (!currentType) continue;
      if (currentType.toLowerCase() === 'timestamp') continue;

      const defaultClause =
        defaultExpr === 'NULL' ? 'NULL DEFAULT NULL' : `NULL DEFAULT ${defaultExpr}`;
      const extraClause = extra ? ` ${extra}` : '';
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` TIMESTAMP ${defaultClause}${extraClause}`,
      );
    }
  },
};
