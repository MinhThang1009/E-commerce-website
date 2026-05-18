const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

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
    },
    // Tên hiển thị
    displayName: {
      type: DataTypes.STRING(255),
      allowNull: true,
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
    },
    // Số lượng tồn kho
    stockQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // Biến thể mặc định
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    attributesEn: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      field: 'attributes_en',
      get() {
        const value = this.getDataValue('attributesEn');
        if (!value) return null;
        try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; }
      },
      set(value) {
        this.setDataValue('attributesEn', typeof value === 'object' ? JSON.stringify(value) : value);
      },
    },
    // Cân nặng tính theo kg — dùng để tính phí ship chính xác
    weight: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    // Kích thước { length, width, height } tính theo cm — dùng để tính phí ship
    dimensions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    // Thứ tự hiển thị variant trong UI (admin tự sắp xếp)
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // Variant có còn được bán không (admin tạm ngưng sản phẩm)
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Xóa mềm (soft delete)
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
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
