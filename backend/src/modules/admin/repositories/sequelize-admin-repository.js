const {
  sequelize,
  User,
  Product,
  Order,
  Review,
  Category,
  Brand,
  OrderItem,
  ProductAttribute,
  ProductVariant,
  ProductSpecification,
  ProductImage,
  ProductWarranty,
  ProductCategory,
  WarrantyPackage,
  CartItem,
  Wishlist,
  Address,
  LoyaltyHistory,
  SearchHistory,
  RecentlyViewed,
  InventoryLog,
  AuditLog,
  ChatMessage,
} = require('@models');
const { Op, Sequelize } = require('sequelize');

/**
 * @file adminRepository.js
 * @layer Repository — Data access layer cho admin module
 * @module admin
 * @description Tất cả thao tác với database của admin.
 *   Service gọi repository, repository gọi model Sequelize.
 *   Không chứa business logic — chỉ query thuần túy.
 *
 *   Pattern: Các method nhận options linh hoạt ({ where, include, order, ... })
 *   để service có thể truyền bất kỳ điều kiện nào cần thiết.
 */

// ─── Expose sequelize + operators để service dùng xây dựng conditions ────────
// Service import từ repository, không import trực tiếp từ sequelize package
const getSequelize = () => sequelize;
const getOp = () => Op;
const getSequelizeFns = () => Sequelize;

// ─── User queries ─────────────────────────────────────────────────────────────
// QUAN TRỌNG: các hàm count/sum nhận flat where object, KHÔNG wrap trong { where: {...} }
// Đúng: countUsers({ role: 'customer' })
// Sai:  countUsers({ where: { role: 'customer' } }) → double-nested, WHERE không được áp dụng

const countUsers = (where = {}) => User.count({ where });

const findUsers = ({ where = {}, limit, offset, order, attributes } = {}) =>
  User.findAndCountAll({ where, limit, offset, order, attributes });

const findUserById = (id, options = {}) => User.findByPk(id, options);

const updateUser = (user, data) => user.update(data);

const deleteUser = (user) => user.destroy();

// ─── Product queries ──────────────────────────────────────────────────────────

const countProducts = (where = {}) => Product.count({ where });

const findProducts = ({ where = {}, limit, offset, order, include, attributes } = {}) =>
  Product.findAndCountAll({ where, limit, offset, order, include, attributes });

const findProductById = (id, options = {}) => Product.findByPk(id, options);

const findProductsList = (options = {}) => Product.findAll(options);

const createProduct = (data) => Product.create(data);

const updateProductById = (id, data, options = {}) =>
  Product.update(data, { where: { id }, ...options });

const deleteProduct = (product) => product.destroy();

const bulkCreateProductImages = (imageData, options = {}) =>
  Object.keys(options).length
    ? ProductImage.bulkCreate(imageData, options)
    : ProductImage.bulkCreate(imageData);

const destroyProductImages = (where, options = {}) => ProductImage.destroy({ where, ...options });

const bulkCreateProductSpecs = (specData, options = {}) =>
  Object.keys(options).length
    ? ProductSpecification.bulkCreate(specData, options)
    : ProductSpecification.bulkCreate(specData);

const findProductSpecs = (where, options = {}) =>
  ProductSpecification.findAll({ where, ...options });

const findProductAttributes = (where, options = {}) =>
  ProductAttribute.findAll({ where, ...options });

const createProductAttribute = (data, options = {}) =>
  Object.keys(options).length
    ? ProductAttribute.create(data, options)
    : ProductAttribute.create(data);

const findProductVariants = (where, options = {}) => ProductVariant.findAll({ where, ...options });

const createProductVariant = (data, options = {}) =>
  Object.keys(options).length ? ProductVariant.create(data, options) : ProductVariant.create(data);

const findWarrantyPackages = (where, options = {}) =>
  WarrantyPackage.findAll({ where, ...options });

