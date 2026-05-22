const { DataTypes } = require('sequelize');
const slugify = require('slugify');
const sequelize = require('@config/sequelize');

// Model thương hiệu
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
    // URL logo thương hiệu
    logoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // Mô tả thương hiệu — tiếng Việt
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
    // Website chính thức của thương hiệu
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // Trạng thái hiển thị
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
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
  },
);

module.exports = Brand;
