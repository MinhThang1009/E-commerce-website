const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const OrderItem = sequelize.define(
  'OrderItem',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    variantId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(19, 2),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    subtotal: {
      type: DataTypes.DECIMAL(19, 2),
      allowNull: false
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true
    },
    attributes: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    warrantyPackageIds: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'warranty_package_ids'
    },
  },
  {
    tableName: 'order_items',
    timestamps: true,
  }
);

module.exports = OrderItem;
