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
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
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
