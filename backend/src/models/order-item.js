const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

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
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Giá của 1 unit tại thời điểm đặt hàng (snapshot giá)
    unitPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    // Số tiền giảm giá áp dụng cho item này (ví dụ: từ sale, discountCode cấp item)
    discountAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    attributes: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    warrantyPackageIds: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'order_items',
    timestamps: true,
    underscored: true,
  },
);

module.exports = OrderItem;
