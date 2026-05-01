const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

// Model hình ảnh sản phẩm - theo cấu trúc data_new.sql
const ProductImage = sequelize.define(
  'ProductImage',
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
    // FK tới bảng product_variants (MỚI)
    variantId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'variant_id',
    },
    // URL hình ảnh
    imageUrl: {
      type: DataTypes.STRING(1000),
      allowNull: false,
      field: 'image_url',
    },
    // Đánh dấu ảnh thumbnail chính
    isThumbnail: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_thumbnail',
    },
    // Màu sắc tương ứng của ảnh (nếu có)
    color: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    // Soft delete
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  },
  {
    tableName: 'product_images',
    timestamps: true,
    paranoid: true,
    // Dùng snake_case cho tên cột tự động (created_at, updated_at)
    underscored: true,
  }
);

module.exports = ProductImage;
