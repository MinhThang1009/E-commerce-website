'use strict';

module.exports = {
  async up(queryInterface) {
    // Xóa FK constraint trước
    try {
      await queryInterface.removeConstraint('audit_logs', 'fk_audit_logs_user');
    } catch (_) {
      /* constraint có thể tên khác hoặc không tồn tại */
    }
    try {
      await queryInterface.removeConstraint('audit_logs', 'audit_logs_ibfk_1');
    } catch (_) {}

    await queryInterface.dropTable('audit_logs', { cascade: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      adminId: { type: Sequelize.INTEGER, allowNull: false, field: 'admin_id' },
      action: { type: Sequelize.STRING(50), allowNull: false },
      entityType: { type: Sequelize.STRING(50), allowNull: false, field: 'entity_type' },
      entityId: { type: Sequelize.INTEGER, allowNull: true, field: 'entity_id' },
      oldValue: { type: Sequelize.TEXT, allowNull: true, field: 'old_value' },
      newValue: { type: Sequelize.TEXT, allowNull: true, field: 'new_value' },
      ip: { type: Sequelize.STRING(45), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: Sequelize.DATE, allowNull: false, field: 'updated_at' },
    });
  },
};