const createProductWarranty = (data, options = {}) =>
  Object.keys(options).length
    ? ProductWarranty.create(data, options)
    : ProductWarranty.create(data);

const destroyProductWarranties = (where, options = {}) =>
  ProductWarranty.destroy({ where, ...options });

const findCategoryById = (id, options = {}) => Category.findByPk(id, options);

const createCategory = (data) => Category.create(data);

// ─── Order queries ────────────────────────────────────────────────────────────

const countOrders = (where = {}) => Order.count({ where });

const sumOrderTotal = (where = {}) => Order.sum('total', { where });

const findOrders = ({ where = {}, limit, offset, order, include } = {}) =>
  Order.findAndCountAll({ where, limit, offset, order, include });

const findOrderById = (id, options = {}) => Order.findByPk(id, options);

const updateOrder = (order, data) => order.update(data);

const countOrdersByStatus = () =>
  Order.findAll({
    attributes: ['status', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

// ─── OrderItem queries ────────────────────────────────────────────────────────

const findTopSellingItems = ({ limit = 5, include = [] } = {}) =>
  OrderItem.findAll({
    attributes: [
      'productId',
      [Sequelize.fn('SUM', Sequelize.col('OrderItem.quantity')), 'totalSold'],
      [Sequelize.fn('SUM', Sequelize.col('OrderItem.subtotal')), 'totalRevenue'],
    ],
    include,
    group: ['productId', 'Product.id'],
    order: [[Sequelize.fn('SUM', Sequelize.col('OrderItem.quantity')), 'DESC']],
    limit,
  });

const aggregateOrderItems = ({
  attributes,
  include = [],
  where = {},
  group,
  order,
  raw,
  limit,
  subQuery,
} = {}) => OrderItem.findAll({ attributes, include, where, group, order, raw, limit, subQuery });

// ─── Review queries ───────────────────────────────────────────────────────────

const findReviews = ({ where = {}, limit, offset, order, include } = {}) =>
  Review.findAndCountAll({ where, limit, offset, order, include });

const findReviewById = (id, options = {}) => Review.findByPk(id, options);

const deleteReview = (review) => review.destroy();

// ─── Inventory & Restock ──────────────────────────────────────────────────────

const createInventoryLog = (data) => InventoryLog.create(data);

// ─── Analytics queries ────────────────────────────────────────────────────────

const aggregateOrders = ({ attributes, where = {}, group, order, raw, include = [] } = {}) =>
  Order.findAll({ attributes, where, group, order, raw, include });

const aggregateUsers = ({ attributes, where = {}, group, order, raw } = {}) =>
  User.findAll({ attributes, where, group, order, raw });

const aggregateOrderItems2 = ({
  attributes,
  include = [],
  where = {},
  group,
  order,
  raw,
  limit,
  subQuery,
} = {}) => OrderItem.findAll({ attributes, include, where, group, order, raw, limit });

// ─── Audit log queries ────────────────────────────────────────────────────────

const findAuditLogs = ({ where = {}, limit, offset, order, include } = {}) =>
  AuditLog.findAndCountAll({ where, limit, offset, order, include });

// ─── Chatbot stats ────────────────────────────────────────────────────────────

const countChatMessages = (where = {}) => ChatMessage.count({ where });

const findOneChatMessage = (options = {}) => ChatMessage.findOne(options);

const aggregateChatMessages = ({ attributes, where = {}, group, order, raw, limit } = {}) =>
  ChatMessage.findAll({ attributes, where, group, order, raw, limit });

const bulkCreateProductVariants = (data, options = {}) => ProductVariant.bulkCreate(data, options);

const bulkCreateProductWarranties = (data, options = {}) =>
  ProductWarranty.bulkCreate(data, options);

const findProductVariantById = (id, productId, options = {}) =>
  ProductVariant.findOne({ where: { id, productId }, ...options });

const sumProductVariantStock = (productId) =>
  ProductVariant.sum('stockQuantity', { where: { productId } });

// ─── Raw sequelize query (chỉ dùng cho analytics phức tạp) ───────────────────

const destroyCartItems = (where, options = {}) => CartItem.destroy({ where, ...options });
const destroyWishlists = (where, options = {}) => Wishlist.destroy({ where, ...options });
const destroyProductCategories = (where, options = {}) =>
  ProductCategory.destroy({ where, ...options });
const bulkCreateProductCategories = (data, options = {}) =>
  ProductCategory.bulkCreate(data, options);

const rawQuery = (sql, options = {}) => sequelize.query(sql, options);

// ─── Expose model references cho service dùng trong Sequelize include arrays ──
// Service import models từ đây, không import trực tiếp từ models/
const getModels = () => ({
  Product,
  ProductImage,
  ProductSpecification,
  ProductVariant,
  ProductAttribute,
  ProductWarranty,
  ProductCategory,
  WarrantyPackage,
  User,
  Order,
  OrderItem,
  Review,
  Category,
  Brand,
  CartItem,
  LoyaltyHistory,
  SearchHistory,
  RecentlyViewed,
  InventoryLog,
  AuditLog,
  ChatMessage,
  Address,
});

// ─── Thêm missing methods ──────────────────────────────────────────────────────

const createProductFull = (data, options = {}) => Product.create(data, options);

const updateProductWhere = (data, where, options = {}) =>
  Product.update(data, { where, ...options });

const findProductOne = (where, options = {}) => Product.findOne({ where, ...options });

const findCategories = (options = {}) => Category.findAll(options);

const destroyProductAttributes = (where, options = {}) =>
  ProductAttribute.destroy({ where, ...options });

const destroyProductVariants = (where, options = {}) =>
  ProductVariant.destroy({ where, ...options });

const bulkCreateProductAttributes = (data, options = {}) =>
  ProductAttribute.bulkCreate(data, options);

const aggregateChatMessagesAdv = (options = {}) => ChatMessage.findAll(options);

module.exports = {
  // Expose utilities cho service
  getSequelize,
  getOp,
  getSequelizeFns,
  // User
  countUsers,
  findUsers,
  findUserById,
  updateUser,
  deleteUser,
  // Product
  countProducts,
  findProducts,
  findProductById,
  createProduct,
  updateProductById,
  deleteProduct,
  bulkCreateProductImages,
  destroyProductImages,
  bulkCreateProductSpecs,
  findProductSpecs,
  findProductAttributes,
  createProductAttribute,
  findProductVariants,
  createProductVariant,
  findWarrantyPackages,
  createProductWarranty,
  destroyProductWarranties,
  findCategoryById,
  createCategory,
  // Order
  countOrders,
  sumOrderTotal,
  findOrders,
  findOrderById,
  updateOrder,
  countOrdersByStatus,
  // OrderItem
  findTopSellingItems,
  aggregateOrderItems,
  aggregateOrderItems2,
  // Review
  findReviews,
  findReviewById,
  deleteReview,
  // Inventory
  createInventoryLog,
  // Analytics
  aggregateOrders,
  aggregateUsers,
  // Audit
  findAuditLogs,
  // Chatbot
  countChatMessages,
  findOneChatMessage,
  aggregateChatMessages,
  // Models (cho include arrays)
  getModels,
  findProductsList,
  // Product advanced
  createProductFull,
  updateProductWhere,
  findProductOne,
  // Category
  findCategories,
  // Destroy
  destroyProductAttributes,
  destroyProductVariants,
  bulkCreateProductAttributes,
  aggregateChatMessagesAdv,
  bulkCreateProductVariants,
  destroyCartItems,
  destroyWishlists,
  destroyProductCategories,
  bulkCreateProductCategories,
  findProductVariantById,
  sumProductVariantStock,
  bulkCreateProductWarranties,
  // Raw
  rawQuery,
};
