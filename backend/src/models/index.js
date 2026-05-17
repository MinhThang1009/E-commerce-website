const sequelize = require('../config/sequelize');
const User = require('./user');
const DiscountCode = require('./discountCode');
const Address = require('./address');
const Category = require('./category');
const Product = require('./product');
const ProductCategory = require('./productCategory');
const ProductAttribute = require('./productAttribute');
const ProductVariant = require('./productVariant');
const ProductSpecification = require('./productSpecification');
const Review = require('./review');
const ReviewFeedback = require('./reviewFeedback');
const Cart = require('./cart');
const CartItem = require('./cartItem');
const Order = require('./order');
const OrderItem = require('./orderItem');
const Wishlist = require('./wishlist');
const WarrantyPackage = require('./warrantyPackage');
const ProductWarranty = require('./productWarranty');
const AttributeGroup = require('./attributeGroup');
const AttributeValue = require('./attributeValue');
const ProductAttributeGroup = require('./productAttributeGroup');
const News = require('./news');
const NewsletterSubscriber = require('./newsletterSubscriber');
const Feedback = require('./feedback');
const ChatMessage = require('./chatMessage');
const Brand = require('./brand');
const Collection = require('./collection');
const ProductCollection = require('./productCollection');
const SearchHistory = require('./searchHistory');
const LoyaltyHistory = require('./loyaltyHistory');
const RecentlyViewed = require('./recentlyViewed');
const Banner = require('./banner');
const EmailCampaign = require('./emailCampaign');
// Models mới theo data_new.sql
const ProductImage = require('./productImage');
const InventoryLog = require('./inventoryLog');
const AuditLog = require('./auditLog');
const ImportLog = require('./importLog');

// =============================================
// QUAN HỆ USER
// =============================================

// User - Address (người dùng - địa chỉ)
User.hasMany(Address, { foreignKey: 'userId', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'userId' });

// User - ImportLog (admin - lịch sử import sản phẩm)
User.hasMany(ImportLog, { foreignKey: 'adminId', as: 'importLogs' });
ImportLog.belongsTo(User, { foreignKey: 'adminId', as: 'admin' });

