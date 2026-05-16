const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AttributeGroup = sequelize.define(
  'AttributeGroup',
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'custom',
      validate: {
        isIn: [['color', 'config', 'storage', 'size', 'custom']],
      },
    },
    isRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'attribute_groups',
    timestamps: true,
    underscored: true,
  }
);

module.exports = AttributeGroup;
