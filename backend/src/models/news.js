const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const News = sequelize.define(
  'News',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    thumbnail: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT, // Mô tả ngắn
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'Tin tức',
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    tags: {
        type: DataTypes.STRING(500), // Các tag cách nhau bằng dấu phẩy
        allowNull: true,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Cho phép null để hỗ trợ bài đăng hệ thống hoặc khi xóa user
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    tableName: 'news',
    timestamps: true,
    paranoid: true,
    underscored: true,
  }
);

module.exports = News;
