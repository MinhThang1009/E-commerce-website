const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const BrandCategory = sequelize.define(
  'BrandCategory',
  {
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'brands',
        key: 'id',
      },
      primaryKey: true,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id',
      },
      primaryKey: true,
    },
  },
  {
    tableName: 'brand_categories',
    timestamps: false,
    underscored: true,
  }
);

module.exports = BrandCategory;
