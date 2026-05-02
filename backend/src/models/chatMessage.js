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
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
  },
  {
    tableName: 'chat_messages',
    timestamps: true,
    underscored: false,
  }
);

module.exports = ChatMessage;
