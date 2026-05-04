const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const NewsletterSubscriber = sequelize.define(
  'NewsletterSubscriber',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    status: {
      type: DataTypes.ENUM('active', 'unsubscribed'),
      defaultValue: 'active',
    },
  },
  {
    tableName: 'newsletter_subscribers',
    timestamps: true,
    underscored: true,
  }
);

module.exports = NewsletterSubscriber;
