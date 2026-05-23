const {
  sequelize,
  Product,
  ProductVariant,
  Category,
  ProductCategory,
  ProductAttribute,
  ProductSpecification,
  Review,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Wishlist,
  AttributeGroup,
  AttributeValue,
  ProductAttributeGroup,
  Image,
  Brand,
  SearchHistory,
  RecentlyViewed,
  DiscountCode,
} = require('../src/models');

async function cleanup() {
  console.log('--- Bắt đầu dọn dẹp dữ liệu dự án ---');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });

    const modelsToClean = [
      { model: SearchHistory, name: 'SearchHistory' },
      { model: RecentlyViewed, name: 'RecentlyViewed' },
      { model: Review, name: 'Review' },
      { model: OrderItem, name: 'OrderItem' },
      { model: Order, name: 'Order' },
      { model: CartItem, name: 'CartItem' },
      { model: Cart, name: 'Cart' },
      { model: Wishlist, name: 'Wishlist' },
      { model: ProductCategory, name: 'ProductCategory' },
      { model: ProductVariant, name: 'ProductVariant' },
      { model: ProductAttribute, name: 'ProductAttribute' },
      { model: ProductAttributeGroup, name: 'ProductAttributeGroup' },
      { model: ProductSpecification, name: 'ProductSpecification' },
      { model: Image, name: 'Image' },
      { model: Product, name: 'Product' },
      { model: Category, name: 'Category' },
      { model: Brand, name: 'Brand' },
      { model: AttributeValue, name: 'AttributeValue' },
      { model: AttributeGroup, name: 'AttributeGroup' },
      { model: DiscountCode, name: 'DiscountCode' },
    ];

    for (const { model, name } of modelsToClean) {
      if (model) {
        process.stdout.write(`Đang xóa dữ liệu bảng ${name}... `);
        await model.destroy({ where: {}, truncate: false, transaction });
        console.log('Xong.');
      }
    }

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
