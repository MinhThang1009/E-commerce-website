const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

// DB có id auto_increment PK + unique(product_id, category_id).
// Model phải khớp: id là PK, productId/categoryId là FK bình thường.
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
    underscored: true,
    indexes: [
      { name: 'uq_pcat_product_category', unique: true, fields: ['product_id', 'category_id'] },
    ],
  },
);

module.exports = ProductCategory;
