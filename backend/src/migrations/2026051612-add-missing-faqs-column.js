'use strict';
/**
 * Migration `2025122401` đã ghi vào sequelizemeta nhưng column faqs
 * không thực sự tồn tại trên DB này — bổ sung nếu thiếu.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [results] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'faqs'`,
    );
    if (results.length === 0) {
      await queryInterface.addColumn('products', 'faqs', {
        type: Sequelize.TEXT,
        allowNull: true,
        after: 'seo_keywords',
      });
      console.log('  ADDED: products.faqs');
    } else {
      console.log('  SKIP: products.faqs already exists');
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('products', 'faqs');
  },
};
