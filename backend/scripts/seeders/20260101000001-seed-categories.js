'use strict';
/**
 * Seeder: categories — 5 danh mục sản phẩm.
 * Idempotent: dùng INSERT IGNORE, rollback DELETE WHERE name IN (...).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO categories (name_vi, name_en, slug, description_vi, description_en, created_at, updated_at) VALUES
      ('Điện thoại', 'Phones', 'dien-thoai', 'Tất cả các dòng điện thoại di động thông minh', 'All Smartphones', NOW(), NOW()),
      ('Tablet', 'Tablets', 'tablet', 'Tất cả các dòng máy tính bảng', 'All Tablets', NOW(), NOW()),
      ('Laptop', 'Laptops', 'laptop', 'Tất cả các dòng máy tính xách tay', 'All Laptops', NOW(), NOW()),
      ('Smartwatch', 'Smartwatches', 'smartwatch', 'Tất cả các dòng đồng hồ thông minh', 'All Smartwatches', NOW(), NOW()),
      ('Đồng hồ', 'Watches', 'dong-ho', 'Tất cả các dòng đồng hồ đeo tay truyền thống', 'All Traditional Watches', NOW(), NOW())
    `);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('categories', {
      slug: ['dien-thoai', 'tablet', 'laptop', 'smartwatch', 'dong-ho'],
    });
  },
};
