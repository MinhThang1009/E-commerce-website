const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

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
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // Phân biệt tin nhắn của user hay AI assistant
    role: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: true,
    },
    messageType: {
      type: DataTypes.ENUM('ai_chatbot', 'support_chat'),
      allowNull: false,
      defaultValue: 'ai_chatbot',
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
    },
    // Đánh dấu khi chatbot rơi vào fallback mode thay vì dùng LLM
    isFallback: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Đánh dấu tin nhắn đã được archive (cleanup job đặt true cho messages cũ hơn 90 ngày)
    isArchived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // JSON string: { products, suggestions } cho assistant messages — dùng cho demo sync
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'chat_messages',
    timestamps: true,
    underscored: true,
  },
);

module.exports = ChatMessage;
