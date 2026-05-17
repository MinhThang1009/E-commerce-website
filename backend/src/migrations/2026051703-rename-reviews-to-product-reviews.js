'use strict';

// Đổi tên reviews → product_reviews cho nhất quán với convention product_* của project.
// Đồng thời DROP bảng product_reviews cũ (orphan, 0 rows, không có model).
module.exports = {
  async up(queryInterface) {
    // 1. DROP orphan product_reviews (không có model, không có data)
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS `product_reviews`');

    // 2. Drop FK trên review_feedbacks trước khi rename
    await queryInterface.sequelize.query(
      'ALTER TABLE `review_feedbacks` DROP FOREIGN KEY `fk_review_feedbacks_review`'
    );

    // 3. Rename reviews → product_reviews
    await queryInterface.renameTable('reviews', 'product_reviews');

    // 4. Re-create FK review_feedbacks → product_reviews
    await queryInterface.sequelize.query(`
      ALTER TABLE \`review_feedbacks\`
        ADD CONSTRAINT \`fk_review_feedbacks_review\`
        FOREIGN KEY (\`review_id\`) REFERENCES \`product_reviews\`(\`id\`)
        ON UPDATE CASCADE ON DELETE CASCADE
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE `review_feedbacks` DROP FOREIGN KEY `fk_review_feedbacks_review`'
    );
    await queryInterface.renameTable('product_reviews', 'reviews');
    await queryInterface.sequelize.query(`
      ALTER TABLE \`review_feedbacks\`
        ADD CONSTRAINT \`fk_review_feedbacks_review\`
        FOREIGN KEY (\`review_id\`) REFERENCES \`reviews\`(\`id\`)
        ON UPDATE CASCADE ON DELETE CASCADE
    `);
  },
};
