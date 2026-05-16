const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ReviewFeedback = sequelize.define(
  'ReviewFeedback',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    reviewId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    isHelpful: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  },
  {
    tableName: 'review_feedbacks',
    timestamps: true,
    underscored: true,
    indexes: [
      { name: 'uq_review_feedbacks_review_user', unique: true, fields: ['review_id', 'user_id'] },
    ],
  }
);

module.exports = ReviewFeedback;
