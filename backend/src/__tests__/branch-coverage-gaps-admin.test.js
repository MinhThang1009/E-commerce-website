/**
 * Branch coverage gaps — admin services (singleton mock pattern).
 */
process.env.NODE_ENV = 'test';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
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
    User: { __m: 'User' },
    Order: { __m: 'Order' },
    ChatMessage: { __m: 'ChatMessage' },
  };
  const seq = {
    transaction: jest.fn(),
    query: jest.fn(),
    QueryTypes: { UPDATE: 'UPDATE' },
  };
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
    'aggregateOrders',
    'aggregateOrderItems',
    'aggregateUsers',
    'findProductsList',
    'countChatMessages',
    'aggregateChatMessagesAdv',
    'findOneChatMessage',
  ])
    fns[n] = jest.fn();
  return {
    getSequelize: () => seq,
    getOp: () => Op,
    getSequelizeFns: () => Sequelize,
    getModels: () => models,
    ...fns,
    __seq: seq,
  };
});

const repo = require('@modules/admin/repositories/sequelize-admin-repository');
const sequelize = repo.__seq;
const TX = { commit: jest.fn(), rollback: jest.fn() };

function invoke(handler, req) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: undefined,
      payload: undefined,
      body: undefined,
      headers,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(b) {
        this.payload = b;
        resolve({ res: this });
        return this;
      },
      send(b) {
        this.body = b;
        resolve({ res: this });
        return this;
      },
      setHeader(k, v) {
        headers[k] = v;
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
});

// ═══════════════════════════════════════════════════════════════════════════════
// admin-analytics-service: L305 (escapeCsv v ?? '' null branch)
// ═══════════════════════════════════════════════════════════════════════════════
describe('admin-analytics-service: exportReport branches (L305)', () => {
  const service = require('@modules/admin/services/admin-analytics-service');

  test('exportReport orders: User null → customer/email empty, paymentMethod null (L300-306)', async () => {
    repo.aggregateOrders.mockResolvedValue([
      {
        toJSON: () => ({
          id: 1,
          number: null,
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod: null,
          total: 100000,
          createdAt: '2026-01-01T00:00:00Z',
          User: null,
        }),
      },
    ]);
    const { res } = await invoke(service.exportReport, { query: { type: 'orders' } });
    expect(res.body).toContain('""');
    expect(res.statusCode).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// admin-product-service: L1001-1002 (updateStock rollback), L1045 (clone too many)
// ═══════════════════════════════════════════════════════════════════════════════
describe('admin-product-service branches', () => {
  const service = require('@modules/admin/services/admin-product-service');

  // L1001-1002: updateProductStock — variant update throws → rollback + re-throw
  test('updateProductStock: variant update error → rollback (L1001-1002)', async () => {
    const product = { id: 1, update: jest.fn() };
    const variant = { id: 5, update: jest.fn().mockRejectedValue(new Error('DB fail')) };
    repo.findProductById.mockResolvedValue(product);
    repo.findProductVariantById.mockResolvedValue(variant);
    const { err } = await invoke(service.updateProductStock, {
      params: { id: '1' },
      body: { stockQuantity: '10', variantId: '5' },
      locale: 'vi',
    });
    expect(err.message).toBe('DB fail');
    expect(TX.rollback).toHaveBeenCalled();
  });

  // L1045: cloneProduct — tất cả 50 tên đều đã tồn tại → throw 409
  test('cloneProduct: all 50 names taken → throw 409 (L1045)', async () => {
    const original = {
      id: 1,
      name: 'Product A',
      get: () => ({ id: 1, name: 'Product A' }),
    };
    repo.findProductById.mockResolvedValue(original);
    repo.findProductOne.mockResolvedValue({ id: 99 });
    const { err } = await invoke(service.cloneProduct, {
      params: { id: '1' },
      locale: 'vi',
    });
    expect(err.statusCode).toBe(409);
  });
});
