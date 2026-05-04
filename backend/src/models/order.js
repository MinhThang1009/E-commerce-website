const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Order = sequelize.define(
  'Order',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled'
      ),
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
      allowNull: false,
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
      allowNull: false,
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
      type: DataTypes.STRING,
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
      type: DataTypes.DECIMAL(19, 2),
      allowNull: false,
    },
    tax: {
      type: DataTypes.DECIMAL(19, 2),
      allowNull: false,
    },
    shippingCost: {
      type: DataTypes.DECIMAL(19, 2),
      allowNull: false,
    },
    discount: {
      type: DataTypes.DECIMAL(19, 2),
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(19, 2),
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
    pointsEarned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    pointsUsed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    pointsDiscount: {
      type: DataTypes.DECIMAL(19, 2),
      defaultValue: 0,
    },
    warrantyCost: {
      type: DataTypes.DECIMAL(19, 2),
      defaultValue: 0,
      field: 'warranty_cost',
    },
    // FK tới discount_codes — biết mã nào đã áp dụng, phục vụ audit trail
    discountCodeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'discount_code_id',
    },
    // Timestamp khi order bị huỷ (null nếu chưa huỷ)
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'cancelled_at',
    },
    // Timestamp khi order được hoàn tiền
    refundedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'refunded_at',
    },
    // Số tiền được hoàn (có thể hoàn một phần)
    refundAmount: {
      type: DataTypes.DECIMAL(19, 2),
      allowNull: true,
      field: 'refund_amount',
    },
  },
  {
    tableName: 'orders',
    timestamps: true,
    paranoid: true,
    underscored: true,
  }
);

module.exports = Order;
