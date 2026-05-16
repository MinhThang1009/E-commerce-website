const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Banner = sequelize.define(
  'Banner',
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
    imageUrl: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    linkUrl: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    position: {
      type: DataTypes.ENUM('home_hero', 'home_middle', 'sidebar'),
      defaultValue: 'home_hero',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: 'banners',
    timestamps: true,
    paranoid: true, // Soft-delete để admin có thể restore banner đã xóa
    underscored: true,
  }
);

module.exports = Banner;
