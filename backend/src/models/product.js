const { DataTypes } = require('sequelize');
const slugify = require('slugify');
const sequelize = require('../config/sequelize');

// Thử load vectorStore service, nếu không có thì bỏ qua
let vectorStoreService;
try {
  vectorStoreService = require('../services/ai/vectorStore');
} catch (e) {
  vectorStoreService = null;
}

// Model sản phẩm - cấu trúc theo data_new.sql
const Product = sequelize.define(
  'Product',
  {
    // ID tự tăng (INT)
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // FK tới bảng categories (quan hệ 1-nhiều trực tiếp)
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'category_id',
    },
    // FK tới bảng brands
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'brand_id',
    },
    // Tên sản phẩm
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // Slug cho URL thân thiện
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    // Tên gốc (không có biến thể)
    baseName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'base_name',
    },
    // Model sản phẩm (ví dụ: iPhone 16 Pro Max)
    model: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // Giá gốc
    basePrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'base_price',
    },
    // Giá so sánh (giá niêm yết / giá cũ)
    compareAtPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'compare_at_price',
    },
    // Mô tả ngắn
    shortDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'short_description',
    },
    // Mô tả chi tiết
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Trạng thái sản phẩm
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'active',
    },
    // Sản phẩm nổi bật
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_featured',
    },
    // Tình trạng sản phẩm (mới, cũ, refurbished)
    condition: {
      type: DataTypes.STRING(50),
      defaultValue: 'new',
    },
    // Hiển thị (public, hidden, draft)
    visibility: {
      type: DataTypes.STRING(50),
      defaultValue: 'public',
    },
    // Thời gian bảo hành (tháng)
    warrantyMonths: {
      type: DataTypes.INTEGER,
      defaultValue: 12,
      field: 'warranty_months',
    },
    // Tags / nhãn sản phẩm (JSON array)
    tags: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const value = this.getDataValue('tags');
        if (!value) return [];
        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
          return [];
        }
      },
      set(value) {
        this.setDataValue(
          'tags',
          typeof value === 'object' ? JSON.stringify(value) : value
        );
      },
    },
    // Thông số kỹ thuật (JSON object)
    specifications: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const value = this.getDataValue('specifications');
        if (!value) return {};
        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
          return {};
        }
      },
      set(value) {
        this.setDataValue(
          'specifications',
          typeof value === 'object' ? JSON.stringify(value) : value
        );
      },
    },
    // Thuộc tính sản phẩm (JSON - màu sắc, dung lượng, v.v.)
    attributes: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const value = this.getDataValue('attributes');
        if (!value) return {};
        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
          return {};
        }
      },
      set(value) {
        this.setDataValue(
          'attributes',
          typeof value === 'object' ? JSON.stringify(value) : value
        );
      },
    },
    // Số lượng tồn kho (cho sản phẩm không có variant)
    stockQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    // Số lượng đã bán
    soldCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sold_count',
    },
    // Số lượt xem
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'view_count',
    },
    // Điểm đánh giá trung bình
    ratingAverage: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.0,
      field: 'rating_average',
    },
    // Thông tin vận chuyển (JSON)
    shippingInfo: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      field: 'shipping_info',
      get() {
        const value = this.getDataValue('shippingInfo');
        if (!value) return {};
        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
          return {};
        }
      },
      set(value) {
        this.setDataValue(
          'shippingInfo',
          typeof value === 'object' ? JSON.stringify(value) : value
        );
      },
    },
    // SEO Title
    seoTitle: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'seo_title',
    },
    // SEO Description
    seoDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'seo_description',
    },
    // SEO Keywords (JSON array)
    seoKeywords: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      field: 'seo_keywords',
      get() {
        const value = this.getDataValue('seoKeywords');
        if (!value) return [];
        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
          return [];
        }
      },
      set(value) {
        this.setDataValue(
          'seoKeywords',
          typeof value === 'object' ? JSON.stringify(value) : value
        );
      },
    },
    // Xóa mềm (soft delete)
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  },
  {
    tableName: 'products',
    timestamps: true,
    // Bật paranoid mode (soft delete)
    paranoid: true,
    // Dùng snake_case cho tên cột tự động (created_at, updated_at)
    underscored: true,
    hooks: {
      // Tự động tạo slug từ tên sản phẩm
      beforeValidate: (product) => {
        if (product.name && (!product.slug || product.changed('name'))) {
          const randomString = Math.random().toString(36).substring(2, 8);
          product.slug =
            slugify(product.name, {
              lower: true,
              strict: true,
            }) +
            '-' +
            randomString;
        }
      },
      // Cập nhật vector store khi tạo sản phẩm mới
      afterCreate: async (product) => {
        try {
          if (vectorStoreService && product.status === 'active') {
            await vectorStoreService.addProduct(product.toJSON());
            vectorStoreService.save();
          }
        } catch (error) {
          console.error(
            'Lỗi cập nhật vector store sau khi tạo sản phẩm:',
            error
          );
        }
      },
      // Cập nhật vector store khi sửa sản phẩm
      afterUpdate: async (product) => {
        try {
          if (vectorStoreService) {
            if (product.status === 'active') {
              await vectorStoreService.addProduct(product.toJSON());
              vectorStoreService.save();
            } else {
              vectorStoreService.items = vectorStoreService.items.filter(
                (item) => item.metadata.id !== product.id
              );
              vectorStoreService.save();
            }
          }
        } catch (error) {
          console.error(
            'Lỗi cập nhật vector store sau khi sửa sản phẩm:',
            error
          );
        }
      },
      // Xóa khỏi vector store khi xóa sản phẩm
      afterDestroy: async (product) => {
        try {
          if (vectorStoreService) {
            vectorStoreService.items = vectorStoreService.items.filter(
              (item) => item.metadata.id !== product.id
            );
            vectorStoreService.save();
          }
        } catch (error) {
          console.error(
            'Lỗi cập nhật vector store sau khi xóa sản phẩm:',
            error
          );
        }
      },
    },
  }
);

module.exports = Product;
