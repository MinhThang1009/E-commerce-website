const { DataTypes } = require('sequelize');
const slugify = require('slugify');
const sequelize = require('@config/sequelize');
const logger = require('@utils/logger');

// Thử load vectorStore service, nếu không có thì bỏ qua
let vectorStoreService;
try {
  vectorStoreService = require('@services/vector-store/vector-store');
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
    },
    // FK tới bảng brands
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Tên sản phẩm — tiếng Việt (canonical) sau i18n migration 2026051611
    nameVi: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    // Tên sản phẩm — tiếng Anh (nullable, dành cho i18n)
    nameEn: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    // Virtual backward-compat: `product.name` maps to nameVi
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
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    // Tên gốc (không có biến thể)
    baseName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // Model sản phẩm (ví dụ: iPhone 16 Pro Max)
    model: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // SKU đã chuyển sang product_variants — column đã drop trong migration 2026051606
    // Giá gốc
    basePrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    // Giá so sánh (giá niêm yết / giá cũ)
    compareAtPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    // Mô tả ngắn — tiếng Việt
    shortDescriptionVi: { type: DataTypes.TEXT, allowNull: true },
    shortDescriptionEn: { type: DataTypes.TEXT, allowNull: true },
    shortDescription: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('shortDescriptionVi');
      },
      set(v) {
        this.setDataValue('shortDescriptionVi', v);
      },
    },
    // Mô tả chi tiết — tiếng Việt
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
    // Trạng thái sản phẩm
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'draft', 'archived'),
      defaultValue: 'active',
    },
    // Sản phẩm nổi bật
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Tình trạng sản phẩm (mới, cũ, refurbished)
    condition: {
      type: DataTypes.STRING(20),
      defaultValue: 'new',
    },
    // Hiển thị (public, hidden, draft)
    visibility: {
      type: DataTypes.STRING(20),
      defaultValue: 'public',
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
        this.setDataValue('tags', typeof value === 'object' ? JSON.stringify(value) : value);
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
          typeof value === 'object' ? JSON.stringify(value) : value,
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
        this.setDataValue('attributes', typeof value === 'object' ? JSON.stringify(value) : value);
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
    },
    // Số lượt xem
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // Điểm đánh giá trung bình
    ratingAverage: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.0,
    },
    // Thông tin vận chuyển (JSON)
    shippingInfo: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
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
          typeof value === 'object' ? JSON.stringify(value) : value,
        );
      },
    },
    // Tiêu đề SEO — tiếng Việt
    seoTitleVi: { type: DataTypes.STRING(500), allowNull: true },
    seoTitleEn: { type: DataTypes.STRING(500), allowNull: true },
    seoTitle: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('seoTitleVi');
      },
      set(v) {
        this.setDataValue('seoTitleVi', v);
      },
    },
    // Mô tả SEO — tiếng Việt
    seoDescriptionVi: { type: DataTypes.TEXT, allowNull: true },
    seoDescriptionEn: { type: DataTypes.TEXT, allowNull: true },
    seoDescription: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('seoDescriptionVi');
      },
      set(v) {
        this.setDataValue('seoDescriptionVi', v);
      },
    },
    // SEO Keywords (JSON array)
    seoKeywords: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
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
        this.setDataValue('seoKeywords', typeof value === 'object' ? JSON.stringify(value) : value);
      },
    },
    // FAQ sản phẩm (JSON array: [{q, a}]) — thêm qua migration 2025122401
    faqs: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('faqs');
        if (!value) return [];
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      },
      set(value) {
        this.setDataValue('faqs', typeof value === 'object' ? JSON.stringify(value) : value);
      },
    },
    // Xóa mềm (soft delete)
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'products',
    timestamps: true,
    // Bật paranoid mode (soft delete)
    paranoid: true,
    // Dùng snake_case cho tên cột tự động (created_at, updated_at)
    underscored: true,
    indexes: [
      { name: 'idx_products_status', fields: ['status'] },
      { name: 'idx_products_is_featured', fields: ['is_featured'] },
    ],
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
          // Chỉ index khi product active. Stock check không làm ở hook vì stock ở variant level
          // (product.stockQuantity luôn 0 — variants chưa tồn tại tại thời điểm afterCreate).
          // Chatbot service tự filter out-of-stock khi search vector.
          if (vectorStoreService && product.status === 'active') {
            const Category = require('@models/category');
            const ProductImage = require('@models/product-image');
            const { enrichProductData } = require('@utils/product-helpers');
            const ProductSpecification = require('@models/product-specification');
            const fullProduct = await Product.findByPk(product.id, {
              include: [
                { model: Category, as: 'categories', attributes: ['name'] },
                { model: Category, as: 'category', attributes: ['name'] },
                {
                  model: ProductImage,
                  as: 'productImages',
                  attributes: ['imageUrl', 'isThumbnail'],
                  required: false,
                },
                {
                  model: ProductSpecification,
                  as: 'productSpecifications',
                  attributes: ['name', 'value', 'valueEn', 'category'],
                  required: false,
                },
              ],
            });
            if (fullProduct) {
              await vectorStoreService.upsertProduct(enrichProductData(fullProduct.toJSON()));
              await vectorStoreService.save();
            }
          }
        } catch (error) {
          logger.error('Lỗi cập nhật vector store sau khi tạo sản phẩm:', error);
        }
      },
      // Cập nhật vector store khi sửa sản phẩm
      afterUpdate: async (product) => {
        try {
          if (vectorStoreService) {
            // Chỉ index khi active — inactive thì xóa khỏi vector store.
            // Stock check không làm ở hook (product.stockQuantity luôn 0 — stock thực ở variant level).
            // Chatbot service tự filter out-of-stock khi search vector.
            if (product.status === 'active') {
              const Category = require('@models/category');
              const ProductImage = require('@models/product-image');
              const ProductVariant = require('@models/product-variant');
              const { enrichProductData } = require('@utils/product-helpers');
              const ProductSpecification = require('@models/product-specification');
              const fullProduct = await Product.findByPk(product.id, {
                include: [
                  { model: Category, as: 'categories', attributes: ['name'] },
                  { model: Category, as: 'category', attributes: ['name'] },
                  {
                    model: ProductImage,
                    as: 'productImages',
                    attributes: ['imageUrl', 'isThumbnail'],
                    required: false,
                  },
                  {
                    model: ProductVariant,
                    as: 'variants',
                    attributes: ['variantName', 'displayName', 'price', 'compareAtPrice', 'stockQuantity', 'isDefault', 'attributes', 'attributesEn'],
                    required: false,
                  },
                  {
                    model: ProductSpecification,
                    as: 'productSpecifications',
                    attributes: ['name', 'value', 'valueEn', 'category'],
                    required: false,
                  },
                ],
              });
              if (fullProduct) {
                await vectorStoreService.upsertProduct(enrichProductData(fullProduct.toJSON()));
                await vectorStoreService.save();
              }
            } else {
              vectorStoreService.items = vectorStoreService.items.filter(
                (item) => item.metadata.id !== product.id,
              );
              await vectorStoreService.save(); // Phải await
            }
          }
        } catch (error) {
          logger.error('Lỗi cập nhật vector store sau khi sửa sản phẩm:', error);
        }
      },
      // Xóa khỏi vector store khi xóa 1 sản phẩm (single instance)
      afterDestroy: async (product) => {
        try {
          if (vectorStoreService) {
            vectorStoreService.items = vectorStoreService.items.filter(
              (item) => item.metadata.id !== product.id,
            );
            await vectorStoreService.save();
          }
        } catch (error) {
          logger.error('Lỗi cập nhật vector store sau khi xóa sản phẩm:', error);
        }
      },
      // Sync vector store sau bulk delete — xóa vectors của products không còn tồn tại
      afterBulkDestroy: async () => {
        try {
          if (!vectorStoreService) return;
          const { Product: ProductModel } = require('@models');
          const activeIds = new Set(
            (await ProductModel.findAll({ attributes: ['id'], raw: true })).map((p) => p.id),
          );
          const before = vectorStoreService.items.length;
          vectorStoreService.items = vectorStoreService.items.filter((item) =>
            activeIds.has(item.metadata.id),
          );
          if (vectorStoreService.items.length < before) {
            await vectorStoreService.save();
            logger.debug(
              `Vector store: xóa ${before - vectorStoreService.items.length} stale vectors sau bulk delete`,
            );
          }
        } catch (error) {
          logger.error('Lỗi sync vector store sau bulk delete:', error);
        }
      },
    },
  },
);

module.exports = Product;
