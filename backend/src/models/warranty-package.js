const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

const WarrantyPackage = sequelize.define(
  'WarrantyPackage',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    durationMonths: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    terms: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    coverage: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: 'warranty_packages',
    timestamps: true,
    underscored: true,
  },
);

module.exports = WarrantyPackage;
