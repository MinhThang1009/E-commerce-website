/**
 * Mutation-kill batch 5 cho admin-product-service.js — push 90→~95.
 * Killable sâu còn lại: createProduct variant (attributes-guard/variantName/images-not-array/
 * isThumbnail/logs), updateProduct (img object/categoryIds-not-array/attr.split/required/
 * varMap update-vs-create/var-temp-id/isDefault some/off-by-one/minPrice-empty/spec
 * valueEn-sortOrder/translate-filter), clone data exact + transaction, logs.
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
  const fns = {};
  for (const n of [
    'findProductById',
    'findProductOne',
    'findCategories',
    'createProductFull',
    'createProductAttribute',
    'findProductAttributes',
    'createProductVariant',
    'updateProductWhere',
    'bulkCreateProductImages',
    'bulkCreateProductSpecs',
    'bulkCreateProductAttributes',
    'bulkCreateProductVariants',
    'findProducts',
    'findProductVariants',
    'findProductSpecs',
    'destroyProductImages',
    'findProductVariantById',
    'sumProductVariantStock',
    'destroyCartItems',
    'destroyWishlists',
    'destroyProductAttributes',
    'destroyProductVariants',
    'destroyProductCategories',
    'createInventoryLog',
  ])
    fns[n] = jest.fn();
  return {
    getSequelize: () => seq,
    getOp: () => Op,
    getSequelizeFns: () => Sequelize,
    getModels: () => models,
    ...fns,
  };
});

const repo = require('@modules/admin/repositories/sequelize-admin-repository');
const logger = require('@utils/logger');
const helpers = require('@utils/product-helpers');
const service = require('@modules/admin/services/admin-product-service');
const sequelize = repo.getSequelize();
const { ProductSpecification } = repo.getModels();
const TX = { commit: jest.fn(), rollback: jest.fn() };

function invoke(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: undefined,
      payload: undefined,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(b) {
        this.payload = b;
        resolve({ res: this });
        return this;
      },
    };
    handler(req, res, (err) => resolve({ err }));
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
});

// ─── createProduct variant deep ─────────────────────────────────────────────

describe('createProduct b5', () => {
  function prod() {
    return { id: 10, setCategories: jest.fn(), update: jest.fn() };
  }
  beforeEach(() => {
    repo.findProductOne.mockResolvedValue(null);
    repo.findProductById.mockResolvedValue({ status: 'draft', toJSON: () => ({ id: 10 }) });
  });

  test('variant.attributes không phải object (mảng) → variantAttributes = {}', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [{ name: 'V', price: '1', stock: '1', attributes: ['x'] }] },
    });
    expect(repo.createProductVariant.mock.calls[0][0].attributes).toEqual({});
  });

  test('variant.attributes string → {}', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [{ name: 'V', price: '1', stock: '1', attributes: 'str' }] },
    });
    expect(repo.createProductVariant.mock.calls[0][0].attributes).toEqual({});
  });

  test('variantName fallback variant.variantName khi không name', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [{ variantName: 'VN', price: '1', stock: '1' }] },
    });
    expect(repo.createProductVariant.mock.calls[0][0].variantName).toBe('VN');
  });

  test('images không phải array → bulkCreateProductImages KHÔNG gọi', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, { body: { name: 'P', images: 'notarray' } });
    expect(repo.bulkCreateProductImages).not.toHaveBeenCalled();
  });

  test('specifications không phải array → bulkCreateProductSpecs KHÔNG gọi', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, { body: { name: 'P', specifications: { a: 1 } } });
    expect(repo.bulkCreateProductSpecs).not.toHaveBeenCalled();
  });

  test('image object isThumbnail=true tại index>0 → true (kill || index===0)', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', images: ['a.jpg', { url: 'b.jpg', isThumbnail: true }] },
    });
    expect(repo.bulkCreateProductImages.mock.calls[0][0][1].isThumbnail).toBe(true);
  });

  test('log variant + spec khi có', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    helpers.generateVariantSku.mockReturnValue('VS');
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [{ name: 'V', price: '1', stock: '1' }] },
    });
    expect(logger.info).toHaveBeenCalledWith('Đang xử lý variants:', expect.any(Array));
    expect(logger.info).toHaveBeenCalledWith('Tạo variant với SKU: VS');
  });
});

// ─── updateProduct deep ─────────────────────────────────────────────────────

describe('updateProduct b5', () => {
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
  function final(status = 'draft') {
    repo.findProductById.mockResolvedValueOnce({ id: 5, status, toJSON: () => ({ id: 5 }) });
  }

  test('categoryIds không phải array → findCategories KHÔNG gọi', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    await invoke(service.updateProduct, { params: { id: '5' }, body: { categoryIds: 'x' } });
    expect(repo.findCategories).not.toHaveBeenCalled();
  });

  test('attr.required defined → dùng giá trị truyền (kill ternary)', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    const existAttr = { name: 'A', update: jest.fn(), type: 'custom', required: false };
    repo.findProductAttributes.mockResolvedValueOnce([existAttr]);
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { attributes: [{ name: 'A', value: 'x', required: true }] },
    });
    expect(existAttr.update.mock.calls[0][0].required).toBe(true);
  });

  test('variant id thật → UPDATE (currentVarMap), không create', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    const existVar = { id: 7, update: jest.fn().mockResolvedValue({ id: 7, price: 1 }) };
    repo.findProductVariants.mockResolvedValueOnce([existVar]);
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { variants: [{ id: 7, price: '1', stock: '1' }] },
    });
    expect(existVar.update).toHaveBeenCalled();
    expect(repo.createProductVariant).not.toHaveBeenCalled();
  });

  test('variant id tạm "var-9" → tạo mới (id=undefined), không update', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    repo.createProductVariant.mockResolvedValueOnce({ id: 9, price: 1 });
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { variants: [{ id: 'var-9', price: '1', stock: '1' }] },
    });
    expect(repo.createProductVariant).toHaveBeenCalled();
    expect(repo.createProductVariant.mock.calls[0][0].id).toBeUndefined();
  });

  test('isDefault: 2 variant không cờ → variant đầu isDefault=true (kill some/every)', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    repo.createProductVariant
      .mockResolvedValueOnce({ id: 9, price: 1 })
      .mockResolvedValueOnce({ id: 10, price: 2 });
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: {
        variants: [
          { price: '1', stock: '1' },
          { price: '2', stock: '1' },
        ],
      },
    });
    expect(repo.createProductVariant.mock.calls[0][0].isDefault).toBe(true);
    expect(repo.createProductVariant.mock.calls[1][0].isDefault).toBe(false);
  });

  test('isDefault: có variant cờ isDefault → variant đầu KHÔNG auto-default', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    repo.createProductVariant
      .mockResolvedValueOnce({ id: 9, price: 1 })
      .mockResolvedValueOnce({ id: 10, price: 2 });
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: {
        variants: [
          { price: '1', stock: '1' },
          { price: '2', stock: '1', isDefault: true },
        ],
      },
    });
    expect(repo.createProductVariant.mock.calls[0][0].isDefault).toBe(false);
  });

  test('variants rỗng → updateProductWhere KHÔNG có basePrice (minVariantPrice null)', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    helpers.calculateTotalStock.mockReturnValue(0);
    await invoke(service.updateProduct, { params: { id: '5' }, body: { variants: [] } });
    const arg = repo.updateProductWhere.mock.calls[0][0];
    expect(arg).toEqual({ stockQuantity: 0 });
    expect(arg.basePrice).toBeUndefined();
  });

  test('spec valueEn null mặc định + sortOrder index', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    repo.findProductSpecs.mockResolvedValueOnce([]);
    ProductSpecification.create.mockResolvedValueOnce({
      value: 'v',
      valueEn: null,
      update: jest.fn(),
    });
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { specifications: [{ name: 'CPU', value: 'v' }] },
    });
    expect(ProductSpecification.create.mock.calls[0][0]).toMatchObject({
      valueEn: null,
      category: 'General',
      sortOrder: 0,
    });
    await new Promise((r) => setImmediate(r)); // drain setImmediate translate (tránh rò sang test sau)
  });

  test('spec đã có valueEn → KHÔNG translate (specsNeedTranslation lọc)', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    repo.findProductSpecs.mockResolvedValueOnce([]);
    ProductSpecification.create.mockResolvedValueOnce({
      value: 'v',
      valueEn: 'EN',
      update: jest.fn(),
    });
    const { translateBatch } = require('@modules/ai/services/translate/translate-service');
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { specifications: [{ name: 'CPU', value: 'v', valueEn: 'EN' }] },
    });
    await new Promise((r) => setImmediate(r));
    expect(translateBatch).not.toHaveBeenCalled();
  });

  test('variant có images → off-by-one loop chạy đúng 1 lần (kill i<=length)', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    repo.createProductVariant.mockResolvedValueOnce({ id: 9, price: 1 });
    const { err } = await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { variants: [{ price: '1', stock: '1', images: ['v.jpg'] }] },
    });
    // i<=length sẽ lặp thừa → variants[length] undefined → crash; i<length ok
    expect(err).toBeUndefined();
    expect(repo.bulkCreateProductImages).toHaveBeenCalledTimes(1);
  });
});

// ─── cloneProduct data exact ────────────────────────────────────────────────

describe('cloneProduct b5', () => {
  function original(over = {}) {
    return {
      name: 'SP',
      get: () => ({ id: 1, name: 'SP', sku: 'OLD' }),
      categories: [{ id: 3 }],
      productAttributes: [{ get: () => ({ id: 5, name: 'Màu', createdAt: 'a', updatedAt: 'b' }) }],
      variants: [{ get: () => ({ id: 7, sku: 'OLD-RED' }) }],
      productSpecifications: [
        { get: () => ({ id: 9, name: 'CPU', createdAt: 'a', updatedAt: 'b' }) },
      ],
      ...over,
    };
  }

  test('createProductFull có {transaction}', async () => {
    repo.findProductById.mockResolvedValueOnce(original());
    repo.findProductOne.mockResolvedValueOnce(null);
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    expect(repo.createProductFull.mock.calls[0][1]).toEqual({ transaction: TX });
  });

  test('bulkCreate categories/attributes/variants/specs có {transaction}', async () => {
    repo.findProductById.mockResolvedValueOnce(original());
    repo.findProductOne.mockResolvedValueOnce(null);
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    const { ProductCategory } = repo.getModels();
    expect(ProductCategory.bulkCreate.mock.calls[0][1]).toEqual({ transaction: TX });
    expect(repo.bulkCreateProductAttributes.mock.calls[0][1]).toEqual({ transaction: TX });
    expect(repo.bulkCreateProductVariants.mock.calls[0][1]).toEqual({ transaction: TX });
    expect(repo.bulkCreateProductSpecs.mock.calls[0][1]).toEqual({ transaction: TX });
  });

  test('spec clone: xoá id/createdAt/updatedAt + productId mới', async () => {
    repo.findProductById.mockResolvedValueOnce(original());
    repo.findProductOne.mockResolvedValueOnce(null);
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    expect(repo.bulkCreateProductSpecs).toHaveBeenCalledWith([{ name: 'CPU', productId: 20 }], {
      transaction: TX,
    });
  });
});

// ─── restockProduct logs ────────────────────────────────────────────────────

describe('restockProduct b5', () => {
  test('vector sync lỗi → logger.error', async () => {
    const p = { stockQuantity: 1, status: 'draft', update: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(p);
    repo.createInventoryLog.mockResolvedValueOnce({ id: 1 });
    repo.findProductById.mockRejectedValueOnce(new Error('index fail')); // lần 2 (index) lỗi
    await invoke(service.restockProduct, {
      params: { productId: '5' },
      body: { quantity: '3' },
      user: { id: 1 },
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi đồng bộ vector store sau khi nhập hàng:',
      'index fail',
    );
  });
});
