const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

const Cart = sequelize.define(
  'Cart',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'merged', 'converted', 'abandoned'),
      defaultValue: 'active',
    },
  },
  {
    tableName: 'carts',
    timestamps: true,
    underscored: true,
  },
);

module.exports = Cart;
