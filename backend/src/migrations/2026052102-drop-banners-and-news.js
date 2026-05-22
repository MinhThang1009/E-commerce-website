'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('banners');
    await queryInterface.dropTable('news');
  },

  async down() {
    // Không khôi phục — tables đã bị xóa có chủ đích
  },
};
