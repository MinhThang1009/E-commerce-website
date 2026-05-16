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
    underscored: true,
    indexes: [
      { name: 'uq_wishlists_user_product', unique: true, fields: ['user_id', 'product_id'] },
    ],
  }
);

module.exports = Wishlist;
