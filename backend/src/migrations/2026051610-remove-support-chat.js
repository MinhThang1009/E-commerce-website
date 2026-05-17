'use strict';

/**
 * Xóa bỏ tính năng support chat realtime (Socket.IO).
 * Bảng chat_messages giữ lại cho AI chatbot (messageType = 'ai_chatbot').
 *
 * Up:
 *   1. Purge tất cả support_chat messages (và NULL legacy).
 *   2. Drop FK constraints referencing sender/product.
 *   3. Drop 8 cột chỉ dùng cho support chat.
 *
 * Down: không khôi phục data đã xóa, chỉ restore schema.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Purge support_chat messages
    await queryInterface.sequelize.query(
      `DELETE FROM chat_messages WHERE message_type = 'support_chat' OR message_type IS NULL`
    );

    // 2. Drop FK constraints
    await queryInterface.removeConstraint('chat_messages', 'fk_chat_messages_sender');
    await queryInterface.removeConstraint('chat_messages', 'fk_chat_messages_product');

    // 3. Drop cột dead (chỉ dùng bởi support chat)
    const dropColumns = [
      'sender_id',
      'is_from_admin',
      'is_read',
      'read_at',
      'status',
      'content_type',
      'attachment_url',
      'product_id',
    ];
    for (const col of dropColumns) {
      await queryInterface.removeColumn('chat_messages', col);
    }
  },

  async down(queryInterface, Sequelize) {
    // Restore schema (data đã purge không thể khôi phục)
    await queryInterface.addColumn('chat_messages', 'sender_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('chat_messages', 'is_from_admin', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn('chat_messages', 'is_read', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn('chat_messages', 'read_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('chat_messages', 'status', {
      type: Sequelize.ENUM('sent', 'delivered', 'read'),
      defaultValue: 'sent',
    });
    await queryInterface.addColumn('chat_messages', 'content_type', {
      type: Sequelize.ENUM('text', 'image', 'product_card'),
      defaultValue: 'text',
    });
    await queryInterface.addColumn('chat_messages', 'attachment_url', {
      type: Sequelize.STRING(512),
      allowNull: true,
    });
    await queryInterface.addColumn('chat_messages', 'product_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
};
