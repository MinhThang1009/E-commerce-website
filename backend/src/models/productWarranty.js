const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ProductWarranty = sequelize.define(
  'ProductWarranty',
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
    warrantyPackageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'warranty_package_id',
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_default',
    },
  },
  {
    tableName: 'product_warranties',
    timestamps: true,
    underscored: true,
  }
);

module.exports = ProductWarranty;
