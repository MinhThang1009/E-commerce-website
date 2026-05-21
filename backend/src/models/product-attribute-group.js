const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

const ProductAttributeGroup = sequelize.define(
  'ProductAttributeGroup',
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
    attributeGroupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    isRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: 'product_attribute_groups',
    timestamps: true,
    underscored: true,
  },
);

module.exports = ProductAttributeGroup;
