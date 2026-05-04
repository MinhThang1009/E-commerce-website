'use strict';

module.exports = {
  // Thêm các trường cần thiết cho AI chatbot vào bảng chat_messages:
  // - role: phân biệt tin nhắn của user hay assistant
  // - message_type: phân biệt AI chatbot messages vs support chat (Phase 10)
  // - intent: lưu intent được phân loại (product_search, general, off_topic...)
  // - response_time_ms: đo hiệu năng RAG pipeline
  // - is_fallback: đánh dấu khi chatbot rơi vào fallback mode
  // - sender_id: cho phép NULL để AI assistant messages không cần userId
  async up(queryInterface, Sequelize) {
    // Cho phép senderId là NULL (AI assistant không có userId)
    // Model dùng underscored: false nên tên cột là camelCase
    await queryInterface.changeColumn('chat_messages', 'senderId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Thêm role để phân biệt user vs assistant trong conversation
    await queryInterface.addColumn('chat_messages', 'role', {
      type: Sequelize.ENUM('user', 'assistant'),
      allowNull: true,
      after: 'isRead',
    });

    // Thêm message_type để phân biệt AI chatbot vs support chat
    // Default 'support_chat' để không ảnh hưởng dữ liệu cũ
    await queryInterface.addColumn('chat_messages', 'message_type', {
      type: Sequelize.ENUM('ai_chatbot', 'support_chat'),
      allowNull: false,
      defaultValue: 'support_chat',
      after: 'role',
    });

    // Thêm intent để track loại yêu cầu người dùng
    await queryInterface.addColumn('chat_messages', 'intent', {
      type: Sequelize.STRING(50),
      allowNull: true,
      after: 'message_type',
    });

    // Thêm response_time_ms để monitor hiệu năng RAG
    await queryInterface.addColumn('chat_messages', 'response_time_ms', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      after: 'intent',
    });

    // Thêm is_fallback để biết khi nào chatbot dùng fallback thay vì LLM
    await queryInterface.addColumn('chat_messages', 'is_fallback', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'response_time_ms',
    });
  },

  async down(queryInterface, Sequelize) {
    // Xóa các cột đã thêm (thứ tự ngược)
    await queryInterface.removeColumn('chat_messages', 'is_fallback');
    await queryInterface.removeColumn('chat_messages', 'response_time_ms');
    await queryInterface.removeColumn('chat_messages', 'intent');
    await queryInterface.removeColumn('chat_messages', 'message_type');
    await queryInterface.removeColumn('chat_messages', 'role');

    // Restore senderId về NOT NULL
    await queryInterface.changeColumn('chat_messages', 'senderId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
