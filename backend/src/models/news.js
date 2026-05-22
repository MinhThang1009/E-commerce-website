const { DataTypes } = require('sequelize');
const sequelize = require('@config/sequelize');

const News = sequelize.define(
  'News',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    titleVi: { type: DataTypes.STRING(200), allowNull: false },
    titleEn: { type: DataTypes.STRING(200), allowNull: true },
    title: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('titleVi');
      },
      set(v) {
        this.setDataValue('titleVi', v);
      },
    },
    slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    contentVi: { type: DataTypes.TEXT('long'), allowNull: false },
    contentEn: { type: DataTypes.TEXT('long'), allowNull: true },
    content: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('contentVi');
      },
      set(v) {
        this.setDataValue('contentVi', v);
      },
    },
    thumbnail: { type: DataTypes.STRING(512), allowNull: true },
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
    categoryVi: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'Tin tức' },
    categoryEn: { type: DataTypes.STRING(100), allowNull: true },
    category: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('categoryVi');
      },
      set(v) {
        this.setDataValue('categoryVi', v);
      },
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    tags: {
      type: DataTypes.STRING(500), // Các tag cách nhau bằng dấu phẩy
      allowNull: true,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Cho phép null để hỗ trợ bài đăng hệ thống hoặc khi xóa user
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    tableName: 'news',
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = News;
