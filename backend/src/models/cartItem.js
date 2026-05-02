const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const CartItem = sequelize.define(
  'CartItem',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    cartId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    variantId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
      },
    },
    price: {
      type: DataTypes.DECIMAL(19, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    warrantyPackageIds: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      field: 'warranty_package_ids',
    },
  },
  {
    tableName: 'cart_items',
    timestamps: true,
    underscored: false,
  }
);

module.exports = CartItem;
