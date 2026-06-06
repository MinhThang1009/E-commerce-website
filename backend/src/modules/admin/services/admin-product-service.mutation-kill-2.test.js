/**
 * Mutation-kill batch 2 cho admin-product-service.js — phần CRUD sâu chưa cover
 * ở batch 1: createProduct (data detail), updateProduct (variants/attributes/specs
 * CRUD), getAllProducts (include/sort literal), cloneProduct (sku suffix).
 * Tách file riêng để dễ quản lý; mutation --mutate cùng source gom cả 2 file.
 */

process.env.NODE_ENV = 'test';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@utils/product-helpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(0),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('GEN-SKU'),
  enrichProductData: jest.fn((p) => p),
}));

jest.mock('@services/vector-store/vector-store', () => ({
  upsertProduct: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  loadPromise: Promise.resolve(),
  items: [],
}));

jest.mock('@modules/ai/services/translate/translate-service', () => ({
  translateBatch: jest.fn().mockResolvedValue([]),
}));

jest.mock('@modules/admin/repositories/sequelize-admin-repository', () => {
  const { Op, Sequelize } = require('sequelize');
  const models = {
    Product: { __m: 'Product' },
    ProductImage: { __m: 'ProductImage' },
    ProductSpecification: { __m: 'ProductSpecification', create: jest.fn() },
    ProductVariant: { __m: 'ProductVariant' },
    ProductAttribute: { __m: 'ProductAttribute' },
    ProductCategory: { __m: 'ProductCategory', bulkCreate: jest.fn() },
    Category: { __m: 'Category' },
    CartItem: { __m: 'CartItem' },
    InventoryLog: { __m: 'InventoryLog' },
  };
  const seq = { transaction: jest.fn(), query: jest.fn(), QueryTypes: { UPDATE: 'UPDATE' } };
  return {
    getSequelize: () => seq,
    getOp: () => Op,
    getSequelizeFns: () => Sequelize,
    getModels: () => models,
    findProductById: jest.fn(),
    findProductOne: jest.fn(),
    findCategories: jest.fn(),
    createProductFull: jest.fn(),
    createProductAttribute: jest.fn(),
    findProductAttributes: jest.fn(),
    createProductVariant: jest.fn(),
    updateProductWhere: jest.fn(),
    bulkCreateProductImages: jest.fn(),
    bulkCreateProductSpecs: jest.fn(),
    bulkCreateProductAttributes: jest.fn(),
    bulkCreateProductVariants: jest.fn(),
    findProducts: jest.fn(),
    findProductVariants: jest.fn(),
    findProductSpecs: jest.fn(),
    destroyProductImages: jest.fn(),
    findProductVariantById: jest.fn(),
    sumProductVariantStock: jest.fn(),
    destroyCartItems: jest.fn(),
    destroyWishlists: jest.fn(),
    destroyProductAttributes: jest.fn(),
    destroyProductVariants: jest.fn(),
    destroyProductCategories: jest.fn(),
    createInventoryLog: jest.fn(),
  };
});

const { Op } = require('sequelize');
const repo = require('@modules/admin/repositories/sequelize-admin-repository');
const helpers = require('@utils/product-helpers');
const vectorStore = require('@services/vector-store/vector-store');
const service = require('@modules/admin/services/admin-product-service');

const sequelize = repo.getSequelize();
const { Category, ProductSpecification, ProductCategory } = repo.getModels();
const TX = { commit: jest.fn(), rollback: jest.fn() };
const flushAsync = () => new Promise((r) => setImmediate(r));

