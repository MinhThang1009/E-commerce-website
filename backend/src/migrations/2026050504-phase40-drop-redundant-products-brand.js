'use strict';

// Phase 40.7 — DROP redundant column products.brand (VARCHAR 255)
// Idempotent: skip nếu column đã bị drop
//
// AUDIT đã verify (2026-05-05):
//   - DB: 45/45 products dùng brand_id (FK), 0/45 có giá trị string trong column brand
//   - Model `product.js`: KHÔNG define field `brand`, chỉ có `brandId`
//   - Codebase: mọi `.brand` là Brand association object (alias `as: 'brand'`) hoặc CSV row.brand → chuyển thành brand_id
//   - Frontend: KHÔNG có TypeScript type nào define `brand: string` cho Product
//
// Down: thêm lại column NULLABLE để rollback an toàn (KHÔNG khôi phục data vì data đã NULL hết)

async function columnExists(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] },
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface) {
    if (await columnExists(queryInterface, 'products', 'brand')) {
      await queryInterface.sequelize.query('ALTER TABLE `products` DROP COLUMN `brand`');
    }
  },

  async down(queryInterface) {
    if (!(await columnExists(queryInterface, 'products', 'brand'))) {
      await queryInterface.sequelize.query(
        'ALTER TABLE `products` ADD COLUMN `brand` VARCHAR(255) NULL DEFAULT NULL',
      );
    }
  },
};
