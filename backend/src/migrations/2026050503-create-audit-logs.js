'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      // ID admin thực hiện hành động
      admin_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      // Loại hành động: CREATE, UPDATE, DELETE, LOGIN, BAN, ROLE_CHANGE, v.v.
      action: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      // Loại entity bị tác động: product, order, user, discount_code, v.v.
      entity_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      // ID của entity cụ thể bị tác động
      entity_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      // Giá trị cũ trước khi thay đổi (JSON serialized)
      old_value: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // Giá trị mới sau khi thay đổi (JSON serialized)
      new_value: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // IP address của admin thực hiện hành động
      ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // Index để query nhanh theo admin, entity, và thời gian
    await queryInterface.addIndex('audit_logs', ['admin_id']);
    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
