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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    thumbnail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
  },
  {
    tableName: 'collections',
    timestamps: true,
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
