const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

const LoyaltyHistory = sequelize.define(
  'LoyaltyHistory',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('earn', 'spend', 'refund', 'adjustment'),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'loyalty_histories',
    timestamps: true,
    underscored: true,
  }
);

module.exports = LoyaltyHistory;
