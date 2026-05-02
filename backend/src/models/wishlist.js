const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Wishlist = sequelize.define(
  'Wishlist',
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
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: 'wishlists',
    timestamps: true,
    underscored: false,
  }
);

module.exports = Wishlist;
