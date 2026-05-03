'use strict';

module.exports = {
  // Thêm các trường Phase 10 cho chat_messages:
  // - status: trạng thái gửi/nhận (sent → delivered → read)
  // - content_type: loại nội dung (text, image, product_card)
  // - attachment_url: URL đính kèm khi content_type = 'image'
  // - product_id: FK tới products khi content_type = 'product_card'
  // - read_at: timestamp khi tin nhắn được đọc
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('chat_messages', 'status', {
      type: Sequelize.ENUM('sent', 'delivered', 'read'),
      allowNull: false,
      defaultValue: 'sent',
      after: 'isRead',
    });

    await queryInterface.addColumn('chat_messages', 'content_type', {
      type: Sequelize.ENUM('text', 'image', 'product_card'),
      allowNull: false,
      defaultValue: 'text',
      after: 'status',
    });

    await queryInterface.addColumn('chat_messages', 'attachment_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'content_type',
    });

    await queryInterface.addColumn('chat_messages', 'product_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'attachment_url',
      references: { model: 'products', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('chat_messages', 'read_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'product_id',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('chat_messages', 'read_at');
    await queryInterface.removeColumn('chat_messages', 'product_id');
    await queryInterface.removeColumn('chat_messages', 'attachment_url');
    await queryInterface.removeColumn('chat_messages', 'content_type');
    await queryInterface.removeColumn('chat_messages', 'status');
  },
};
