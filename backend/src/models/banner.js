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
      type: DataTypes.STRING,
      allowNull: false,
      field: 'image_url',
    },
    linkUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'link_url',
    },
    position: {
      type: DataTypes.ENUM('home_hero', 'home_middle', 'sidebar'),
      defaultValue: 'home_hero',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: 'banners',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Banner;
