const { DataTypes } = require('sequelize');
const slugify = require('slugify');
const sequelize = require('../config/sequelize');

// Model danh mục sản phẩm - theo cấu trúc data_new.sql
const Category = sequelize.define(
  'Category',
  {
    // ID tự tăng
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // Tên danh mục
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    // Slug cho URL thân thiện
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    // Mô tả danh mục
    description: {
      type: DataTypes.TEXT,
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
    tableName: 'categories',
    timestamps: true,
    paranoid: true,
    // Dùng snake_case cho tên cột tự động (created_at, updated_at)
    underscored: true,
    hooks: {
      // Tự động tạo slug từ tên danh mục
      beforeValidate: (category) => {
        if (category.name) {
          category.slug = slugify(category.name, {
            lower: true,
            strict: true,
          });
        }
      },
    },
  }
);

module.exports = Category;
