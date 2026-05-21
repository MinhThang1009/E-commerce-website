'use strict';

// Phase 40.22 — Add 19 CHECK constraints để enforce business rules ở DB level
// Idempotent: skip nếu CHECK constraint cùng tên đã tồn tại
//
// PRE-FLIGHT đã verify (2026-05-05):
//   - 0 rows hiện tại violate bất kỳ rule nào trong 19 CHECKs
//   - MariaDB 10.4.32 fully enforces CHECK constraints (verified)

const CHECKS = [
  // [table, name, expression]
  ['products', 'chk_products_rating_average', 'rating_average >= 0.00 AND rating_average <= 5.00'],
  ['products', 'chk_products_stock_quantity', 'stock_quantity >= 0'],
  ['product_variants', 'chk_product_variants_stock_quantity', 'stock_quantity >= 0'],
  ['cart_items', 'chk_cart_items_quantity', 'quantity >= 1'],
  ['order_items', 'chk_order_items_quantity', 'quantity >= 1'],
  ['products', 'chk_products_base_price', 'base_price IS NULL OR base_price >= 0'],
  ['product_variants', 'chk_product_variants_price', 'price IS NULL OR price >= 0'],
  ['order_items', 'chk_order_items_unit_price', 'unit_price >= 0'],
  ['order_items', 'chk_order_items_subtotal', 'subtotal >= 0'],
  ['cart_items', 'chk_cart_items_unit_price', 'unit_price >= 0'],
  ['warranty_packages', 'chk_warranty_packages_price', 'price >= 0'],
  ['orders', 'chk_orders_subtotal', 'subtotal >= 0'],
  ['orders', 'chk_orders_tax', 'tax >= 0'],
  ['orders', 'chk_orders_total', 'total >= 0'],
  ['orders', 'chk_orders_discount', 'discount >= 0'],
  ['users', 'chk_users_loyalty_points', 'loyalty_points >= 0'],
  ['discount_codes', 'chk_discount_codes_value', 'value >= 0'],
  ['warranty_packages', 'chk_warranty_packages_duration', 'duration_months >= 1'],
  ['products', 'chk_products_warranty_months', 'warranty_months >= 0'],
];

async function checkExists(qi, table, name) {
  const [rows] = await qi.sequelize.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'`,
    { replacements: [table, name] },
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface) {
    for (const [table, name, expr] of CHECKS) {
      if (await checkExists(queryInterface, table, name)) continue;
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` CHECK (${expr})`,
      );
    }
  },

  async down(queryInterface) {
    for (const [table, name] of CHECKS) {
      if (!(await checkExists(queryInterface, table, name))) continue;
      await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` DROP CONSTRAINT \`${name}\``);
    }
  },
};
