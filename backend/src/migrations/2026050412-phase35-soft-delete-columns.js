'use strict';

// Thêm cột deletedAt cho soft delete trên users, orders, discount_codes
// và cột is_archived cho chat_messages
module.exports = {
  async up(queryInterface, Sequelize) {
    // Users — soft delete
    await queryInterface.addColumn('users', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    // Orders — soft delete
    await queryInterface.addColumn('orders', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    // Discount codes — soft delete
    await queryInterface.addColumn('discount_codes', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    // Chat messages — archive flag thay vì xóa
    await queryInterface.addColumn('chat_messages', 'is_archived', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'deletedAt');
    await queryInterface.removeColumn('orders', 'deletedAt');
    await queryInterface.removeColumn('discount_codes', 'deletedAt');
    await queryInterface.removeColumn('chat_messages', 'is_archived');
  },
};
