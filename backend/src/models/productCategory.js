const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ProductCategory = sequelize.define(
  'ProductCategory',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: 'product_categories',
    timestamps: true,
    underscored: false,
  }
);

module.exports = ProductCategory;
