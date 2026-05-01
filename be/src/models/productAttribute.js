const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ProductAttribute = sequelize.define(
  'ProductAttribute',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('color', 'size', 'material', 'custom'),
      allowNull: false,
      defaultValue: 'custom',
    },
    values: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order',
    },
  },
  {
    tableName: 'product_attributes',
    timestamps: true,
  }
);

module.exports = ProductAttribute;
