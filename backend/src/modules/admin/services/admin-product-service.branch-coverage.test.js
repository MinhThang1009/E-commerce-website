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
const mockSeq = { transaction: jest.fn(), query: jest.fn(), QueryTypes: { UPDATE: 'UPDATE' } };

jest.mock('@modules/admin/repositories/sequelize-admin-repository', () => {
  const { Op, Sequelize } = require('sequelize');
  const fns = {};
  for (const n of [
    'findProductById',
    'findProductOne',
    'findProductVariantById',
    'sumProductVariantStock',
  ])
    fns[n] = jest.fn();
  return {
    getSequelize: () => mockSeq,
    getOp: () => Op,
    getSequelizeFns: () => Sequelize,
    getModels: () => ({
      Product: {},
      ProductImage: {},
      ProductSpecification: { create: jest.fn() },
      ProductVariant: {},
      ProductAttribute: {},
      ProductCategory: { bulkCreate: jest.fn() },
      Category: {},
      CartItem: {},
      InventoryLog: {},
    }),
    ...fns,
  };
});

const repo = require('../repositories/sequelize-admin-repository');
const service = require('./admin-product-service');
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
  mockSeq.transaction.mockResolvedValue(TX);
});

describe('AdminProductService — branch coverage', () => {
  test('updateProductStock: variant update error → rollback', async () => {
    repo.findProductById.mockResolvedValue({ id: 1, update: jest.fn() });
    repo.findProductVariantById.mockResolvedValue({
      id: 5,
      update: jest.fn().mockRejectedValue(new Error('DB fail')),
    });
    const { err } = await invoke(service.updateProductStock, {
      params: { id: '1' },
      body: { stockQuantity: '10', variantId: '5' },
      locale: 'vi',
    });
    expect(err.message).toBe('DB fail');
    expect(TX.rollback).toHaveBeenCalled();
  });

  test('cloneProduct: all 50 names taken → throw 409', async () => {
    repo.findProductById.mockResolvedValue({
      id: 1,
      name: 'Product A',
      get: () => ({ id: 1, name: 'Product A' }),
    });
    repo.findProductOne.mockResolvedValue({ id: 99 });
    const { err } = await invoke(service.cloneProduct, { params: { id: '1' }, locale: 'vi' });
    expect(err.statusCode).toBe(409);
  });
});
