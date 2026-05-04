const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const DiscountCode = sequelize.define(
  'DiscountCode',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    type: {
      type: DataTypes.ENUM('percent', 'fixed'),
      allowNull: false,
      defaultValue: 'fixed',
    },
    value: {
      type: DataTypes.DECIMAL(19, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    minOrderAmount: {
      type: DataTypes.DECIMAL(19, 2),
      allowNull: true,
      defaultValue: 0,
    },
    maxDiscountAmount: {
      type: DataTypes.DECIMAL(19, 2),
      allowNull: true, // Giới hạn tối đa áp dụng cho loại giảm theo phần trăm
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    usageLimit: {
      type: DataTypes.INTEGER,
      allowNull: true, // null nghĩa là không giới hạn số lần dùng
    },
    usedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'discount_codes',
    timestamps: true,
    paranoid: true,
    underscored: true,
  }
);

module.exports = DiscountCode;
