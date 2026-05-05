// Migration: tạo bảng import_logs để lưu lịch sử import sản phẩm của admin
// Fix Phase 40 Group C: INT UNSIGNED → INT (signed) để FK match users.id (INT signed)
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('import_logs', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      // Admin thực hiện import (INT signed để match users.id)
      admin_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      // Tên file đã upload
      filename: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      // Tổng số dòng trong file (không tính header)
      total_rows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // Số dòng import thành công
      success_rows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // Số dòng thất bại (validation error hoặc DB error)
      failed_rows: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // Chi tiết lỗi từng dòng (JSON array: [{ row, field, message }])
      error_detail: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      // Thời điểm import
      imported_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('import_logs');
  },
};
