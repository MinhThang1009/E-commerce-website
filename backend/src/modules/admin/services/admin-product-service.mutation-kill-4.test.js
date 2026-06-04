/**
 * Mutation-kill batch 4 cho admin-product-service.js — full push ~95%.
 * Nhắm các survivor KILLABLE còn lại: arg query exact (dup/findCategories/findProduct*),
 * skip-when-absent (categoryIds/comparePrice/images-not-array), fallback chains
 * (displayName/variantName/sku), destroy args, qty=0, response shapes, log templates.
 * Equivalent CHẤP NHẬN (không test): changes.* (dead), updateData if→true (set undefined),
 * Math.random, init arrays, qty<=0 (đã chặn !qty). Xem commit message.
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

const { Op } = require('sequelize');
const repo = require('@modules/admin/repositories/sequelize-admin-repository');
const logger = require('@utils/logger');
const helpers = require('@utils/product-helpers');
const service = require('@modules/admin/services/admin-product-service');
const sequelize = repo.getSequelize();
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

// ─── createProduct killable ─────────────────────────────────────────────────

describe('createProduct b4', () => {
  function prod() {
    return { id: 10, setCategories: jest.fn(), update: jest.fn() };
  }
  beforeEach(() => {
    repo.findProductOne.mockResolvedValue(null);
    repo.findProductById.mockResolvedValue({ status: 'draft', toJSON: () => ({ id: 10 }) });
  });

  test('dup check: findProductOne({nameVi:name})', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, { body: { name: 'ABC' } });
    expect(repo.findProductOne).toHaveBeenCalledWith({ nameVi: 'ABC' });
  });

  test('không categoryIds → findCategories + setCategories KHÔNG gọi', async () => {
    const p = prod();
    repo.createProductFull.mockResolvedValueOnce(p);
    await invoke(service.createProduct, { body: { name: 'P' } });
    expect(repo.findCategories).not.toHaveBeenCalled();
    expect(p.setCategories).not.toHaveBeenCalled();
  });

  test('findCategories where = {id: categoryIds}', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    repo.findCategories.mockResolvedValueOnce([{ id: 3 }]);
    await invoke(service.createProduct, { body: { name: 'P', categoryIds: [3] } });
    expect(repo.findCategories).toHaveBeenCalledWith({ where: { id: [3] } });
  });

  test('không comparePrice → sequelize.query KHÔNG gọi', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, { body: { name: 'P' } });
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  test('không attributes → createProductAttribute KHÔNG gọi + KHÔNG log attributes', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, { body: { name: 'P' } });
    expect(repo.createProductAttribute).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith('Đang xử lý attributes:', expect.anything());
  });

  test('log: request + comparePrice + attributes/variants/spec khi có', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', comparePrice: 5, attributes: [{ name: 'A', value: 'x' }] },
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Dữ liệu request tạo sản phẩm:',
      expect.stringContaining('"name"'),
    );
    expect(logger.info).toHaveBeenCalledWith('comparePrice từ request:', 5);
    expect(logger.info).toHaveBeenCalledWith('Đang xử lý attributes:', [{ name: 'A', value: 'x' }]);
  });

  test('attribute tạo lỗi → logger.error + rethrow', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    repo.createProductAttribute.mockRejectedValueOnce(new Error('attr fail'));
    const { err } = await invoke(service.createProduct, {
      body: { name: 'P', attributes: [{ name: 'A', value: 'x' }] },
    });
    expect(logger.error).toHaveBeenCalledWith('Lỗi khi tạo attributes:', expect.any(Error));
    expect(err.message).toBe('attr fail');
  });

  test('variant displayName: ưu tiên displayName truyền vào', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [{ name: 'V', displayName: 'MyName', price: '1', stock: '1' }] },
    });
    expect(repo.createProductVariant.mock.calls[0][0].displayName).toBe('MyName');
  });

  test('variant displayName fallback variant.name khi không attrs/displayName', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [{ name: 'TênV', price: '1', stock: '1' }] },
    });
    expect(repo.createProductVariant.mock.calls[0][0].displayName).toBe('TênV');
  });

  test('variant variantName fallback sku khi không name/displayName/attrs', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    helpers.generateVariantSku.mockReturnValue('SKX');
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [{ price: '1', stock: '1' }] },
    });
    expect(repo.createProductVariant.mock.calls[0][0].variantName).toBe('SKX');
  });

  test('variant.images giữ nguyên khi truyền', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', variants: [{ name: 'V', price: '1', stock: '1', images: ['a'] }] },
    });
    expect(repo.createProductVariant.mock.calls[0][0].images).toEqual(['a']);
  });

  test('image object isThumbnail=false + index>0 → false', async () => {
    repo.createProductFull.mockResolvedValueOnce(prod());
    await invoke(service.createProduct, {
      body: { name: 'P', images: ['a.jpg', { url: 'b.jpg', isThumbnail: false }] },
    });
    expect(repo.bulkCreateProductImages.mock.calls[0][0][1].isThumbnail).toBe(false);
  });
});

// ─── updateProduct killable ─────────────────────────────────────────────────

describe('updateProduct b4', () => {
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

  test('không tìm thấy → message "Không tìm thấy sản phẩm"', async () => {
    repo.findProductById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { name: 'X' },
    });
    expect(err.message).toBe('Không tìm thấy sản phẩm');
  });

  test('images không phải array → KHÔNG destroy/bulkCreate', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    await invoke(service.updateProduct, { params: { id: '5' }, body: { images: 'notarray' } });
    expect(repo.destroyProductImages).not.toHaveBeenCalled();
    expect(repo.bulkCreateProductImages).not.toHaveBeenCalled();
  });

  test('không comparePrice/compareAtPrice → sequelize.query KHÔNG gọi', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    await invoke(service.updateProduct, { params: { id: '5' }, body: { name: 'X' } });
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  test('categoryIds → findCategories where + setCategories null khi rỗng', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    repo.findCategories.mockResolvedValueOnce([]);
    await invoke(service.updateProduct, { params: { id: '5' }, body: { categoryIds: [] } });
    expect(repo.findCategories).toHaveBeenCalledWith({ where: { id: [] }, transaction: TX });
    expect(p.update).toHaveBeenCalledWith({ categoryId: null }, { transaction: TX });
  });

  test('attributes → findProductAttributes({productId}); attr.value split', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    repo.findProductAttributes.mockResolvedValueOnce([]);
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { attributes: [{ name: 'A', value: ' x , y ' }] },
    });
    expect(repo.findProductAttributes).toHaveBeenCalledWith(
      { productId: '5' },
      { transaction: TX },
    );
    expect(repo.createProductAttribute.mock.calls[0][0].values).toEqual(['x', 'y']);
  });

  test('variant sku fallback generateVariantSku(sku||PROD)', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    repo.createProductVariant.mockResolvedValueOnce({ id: 9, price: 1 });
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { variants: [{ price: '1', stock: '1', attributes: { c: 'x' } }] },
    });
    expect(helpers.generateVariantSku).toHaveBeenCalledWith('PROD', { c: 'x' });
  });

  test('findProductSpecs({productId})', async () => {
    const p = prod();
    repo.findProductById.mockResolvedValueOnce(p);
    final();
    repo.findProductSpecs.mockResolvedValueOnce([]);
    require('@modules/admin/repositories/sequelize-admin-repository')
      .getModels()
      .ProductSpecification.create.mockResolvedValueOnce({ value: 'v', valueEn: 'v' });
    await invoke(service.updateProduct, {
      params: { id: '5' },
      body: { specifications: [{ name: 'CPU', value: 'v', valueEn: 'v' }] },
    });
    expect(repo.findProductSpecs).toHaveBeenCalledWith({ productId: '5' }, { transaction: TX });
  });
});

// ─── deleteProduct: destroy args ────────────────────────────────────────────

describe('deleteProduct b4', () => {
  test('destroy attributes/variants/categories với {productId}', async () => {
    const p = { destroy: jest.fn().mockResolvedValue() };
    repo.findProductById.mockResolvedValueOnce(p);
    await invoke(service.deleteProduct, { params: { id: '5' } });
    expect(repo.destroyProductAttributes).toHaveBeenCalledWith(
      { productId: '5' },
      { transaction: TX },
    );
    expect(repo.destroyProductVariants).toHaveBeenCalledWith(
      { productId: '5' },
      { transaction: TX },
    );
    expect(repo.destroyProductCategories).toHaveBeenCalledWith(
      { productId: '5' },
      { transaction: TX },
    );
  });
});

// ─── getAllProducts killable ────────────────────────────────────────────────

describe('getAllProducts b4', () => {
  beforeEach(() => repo.findProducts.mockResolvedValue({ count: 0, rows: [] }));

  test('không search → where KHÔNG có Op.or', async () => {
    await invoke(service.getAllProducts, { query: {} });
    expect(repo.findProducts.mock.calls[0][0].where[Op.or]).toBeUndefined();
  });

  test('offset = (page-1)*limit', async () => {
    await invoke(service.getAllProducts, { query: { page: '3', limit: '10' } });
    expect(repo.findProducts.mock.calls[0][0].offset).toBe(20);
  });

  test('không category → include[1] KHÔNG có where/required=true', async () => {
    await invoke(service.getAllProducts, { query: {} });
    const inc1 = repo.findProducts.mock.calls[0][0].include[1];
    expect(inc1.where).toBeUndefined();
    expect(inc1.required).toBeUndefined();
  });
});

// ─── updateProductStock: qty=0 hợp lệ ───────────────────────────────────────

describe('updateProductStock b4', () => {
  test('qty=0 → hợp lệ (kill < 0 → <= 0), update stock 0', async () => {
    const p = { id: 5, update: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(p);
    const { res } = await invoke(service.updateProductStock, {
      params: { id: '5' },
      body: { stockQuantity: '0' },
    });
    expect(res.statusCode).toBe(200);
    expect(p.update).toHaveBeenCalledWith({ stockQuantity: 0 });
  });
});

// ─── toggleProductStatus: response shape ────────────────────────────────────

describe('toggleProductStatus b4', () => {
  test('response data.product', async () => {
    const p = { status: 'active', update: jest.fn() };
    repo.findProductById.mockResolvedValueOnce(p);
    const { res } = await invoke(service.toggleProductStatus, { params: { id: '5' }, body: {} });
    expect(res.payload).toEqual({ status: 'success', data: { product: p } });
  });
});

// ─── cloneProduct killable ──────────────────────────────────────────────────

describe('cloneProduct b4', () => {
  function original(over = {}) {
    return {
      name: 'SP',
      get: () => ({ id: 1, name: 'SP', sku: 'OLD' }),
      categories: [],
      productAttributes: [],
      variants: [],
      productSpecifications: [],
      ...over,
    };
  }

  test('findProductOne({nameVi: testName}) khi tìm tên unique', async () => {
    repo.findProductById.mockResolvedValueOnce(original());
    repo.findProductOne.mockResolvedValueOnce(null);
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    expect(repo.findProductOne).toHaveBeenCalledWith({ nameVi: 'SP (1)' });
  });

  test('không categories/variants/specs → bulk KHÔNG gọi', async () => {
    repo.findProductById.mockResolvedValueOnce(original());
    repo.findProductOne.mockResolvedValueOnce(null);
    repo.createProductFull.mockResolvedValueOnce({ id: 20 });
    await invoke(service.cloneProduct, { params: { id: '5' } });
    const { ProductCategory } = repo.getModels();
    expect(ProductCategory.bulkCreate).not.toHaveBeenCalled();
    expect(repo.bulkCreateProductAttributes).not.toHaveBeenCalled();
    expect(repo.bulkCreateProductVariants).not.toHaveBeenCalled();
    expect(repo.bulkCreateProductSpecs).not.toHaveBeenCalled();
  });
});
