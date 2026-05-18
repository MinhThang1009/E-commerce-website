const { DataTypes } = require('sequelize');
const slugify = require('slugify');
const sequelize = require('@config/sequelize');

// Model thương hiệu - theo cấu trúc data_new.sql
const Brand = sequelize.define(
  'Brand',
  {
    // ID tự tăng
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // Tên thương hiệu — tiếng Việt (sau i18n migration 2026051611)
    nameVi: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    nameEn: { type: DataTypes.STRING(100), allowNull: true },
    name: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('nameVi'); },
      set(v) { this.setDataValue('nameVi', v); },
    },
    // Slug cho URL thân thiện
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    // URL logo thương hiệu
    logoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // Xóa mềm (soft delete)
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'brands',
    timestamps: true,
    paranoid: true,
    underscored: true,
    hooks: {
      // Tự động tạo slug từ tên thương hiệu
      beforeValidate: (brand) => {
        if (brand.name && !brand.slug) {
          brand.slug = slugify(brand.name, {
            lower: true,
            strict: true,
          });
        }
      },
    },
  }
);

module.exports = Brand;
