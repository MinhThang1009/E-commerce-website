'use strict';

// Phase 40.6 — Thống nhất DECIMAL precision = DECIMAL(15,2) cho 17 monetary columns
// Đủ cho VND: max 999,999,999,999.99 ≈ 10^12 đồng (1 nghìn tỷ); max precision 15 = 9.99 * 10^12
// Idempotent: skip nếu column đã DECIMAL(15,2)
//
// PRE-FLIGHT đã verify (2026-05-05):
//   - MAX(orders.subtotal) = 24,990,000 < 10^13 ✓
//   - MAX(orders.total) = 24,990,000 < 10^13 ✓
//   - MAX(discount_codes.max_discount_amount) = 5,000,000 < 10^13 ✓
//   - MAX(warranty_packages.price) = 1,500,000 < 10^13 ✓
//   - order_items / cart_items / attribute_values: 0 rows ✓
//   - Tất cả MAX < 9,999,999,999,999.99 → safe to shrink hoặc grow
//
// 17 columns shrink/grow:
//   - 14 cols: DECIMAL(19,2) → DECIMAL(15,2) [shrink]
//   - 3 cols: DECIMAL(12,2) → DECIMAL(15,2) [grow] (attribute_values.price_adjustment, warranty_packages.price)

const TARGET_TYPE = 'DECIMAL(15,2)';

const COLUMNS = [
  // [table, column, isNullable, columnDefault] — preserve nullability + default
  ['orders', 'subtotal', false, null],
  ['orders', 'tax', false, null],
  ['orders', 'shipping_cost', false, null],
  ['orders', 'discount', true, '0.00'],
  ['orders', 'total', false, null],
  ['orders', 'points_discount', true, '0.00'],
  ['orders', 'warranty_cost', true, '0.00'],
  ['orders', 'refund_amount', true, null],
  ['order_items', 'unit_price', false, null],
  ['order_items', 'subtotal', false, null],
  ['order_items', 'discount_amount', false, '0.00'],
  ['cart_items', 'unit_price', false, null],
  ['discount_codes', 'value', false, null],
  ['discount_codes', 'min_order_amount', true, '0.00'],
  ['discount_codes', 'max_discount_amount', true, null],
  ['attribute_values', 'price_adjustment', true, '0.00'],
  ['warranty_packages', 'price', false, '0.00'],
];

async function getColumnType(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] },
  );
  return rows[0] ? rows[0].COLUMN_TYPE : null;
}

function buildModifySql(table, column, type, isNullable, columnDefault) {
  const nullClause = isNullable ? 'NULL' : 'NOT NULL';
  let defaultClause = '';
  if (columnDefault !== null) {
    defaultClause = ` DEFAULT '${columnDefault}'`;
  } else if (isNullable) {
    defaultClause = ' DEFAULT NULL';
  }
  return `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${type} ${nullClause}${defaultClause}`;
}

module.exports = {
  async up(queryInterface) {
    for (const [table, column, isNullable, defVal] of COLUMNS) {
      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) {
        // Cột không tồn tại — skip (có thể migration trước chưa chạy)
        continue;
      }
      if (currentType.toLowerCase() === 'decimal(15,2)') {
        // Idempotent — đã đúng type, skip
        continue;
      }
      const sql = buildModifySql(table, column, TARGET_TYPE, isNullable, defVal);
      await queryInterface.sequelize.query(sql);
    }
  },

  async down(queryInterface) {
    // Rollback về DECIMAL(19,2) cho 14 cols, DECIMAL(12,2) cho 3 cols
    const ROLLBACK = [
      ['orders', 'subtotal', 'DECIMAL(19,2)', false, null],
      ['orders', 'tax', 'DECIMAL(19,2)', false, null],
      ['orders', 'shipping_cost', 'DECIMAL(19,2)', false, null],
      ['orders', 'discount', 'DECIMAL(19,2)', true, '0.00'],
      ['orders', 'total', 'DECIMAL(19,2)', false, null],
      ['orders', 'points_discount', 'DECIMAL(19,2)', true, '0.00'],
      ['orders', 'warranty_cost', 'DECIMAL(19,2)', true, '0.00'],
      ['orders', 'refund_amount', 'DECIMAL(19,2)', true, null],
      ['order_items', 'unit_price', 'DECIMAL(19,2)', false, null],
      ['order_items', 'subtotal', 'DECIMAL(19,2)', false, null],
      ['order_items', 'discount_amount', 'DECIMAL(19,2)', false, '0.00'],
      ['cart_items', 'unit_price', 'DECIMAL(19,2)', false, null],
      ['discount_codes', 'value', 'DECIMAL(19,2)', false, null],
      ['discount_codes', 'min_order_amount', 'DECIMAL(19,2)', true, '0.00'],
      ['discount_codes', 'max_discount_amount', 'DECIMAL(19,2)', true, null],
      ['attribute_values', 'price_adjustment', 'DECIMAL(12,2)', true, '0.00'],
      ['warranty_packages', 'price', 'DECIMAL(12,2)', false, '0.00'],
    ];
    for (const [table, column, type, isNullable, defVal] of ROLLBACK) {
      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) continue;
      if (currentType.toLowerCase() === type.toLowerCase()) continue;
      const sql = buildModifySql(table, column, type, isNullable, defVal);
      await queryInterface.sequelize.query(sql);
    }
  },
};
