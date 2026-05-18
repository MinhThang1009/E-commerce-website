const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

const SearchHistory = sequelize.define(
  'SearchHistory',
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
    keyword: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    resultsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: 'search_histories',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = SearchHistory;
