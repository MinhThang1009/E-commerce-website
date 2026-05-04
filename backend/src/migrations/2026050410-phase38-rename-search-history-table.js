'use strict';

// Phase 38: đổi tên bảng search_history → search_histories
// Lý do: chuẩn naming convention "số nhiều" — nhất quán với audit_logs, loyalty_histories
// Table stores nhiều records → dùng tên số nhiều

module.exports = {
  async up(queryInterface) {
    await queryInterface.renameTable('search_history', 'search_histories');
  },

  async down(queryInterface) {
    await queryInterface.renameTable('search_histories', 'search_history');
  },
};
