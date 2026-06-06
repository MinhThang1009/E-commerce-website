const { DataTypes } = require('sequelize');
const slugify = require('slugify');
const sequelize = require('@config/sequelize');

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
    // Tên danh mục — tiếng Việt (sau i18n migration 2026051611)
    nameVi: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    nameEn: { type: DataTypes.STRING(100), allowNull: true },
    name: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('nameVi');
      },
      set(v) {
        this.setDataValue('nameVi', v);
      },
    },
    // Slug cho URL thân thiện
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    // Ảnh đại diện danh mục
    image: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // Mô tả danh mục — tiếng Việt
    descriptionVi: { type: DataTypes.TEXT, allowNull: true },
    descriptionEn: { type: DataTypes.TEXT, allowNull: true },
    description: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('descriptionVi');
      },
      set(v) {
        this.setDataValue('descriptionVi', v);
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'sort_order',
    },
    // ID danh mục cha (null = danh mục gốc)
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'parent_id',
    },
    // Xóa mềm (soft delete)
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'categories',
    timestamps: true,
    paranoid: true,
    // Dùng snake_case cho tên cột tự động (created_at, updated_at)
    underscored: true,
    hooks: {
      // Tự động tạo slug từ tên danh mục (chỉ khi chưa có slug — tránh ghi đè slug tùy chỉnh)
      beforeValidate: (category) => {
        if (category.name && !category.slug) {
          category.slug = slugify(category.name, {
            lower: true,
            strict: true,
          });
        }
      },
    },
  },
);

module.exports = Category;
