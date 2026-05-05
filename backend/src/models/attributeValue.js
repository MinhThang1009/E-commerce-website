const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

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
      field: 'attribute_group_id',
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
      field: 'color_code',
      validate: {
        isValidColor(value) {
          if (value && !/^#[0-9A-F]{6}$/i.test(value)) {
            throw new Error('Mã màu phải ở định dạng hex (ví dụ: #FF0000)');
          }
        },
      },
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'image_url',
    },
    priceAdjustment: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'price_adjustment',
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
    // Trường mới: xác định giá trị thuộc tính này có ảnh hưởng tên sản phẩm không
    affectsName: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'affects_name',
    },
    // Trường mới: template tên dùng để đặt tên sản phẩm
    nameTemplate: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'name_template',
      comment: 'Template tên sản phẩm (ví dụ: "I9", "RTX 4080", "32GB")',
    },
  },
  {
    tableName: 'attribute_values',
    timestamps: true,
    underscored: true,
  }
);

module.exports = AttributeValue;
