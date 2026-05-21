const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

const AttributeValue = sequelize.define(
  'AttributeValue',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    attributeGroupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    colorCode: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isValidColor(value) {
          if (value && !/^#[0-9A-F]{6}$/i.test(value)) {
            throw new Error('Mã màu phải ở định dạng hex (ví dụ: #FF0000)');
          }
        },
      },
    },
    imageUrl: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    priceAdjustment: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Trường mới: xác định giá trị thuộc tính này có ảnh hưởng tên sản phẩm không
    affectsName: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Trường mới: template tên dùng để đặt tên sản phẩm
    nameTemplate: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Template tên sản phẩm (ví dụ: "I9", "RTX 4080", "32GB")',
    },
  },
  {
    tableName: 'attribute_values',
    timestamps: true,
    underscored: true,
  },
);

module.exports = AttributeValue;
