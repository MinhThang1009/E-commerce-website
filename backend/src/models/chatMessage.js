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
