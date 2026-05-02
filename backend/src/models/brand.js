const { DataTypes } = require('sequelize');
const slugify = require('slugify');
const sequelize = require('../config/sequelize');

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
    // Tên thương hiệu
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
    // URL logo thương hiệu
    logoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'logo_url',
    },
    // Xóa mềm (soft delete)
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
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
