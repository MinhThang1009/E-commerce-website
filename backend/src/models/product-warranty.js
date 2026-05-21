const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

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
    },
    warrantyPackageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: 'product_warranties',
    timestamps: true,
    underscored: true,
  },
);

module.exports = ProductWarranty;