function invoke(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: undefined,
      payload: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(b) {
        this.payload = b;
        resolve({ res: this });
        return this;
      },
    };
    const next = (err) => resolve({ err });
    handler(req, res, next);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  TX.commit.mockResolvedValue(undefined);
  TX.rollback.mockResolvedValue(undefined);
  sequelize.transaction.mockResolvedValue(TX);
  sequelize.query.mockResolvedValue([{}, 1]);
  helpers.generateVariantSku.mockReturnValue('GEN-SKU');
  helpers.calculateTotalStock.mockReturnValue(0);
  repo.findCategories.mockResolvedValue([]);
  repo.findProductAttributes.mockResolvedValue([]);
  repo.findProductVariants.mockResolvedValue([]);
  repo.findProductSpecs.mockResolvedValue([]);
  repo.createProductVariant.mockResolvedValue({ id: 1, price: 0 });
  repo.createProductAttribute.mockResolvedValue({ id: 1 });
  vectorStore.items = [];
});

// ─── createProduct deep ─────────────────────────────────────────────────────

describe('createProduct deep', () => {
  function prod() {
    return { id: 10, setCategories: jest.fn(), update: jest.fn() };
  }
  beforeEach(() => {
    repo.findProductOne.mockResolvedValue(null);
    repo.findProductById.mockResolvedValue({ status: 'draft', toJSON: () => ({ id: 10 }) });
  });

  test('createProductFull fallback đầy đủ (body tối thiểu)', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, { body: { name: 'P', description: 'D' } });
    expect(repo.createProductFull).toHaveBeenCalledWith(
      {
        name: 'P',
        baseName: 'P',
        description: 'D',
        shortDescription: 'D',
        basePrice: undefined,
        compareAtPrice: null,
        stockQuantity: 0,
        status: 'active',
        isFeatured: false,
        seoTitle: 'P',
        seoDescription: 'D',
        seoKeywords: [],
        condition: 'new',
        specifications: {}, // specifications mặc định {} → {} || [] = {}
        faqs: [],
      },
      expect.anything(),
    );
  });

  test('không sku → generateVariantSku nhận uniqueSku SKU-<ts>-<rand>', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [{ name: 'V', price: '1', stock: '1' }] },
    });
    expect(helpers.generateVariantSku).toHaveBeenCalledWith(
      expect.stringMatching(/^SKU-\d+-\d+$/),
      {},
    );
  });

  test('attribute value mảng / số', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: {
        name: 'P',
        attributes: [
          { name: 'A', value: ['x', 'y'] },
          { name: 'B', value: 42 },
        ],
      },
    });
    expect(repo.createProductAttribute).toHaveBeenCalledWith(
      { productId: 10, name: 'A', values: ['x', 'y'] },
      expect.anything(),
    );
    expect(repo.createProductAttribute).toHaveBeenCalledWith(
      { productId: 10, name: 'B', values: ['42'] },
      expect.anything(),
    );
  });

  test('variant displayName/variantName fallback từ attributes; sortOrder/isAvailable', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    helpers.generateVariantSku.mockReturnValue('SK');
    await invoke(service.createProduct, {
      body: {
        name: 'P',
        variants: [{ price: '10', stock: '2', attributes: { color: 'Đỏ', size: 'L' } }],
      },
    });
    const arg = repo.createProductVariant.mock.calls[0][0];
    expect(arg.displayName).toBe('Đỏ - L');
    expect(arg.variantName).toBe('Đỏ - L');
    expect(arg.sortOrder).toBe(0);
    expect(arg.isAvailable).toBe(true);
    expect(arg.isDefault).toBe(false);
    expect(arg.sku).toBe('SK');
    expect(arg.price).toBe(10);
    expect(arg.stockQuantity).toBe(2);
  });

  test('variant isAvailable=false + isDefault=true khi truyền', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: {
        name: 'P',
        variants: [{ name: 'V', price: '1', stock: '1', isAvailable: false, isDefault: true }],
      },
    });
    const arg = repo.createProductVariant.mock.calls[0][0];
    expect(arg.isAvailable).toBe(false);
    expect(arg.isDefault).toBe(true);
  });

  test('variants → updateProductWhere(stockQuantity=calculateTotalStock)', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    helpers.calculateTotalStock.mockReturnValue(99);
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [{ name: 'V', price: '1', stock: '5' }] },
    });
    expect(repo.updateProductWhere).toHaveBeenCalledWith(
      { stockQuantity: 99 },
      { id: 10 },
      expect.anything(),
    );
  });

  test('specs → bulkCreateProductSpecs (category General, sortOrder index)', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', specifications: [{ name: 'CPU', value: 'A17' }] },
    });
    expect(repo.bulkCreateProductSpecs).toHaveBeenCalledWith(
      [{ productId: 10, name: 'CPU', value: 'A17', category: 'General', sortOrder: 0 }],
      expect.anything(),
    );
  });

  test('mảng rỗng → KHÔNG gọi create tương ứng', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [], images: [], specifications: [], attributes: [] },
    });
    expect(repo.createProductVariant).not.toHaveBeenCalled();
    expect(repo.updateProductWhere).not.toHaveBeenCalled();
    expect(repo.bulkCreateProductImages).not.toHaveBeenCalled();
    expect(repo.bulkCreateProductSpecs).not.toHaveBeenCalled();
    expect(repo.createProductAttribute).not.toHaveBeenCalled();
  });
});

