const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ProductSpecification = sequelize.define(
  'ProductSpecification',
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    valueEn: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'value_en',
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'General',
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: 'product_specifications',
    timestamps: true,
    underscored: true,
  }
);

module.exports = ProductSpecification;
