/**
 * Mutation-kill batch 3 cho admin-product-service.js — high-value còn sót sau
 * batch 1+2: include-shape (findProductById options), data-construction exact args
 * (clone/variant/attribute/spec/image), getAllProducts include[3]/[4], messages.
 * KHÔNG chase log-plumbing + guard-on-empty equivalent (xem commit message).
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

const repo = require('@modules/admin/repositories/sequelize-admin-repository');
const helpers = require('@utils/product-helpers');
const service = require('@modules/admin/services/admin-product-service');

const sequelize = repo.getSequelize();
const models = repo.getModels();
const { Category, ProductVariant, ProductImage, ProductSpecification, ProductAttribute } = models;
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

const INCLUDE_5 = [
  { model: Category, as: 'categories', through: { attributes: [] } },
  { model: ProductAttribute, as: 'productAttributes' },
  { model: ProductVariant, as: 'variants' },
  {
    model: ProductImage,
    as: 'productImages',
    attributes: ['imageUrl', 'isThumbnail'],
    required: false,
  },
  { model: ProductSpecification, as: 'productSpecifications' },
];

// ─── createProduct: findProductAttributes + final include + image data ──────

describe('createProduct — include + arg phụ', () => {
  function prod() {
    return { id: 10, setCategories: jest.fn(), update: jest.fn() };
  }
  beforeEach(() => {
    repo.findProductOne.mockResolvedValue(null);
    repo.findProductById.mockResolvedValue({ status: 'draft', toJSON: () => ({ id: 10 }) });
  });

  test('có variants → findProductAttributes({productId})', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [{ name: 'V', price: '1', stock: '1' }] },
    });
    expect(repo.findProductAttributes).toHaveBeenCalledWith({ productId: 10 });
  });

  test('final findProductById có include shape đầy đủ', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, { body: { name: 'P' } });
    const lastCall = repo.findProductById.mock.calls.at(-1);
    expect(lastCall[1].include).toEqual(INCLUDE_5);
  });

  test('image object: url||imageUrl + isThumbnail||index0', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: {
        name: 'P',
        images: [{ imageUrl: 'x.jpg', isThumbnail: true }, { url: 'y.jpg' }],
      },
    });
    expect(repo.bulkCreateProductImages).toHaveBeenCalledWith([
      { productId: 10, imageUrl: 'x.jpg', isThumbnail: true, color: null, variantId: null },
      { productId: 10, imageUrl: 'y.jpg', isThumbnail: false, color: null, variantId: null },
    ]);
  });
});

// ─── updateProduct: include + variant/attr data exact ───────────────────────

describe('updateProduct — include + data exact', () => {
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

  test('findProductById đầu tiên có {transaction}', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    repo.findProductById.mockResolvedValueOnce({ status: 'draft', toJSON: () => ({ id: 5 }) });
    await invoke(service.updateProduct, { params: { id: '5' }, body: { name: 'X' } });
    expect(repo.findProductById).toHaveBeenNthCalledWith(1, '5', { transaction: TX });
  });

  test('final findProductById include shape', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    repo.findProductById.mockResolvedValueOnce({ status: 'draft', toJSON: () => ({ id: 5 }) });
    await invoke(service.updateProduct, { params: { id: '5' }, body: { name: 'X' } });
    expect(repo.findProductById.mock.calls.at(-1)[1].include).toEqual(INCLUDE_5);
  });

  test('variant mới: createProductVariant data đầy đủ', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    repo.findProductById.mockResolvedValueOnce({ status: 'draft', toJSON: () => ({ id: 5 }) });
    repo.createProductVariant.mockResolvedValueOnce({ id: 9, price: 30 });
    helpers.generateVariantSku.mockReturnValue('VS');
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { sku: 'P', variants: [{ price: '30', stock: '6', attributes: { c: 'Đỏ' } }] },
    });
    expect(repo.createProductVariant).toHaveBeenCalledWith(
      {
        variantName: 'Đỏ',
        sku: 'VS',
        attributes: { c: 'Đỏ' },
        attributeValues: { c: 'Đỏ' },
        price: 30,
        stockQuantity: 6,
        images: [],
        isDefault: true, // index 0 và không variant nào isDefault
        isAvailable: true,
        compareAtPrice: null,
        displayName: 'Đỏ',
        productId: '5',
        id: undefined,
      },
      { transaction: TX },
    );
  });

  test('attribute tạo mới: type custom + required false mặc định', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    repo.findProductById.mockResolvedValueOnce({ status: 'draft', toJSON: () => ({ id: 5 }) });
    repo.findProductAttributes.mockResolvedValueOnce([]);
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { attributes: [{ name: 'Mới', value: 'a' }] },
    });
    expect(repo.createProductAttribute).toHaveBeenCalledWith(
      { productId: '5', name: 'Mới', values: ['a'], type: 'custom', required: false },
      { transaction: TX },
    );
  });

  test('variant images: destroy theo variantId + bulkCreate', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    repo.findProductById.mockResolvedValueOnce({ status: 'draft', toJSON: () => ({ id: 5 }) });
    repo.createProductVariant.mockResolvedValueOnce({ id: 9, price: 30 });
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { variants: [{ price: '1', stock: '1', images: ['v1.jpg', 'v2.jpg'] }] },
    });
    expect(repo.destroyProductImages).toHaveBeenCalledWith(
      { productId: '5', variantId: 9 },
      { transaction: TX },
    );
    expect(repo.bulkCreateProductImages).toHaveBeenCalledWith(
      [
        { productId: '5', variantId: 9, imageUrl: 'v1.jpg', isThumbnail: true, color: null },
        { productId: '5', variantId: 9, imageUrl: 'v2.jpg', isThumbnail: false, color: null },
      ],
      { transaction: TX },
    );
  });
});

// ─── getAllProducts: include[3]/[4] ─────────────────────────────────────────

describe('getAllProducts — include attributes/specs', () => {
  beforeEach(() => repo.findProducts.mockResolvedValue({ count: 0, rows: [] }));

  test('include[3]=productAttributes, include[4]=productSpecifications (required false)', async () => {
    await invoke(service.getAllProducts, { query: {} });
    const inc = repo.findProducts.mock.calls[0][0].include;
    expect(inc[3]).toEqual({ model: ProductAttribute, as: 'productAttributes', required: false });
    expect(inc[4]).toEqual({
      model: ProductSpecification,
      as: 'productSpecifications',
      required: false,
    });
  });
});

// ─── updateProductStock: messages + response ────────────────────────────────

describe('updateProductStock — messages', () => {
  test('product không tồn tại → message đúng', async () => {
    repo.findProductById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.updateProductStock, {
      params: { id: '5' },
      body: { stockQuantity: '5' },
    });
    expect(err.message).toBe('Không tìm thấy sản phẩm');
  });

  test('response status success', async () => {
    const p = { id: 5, update: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(p);
    const { res } = await invoke(service.updateProductStock, {
      params: { id: '5' },
      body: { stockQuantity: '5' },
    });
    expect(res.payload.status).toBe('success');
  });
});

// ─── cloneProduct: include + clone data exact ───────────────────────────────

describe('cloneProduct — include + data', () => {
  function original(over = {}) {
    return {
      name: 'SP',
      get: () => ({ id: 1, name: 'SP', sku: 'OLD', createdAt: 'x', updatedAt: 'y', slug: 's' }),
      categories: [],
      productAttributes: [],
      variants: [],
      productSpecifications: [],
      ...over,
    };
  }

  test('include 4 association khi tìm product gốc', async () => {
    repo.findProductById.mockResolvedValueOnce(original());
    repo.findProductOne.mockResolvedValueOnce(null);
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    expect(repo.findProductById.mock.calls[0][1].include).toEqual([
      { model: Category, as: 'categories' },
      { model: ProductAttribute, as: 'productAttributes' },
      { model: ProductVariant, as: 'variants' },
      { model: ProductSpecification, as: 'productSpecifications' },
    ]);
  });

  test('clone data: xoá id/createdAt/updatedAt/slug, status draft, sku mới', async () => {
    repo.findProductById.mockResolvedValueOnce(original());
    repo.findProductOne.mockResolvedValueOnce(null);
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    const data = repo.createProductFull.mock.calls[0][0];
    expect(data.id).toBeUndefined();
    expect(data.createdAt).toBeUndefined();
    expect(data.updatedAt).toBeUndefined();
    expect(data.slug).toBeUndefined();
    expect(data.status).toBe('draft');
    expect(data.sku).toMatch(/^SKU-\d+-\d+$/);
    expect(data.name).toBe('SP (1)');
  });

  test('clone attribute data: xoá id/createdAt/updatedAt + gắn productId mới', async () => {
    repo.findProductById.mockResolvedValueOnce(
      original({
        productAttributes: [
          { get: () => ({ id: 5, name: 'Màu', createdAt: 'a', updatedAt: 'b' }) },
        ],
      }),
    );
    repo.findProductOne.mockResolvedValueOnce(null);
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    expect(repo.bulkCreateProductAttributes).toHaveBeenCalledWith(
      [{ name: 'Màu', productId: 20 }],
      { transaction: TX },
    );
  });

  test('clone variant không có "-" trong sku → suffix random', async () => {
    repo.findProductById.mockResolvedValueOnce(
      original({ variants: [{ get: () => ({ id: 7, sku: 'NODASH' }) }] }),
    );
    repo.findProductOne.mockResolvedValueOnce(null);
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    const vd = repo.bulkCreateProductVariants.mock.calls[0][0][0];
    expect(vd.sku).toMatch(/^SKU-\d+-\d+-\d+$/); // suffix là số random
  });
});

// ─── restockProduct: include index + messages ───────────────────────────────

describe('restockProduct — include index', () => {
  test('findProductById index (lần 2) có include 3 model', async () => {
    const p = { stockQuantity: 1, status: 'draft', update: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(p);
    repo.createInventoryLog.mockResolvedValueOnce({ id: 1 });
    repo.findProductById.mockResolvedValueOnce({ status: 'active', toJSON: () => ({ id: 5 }) });
    await invoke(service.restockProduct, {
      params: { productId: '5' },
      body: { quantity: '3' },
      user: { id: 1 },
    });
    const indexCall = repo.findProductById.mock.calls.at(-1);
    expect(indexCall[1].include).toEqual([
      { model: Category, as: 'categories', through: { attributes: [] } },
      { model: ProductVariant, as: 'variants', attributes: ['stockQuantity'] },
      {
        model: ProductImage,
        as: 'productImages',
        attributes: ['imageUrl', 'isThumbnail'],
        required: false,
      },
    ]);
  });

  test('variant không tồn tại → 404 biến thể', async () => {
    const p = { stockQuantity: 1, status: 'draft', update: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(p);
    repo.findProductVariantById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.restockProduct, {
      params: { productId: '5' },
      body: { quantity: '3', variantId: '9' },
      user: { id: 1 },
    });
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Không tìm thấy biến thể');
  });
});
