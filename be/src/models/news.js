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
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    thumbnail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT, // Short description
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Tin tức',
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    tags: {
        type: DataTypes.STRING, // Comma separated tags
        allowNull: true,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Optional if we want to allow system posts or delete user
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    tableName: 'news',
    timestamps: true,
    underscored: true,
  }
);

module.exports = News;
