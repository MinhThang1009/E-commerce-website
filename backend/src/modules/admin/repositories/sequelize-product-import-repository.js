/**
 * @file sequelize-product-import-repository.js
 * @layer Repository
 * @module admin
 * @description Data access layer cho import/export sản phẩm
 */
const { Op } = require('sequelize');
const {
  sequelize,
  Product,
  ProductVariant,
  ProductImage,
  ProductCategory,
  ProductSpecification,
  Category,
  Brand,
  ImportLog,
} = require('@models');

const runInTransaction = (work) => sequelize.transaction(work);

// ─── Lookup maps ──────────────────────────────────────────────────────────────

const findCategoriesForImport = () => Category.findAll({ attributes: ['id', 'slug', 'name'] });

const findBrandsForImport = () => Brand.findAll({ attributes: ['id', 'name', 'slug'] });

// ─── Product insert helpers ───────────────────────────────────────────────────

const findProductBySlug = (slug, transaction) =>
  Product.findOne({ where: { slug }, transaction, attributes: ['id'] });

const createProduct = (data, transaction) => Product.create(data, { transaction });

const createProductVariant = (data, transaction) => ProductVariant.create(data, { transaction });

const createProductImage = (data, transaction) => ProductImage.create(data, { transaction });

const createProductCategory = (data, transaction) => ProductCategory.create(data, { transaction });

const createProductSpecification = (data, transaction) =>
  ProductSpecification.create(data, { transaction });

// ─── Import log ───────────────────────────────────────────────────────────────

const createImportLog = (data) => ImportLog.create(data);

const findImportHistory = ({ limit, offset }) =>
  ImportLog.findAndCountAll({
    order: [['importedAt', 'DESC']],
    limit,
    offset,
    attributes: { exclude: ['errorDetail'] },
  });

// ─── Vector sync ──────────────────────────────────────────────────────────────

const findProductsByIds = (ids) =>
  Product.findAll({
    where: { id: { [Op.in]: ids } },
    include: [
      { model: Category, as: 'categories', attributes: ['name'] },
      {
        model: ProductImage,
        as: 'productImages',
        attributes: ['imageUrl', 'isThumbnail'],
        required: false,
      },
      { model: ProductVariant, as: 'variants', attributes: ['stockQuantity'], required: false },
    ],
  });

// ─── Export ───────────────────────────────────────────────────────────────────

const findProductsForExport = () =>
  Product.findAll({
    include: [
      { model: Category, as: 'category', attributes: ['slug'] },
      { model: Brand, as: 'brand', attributes: ['name'] },
      { model: ProductImage, as: 'productImages', attributes: ['imageUrl'], limit: 5 },
      { model: ProductSpecification, as: 'specifications', attributes: ['specKey', 'specValue'] },
    ],
    order: [['id', 'ASC']],
  });

module.exports = {
  runInTransaction,
  findCategoriesForImport,
  findBrandsForImport,
  findProductBySlug,
  createProduct,
  createProductVariant,
  createProductImage,
  createProductCategory,
  createProductSpecification,
  createImportLog,
  findImportHistory,
  findProductsByIds,
  findProductsForExport,
};
