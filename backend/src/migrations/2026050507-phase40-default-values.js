'use strict';

// Phase 40.20 — Standardize DEFAULT 0.00 cho 11 DECIMAL pricing columns
// Idempotent: skip nếu DEFAULT đã đúng 0.00
//
// PRE-FLIGHT đã verify (2026-05-05):
//   - 11 columns có DEFAULT NULL — cần đổi sang 0.00
//   - 2 columns đã đúng (order_items.discount_amount, warranty_packages.price) — skip

const COLUMNS = [
  // [table, column, isNullable]
  ['products', 'base_price', true],
  ['products', 'compare_at_price', true],
  ['product_variants', 'price', true],
  ['product_variants', 'compare_at_price', true],
  ['order_items', 'unit_price', false],
  ['order_items', 'subtotal', false],
  ['cart_items', 'unit_price', false],
  ['orders', 'subtotal', false],
  ['orders', 'tax', false],
  ['orders', 'shipping_cost', false],
  ['orders', 'total', false],
];

async function getColumnDefault(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] },
  );
  return rows[0] ? rows[0].COLUMN_DEFAULT : undefined;
}

module.exports = {
  async up(queryInterface) {
    for (const [table, column, isNullable] of COLUMNS) {
      const currentDefault = await getColumnDefault(queryInterface, table, column);
      if (currentDefault === '0.00') continue; // Idempotent
      const nullClause = isNullable ? 'NULL' : 'NOT NULL';
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` DECIMAL(15,2) ${nullClause} DEFAULT 0.00`,
      );
    }
  },

  async down(queryInterface) {
    for (const [table, column, isNullable] of COLUMNS) {
      const nullClause = isNullable ? 'NULL DEFAULT NULL' : 'NOT NULL';
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` DECIMAL(15,2) ${nullClause}`,
      );
    }
  },
};
