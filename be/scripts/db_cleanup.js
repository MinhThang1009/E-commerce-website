const {
  sequelize,
  Product,
  ProductVariant,
  Category,
  ProductCategory,
  ProductAttribute,
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
  Image,
  News,
  Brand,
  Collection,
  ProductCollection,
  SearchHistory,
  LoyaltyHistory,
  RecentlyViewed,
  Banner,
  EmailCampaign,
  DiscountCode,
} = require('../src/models');

async function cleanup() {
  console.log('--- Bắt đầu dọn dẹp dữ liệu dự án ---');
  const transaction = await sequelize.transaction();

  try {
    // Tạm thời tắt kiểm tra khóa ngoại để xóa dữ liệu dễ dàng hơn
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });

    const modelsToClean = [
      { model: EmailCampaign, name: 'EmailCampaign' },
      { model: Banner, name: 'Banner' },
      { model: LoyaltyHistory, name: 'LoyaltyHistory' },
      { model: SearchHistory, name: 'SearchHistory' },
      { model: RecentlyViewed, name: 'RecentlyViewed' },
      { model: ReviewFeedback, name: 'ReviewFeedback' },
      { model: Review, name: 'Review' },
      { model: OrderItem, name: 'OrderItem' },
      { model: Order, name: 'Order' },
      { model: CartItem, name: 'CartItem' },
      { model: Cart, name: 'Cart' },
      { model: Wishlist, name: 'Wishlist' },
      { model: ProductWarranty, name: 'ProductWarranty' },
      { model: WarrantyPackage, name: 'WarrantyPackage' },
      { model: ProductCategory, name: 'ProductCategory' },
      { model: ProductCollection, name: 'ProductCollection' },
      { model: ProductVariant, name: 'ProductVariant' },
      { model: ProductAttribute, name: 'ProductAttribute' },
      { model: ProductAttributeGroup, name: 'ProductAttributeGroup' },
      { model: ProductSpecification, name: 'ProductSpecification' },
      { model: Image, name: 'Image' },
      { model: Product, name: 'Product' },
      { model: Category, name: 'Category' },
      { model: Collection, name: 'Collection' },
      { model: Brand, name: 'Brand' },
      { model: AttributeValue, name: 'AttributeValue' },
      { model: AttributeGroup, name: 'AttributeGroup' },
      { model: News, name: 'News' },
      { model: DiscountCode, name: 'DiscountCode' },
    ];

    for (const { model, name } of modelsToClean) {
      if (model) {
        process.stdout.write(`Đang xóa dữ liệu bảng ${name}... `);
        await model.destroy({ where: {}, truncate: false, transaction });
        console.log('Xong.');
      }
    }

    // Bật lại kiểm tra khóa ngoại
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });

    await transaction.commit();
    console.log('\n--- DỌN DẸP HOÀN TẤT ---');
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('\nLỗi khi dọn dẹp dữ liệu:', error);
    process.exit(1);
  }
}

cleanup();
