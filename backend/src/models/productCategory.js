const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ProductCategory = sequelize.define(
  'ProductCategory',
  {
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      field: 'product_id',
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      field: 'category_id',
    },
  },
  {
    tableName: 'product_categories',
    timestamps: true,
    underscored: false,
  }
);

module.exports = ProductCategory;
