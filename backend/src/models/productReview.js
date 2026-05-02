const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

// Model đánh giá sản phẩm - theo cấu trúc data_new.sql
const ProductReview = sequelize.define(
  'ProductReview',
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
    // FK tới bảng product_variants (tùy chọn)
    variantId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'variant_id',
    },
    // FK tới bảng users
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    // Điểm đánh giá (1-5)
    ratingValue: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'rating_value',
      validate: {
        min: 1,
        max: 5,
      },
    },
    // Nội dung đánh giá
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Xóa mềm (soft delete)
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  },
  {
    tableName: 'product_reviews',
    timestamps: true,
    paranoid: true,
    // Dùng snake_case cho tên cột tự động (created_at, updated_at)
    underscored: true,
  }
);

module.exports = ProductReview;
