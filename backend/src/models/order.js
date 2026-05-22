const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

const Order = sequelize.define(
  'Order',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
      defaultValue: 'pending',
    },
    shippingFirstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    shippingLastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    shippingCompany: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shippingAddress1: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    shippingAddress2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shippingCity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    shippingState: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '',
    },
    shippingZip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shippingCountry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shippingPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billingFirstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    billingLastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    billingCompany: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billingAddress1: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    billingAddress2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billingCity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    billingState: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '',
    },
    billingZip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billingCountry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billingPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending',
    },
    paymentTransactionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentProvider: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    tax: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    shippingCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    trackingNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shippingProvider: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    estimatedDelivery: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // FK tới discount_codes — biết mã nào đã áp dụng, phục vụ audit trail
    discountCodeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Timestamp khi order bị huỷ (null nếu chưa huỷ)
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Timestamp khi order được hoàn tiền
    refundedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Số tiền được hoàn (có thể hoàn một phần)
    refundAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
  },
  {
    tableName: 'orders',
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      { name: 'idx_orders_status', fields: ['status'] },
      { name: 'idx_orders_created_at', fields: ['created_at'] },
      { name: 'idx_orders_payment_status', fields: ['payment_status'] },
    ],
  },
);

module.exports = Order;