// User - AuditLog (admin - nhật ký thao tác)
User.hasMany(AuditLog, { foreignKey: 'adminId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'adminId', as: 'admin' });

// User - News (người dùng - bài viết)
User.hasMany(News, { foreignKey: 'userId', as: 'news' });
News.belongsTo(User, { foreignKey: 'userId', as: 'author' });

// =============================================
// QUAN HỆ CATEGORY
// =============================================

// Product - Category (quan hệ trực tiếp 1-nhiều theo data_new.sql)
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'directProducts' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

// Product - Category (nhiều-nhiều qua bảng product_categories - giữ tương thích)
Product.belongsToMany(Category, {
  through: ProductCategory,
  foreignKey: 'productId',
  otherKey: 'categoryId',
  as: 'categories',
});
Category.belongsToMany(Product, {
  through: ProductCategory,
  foreignKey: 'categoryId',
  otherKey: 'productId',
  as: 'products',
});

// =============================================
// QUAN HỆ PRODUCT
// =============================================

// Product - ProductAttribute (sản phẩm - thuộc tính)
Product.hasMany(ProductAttribute, { foreignKey: 'productId', as: 'productAttributes' });
ProductAttribute.belongsTo(Product, { foreignKey: 'productId' });

// Product - ProductVariant (sản phẩm - biến thể)
Product.hasMany(ProductVariant, { foreignKey: 'productId', as: 'variants' });
ProductVariant.belongsTo(Product, { foreignKey: 'productId' });

// Product - Biến thể mặc định
Product.hasOne(ProductVariant, {
  foreignKey: 'productId',
  as: 'defaultVariant',
  scope: { isDefault: true },
});

// Product - ProductSpecification (sản phẩm - thông số kỹ thuật)
Product.hasMany(ProductSpecification, { foreignKey: 'productId', as: 'productSpecifications' });
ProductSpecification.belongsTo(Product, { foreignKey: 'productId' });

// Product - ProductImage (MỚI - theo data_new.sql)
Product.hasMany(ProductImage, { foreignKey: 'productId', as: 'productImages' });
ProductImage.belongsTo(Product, { foreignKey: 'productId' });

// Biến thể - Hình ảnh (MỚI)
ProductVariant.hasMany(ProductImage, { foreignKey: 'variantId', as: 'images' });
ProductImage.belongsTo(ProductVariant, { foreignKey: 'variantId', as: 'variant' });

// =============================================
// QUAN HỆ REVIEW (giữ bảng reviews cũ để tương thích)
// =============================================

Product.hasMany(Review, { foreignKey: 'productId', as: 'reviews' });
Review.belongsTo(Product, { foreignKey: 'productId' });
User.hasMany(Review, { foreignKey: 'userId', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Review - ReviewFeedback (đánh giá - phản hồi đánh giá)
Review.hasMany(ReviewFeedback, { foreignKey: 'reviewId', as: 'feedbacks' });
ReviewFeedback.belongsTo(Review, { foreignKey: 'reviewId' });
User.hasMany(ReviewFeedback, { foreignKey: 'userId' });
ReviewFeedback.belongsTo(User, { foreignKey: 'userId' });

// =============================================
// QUAN HỆ CART & ORDER
// =============================================

User.hasMany(Cart, { foreignKey: 'userId', as: 'carts' });
Cart.belongsTo(User, { foreignKey: 'userId' });

Cart.hasMany(CartItem, { foreignKey: 'cartId', as: 'items' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });
CartItem.belongsTo(Product, { foreignKey: 'productId' });
CartItem.belongsTo(ProductVariant, { foreignKey: 'variantId' });

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId' });

DiscountCode.hasMany(Order, { foreignKey: 'discountCodeId' });
Order.belongsTo(DiscountCode, { foreignKey: 'discountCodeId', as: 'appliedDiscount' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId' });
OrderItem.belongsTo(ProductVariant, { foreignKey: 'variantId' });

// =============================================
// QUAN HỆ WISHLIST
// =============================================

User.belongsToMany(Product, {
  through: Wishlist,
  foreignKey: 'userId',
  otherKey: 'productId',
  as: 'wishlist',
});
Product.belongsToMany(User, {
  through: Wishlist,
  foreignKey: 'productId',
  otherKey: 'userId',
  as: 'wishlistedBy',
});
Wishlist.belongsTo(Product, { foreignKey: 'productId' });
Wishlist.belongsTo(User, { foreignKey: 'userId' });

// =============================================
// QUAN HỆ WARRANTY
// =============================================

Product.belongsToMany(WarrantyPackage, {
  through: ProductWarranty,
  foreignKey: 'productId',
  otherKey: 'warrantyPackageId',
  as: 'warrantyPackages',
});
WarrantyPackage.belongsToMany(Product, {
  through: ProductWarranty,
  foreignKey: 'warrantyPackageId',
  otherKey: 'productId',
  as: 'products',
});
ProductWarranty.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
ProductWarranty.belongsTo(WarrantyPackage, { foreignKey: 'warrantyPackageId', as: 'warrantyPackage' });
Product.hasMany(ProductWarranty, { foreignKey: 'productId', as: 'productWarranties' });
WarrantyPackage.hasMany(ProductWarranty, { foreignKey: 'warrantyPackageId', as: 'productWarranties' });

// =============================================
// QUAN HỆ ATTRIBUTE
// =============================================

AttributeGroup.hasMany(AttributeValue, { foreignKey: 'attributeGroupId', as: 'values' });
AttributeValue.belongsTo(AttributeGroup, { foreignKey: 'attributeGroupId', as: 'group' });

Product.belongsToMany(AttributeGroup, {
  through: ProductAttributeGroup,
  foreignKey: 'productId',
  otherKey: 'attributeGroupId',
  as: 'attributeGroups',
});
AttributeGroup.belongsToMany(Product, {
  through: ProductAttributeGroup,
  foreignKey: 'attributeGroupId',
  otherKey: 'productId',
  as: 'products',
});

// images table đã DROP (migration 2026051615) — Image model removed 2026-05-17

// =============================================
// QUAN HỆ BRAND
// =============================================

Brand.hasMany(Product, { foreignKey: 'brandId', as: 'products' });
Product.belongsTo(Brand, { foreignKey: 'brandId', as: 'brand' });

// =============================================
// QUAN HỆ COLLECTION
// =============================================

Product.belongsToMany(Collection, {
  through: ProductCollection,
  foreignKey: 'productId',
  otherKey: 'collectionId',
  as: 'collections',
});
Collection.belongsToMany(Product, {
  through: ProductCollection,
  foreignKey: 'collectionId',
  otherKey: 'productId',
  as: 'products',
});

// =============================================
// QUAN HỆ INVENTORY LOG
// =============================================

Product.hasMany(InventoryLog, { foreignKey: 'productId', as: 'inventoryLogs' });
InventoryLog.belongsTo(Product, { foreignKey: 'productId' });
ProductVariant.hasMany(InventoryLog, { foreignKey: 'variantId', as: 'inventoryLogs' });
InventoryLog.belongsTo(ProductVariant, { foreignKey: 'variantId' });
Order.hasMany(InventoryLog, { foreignKey: 'orderId', as: 'inventoryLogs' });
InventoryLog.belongsTo(Order, { foreignKey: 'orderId' });
User.hasMany(InventoryLog, { foreignKey: 'createdBy', as: 'inventoryLogs' });
InventoryLog.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// =============================================
// QUAN HỆ KHÁC
// =============================================

User.hasMany(ChatMessage, { foreignKey: 'userId', as: 'chatMessages' });
ChatMessage.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(SearchHistory, { foreignKey: 'userId', as: 'searchHistories' });
SearchHistory.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(LoyaltyHistory, { foreignKey: 'userId', as: 'loyaltyHistories' });
LoyaltyHistory.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Order.hasMany(LoyaltyHistory, { foreignKey: 'orderId', as: 'loyaltyHistories' });
LoyaltyHistory.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

User.hasMany(RecentlyViewed, { foreignKey: 'userId', as: 'recentlyViewed' });
RecentlyViewed.belongsTo(User, { foreignKey: 'userId' });
Product.hasMany(RecentlyViewed, { foreignKey: 'productId', as: 'recentlyViewed' });
RecentlyViewed.belongsTo(Product, { foreignKey: 'productId' });

// =============================================
// XUẤT
// =============================================

module.exports = {
  sequelize,
  User,
  Address,
  Category,
  Product,
  ProductCategory,
  ProductAttribute,
  ProductVariant,
  ProductSpecification,
  Review,
  ReviewFeedback,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Wishlist,
  WarrantyPackage,
  ProductWarranty,
  AttributeGroup,
  AttributeValue,
  ProductAttributeGroup,
  News,
  NewsletterSubscriber,
  ChatMessage,
  Feedback,
  DiscountCode,
  Brand,
  Collection,
  ProductCollection,
  SearchHistory,
  LoyaltyHistory,
  RecentlyViewed,
  Banner,
  EmailCampaign,
  // Models mới
  ProductImage,
  InventoryLog,
  AuditLog,
  ImportLog,
};
