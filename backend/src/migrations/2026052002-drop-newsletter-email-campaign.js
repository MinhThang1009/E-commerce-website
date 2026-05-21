'use strict';

// Migration: xóa hoàn toàn tính năng newsletter + email campaign khỏi project.
// Drop 2 bảng `email_campaigns` và `newsletter_subscribers`.
// `down()` tái tạo schema gốc để có thể rollback.

module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('email_campaigns');
    await queryInterface.dropTable('newsletter_subscribers');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('email_campaigns', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      subject: { type: Sequelize.STRING, allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.ENUM('draft', 'sent'), defaultValue: 'draft' },
      sent_at: { type: Sequelize.DATE },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable('newsletter_subscribers', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      email: { type: Sequelize.STRING(255), allowNull: false },
      status: {
        type: Sequelize.ENUM('active', 'unsubscribed'),
        defaultValue: 'active',
      },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
  },
};
