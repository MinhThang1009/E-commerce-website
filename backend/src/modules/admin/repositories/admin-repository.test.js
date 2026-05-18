/**
 * @file adminRepository.test.js
 * @description Tests cho adminRepository — tập trung vào:
 *   - Tất cả functions chưa được gọi (uncovered functions)
 *   - Hai branches của Object.keys(options).length ternary
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockProductUpdate = jest.fn();
const mockProductCreate = jest.fn();
const mockProductImageBulkCreate = jest.fn();
const mockProductSpecBulkCreate = jest.fn();
const mockProductAttributeCreate = jest.fn();
const mockProductAttributeBulkCreate = jest.fn();
const mockProductVariantCreate = jest.fn();
const mockProductVariantBulkCreate = jest.fn();
const mockProductWarrantyCreate = jest.fn();
const mockProductWarrantyBulkCreate = jest.fn();
const mockProductWarrantyDestroy = jest.fn();
const mockProductCategoryBulkCreate = jest.fn();
const mockOrderFindAll = jest.fn();
const mockOrderItemFindAll = jest.fn();
const mockChatMessageFindAll = jest.fn();
const mockSequelizeQuery = jest.fn();
const mockCartItemDestroy = jest.fn();
const mockWishlistDestroy = jest.fn();
const mockProductCategoryDestroy = jest.fn();

const mockFnOrUndef = jest.fn().mockResolvedValue(undefined);

jest.mock('@models', () => ({
  sequelize: {
    query: (...args) => mockSequelizeQuery(...args),
    fn: jest.fn((name, ...args) => ({ fn: name, args })),
    col: jest.fn((col) => ({ col })),
  },
  Product: {
    create: (...args) => mockProductCreate(...args),
    update: (...args) => mockProductUpdate(...args),
    findAll: jest.fn().mockResolvedValue([]),
    findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findByPk: jest.fn().mockResolvedValue(null),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
  },
  ProductImage: { bulkCreate: (...args) => mockProductImageBulkCreate(...args), destroy: jest.fn() },
  ProductSpecification: { bulkCreate: (...args) => mockProductSpecBulkCreate(...args), findAll: jest.fn().mockResolvedValue([]) },
  ProductAttribute: {
    create: (...args) => mockProductAttributeCreate(...args),
    bulkCreate: (...args) => mockProductAttributeBulkCreate(...args),
    findAll: jest.fn().mockResolvedValue([]),
    destroy: jest.fn(),
  },
  ProductVariant: {
    create: (...args) => mockProductVariantCreate(...args),
    bulkCreate: (...args) => mockProductVariantBulkCreate(...args),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    sum: jest.fn().mockResolvedValue(0),
    destroy: jest.fn(),
  },
  ProductWarranty: {
    create: (...args) => mockProductWarrantyCreate(...args),
    bulkCreate: (...args) => mockProductWarrantyBulkCreate(...args),
    destroy: (...args) => mockProductWarrantyDestroy(...args),
  },
  ProductCategory: {
    bulkCreate: (...args) => mockProductCategoryBulkCreate(...args),
    destroy: (...args) => mockProductCategoryDestroy(...args),
  },
  WarrantyPackage: { findAll: jest.fn().mockResolvedValue([]) },
  User: { count: jest.fn().mockResolvedValue(0), findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }), findByPk: jest.fn().mockResolvedValue(null), findAll: jest.fn().mockResolvedValue([]) },
  Order: {
    count: jest.fn().mockResolvedValue(0),
    sum: jest.fn().mockResolvedValue(0),
    findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findByPk: jest.fn().mockResolvedValue(null),
    findAll: (...args) => mockOrderFindAll(...args),
    update: jest.fn().mockResolvedValue([1]),
  },
  OrderItem: { findAll: (...args) => mockOrderItemFindAll(...args) },
  Review: { findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }), findByPk: jest.fn().mockResolvedValue(null) },
  Category: { findByPk: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 1 }), findAll: jest.fn().mockResolvedValue([]) },
  Brand: {},
  CartItem: { destroy: (...args) => mockCartItemDestroy(...args) },
  Wishlist: { destroy: (...args) => mockWishlistDestroy(...args) },
  InventoryLog: { create: jest.fn().mockResolvedValue({ id: 1 }) },
  AuditLog: { findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }) },
  ChatMessage: {
    count: jest.fn().mockResolvedValue(0),
    findOne: jest.fn().mockResolvedValue(null),
    findAll: (...args) => mockChatMessageFindAll(...args),
  },
  Address: {},
  LoyaltyHistory: {},
  SearchHistory: {},
  RecentlyViewed: {},
  Op: {},
  Sequelize: {
    fn: jest.fn((name, ...args) => ({ fn: name, args })),
    col: jest.fn((col) => ({ col })),
  },
}));

jest.mock('sequelize', () => ({
  Op: {},
  Sequelize: class {
    static fn(...args) { return { fn: args[0], args: args.slice(1) }; }
    static col(c) { return { col: c }; }
  },
}));

// ── Require ───────────────────────────────────────────────────────────────────

const repo = require('./sequelize-admin-repository');

afterEach(() => jest.clearAllMocks());

// ═══════════════════════════════════════════════════════════════════════════════
// Utility getters
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — utility getters', () => {
  test('getSequelize trả về sequelize instance', () => {
    expect(repo.getSequelize()).toBeDefined();
  });

  test('getOp trả về Op', () => {
    expect(repo.getOp()).toBeDefined();
  });

  test('getSequelizeFns trả về Sequelize', () => {
    expect(repo.getSequelizeFns()).toBeDefined();
  });

  test('getModels trả về object có Product, User, Order...', () => {
    const models = repo.getModels();
    expect(models.Product).toBeDefined();
    expect(models.User).toBeDefined();
    expect(models.Order).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// updateProductById (line 74)
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — updateProductById', () => {
  test('gọi Product.update với where: { id }', async () => {
    mockProductUpdate.mockResolvedValue([1]);
    await repo.updateProductById(5, { name: 'New Name' });
    expect(mockProductUpdate).toHaveBeenCalledWith({ name: 'New Name' }, { where: { id: 5 } });
  });

  test('spread options khi có options', async () => {
    mockProductUpdate.mockResolvedValue([1]);
    await repo.updateProductById(5, { name: 'New Name' }, { returning: true });
    expect(mockProductUpdate).toHaveBeenCalledWith(
      { name: 'New Name' },
      expect.objectContaining({ where: { id: 5 }, returning: true }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Object.keys(options).length branches — TRUE (options non-empty)
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — bulkCreate functions với non-empty options (TRUE branch)', () => {
  const opts = { transaction: 'fake-tx' };
  const imgData = [{ url: 'img.jpg' }];
  const specData = [{ key: 'ram', value: '8GB' }];
  const attrData = [{ name: 'Color' }];
  const variantData = [{ sku: 'SKU-1' }];
  const warrantyData = [{ packageId: 1 }];
  const catData = [{ productId: 1, categoryId: 2 }];

  test('bulkCreateProductImages với options → gọi với options', async () => {
    mockProductImageBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductImages(imgData, opts);
    expect(mockProductImageBulkCreate).toHaveBeenCalledWith(imgData, opts);
  });

  test('bulkCreateProductSpecs với options → gọi với options', async () => {
    mockProductSpecBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductSpecs(specData, opts);
    expect(mockProductSpecBulkCreate).toHaveBeenCalledWith(specData, opts);
  });

  test('createProductAttribute với options → gọi với options', async () => {
    mockProductAttributeCreate.mockResolvedValue({ id: 1 });
    await repo.createProductAttribute({ name: 'Color' }, opts);
    expect(mockProductAttributeCreate).toHaveBeenCalledWith({ name: 'Color' }, opts);
  });

  test('createProductVariant với options → gọi với options', async () => {
    mockProductVariantCreate.mockResolvedValue({ id: 1 });
    await repo.createProductVariant({ sku: 'SKU-1' }, opts);
    expect(mockProductVariantCreate).toHaveBeenCalledWith({ sku: 'SKU-1' }, opts);
  });

  test('createProductWarranty với options → gọi với options', async () => {
    mockProductWarrantyCreate.mockResolvedValue({ id: 1 });
    await repo.createProductWarranty({ packageId: 1 }, opts);
    expect(mockProductWarrantyCreate).toHaveBeenCalledWith({ packageId: 1 }, opts);
  });

  test('bulkCreateProductVariants với options → gọi với options', async () => {
    mockProductVariantBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductVariants(variantData, opts);
    expect(mockProductVariantBulkCreate).toHaveBeenCalledWith(variantData, opts);
  });

  test('bulkCreateProductWarranties với options → gọi với options', async () => {
    mockProductWarrantyBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductWarranties(warrantyData, opts);
    expect(mockProductWarrantyBulkCreate).toHaveBeenCalledWith(warrantyData, opts);
  });

  test('bulkCreateProductCategories với options → gọi với options', async () => {
    mockProductCategoryBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductCategories(catData, opts);
    expect(mockProductCategoryBulkCreate).toHaveBeenCalledWith(catData, opts);
  });

  test('bulkCreateProductAttributes với options → gọi với options', async () => {
    mockProductAttributeBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductAttributes(attrData, opts);
    expect(mockProductAttributeBulkCreate).toHaveBeenCalledWith(attrData, opts);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FALSE branch — empty options
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — bulkCreate functions với empty options (FALSE branch)', () => {
  const imgData = [{ url: 'img.jpg' }];

  test('bulkCreateProductImages không có options → gọi không có options', async () => {
    mockProductImageBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductImages(imgData);
    expect(mockProductImageBulkCreate).toHaveBeenCalledWith(imgData);
  });

  test('createProductAttribute không có options → gọi không có options', async () => {
    mockProductAttributeCreate.mockResolvedValue({ id: 1 });
    await repo.createProductAttribute({ name: 'Size' });
    expect(mockProductAttributeCreate).toHaveBeenCalledWith({ name: 'Size' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Uncovered functions: countOrdersByStatus, findTopSellingItems, aggregateX
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — uncovered aggregate functions', () => {
  test('countOrdersByStatus gọi Order.findAll với group by status', async () => {
    mockOrderFindAll.mockResolvedValue([{ status: 'pending', count: 5 }]);
    const result = await repo.countOrdersByStatus();
    // Verify đúng argument — phải có group: ['status']
    expect(mockOrderFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ group: ['status'], raw: true }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('pending');
  });

  test('findTopSellingItems gọi OrderItem.findAll với limit và group đúng', async () => {
    mockOrderItemFindAll.mockResolvedValue([{ productId: 1, totalSold: 10 }]);
    const result = await repo.findTopSellingItems({ limit: 5 });
    // Verify limit được truyền vào
    expect(mockOrderItemFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, group: ['productId', 'Product.id'] }),
    );
    expect(result).toHaveLength(1);
  });

  test('findTopSellingItems không có args → default limit=5, include=[] (lines 143-158 default branch)', async () => {
    mockOrderItemFindAll.mockResolvedValue([]);
    await repo.findTopSellingItems();
    expect(mockOrderItemFindAll).toHaveBeenCalled();
  });

  test('aggregateOrderItems2 gọi OrderItem.findAll', async () => {
    mockOrderItemFindAll.mockResolvedValue([]);
    await repo.aggregateOrderItems2({ attributes: ['productId'], group: ['productId'] });
    expect(mockOrderItemFindAll).toHaveBeenCalled();
  });

  test('aggregateOrderItems với include và where rõ ràng (line 156-158 explicit branch)', async () => {
    mockOrderItemFindAll.mockResolvedValue([]);
    await repo.aggregateOrderItems({ attributes: ['productId'], include: [], where: { status: 'paid' }, group: ['productId'], raw: true });
    expect(mockOrderItemFindAll).toHaveBeenCalled();
  });

  test('aggregateOrderItems2 với include và where rõ ràng (branches)', async () => {
    mockOrderItemFindAll.mockResolvedValue([]);
    await repo.aggregateOrderItems2({ attributes: ['productId'], include: [], where: { status: 'completed' }, group: ['productId'], raw: true });
    expect(mockOrderItemFindAll).toHaveBeenCalled();
  });

  test('aggregateChatMessages gọi ChatMessage.findAll', async () => {
    mockChatMessageFindAll.mockResolvedValue([{ count: 10 }]);
    const result = await repo.aggregateChatMessages({ attributes: ['intent'], group: ['intent'] });
    expect(mockChatMessageFindAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  test('aggregateChatMessagesAdv gọi ChatMessage.findAll với arbitrary options', async () => {
    mockChatMessageFindAll.mockResolvedValue([]);
    await repo.aggregateChatMessagesAdv({ where: { role: 'user' } });
    expect(mockChatMessageFindAll).toHaveBeenCalledWith({ where: { role: 'user' } });
  });

  test('rawQuery gọi sequelize.query', async () => {
    mockSequelizeQuery.mockResolvedValue([[{ count: 42 }], undefined]);
    const result = await repo.rawQuery('SELECT count(*) FROM orders', { type: 'SELECT' });
    expect(mockSequelizeQuery).toHaveBeenCalled();
  });

  test('destroyCartItems gọi CartItem.destroy', async () => {
    mockCartItemDestroy.mockResolvedValue(2);
    await repo.destroyCartItems({ userId: 1 });
    expect(mockCartItemDestroy).toHaveBeenCalledWith({ where: { userId: 1 } });
  });

  test('destroyWishlists gọi Wishlist.destroy', async () => {
    mockWishlistDestroy.mockResolvedValue(1);
    await repo.destroyWishlists({ userId: 1 });
    expect(mockWishlistDestroy).toHaveBeenCalledWith({ where: { userId: 1 } });
  });

  test('destroyProductCategories gọi ProductCategory.destroy', async () => {
    mockProductCategoryDestroy.mockResolvedValue(3);
    await repo.destroyProductCategories({ productId: 5 });
    expect(mockProductCategoryDestroy).toHaveBeenCalledWith({ where: { productId: 5 } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// User queries (lines 49-51+)
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — User queries', () => {
  const { User } = require('@models');

  test('countUsers với where rõ ràng', async () => {
    User.count.mockResolvedValue(10);
    const r = await repo.countUsers({ isActive: true });
    expect(User.count).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(r).toBe(10);
  });

  test('countUsers không có where → default {} (line 49 default branch)', async () => {
    User.count.mockResolvedValue(5);
    await repo.countUsers();
    expect(User.count).toHaveBeenCalledWith({ where: {} });
  });

  test('findUsers với options đầy đủ', async () => {
    User.findAndCountAll.mockResolvedValue({ count: 2, rows: [{ id: 1 }, { id: 2 }] });
    const r = await repo.findUsers({ where: {}, limit: 10, offset: 0 });
    expect(User.findAndCountAll).toHaveBeenCalled();
    expect(r.count).toBe(2);
  });

  test('findUsers không có args → default (line 51 default branch)', async () => {
    User.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await repo.findUsers();
    expect(User.findAndCountAll).toHaveBeenCalled();
  });

  test('findUserById gọi User.findByPk', async () => {
    User.findByPk.mockResolvedValue({ id: 5 });
    const r = await repo.findUserById(5);
    expect(User.findByPk).toHaveBeenCalledWith(5, {});
  });

  test('updateUser gọi user.update', async () => {
    const user = { update: jest.fn().mockResolvedValue({ id: 1 }) };
    await repo.updateUser(user, { isActive: false });
    expect(user.update).toHaveBeenCalledWith({ isActive: false });
  });

  test('deleteUser gọi user.destroy', async () => {
    const user = { destroy: jest.fn().mockResolvedValue(undefined) };
    await repo.deleteUser(user);
    expect(user.destroy).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Product queries (lines 64+)
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — Product queries', () => {
  const { Product, ProductSpecification, ProductAttribute, ProductVariant, WarrantyPackage, ProductImage, ProductWarranty } = require('@models');

  test('findProducts gọi Product.findAndCountAll', async () => {
    Product.findAndCountAll.mockResolvedValue({ count: 5, rows: [] });
    await repo.findProducts({ where: {}, limit: 10, offset: 0 });
    expect(Product.findAndCountAll).toHaveBeenCalled();
  });

  test('findProducts không có args → default (line 64 default branch)', async () => {
    Product.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await repo.findProducts();
    expect(Product.findAndCountAll).toHaveBeenCalled();
  });

  test('findProductsList gọi Product.findAll', async () => {
    Product.findAll.mockResolvedValue([{ id: 1 }]);
    const r = await repo.findProductsList({ where: {}, limit: 5 });
    expect(Product.findAll).toHaveBeenCalled();
    expect(r).toHaveLength(1);
  });

  test('findProductsList không có args → default (line 69 default branch)', async () => {
    Product.findAll.mockResolvedValue([]);
    await repo.findProductsList();
    expect(Product.findAll).toHaveBeenCalled();
  });

  test('findProductById gọi Product.findByPk', async () => {
    Product.findByPk.mockResolvedValue({ id: 3 });
    await repo.findProductById(3);
    expect(Product.findByPk).toHaveBeenCalledWith(3, {});
  });

  test('createProduct gọi Product.create', async () => {
    mockProductCreate.mockResolvedValue({ id: 10 });
    await repo.createProduct({ name: 'Test' });
    expect(mockProductCreate).toHaveBeenCalledWith({ name: 'Test' });
  });

  test('deleteProduct gọi product.destroy (line 83)', async () => {
    const product = { destroy: jest.fn().mockResolvedValue(undefined) };
    await repo.deleteProduct(product);
    expect(product.destroy).toHaveBeenCalled();
  });

  test('destroyProductImages gọi ProductImage.destroy', async () => {
    ProductImage.destroy.mockResolvedValue(2);
    await repo.destroyProductImages({ productId: 1 });
    expect(ProductImage.destroy).toHaveBeenCalled();
  });

  test('bulkCreateProductSpecs không có options → FALSE branch', async () => {
    mockProductSpecBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductSpecs([{ key: 'ram' }]);
    expect(mockProductSpecBulkCreate).toHaveBeenCalledWith([{ key: 'ram' }]);
  });

  test('findProductSpecs gọi ProductSpecification.findAll', async () => {
    ProductSpecification.findAll.mockResolvedValue([]);
    await repo.findProductSpecs({ productId: 1 });
    expect(ProductSpecification.findAll).toHaveBeenCalled();
  });

  test('findProductAttributes gọi ProductAttribute.findAll', async () => {
    ProductAttribute.findAll.mockResolvedValue([]);
    await repo.findProductAttributes({ productId: 1 });
    expect(ProductAttribute.findAll).toHaveBeenCalled();
  });

  test('findProductVariants gọi ProductVariant.findAll', async () => {
    ProductVariant.findAll.mockResolvedValue([]);
    await repo.findProductVariants({ productId: 1 });
    expect(ProductVariant.findAll).toHaveBeenCalled();
  });

  test('findWarrantyPackages gọi WarrantyPackage.findAll', async () => {
    WarrantyPackage.findAll.mockResolvedValue([]);
    await repo.findWarrantyPackages({});
    expect(WarrantyPackage.findAll).toHaveBeenCalled();
  });

  test('destroyProductWarranties gọi ProductWarranty.destroy', async () => {
    mockProductWarrantyDestroy.mockResolvedValue(1);
    await repo.destroyProductWarranties({ productId: 1 });
    expect(mockProductWarrantyDestroy).toHaveBeenCalledWith({ where: { productId: 1 } });
  });

  test('findProductVariantById gọi ProductVariant.findOne', async () => {
    ProductVariant.findOne.mockResolvedValue(null);
    await repo.findProductVariantById(1, 5);
    expect(ProductVariant.findOne).toHaveBeenCalledWith({ where: { id: 1, productId: 5 } });
  });

  test('findProductVariantById với options rõ ràng (line 291 non-default branch)', async () => {
    ProductVariant.findOne.mockResolvedValue({ id: 1 });
    await repo.findProductVariantById(1, 5, { include: [] });
    expect(ProductVariant.findOne).toHaveBeenCalledWith({ where: { id: 1, productId: 5 }, include: [] });
  });

  test('sumProductVariantStock gọi ProductVariant.sum', async () => {
    ProductVariant.sum.mockResolvedValue(50);
    const r = await repo.sumProductVariantStock(5);
    expect(ProductVariant.sum).toHaveBeenCalledWith('stockQuantity', { where: { productId: 5 } });
    expect(r).toBe(50);
  });

  test('destroyProductAttributes gọi ProductAttribute.destroy', async () => {
    ProductAttribute.destroy.mockResolvedValue(1);
    await repo.destroyProductAttributes({ productId: 1 });
    expect(ProductAttribute.destroy).toHaveBeenCalled();
  });

  test('destroyProductVariants gọi ProductVariant.destroy', async () => {
    ProductVariant.destroy.mockResolvedValue(1);
    await repo.destroyProductVariants({ productId: 1 });
    expect(ProductVariant.destroy).toHaveBeenCalled();
  });

  test('createProductFull gọi Product.create', async () => {
    mockProductCreate.mockResolvedValue({ id: 99 });
    await repo.createProductFull({ name: 'Full Product' });
    expect(mockProductCreate).toHaveBeenCalled();
  });

  test('createProductFull với options (Object.keys > 0 branch)', async () => {
    mockProductCreate.mockResolvedValue({ id: 100 });
    await repo.createProductFull({ name: 'Test' }, { transaction: 'tx' });
    expect(mockProductCreate).toHaveBeenCalledWith({ name: 'Test' }, { transaction: 'tx' });
  });

  test('updateProductWhere gọi Product.update', async () => {
    mockProductUpdate.mockResolvedValue([1]);
    await repo.updateProductWhere({ name: 'New' }, { id: 1 });
    expect(mockProductUpdate).toHaveBeenCalledWith(
      { name: 'New' },
      expect.objectContaining({ where: { id: 1 } }),
    );
  });

  test('findProductOne gọi Product.findOne', async () => {
    Product.findOne.mockResolvedValue({ id: 7 });
    await repo.findProductOne({ id: 7 });
    expect(Product.findOne).toHaveBeenCalled();
  });

  test('findProductOne với options rõ ràng (line 278 non-default branch)', async () => {
    Product.findOne.mockResolvedValue({ id: 7 });
    await repo.findProductOne({ id: 7 }, { include: [], raw: true });
    expect(Product.findOne).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Category queries
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — Category queries', () => {
  const { Category } = require('@models');

  test('findCategoryById gọi Category.findByPk', async () => {
    Category.findByPk.mockResolvedValue({ id: 2 });
    await repo.findCategoryById(2);
    expect(Category.findByPk).toHaveBeenCalledWith(2, {});
  });

  test('createCategory gọi Category.create', async () => {
    Category.create.mockResolvedValue({ id: 3 });
    await repo.createCategory({ name: 'Gaming' });
    expect(Category.create).toHaveBeenCalledWith({ name: 'Gaming' });
  });

  test('findCategories gọi Category.findAll', async () => {
    Category.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const r = await repo.findCategories({ where: {} });
    expect(Category.findAll).toHaveBeenCalled();
    expect(r).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Order queries (lines 114+)
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — Order queries', () => {
  const { Order } = require('@models');

  test('countOrders gọi Order.count với where đúng', async () => {
    Order.count.mockResolvedValue(15);
    const r = await repo.countOrders({ status: 'pending' });
    expect(Order.count).toHaveBeenCalledWith({ where: { status: 'pending' } });
    expect(r).toBe(15);
  });

  test('countOrders không có where → default (line 114 default branch)', async () => {
    Order.count.mockResolvedValue(0);
    await repo.countOrders();
    expect(Order.count).toHaveBeenCalledWith({ where: {} });
  });

  test('sumOrderTotal gọi Order.sum', async () => {
    Order.sum.mockResolvedValue(1000000);
    await repo.sumOrderTotal({ status: 'completed' });
    expect(Order.sum).toHaveBeenCalled();
  });

  test('sumOrderTotal không có where → default (line 125 default branch)', async () => {
    Order.sum.mockResolvedValue(0);
    await repo.sumOrderTotal();
    expect(Order.sum).toHaveBeenCalled();
  });

  test('findOrders gọi Order.findAndCountAll', async () => {
    Order.findAndCountAll.mockResolvedValue({ count: 3, rows: [] });
    await repo.findOrders({ where: {}, limit: 10, offset: 0 });
    expect(Order.findAndCountAll).toHaveBeenCalled();
  });

  test('findOrders không có args → default (line 127 default branch)', async () => {
    Order.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await repo.findOrders();
    expect(Order.findAndCountAll).toHaveBeenCalled();
  });

  test('findOrderById gọi Order.findByPk', async () => {
    Order.findByPk.mockResolvedValue({ id: 1 });
    await repo.findOrderById(1);
    expect(Order.findByPk).toHaveBeenCalledWith(1, {});
  });

  test('updateOrder gọi order.update (line 132)', async () => {
    const order = { update: jest.fn().mockResolvedValue({ id: 1, status: 'processing' }) };
    await repo.updateOrder(order, { status: 'processing' });
    expect(order.update).toHaveBeenCalledWith({ status: 'processing' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Review queries (line 169+)
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — Review queries', () => {
  const { Review } = require('@models');

  test('findReviews gọi Review.findAndCountAll', async () => {
    Review.findAndCountAll.mockResolvedValue({ count: 1, rows: [{ id: 1 }] });
    await repo.findReviews({ where: {}, limit: 5 });
    expect(Review.findAndCountAll).toHaveBeenCalled();
  });

  test('findReviews không có args → default (line 169 default branch)', async () => {
    Review.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await repo.findReviews();
    expect(Review.findAndCountAll).toHaveBeenCalled();
  });

  test('findReviewById gọi Review.findByPk', async () => {
    Review.findByPk.mockResolvedValue({ id: 2 });
    await repo.findReviewById(2);
    expect(Review.findByPk).toHaveBeenCalledWith(2, {});
  });

  test('deleteReview gọi review.destroy (line 188)', async () => {
    const review = { destroy: jest.fn().mockResolvedValue(undefined) };
    await repo.deleteReview(review);
    expect(review.destroy).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Inventory + Analytics + Audit + Chatbot (lines 182-240)
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — Inventory, Analytics, Audit, Chatbot', () => {
  const { InventoryLog, AuditLog, ChatMessage, Order, User } = require('@models');

  test('createInventoryLog gọi InventoryLog.create', async () => {
    InventoryLog.create.mockResolvedValue({ id: 1 });
    await repo.createInventoryLog({ productId: 1, delta: -2 });
    expect(InventoryLog.create).toHaveBeenCalledWith({ productId: 1, delta: -2 });
  });

  test('aggregateOrders gọi Order.findAll', async () => {
    mockOrderFindAll.mockResolvedValue([{ total: 1000 }]);
    await repo.aggregateOrders({ attributes: ['total'], group: ['status'] });
    expect(mockOrderFindAll).toHaveBeenCalled();
  });

  test('aggregateOrders không có args → default (line 201 default branch)', async () => {
    mockOrderFindAll.mockResolvedValue([]);
    await repo.aggregateOrders();
    expect(mockOrderFindAll).toHaveBeenCalled();
  });

  test('aggregateUsers gọi User.findAll', async () => {
    User.findAll.mockResolvedValue([{ count: 5 }]);
    await repo.aggregateUsers({ attributes: ['createdAt'], group: ['date'] });
    expect(User.findAll).toHaveBeenCalled();
  });

  test('aggregateUsers không có args → default (line 210 default branch)', async () => {
    User.findAll.mockResolvedValue([]);
    await repo.aggregateUsers();
    expect(User.findAll).toHaveBeenCalled();
  });

  test('aggregateUsers với where rõ ràng (line 210 non-default branch)', async () => {
    User.findAll.mockResolvedValue([]);
    await repo.aggregateUsers({ attributes: ['id'], where: { isActive: true }, group: ['id'], raw: true });
    expect(User.findAll).toHaveBeenCalled();
  });

  test('findAuditLogs gọi AuditLog.findAndCountAll', async () => {
    AuditLog.findAndCountAll.mockResolvedValue({ count: 2, rows: [] });
    await repo.findAuditLogs({ where: {}, limit: 10 });
    expect(AuditLog.findAndCountAll).toHaveBeenCalled();
  });

  test('findAuditLogs không có args → default (line 235 default branch)', async () => {
    AuditLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    await repo.findAuditLogs();
    expect(AuditLog.findAndCountAll).toHaveBeenCalled();
  });

  test('countChatMessages gọi ChatMessage.count', async () => {
    ChatMessage.count.mockResolvedValue(42);
    const r = await repo.countChatMessages({ role: 'user' });
    expect(ChatMessage.count).toHaveBeenCalled();
    expect(r).toBe(42);
  });

  test('countChatMessages không có args → default (line 240 default branch)', async () => {
    ChatMessage.count.mockResolvedValue(0);
    await repo.countChatMessages();
    expect(ChatMessage.count).toHaveBeenCalledWith({ where: {} });
  });

  test('findOneChatMessage gọi ChatMessage.findOne', async () => {
    ChatMessage.findOne.mockResolvedValue({ id: 5 });
    await repo.findOneChatMessage({ where: { sessionId: 'abc' } });
    expect(ChatMessage.findOne).toHaveBeenCalled();
  });

  test('findOneChatMessage không có args → default (line 240+ default branch)', async () => {
    ChatMessage.findOne.mockResolvedValue(null);
    await repo.findOneChatMessage();
    expect(ChatMessage.findOne).toHaveBeenCalledWith({});
  });

  test('aggregateChatMessages với where rõ ràng (line 240 non-default branch)', async () => {
    mockChatMessageFindAll.mockResolvedValue([]);
    await repo.aggregateChatMessages({ attributes: ['intent'], where: { role: 'user' }, group: ['intent'], raw: true });
    expect(mockChatMessageFindAll).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FALSE branches cho các bulkCreate còn thiếu
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminRepository — bulkCreate FALSE branches còn thiếu', () => {
  test('bulkCreateProductVariants không có options → FALSE branch', async () => {
    mockProductVariantBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductVariants([{ sku: 'V1' }]);
    expect(mockProductVariantBulkCreate).toHaveBeenCalledWith([{ sku: 'V1' }]);
  });

  test('bulkCreateProductWarranties không có options → FALSE branch', async () => {
    mockProductWarrantyBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductWarranties([{ packageId: 1 }]);
    expect(mockProductWarrantyBulkCreate).toHaveBeenCalledWith([{ packageId: 1 }]);
  });

  test('bulkCreateProductCategories không có options → FALSE branch', async () => {
    mockProductCategoryBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductCategories([{ productId: 1, categoryId: 2 }]);
    expect(mockProductCategoryBulkCreate).toHaveBeenCalledWith([{ productId: 1, categoryId: 2 }]);
  });

  test('bulkCreateProductAttributes không có options → FALSE branch', async () => {
    mockProductAttributeBulkCreate.mockResolvedValue([]);
    await repo.bulkCreateProductAttributes([{ name: 'Color' }]);
    expect(mockProductAttributeBulkCreate).toHaveBeenCalledWith([{ name: 'Color' }]);
  });

  test('createProductVariant không có options → FALSE branch', async () => {
    mockProductVariantCreate.mockResolvedValue({ id: 1 });
    await repo.createProductVariant({ sku: 'V1' });
    expect(mockProductVariantCreate).toHaveBeenCalledWith({ sku: 'V1' });
  });

  test('createProductWarranty không có options → FALSE branch', async () => {
    mockProductWarrantyCreate.mockResolvedValue({ id: 1 });
    await repo.createProductWarranty({ packageId: 1 });
    expect(mockProductWarrantyCreate).toHaveBeenCalledWith({ packageId: 1 });
  });
});
