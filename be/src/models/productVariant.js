const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

// Model biến thể sản phẩm - theo cấu trúc data_new.sql
const ProductVariant = sequelize.define(
  'ProductVariant',
  {
    // ID tự tăng
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // FK tới bảng products
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id',
    },
    // Mã SKU duy nhất
    sku: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    // Tên biến thể (ví dụ: "256GB - Titan Đen")
    variantName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'variant_name',
    },
    // Tên hiển thị
    displayName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'display_name',
    },
    // Giá biến thể
    price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    // Giá so sánh
    compareAtPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'compare_at_price',
    },
    // Số lượng tồn kho
    stockQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'stock_quantity',
    },
    // Biến thể mặc định
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_default',
    },
    // Thuộc tính biến thể (JSON - storage, color, ram, v.v.)
    attributes: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const value = this.getDataValue('attributes');
        if (!value) return {};
        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
          return {};
        }
      },
      set(value) {
        this.setDataValue(
          'attributes',
          typeof value === 'object' ? JSON.stringify(value) : value
        );
      },
    },
    // Soft delete
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  },
  {
    tableName: 'product_variants',
    timestamps: true,
    paranoid: true,
    // Dùng snake_case cho tên cột tự động (created_at, updated_at)
    underscored: true,
  }
);

module.exports = ProductVariant;
