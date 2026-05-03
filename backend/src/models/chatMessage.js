const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ChatMessage = sequelize.define(
  'ChatMessage',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Cho phép NULL để AI assistant messages không cần senderId
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isFromAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Trạng thái gửi/nhận tin nhắn (sent → delivered → read)
    status: {
      type: DataTypes.ENUM('sent', 'delivered', 'read'),
      defaultValue: 'sent',
    },
    // Loại nội dung tin nhắn (text, hình ảnh, product card)
    contentType: {
      type: DataTypes.ENUM('text', 'image', 'product_card'),
      defaultValue: 'text',
      field: 'content_type',
    },
    // URL đính kèm khi contentType = 'image'
    attachmentUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'attachment_url',
    },
    // FK tới products khi contentType = 'product_card' (admin chia sẻ sản phẩm)
    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'product_id',
    },
    // Thời điểm tin nhắn được đọc
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at',
    },
    // Phân biệt tin nhắn của user hay AI assistant
    role: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: true,
    },
    // Phân biệt AI chatbot messages vs support chat (để admin dashboard không lẫn lộn)
    messageType: {
      type: DataTypes.ENUM('ai_chatbot', 'support_chat'),
      allowNull: false,
      defaultValue: 'support_chat',
      field: 'message_type',
    },
    // Intent được phân loại từ tin nhắn user (product_search, general, off_topic...)
    intent: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    // Thời gian xử lý RAG pipeline (ms) để monitor hiệu năng
    responseTimeMs: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'response_time_ms',
    },
    // Đánh dấu khi chatbot rơi vào fallback mode thay vì dùng LLM
    isFallback: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_fallback',
    },
  },
  {
    tableName: 'chat_messages',
    timestamps: true,
    underscored: false,
  }
);

module.exports = ChatMessage;
