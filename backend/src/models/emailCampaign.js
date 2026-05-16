const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const EmailCampaign = sequelize.define(
  'EmailCampaign',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('draft', 'sent'),
      defaultValue: 'draft',
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'email_campaigns',
    timestamps: true,
    underscored: true,
  }
);

module.exports = EmailCampaign;
