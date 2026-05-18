const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

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
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    viewedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'recently_viewed_products',
    timestamps: true,
    underscored: true,
    indexes: [
      { name: 'idx_rvp_user_product', fields: ['user_id', 'product_id'] },
    ],
  }
);

module.exports = RecentlyViewed;
