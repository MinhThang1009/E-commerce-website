/**
 * Mutation-kill tests cho admin-product-service.js (baseline 56.37%, 1203 dòng).
 *
 * 11 hàm CRUD sản phẩm. Mock repository + product-helpers + vector store +
 * translate + sequelize.transaction để assert OUTCOME thật: arg create/update
 * (atomicity: transaction sentinel), nhánh hasOwnProperty, transform, validation,
 * inventory log, clone. Gọi service trực tiếp (catchAsync) với mock req/res/next.
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
  // Singleton — getModels/getSequelize PHẢI trả cùng reference mỗi lần gọi
  // (service capture lúc load, test phải chạm đúng object đó).
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
  const seq = {
    transaction: jest.fn(),
    query: jest.fn(),
    QueryTypes: { UPDATE: 'UPDATE' },
  };
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
const { Category, ProductVariant, ProductImage, ProductSpecification, ProductCategory } =
  repo.getModels();

const TX = { commit: jest.fn(), rollback: jest.fn() };

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

const flushAsync = () => new Promise((r) => setImmediate(r));

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
});

// ─── getProductById ─────────────────────────────────────────────────────────

describe('getProductById', () => {
  test('không tìm thấy → 404', async () => {
    repo.findProductById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.getProductById, { params: { id: '5' } });
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Không tìm thấy sản phẩm');
  });

  test('include shape đầy đủ (5 association)', async () => {
    repo.findProductById.mockResolvedValueOnce({ toJSON: () => ({ id: 5 }) });
    await invoke(service.getProductById, { params: { id: '5' } });
    const opts = repo.findProductById.mock.calls[0][1];
    expect(opts.include).toEqual([
      { model: Category, as: 'categories', through: { attributes: [] } },
      { model: repo.getModels().ProductAttribute, as: 'productAttributes' },
      { model: ProductVariant, as: 'variants' },
      { model: ProductSpecification, as: 'productSpecifications' },
      { model: ProductImage, as: 'productImages', required: false },
    ]);
  });

  test('variants: deepParseJSON cho attributes (parse chuỗi JSON nhiều lần)', async () => {
    repo.findProductById.mockResolvedValueOnce({
      toJSON: () => ({
        id: 5,
        variants: [{ id: 1, attributes: '{"color":"red"}' }],
      }),
    });
    const { res } = await invoke(service.getProductById, { params: { id: '5' } });
    expect(res.payload.data.product.variants[0].attributes).toEqual({ color: 'red' });
  });

  test('variants: attributes không parse được → {}', async () => {
    repo.findProductById.mockResolvedValueOnce({
      toJSON: () => ({ id: 5, variants: [{ id: 1, attributes: 'not json' }] }),
    });
    const { res } = await invoke(service.getProductById, { params: { id: '5' } });
    expect(res.payload.data.product.variants[0].attributes).toEqual({});
  });

  test('attributes.values: không phải mảng → []', async () => {
    repo.findProductById.mockResolvedValueOnce({
      toJSON: () => ({ id: 5, attributes: [{ name: 'X', values: 'bad' }] }),
    });
    const { res } = await invoke(service.getProductById, { params: { id: '5' } });
    expect(res.payload.data.product.attributes[0].values).toEqual([]);
  });

  test('thành công → 200 status success', async () => {
    repo.findProductById.mockResolvedValueOnce({ toJSON: () => ({ id: 5 }) });
    const { res } = await invoke(service.getProductById, { params: { id: '5' } });
    expect(res.statusCode).toBe(200);
    expect(res.payload.status).toBe('success');
  });
});

// ─── createProduct ──────────────────────────────────────────────────────────

describe('createProduct', () => {
  const baseProduct = { id: 10, setCategories: jest.fn(), update: jest.fn() };

  beforeEach(() => {
    repo.findProductOne.mockResolvedValue(null);
    repo.createProductFull.mockResolvedValue({ ...baseProduct });
    repo.findProductById.mockResolvedValue({ status: 'inactive', toJSON: () => ({ id: 10 }) });
  });

  test('trùng tên → 409', async () => {
    repo.findProductOne.mockResolvedValueOnce({ id: 1 });
    const { err } = await invoke(service.createProduct, { body: { name: 'Dup' } });
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe('Đã tồn tại sản phẩm với tên này');
  });

  test('categoryIds nhưng không tồn tại → 400', async () => {
    repo.findCategories.mockResolvedValueOnce([]);
    const { err } = await invoke(service.createProduct, {
      body: { name: 'P', categoryIds: [99] },
    });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Danh mục không tồn tại');
  });

  test('createProductFull nhận data đúng (price từ basePrice, fallback seoTitle=name)', async () => {
    const prod = { id: 10, setCategories: jest.fn(), update: jest.fn() };
    repo.createProductFull.mockResolvedValueOnce(prod);
    await invoke(service.createProduct, {
      body: { name: 'P1', basePrice: 500, stock: 7 },
    });
    expect(repo.createProductFull).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'P1',
        baseName: 'P1',
        basePrice: 500,
        stockQuantity: 7,
        status: 'active',
        seoTitle: 'P1',
      }),
    );
  });

  test('price fallback sang priceField khi không có basePrice', async () => {
    const prod = { id: 10, setCategories: jest.fn(), update: jest.fn() };
    repo.createProductFull.mockResolvedValueOnce(prod);
    await invoke(service.createProduct, { body: { name: 'P', price: 300 } });
    expect(repo.createProductFull.mock.calls[0][0].basePrice).toBe(300);
  });

  test('comparePrice → raw SQL UPDATE', async () => {
    const prod = { id: 10, setCategories: jest.fn(), update: jest.fn() };
    repo.createProductFull.mockResolvedValueOnce(prod);
    await invoke(service.createProduct, { body: { name: 'P', comparePrice: 999 } });
    expect(sequelize.query).toHaveBeenCalledWith(
      'UPDATE products SET compare_at_price = :comparePrice WHERE id = :id',
      expect.objectContaining({ replacements: { comparePrice: 999, id: 10 } }),
    );
  });

  test('categories chọn được → setCategories + update categoryId phần tử đầu', async () => {
    const prod = { id: 10, setCategories: jest.fn(), update: jest.fn() };
    repo.createProductFull.mockResolvedValueOnce(prod);
    repo.findCategories.mockResolvedValueOnce([{ id: 3 }, { id: 4 }]);
    await invoke(service.createProduct, { body: { name: 'P', categoryIds: [3, 4] } });
    expect(prod.setCategories).toHaveBeenCalledWith([{ id: 3 }, { id: 4 }]);
    expect(prod.update).toHaveBeenCalledWith({ categoryId: 3 });
  });

  test('attributes: value chuỗi "a,b" → split/trim/filter; values rỗng → ["Default"]', async () => {
    const prod = { id: 10, setCategories: jest.fn(), update: jest.fn() };
    repo.createProductFull.mockResolvedValueOnce(prod);
    await invoke(service.createProduct, {
      body: {
        name: 'P',
        attributes: [
          { name: 'Màu', value: 'đỏ, xanh ,' },
          { name: 'Size', value: '' },
        ],
      },
    });
    expect(repo.createProductAttribute).toHaveBeenCalledWith({
      productId: 10,
      name: 'Màu',
      values: ['đỏ', 'xanh'],
    });
    expect(repo.createProductAttribute).toHaveBeenCalledWith({
      productId: 10,
      name: 'Size',
      values: ['Default'],
    });
  });

  test('variants: generateVariantSku + parseFloat/parseInt + isDefault default false', async () => {
    const prod = { id: 10, setCategories: jest.fn(), update: jest.fn() };
    repo.createProductFull.mockResolvedValueOnce(prod);
    helpers.generateVariantSku.mockReturnValue('AUTO-SKU');
    await invoke(service.createProduct, {
      body: {
        name: 'P',
        variants: [{ name: 'V1', price: '15.5', stock: '3', attributes: { color: 'red' } }],
      },
    });
    expect(repo.createProductVariant).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 10,
        sku: 'AUTO-SKU',
        price: 15.5,
        stockQuantity: 3,
        isDefault: false,
        isAvailable: true,
        attributes: { color: 'red' },
      }),
    );
  });

  test('images: string → isThumbnail index 0; object → giữ url/color', async () => {
    const prod = { id: 10, setCategories: jest.fn(), update: jest.fn() };
    repo.createProductFull.mockResolvedValueOnce(prod);
    await invoke(service.createProduct, {
      body: { name: 'P', images: ['a.jpg', { url: 'b.jpg', color: 'red' }] },
    });
    expect(repo.bulkCreateProductImages).toHaveBeenCalledWith([
      { productId: 10, imageUrl: 'a.jpg', isThumbnail: true, color: null, variantId: null },
      { productId: 10, imageUrl: 'b.jpg', isThumbnail: false, color: 'red', variantId: null },
    ]);
  });

  test('vector sync khi status active', async () => {
    const prod = { id: 10, setCategories: jest.fn(), update: jest.fn() };
    repo.createProductFull.mockResolvedValueOnce(prod);
    repo.findProductById.mockResolvedValueOnce({ status: 'active', toJSON: () => ({ id: 10 }) });
    await invoke(service.createProduct, { body: { name: 'P' } });
    expect(vectorStore.upsertProduct).toHaveBeenCalled();
  });

  test('KHÔNG sync khi status không active; vẫn trả 201', async () => {
    const prod = { id: 10, setCategories: jest.fn(), update: jest.fn() };
    repo.createProductFull.mockResolvedValueOnce(prod);
    repo.findProductById.mockResolvedValueOnce({ status: 'draft', toJSON: () => ({ id: 10 }) });
    const { res } = await invoke(service.createProduct, { body: { name: 'P' } });
    expect(vectorStore.upsertProduct).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.payload.status).toBe('success');
  });
});

// ─── deleteProduct ──────────────────────────────────────────────────────────

describe('deleteProduct', () => {
  test('không tìm thấy → 404', async () => {
    repo.findProductById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.deleteProduct, { params: { id: '5' } });
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Không tìm thấy sản phẩm');
  });

  test('xoá: destroy các quan hệ + product + commit, 200 message', async () => {
    const prod = { destroy: jest.fn().mockResolvedValue() };
    repo.findProductById.mockResolvedValueOnce(prod);
    const { res } = await invoke(service.deleteProduct, { params: { id: '5' } });
    expect(repo.destroyCartItems).toHaveBeenCalledWith({ productId: '5' }, { transaction: TX });
    expect(repo.destroyWishlists).toHaveBeenCalledWith({ productId: '5' }, { transaction: TX });
    expect(prod.destroy).toHaveBeenCalledWith({ transaction: TX });
    expect(TX.commit).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ status: 'success', message: 'Xóa sản phẩm thành công' });
  });

  test('lỗi giữa chừng → rollback + throw', async () => {
    const prod = { destroy: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(prod);
    repo.destroyCartItems.mockRejectedValueOnce(new Error('db'));
    const { err } = await invoke(service.deleteProduct, { params: { id: '5' } });
    expect(TX.rollback).toHaveBeenCalled();
    expect(err.message).toBe('db');
  });
});

// ─── updateProductStock ─────────────────────────────────────────────────────

describe('updateProductStock', () => {
  test('qty âm/không hợp lệ → 400', async () => {
    const { err } = await invoke(service.updateProductStock, {
      params: { id: '5' },
      body: { stockQuantity: '-1' },
    });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Số lượng tồn kho phải là số nguyên không âm');
  });

  test('không tìm thấy product → 404', async () => {
    repo.findProductById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.updateProductStock, {
      params: { id: '5' },
      body: { stockQuantity: '10' },
    });
    expect(err.statusCode).toBe(404);
  });

  test('không variantId → update product stock', async () => {
    const prod = { id: 5, update: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(prod);
    const { res } = await invoke(service.updateProductStock, {
      params: { id: '5' },
      body: { stockQuantity: '12' },
    });
    expect(prod.update).toHaveBeenCalledWith({ stockQuantity: 12 });
    expect(res.payload.data).toEqual({ id: 5, stockQuantity: 12 });
  });

  test('có variantId → update variant + tổng lại product', async () => {
    const prod = { id: 5, update: jest.fn() };
    const variant = { update: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(prod);
    repo.findProductVariantById.mockResolvedValueOnce(variant);
    repo.sumProductVariantStock.mockResolvedValueOnce(20);
    await invoke(service.updateProductStock, {
      params: { id: '5' },
      body: { stockQuantity: '8', variantId: '3' },
    });
    expect(variant.update).toHaveBeenCalledWith({ stockQuantity: 8 });
    expect(prod.update).toHaveBeenCalledWith({ stockQuantity: 20 });
  });

  test('variantId không tồn tại → 404 biến thể', async () => {
    repo.findProductById.mockResolvedValueOnce({ id: 5, update: jest.fn() });
    repo.findProductVariantById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.updateProductStock, {
      params: { id: '5' },
      body: { stockQuantity: '8', variantId: '3' },
    });
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Không tìm thấy biến thể');
  });
});

// ─── toggleProductStatus ────────────────────────────────────────────────────

describe('toggleProductStatus', () => {
  test('không tìm thấy → 404', async () => {
    repo.findProductById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.toggleProductStatus, { params: { id: '5' }, body: {} });
    expect(err.statusCode).toBe(404);
  });

  test('status không hợp lệ → 400', async () => {
    repo.findProductById.mockResolvedValueOnce({ status: 'active', update: jest.fn() });
    const { err } = await invoke(service.toggleProductStatus, {
      params: { id: '5' },
      body: { status: 'weird' },
    });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Trạng thái không hợp lệ');
  });

  test('không truyền status → toggle active→inactive', async () => {
    const prod = { status: 'active', update: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(prod);
    await invoke(service.toggleProductStatus, { params: { id: '5' }, body: {} });
    expect(prod.update).toHaveBeenCalledWith({ status: 'inactive' });
  });

  test('không truyền status + đang inactive → active', async () => {
    const prod = { status: 'inactive', update: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(prod);
    await invoke(service.toggleProductStatus, { params: { id: '5' }, body: {} });
    expect(prod.update).toHaveBeenCalledWith({ status: 'active' });
  });

  test('truyền status hợp lệ → dùng status đó', async () => {
    const prod = { status: 'active', update: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(prod);
    await invoke(service.toggleProductStatus, { params: { id: '5' }, body: { status: 'draft' } });
    expect(prod.update).toHaveBeenCalledWith({ status: 'draft' });
  });
});

// ─── cloneProduct ───────────────────────────────────────────────────────────

describe('cloneProduct', () => {
  test('không tìm thấy gốc → 404', async () => {
    repo.findProductById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.cloneProduct, { params: { id: '5' } });
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Không tìm thấy sản phẩm gốc');
  });

  test('tên unique tăng dần (1) khi chưa tồn tại; status draft', async () => {
    const original = {
      name: 'SP',
      get: () => ({ id: 1, name: 'SP', sku: 'OLD' }),
      categories: [],
      productAttributes: [],
      variants: [],
      productSpecifications: [],
    };
    repo.findProductById.mockResolvedValueOnce(original);
    repo.findProductOne.mockResolvedValueOnce(null); // 'SP (1)' chưa tồn tại
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    const data = repo.createProductFull.mock.calls[0][0];
    expect(data.name).toBe('SP (1)');
    expect(data.status).toBe('draft');
    expect(data.id).toBeUndefined();
  });

  test('tên tăng (2) khi (1) đã tồn tại', async () => {
    const original = {
      name: 'SP',
      get: () => ({ id: 1, name: 'SP', sku: 'OLD' }),
      categories: [],
      productAttributes: [],
      variants: [],
      productSpecifications: [],
    };
    repo.findProductById.mockResolvedValueOnce(original);
    repo.findProductOne
      .mockResolvedValueOnce({ id: 9 }) // 'SP (1)' tồn tại
      .mockResolvedValueOnce(null); // 'SP (2)' chưa
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    expect(repo.createProductFull.mock.calls[0][0].name).toBe('SP (2)');
  });

  test('clone categories/attributes/variants/specs + commit + 201', async () => {
    const original = {
      name: 'SP',
      get: () => ({ id: 1, name: 'SP', sku: 'OLD' }),
      categories: [{ id: 3 }],
      productAttributes: [{ get: () => ({ id: 5, name: 'Màu' }) }],
      variants: [{ get: () => ({ id: 7, sku: 'OLD-RED' }) }],
      productSpecifications: [{ get: () => ({ id: 9, name: 'CPU' }) }],
    };
    repo.findProductById.mockResolvedValueOnce(original);
    repo.findProductOne.mockResolvedValueOnce(null);
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    const { res } = await invoke(service.cloneProduct, { params: { id: '5' } });
    expect(ProductCategory.bulkCreate).toHaveBeenCalledWith([{ productId: 20, categoryId: 3 }], {
      transaction: TX,
    });
    expect(repo.bulkCreateProductAttributes).toHaveBeenCalled();
    expect(repo.bulkCreateProductVariants).toHaveBeenCalled();
    expect(repo.bulkCreateProductSpecs).toHaveBeenCalled();
    expect(TX.commit).toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });
});

// ─── getAllProducts ─────────────────────────────────────────────────────────

describe('getAllProducts', () => {
  beforeEach(() => {
    repo.findProducts.mockResolvedValue({ count: 0, rows: [] });
  });

  test('query rỗng → where {}, order [createdAt DESC], distinct true', async () => {
    await invoke(service.getAllProducts, { query: {} });
    const args = repo.findProducts.mock.calls[0][0];
    expect(args.where).toEqual({});
    expect(args.distinct).toBe(true);
    expect(args.order).toEqual([['createdAt', 'DESC']]);
  });

  test('search → Op.or 3 field; status → where.status', async () => {
    await invoke(service.getAllProducts, { query: { search: 'abc', status: 'active' } });
    const args = repo.findProducts.mock.calls[0][0];
    expect(args.where[Op.or]).toEqual([
      { nameVi: { [Op.like]: '%abc%' } },
      { nameEn: { [Op.like]: '%abc%' } },
      { shortDescriptionVi: { [Op.like]: '%abc%' } },
    ]);
    expect(args.where.status).toBe('active');
  });

  test('priceMin/priceMax → basePrice gte/lte; stockMin/Max → stockQuantity', async () => {
    await invoke(service.getAllProducts, {
      query: { priceMin: '100', priceMax: '500', stockMin: '1', stockMax: '9' },
    });
    const where = repo.findProducts.mock.calls[0][0].where;
    expect(where.basePrice).toEqual({ [Op.gte]: 100, [Op.lte]: 500 });
    expect(where.stockQuantity).toEqual({ [Op.gte]: 1, [Op.lte]: 9 });
  });

  test('sortBy=price → basePrice; sortBy=name → nameVi', async () => {
    await invoke(service.getAllProducts, { query: { sortBy: 'price', sortOrder: 'asc' } });
    expect(repo.findProducts.mock.calls[0][0].order).toEqual([['basePrice', 'ASC']]);
    jest.clearAllMocks();
    repo.findProducts.mockResolvedValue({ count: 0, rows: [] });
    await invoke(service.getAllProducts, { query: { sortBy: 'name' } });
    expect(repo.findProducts.mock.calls[0][0].order).toEqual([['nameVi', 'DESC']]);
  });

  test('category filter → include[1].where + required true', async () => {
    await invoke(service.getAllProducts, { query: { category: '7' } });
    const include = repo.findProducts.mock.calls[0][0].include;
    expect(include[1].where).toEqual({ id: '7' });
    expect(include[1].required).toBe(true);
  });

  test('transform: images/price + stock từ variants + pagination', async () => {
    repo.findProducts.mockResolvedValueOnce({
      count: 30,
      rows: [
        {
          toJSON: () => ({
            id: 1,
            basePrice: 200,
            productImages: [{ imageUrl: 'a.jpg' }],
            variants: [{ stockQuantity: 2 }, { stockQuantity: 3 }],
          }),
        },
      ],
    });
    const { res } = await invoke(service.getAllProducts, { query: { page: '2', limit: '10' } });
    const p = res.payload.data.products[0];
    expect(p.images).toEqual(['a.jpg']);
    expect(p.price).toBe(200);
    expect(p.stockQuantity).toBe(5); // tổng variants
    expect(res.payload.data.pagination).toEqual({
      currentPage: 2,
      totalPages: 3,
      totalItems: 30,
      itemsPerPage: 10,
    });
  });

  test('transform: category đẩy vào categories nếu chưa có', async () => {
    repo.findProducts.mockResolvedValueOnce({
      count: 1,
      rows: [{ toJSON: () => ({ id: 1, basePrice: 1, category: { id: 9 }, categories: [] }) }],
    });
    const { res } = await invoke(service.getAllProducts, { query: {} });
    expect(res.payload.data.products[0].categories).toEqual([{ id: 9 }]);
  });

  test('findProducts lỗi → logger + rethrow', async () => {
    repo.findProducts.mockRejectedValueOnce(new Error('boom'));
    const { err } = await invoke(service.getAllProducts, { query: {} });
    expect(err.message).toBe('boom');
  });
});

// ─── updateProduct ──────────────────────────────────────────────────────────

describe('updateProduct', () => {
  function makeProduct(over = {}) {
    return {
      id: 5,
      name: 'Old',
      basePrice: 100,
      update: jest.fn().mockResolvedValue(undefined),
      setCategories: jest.fn().mockResolvedValue(undefined),
      ...over,
    };
  }

  test('không tìm thấy → rollback + 404', async () => {
    repo.findProductById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { name: 'X' },
    });
    expect(TX.rollback).toHaveBeenCalled();
    expect(err.statusCode).toBe(404);
  });

  test('updateData chỉ chứa field hasOwnProperty; parseFloat price', async () => {
    const prod = makeProduct();
    repo.findProductById.mockResolvedValueOnce(prod);
    repo.findProductById.mockResolvedValueOnce({ status: 'draft', toJSON: () => ({ id: 5 }) });
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { name: 'New', price: '250.5' },
    });
    expect(prod.update).toHaveBeenCalledWith(
      { name: 'New', basePrice: 250.5 },
      { transaction: TX },
    );
  });

  test('comparePrice rỗng "" → null trong raw SQL', async () => {
    const prod = makeProduct();
    repo.findProductById.mockResolvedValueOnce(prod);
    repo.findProductById.mockResolvedValueOnce({ status: 'draft', toJSON: () => ({ id: 5 }) });
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { comparePrice: '' },
    });
    expect(sequelize.query).toHaveBeenCalledWith(
      'UPDATE products SET compare_at_price = :compareAtPrice WHERE id = :id',
      expect.objectContaining({ replacements: { compareAtPrice: null, id: '5' } }),
    );
  });

  test('categoryIds → setCategories + update categoryId đầu (null nếu rỗng)', async () => {
    const prod = makeProduct();
    repo.findProductById.mockResolvedValueOnce(prod);
    repo.findProductById.mockResolvedValueOnce({ status: 'draft', toJSON: () => ({ id: 5 }) });
    repo.findCategories.mockResolvedValueOnce([{ id: 8 }]);
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { categoryIds: [8] },
    });
    expect(prod.setCategories).toHaveBeenCalledWith([{ id: 8 }], { transaction: TX });
    expect(prod.update).toHaveBeenCalledWith({ categoryId: 8 }, { transaction: TX });
  });

  test('commit + vector sync khi active; 200', async () => {
    const prod = makeProduct();
    repo.findProductById.mockResolvedValueOnce(prod);
    repo.findProductById.mockResolvedValueOnce({ status: 'active', toJSON: () => ({ id: 5 }) });
    const { res } = await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { name: 'X' },
    });
    expect(TX.commit).toHaveBeenCalled();
    expect(vectorStore.upsertProduct).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  test('không active → loại khỏi vector items', async () => {
    const prod = makeProduct();
    repo.findProductById.mockResolvedValueOnce(prod);
    repo.findProductById.mockResolvedValueOnce({
      id: 5,
      status: 'draft',
      toJSON: () => ({ id: 5 }),
    });
    vectorStore.items = [{ metadata: { id: 5 } }, { metadata: { id: 6 } }];
    await invoke(service.updateProduct, { params: { id: '5' }, body: { name: 'X' } });
    expect(vectorStore.items).toEqual([{ metadata: { id: 6 } }]);
  });

  test('specs cần dịch → setImmediate translateBatch', async () => {
    const prod = makeProduct();
    repo.findProductById.mockResolvedValueOnce(prod);
    repo.findProductById.mockResolvedValueOnce({ status: 'draft', toJSON: () => ({ id: 5 }) });
    repo.findProductSpecs.mockResolvedValueOnce([]);
    ProductSpecification.create.mockResolvedValueOnce({
      value: 'Tiếng Việt',
      valueEn: null,
      update: jest.fn(),
    });
    const { translateBatch } = require('@modules/ai/services/translate/translate-service');
    translateBatch.mockResolvedValueOnce(['English']);
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { specifications: [{ name: 'CPU', value: 'Tiếng Việt' }] },
    });
    await flushAsync();
    expect(translateBatch).toHaveBeenCalledWith(['Tiếng Việt']);
  });
});
