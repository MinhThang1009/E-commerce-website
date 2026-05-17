const { DataTypes } = require('sequelize');
const slugify = require('slugify');
const sequelize = require('../config/sequelize');

const Collection = sequelize.define(
  'Collection',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nameVi: { type: DataTypes.STRING(200), allowNull: false },
    nameEn: { type: DataTypes.STRING(200), allowNull: true },
    name: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('nameVi'); },
      set(v) { this.setDataValue('nameVi', v); },
    },
    slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    descriptionVi: { type: DataTypes.TEXT, allowNull: true },
    descriptionEn: { type: DataTypes.TEXT, allowNull: true },
    description: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('descriptionVi'); },
      set(v) { this.setDataValue('descriptionVi', v); },
    },
    thumbnail: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: 'collections',
    timestamps: true,
    paranoid: true,
    underscored: true,
    hooks: {
      beforeValidate: (collection) => {
        if (collection.name && !collection.slug) {
          collection.slug = slugify(collection.name, {
            lower: true,
            strict: true,
          });
        }
      },
    },
  }
);

module.exports = Collection;
