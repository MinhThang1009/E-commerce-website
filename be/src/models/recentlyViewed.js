const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const RecentlyViewed = sequelize.define(
  'RecentlyViewed',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id',
    },
    viewedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'viewed_at',
    },
  },
  {
    tableName: 'recently_viewed',
    timestamps: true,
    underscored: true,
  }
);

module.exports = RecentlyViewed;