// ─── updateProduct deep ─────────────────────────────────────────────────────

describe('updateProduct deep', () => {
  function prod(over = {}) {
    return {
      id: 5,
      name: 'Old',
      basePrice: 100,
      update: jest.fn().mockResolvedValue(undefined),
      setCategories: jest.fn().mockResolvedValue(undefined),
      ...over,
    };
  }
  function mockFinal(status = 'draft') {
    repo.findProductById.mockResolvedValueOnce({ id: 5, status, toJSON: () => ({ id: 5 }) });
  }

  test('updateData map đủ field hasOwnProperty', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    mockFinal();
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: {
        baseName: 'BN',
        description: 'D',
        shortDescription: 'SD',
        stockQuantity: '12',
        status: 'active',
        featured: true, // trigger hasOwnProperty('featured')
        isFeatured: true, // giá trị thực (destructure isFeatured: featured)
        condition: 'used',
        seoTitle: 'ST',
        seoDescription: 'SDesc',
        seoKeywords: ['k'],
        faqs: [{ q: 'a' }],
      },
    });
    expect(p.update).toHaveBeenCalledWith(
      {
        baseName: 'BN',
        description: 'D',
        shortDescription: 'SD',
        stockQuantity: 12,
        status: 'active',
        isFeatured: true,
        condition: 'used',
        seoTitle: 'ST',
        seoDescription: 'SDesc',
        seoKeywords: ['k'],
        faqs: [{ q: 'a' }],
      },
      { transaction: TX },
    );
  });

  test('baseName fallback name khi baseName rỗng', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    mockFinal();
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { name: 'NewName', baseName: '' },
    });
    expect(p.update.mock.calls[0][0].baseName).toBe('NewName');
  });

  test('images: destroy cũ + bulkCreate (string + object)', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    mockFinal();
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { images: ['a.jpg', { url: 'b.jpg', color: 'red', variantId: 3 }] },
    });
    expect(repo.destroyProductImages).toHaveBeenCalledWith({ productId: '5' }, { transaction: TX });
    expect(repo.bulkCreateProductImages).toHaveBeenCalledWith(
      [
        { productId: '5', imageUrl: 'a.jpg', isThumbnail: true, color: null, variantId: null },
        { productId: '5', imageUrl: 'b.jpg', isThumbnail: false, color: 'red', variantId: 3 },
      ],
      { transaction: TX },
    );
  });

  test('compareAtPrice ưu tiên hơn comparePrice', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    mockFinal();
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { compareAtPrice: 200, comparePrice: 999 },
    });
    expect(sequelize.query.mock.calls[0][1].replacements.compareAtPrice).toBe(200);
  });

  test('attributes CRUD: xoá cũ không còn, update tồn tại, tạo mới', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    mockFinal();
    const oldAttr = { name: 'Cũ', destroy: jest.fn() };
    const existAttr = { name: 'Màu', update: jest.fn(), type: 'custom', required: false };
    repo.findProductAttributes.mockResolvedValueOnce([oldAttr, existAttr]);
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: {
        attributes: [
          { name: 'Màu', value: 'đỏ,xanh' },
          { name: 'Mới', value: ['a'] },
        ],
      },
    });
    expect(oldAttr.destroy).toHaveBeenCalledWith({ transaction: TX }); // không còn → xoá
    expect(existAttr.update).toHaveBeenCalledWith(
      expect.objectContaining({ values: ['đỏ', 'xanh'] }),
      { transaction: TX },
    );
    expect(repo.createProductAttribute).toHaveBeenCalledWith(
      expect.objectContaining({ productId: '5', name: 'Mới', values: ['a'] }),
      { transaction: TX },
    );
  });

  test('variants CRUD: update tồn tại + tạo mới + xoá bỏ + stock/minPrice', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    mockFinal();
    const existVar = { id: 7, update: jest.fn().mockResolvedValue({ id: 7, price: 50 }) };
    const removeVar = { id: 8, destroy: jest.fn() };
    repo.findProductVariants.mockResolvedValueOnce([existVar, removeVar]);
    repo.createProductVariant.mockResolvedValueOnce({ id: 9, price: 30 });
    helpers.calculateTotalStock.mockReturnValue(10);
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: {
        variants: [
          { id: 7, price: '50', stock: '4' },
          { price: '30', stock: '6' },
        ],
      },
    });
    expect(removeVar.destroy).toHaveBeenCalledWith({ transaction: TX }); // id 8 không có trong incoming
    expect(existVar.update).toHaveBeenCalled(); // id 7 update
    expect(repo.createProductVariant).toHaveBeenCalled(); // variant mới
    // minVariantPrice = min(50,30)=30 > 0 → stockUpdate có basePrice
    expect(repo.updateProductWhere).toHaveBeenCalledWith(
      { stockQuantity: 10, basePrice: 30 },
      { id: '5' },
      { transaction: TX },
    );
  });

  test('stockQuantity-only (không variants) → updateProductWhere stock', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    mockFinal();
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { stockQuantity: '15' },
    });
    expect(repo.updateProductWhere).toHaveBeenCalledWith(
      { stockQuantity: 15 },
      { id: '5' },
      { transaction: TX },
    );
  });

  test('specs CRUD: xoá cũ + update tồn tại + tạo mới', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    mockFinal();
    const oldSpec = { name: 'Cũ', destroy: jest.fn() };
    const existSpec = {
      name: 'CPU',
      value: 'X',
      valueEn: 'X',
      update: jest.fn().mockResolvedValue({ valueEn: 'X' }),
    };
    repo.findProductSpecs.mockResolvedValueOnce([oldSpec, existSpec]);
    ProductSpecification.create.mockResolvedValueOnce({ value: 'New', valueEn: 'New' });
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: {
        specifications: [
          { name: 'CPU', value: 'X' },
          { name: 'RAM', value: 'New', valueEn: 'New' },
        ],
      },
    });
    expect(oldSpec.destroy).toHaveBeenCalledWith({ transaction: TX });
    expect(existSpec.update).toHaveBeenCalled();
    expect(ProductSpecification.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'RAM', value: 'New', productId: '5', category: 'General' }),
      { transaction: TX },
    );
  });

  test('lỗi khi cập nhật → rollback + throw', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    p.update.mockRejectedValueOnce(new Error('boom'));
    const { err } = await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { name: 'X' },
    });
    expect(TX.rollback).toHaveBeenCalled();
    expect(err.message).toBe('boom');
  });
});

