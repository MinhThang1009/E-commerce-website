'use strict';

// Phase 40.21 — NULL/NOT NULL consistency
// Idempotent: skip nếu column đã NOT NULL DEFAULT 'Vietnam'
//
// PRE-FLIGHT đã verify (2026-05-05):
//   - 0 rows orders có NULL hoặc empty shipping_country/billing_country → safe to NOT NULL
//
// Quyết định (per plan.md):
//   - shipping_country / billing_country: NOT NULL DEFAULT 'Vietnam' (mọi order ship Vietnam)
//   - shipping_zip / billing_zip: GIỮ NULLABLE (Vietnam không bắt buộc zip code)

const COLUMNS = [
  ['orders', 'shipping_country'],
  ['orders', 'billing_country'],
];

async function getColumnState(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return rows[0] || null;
}

module.exports = {
  async up(queryInterface) {
    for (const [table, column] of COLUMNS) {
      const state = await getColumnState(queryInterface, table, column);
      if (!state) continue;
      // Idempotent: skip nếu đã NOT NULL + DEFAULT 'Vietnam'
      if (state.IS_NULLABLE === 'NO' && state.COLUMN_DEFAULT === 'Vietnam') continue;
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` VARCHAR(255) NOT NULL DEFAULT 'Vietnam'`
      );
    }
  },

  async down(queryInterface) {
    for (const [table, column] of COLUMNS) {
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` VARCHAR(255) NULL DEFAULT NULL`
      );
    }
  },
};
