const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

const Image = sequelize.define(
  'Image',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    category: {
      type: DataTypes.ENUM('product', 'thumbnail', 'user', 'review'),
      allowNull: false,
      defaultValue: 'product',
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'products',
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'images',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['product_id'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['category'],
      },
      {
        fields: ['is_active'],
      },
    ],
  },
);

module.exports = Image;
