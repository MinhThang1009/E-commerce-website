const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Feedback = sequelize.define(
  'Feedback',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
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
      type: DataTypes.ENUM('pending', 'reviewed', 'resolved'),
      defaultValue: 'pending',
    },
  },
  {
    tableName: 'feedbacks',
    timestamps: true,
    underscored: false,
  }
);

module.exports = Feedback;
