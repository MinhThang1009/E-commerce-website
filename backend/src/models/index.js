const sequelize = require('@config/sequelize');
const User = require('@models/user');
const DiscountCode = require('@models/discount-code');
const Address = require('@models/address');
const Category = require('@models/category');
const Product = require('@models/product');
const ProductCategory = require('@models/product-category');
const ProductAttribute = require('@models/product-attribute');
const ProductVariant = require('@models/product-variant');
const ProductSpecification = require('@models/product-specification');
const Review = require('@models/review');
const Cart = require('@models/cart');
const CartItem = require('@models/cart-item');
const Order = require('@models/order');
const OrderItem = require('@models/order-item');
const Wishlist = require('@models/wishlist');
const WarrantyPackage = require('@models/warranty-package');
const ProductWarranty = require('@models/product-warranty');
const AttributeGroup = require('@models/attribute-group');
const AttributeValue = require('@models/attribute-value');
const ProductAttributeGroup = require('@models/product-attribute-group');
const News = require('@models/news');
const Feedback = require('@models/feedback');
const ChatMessage = require('@models/chat-message');
const Brand = require('@models/brand');
const SearchHistory = require('@models/search-history');
const LoyaltyHistory = require('@models/loyalty-history');
const RecentlyViewed = require('@models/recently-viewed');
const Banner = require('@models/banner');
// Models mới theo data_new.sql
const ProductImage = require('@models/product-image');
const InventoryLog = require('@models/inventory-log');
const AuditLog = require('@models/audit-log');
// =============================================
// QUAN HỆ USER
// =============================================

// User - Address (người dùng - địa chỉ)
User.hasMany(Address, { foreignKey: 'userId', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'userId' });

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
ProductWarranty.belongsTo(WarrantyPackage, {
  foreignKey: 'warrantyPackageId',
  as: 'warrantyPackage',
});
Product.hasMany(ProductWarranty, { foreignKey: 'productId', as: 'productWarranties' });
WarrantyPackage.hasMany(ProductWarranty, {
  foreignKey: 'warrantyPackageId',
  as: 'productWarranties',
});

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
  ChatMessage,
  Feedback,
  DiscountCode,
  Brand,
  SearchHistory,
  LoyaltyHistory,
  RecentlyViewed,
  Banner,
  // Models mới
  ProductImage,
  InventoryLog,
  AuditLog,
};
