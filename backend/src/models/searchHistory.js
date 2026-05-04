const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

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
      field: 'user_id',
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'session_id',
    },
    keyword: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    resultsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'results_count',
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
