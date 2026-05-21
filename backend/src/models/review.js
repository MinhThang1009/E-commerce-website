const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

const Review = sequelize.define(
  'Review',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    variantId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    likes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    dislikes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    images: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
  },
  {
    tableName: 'product_reviews',
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = Review;