// ─── getAllProducts deep ────────────────────────────────────────────────────

describe('getAllProducts deep', () => {
  beforeEach(() => repo.findProducts.mockResolvedValue({ count: 0, rows: [] }));

  test('include shape 6 association', async () => {
    await invoke(service.getAllProducts, { query: {} });
    const inc = repo.findProducts.mock.calls[0][0].include;
    expect(inc).toHaveLength(6);
    expect(inc[0]).toEqual({ model: Category, as: 'category' });
    expect(inc[1]).toMatchObject({ as: 'categories', through: { attributes: [] } });
    expect(inc[2]).toMatchObject({ as: 'variants', required: false });
    expect(inc[5]).toMatchObject({
      as: 'productImages',
      attributes: ['imageUrl', 'color', 'isThumbnail'],
      required: false,
    });
  });

  test('sortBy=stockQuantity → Sequelize.literal subquery, ASC', async () => {
    await invoke(service.getAllProducts, { query: { sortBy: 'stockQuantity', sortOrder: 'asc' } });
    const order = repo.findProducts.mock.calls[0][0].order[0];
    expect(order[0].val).toContain('SUM(pv.stock_quantity)');
    expect(order[1]).toBe('ASC');
  });

  test('sortBy=stock → literal subquery', async () => {
    await invoke(service.getAllProducts, { query: { sortBy: 'stock' } });
    expect(repo.findProducts.mock.calls[0][0].order[0][0].val).toContain('product_variants');
  });

  test('category filter → include[1].where + required', async () => {
    await invoke(service.getAllProducts, { query: { category: '7' } });
    const inc = repo.findProducts.mock.calls[0][0].include;
    expect(inc[1].where).toEqual({ id: '7' });
    expect(inc[1].required).toBe(true);
  });

  test('logger lấy + xong', async () => {
    const logger = require('@utils/logger');
    await invoke(service.getAllProducts, { query: {} });
    expect(logger.info).toHaveBeenCalledWith('[ADMIN] Đang lấy danh sách sản phẩm...');
    expect(logger.info).toHaveBeenCalledWith('[ADMIN] Lấy sản phẩm xong:', 0);
  });

  test('transform: không variants → giữ stock gốc, images []', async () => {
    repo.findProducts.mockResolvedValueOnce({
      count: 1,
      rows: [{ toJSON: () => ({ id: 1, basePrice: 5, stockQuantity: 7 }) }],
    });
    const { res } = await invoke(service.getAllProducts, { query: {} });
    expect(res.payload.data.products[0].stockQuantity).toBe(7);
    expect(res.payload.data.products[0].images).toEqual([]);
  });

  test('transform: category đã có trong categories → không push trùng', async () => {
    repo.findProducts.mockResolvedValueOnce({
      count: 1,
      rows: [
        { toJSON: () => ({ id: 1, basePrice: 1, category: { id: 9 }, categories: [{ id: 9 }] }) },
      ],
    });
    const { res } = await invoke(service.getAllProducts, { query: {} });
    expect(res.payload.data.products[0].categories).toEqual([{ id: 9 }]);
  });

  test('findProducts lỗi → rethrow', async () => {
    repo.findProducts.mockRejectedValueOnce(new Error('boom'));
    const { err } = await invoke(service.getAllProducts, { query: {} });
    expect(err.message).toBe('boom');
  });
});

// ─── cloneProduct deep ──────────────────────────────────────────────────────

describe('cloneProduct deep', () => {
  test('variant sku có "-" → suffix phần cuối', async () => {
    const original = {
      name: 'SP',
      get: () => ({ id: 1, name: 'SP', sku: 'OLD' }),
      categories: [],
      productAttributes: [],
      variants: [{ get: () => ({ id: 7, sku: 'OLD-RED' }) }],
      productSpecifications: [],
    };
    repo.findProductById.mockResolvedValueOnce(original);
    repo.findProductOne.mockResolvedValueOnce(null);
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    const vd = repo.bulkCreateProductVariants.mock.calls[0][0][0];
    expect(vd.sku).toMatch(/^SKU-\d+-\d+-RED$/);
    expect(vd.productId).toBe(20);
    expect(vd.id).toBeUndefined();
  });
});
