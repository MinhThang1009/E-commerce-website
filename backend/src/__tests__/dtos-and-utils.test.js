// Phase 44 — 100% coverage cho tất cả DTO files, unitOfWork, và SequelizeInventoryRepository.
// Tất cả DTO là pure function / pass-through — test verify output trực tiếp.

// ─── CART DTO ─────────────────────────────────────────────────────────────────
const { toCartDto } = require('@modules/cart/dtos/cart-dto');

describe('toCartDto', () => {
  test('trả về null khi data là null', () => {
    expect(toCartDto(null)).toBeNull();
  });

  test('trả về null khi data là undefined', () => {
    expect(toCartDto(undefined)).toBeNull();
  });

  test('pass-through data khi có giá trị', () => {
    const cartData = { id: 1, items: [], subtotal: 0 };
    expect(toCartDto(cartData)).toBe(cartData);
  });
});

// ─── CATALOG DTO ──────────────────────────────────────────────────────────────
const { toCategoryDto, toBrandDto, toProductDto } = require('@modules/catalog/dtos/catalog-dto');

describe('toCategoryDto', () => {
  test('trả về null khi input là null', () => {
    expect(toCategoryDto(null)).toBeNull();
  });

  test('trả về null khi input là undefined', () => {
    expect(toCategoryDto(undefined)).toBeNull();
  });

  test('pass-through object hợp lệ', () => {
    const cat = { id: 1, name: 'Electronics' };
    expect(toCategoryDto(cat)).toBe(cat);
  });
});

describe('toBrandDto', () => {
  test('trả về null khi input là null', () => {
    expect(toBrandDto(null)).toBeNull();
  });

  test('trả về null khi input là undefined', () => {
    expect(toBrandDto(undefined)).toBeNull();
  });

  test('pass-through object hợp lệ', () => {
    const brand = { id: 2, name: 'Samsung' };
    expect(toBrandDto(brand)).toBe(brand);
  });
});

describe('toProductDto', () => {
  test('trả về null khi input là null', () => {
    expect(toProductDto(null)).toBeNull();
  });

  test('trả về null khi input là undefined', () => {
    expect(toProductDto(undefined)).toBeNull();
  });

  test('pass-through object hợp lệ', () => {
    const product = { id: 5, name: 'Phone' };
    expect(toProductDto(product)).toBe(product);
  });
});

// ─── CONTENT DTO ──────────────────────────────────────────────────────────────
const { toFeedbackDto } = require('@modules/content/dtos/content-dto');

describe('toFeedbackDto', () => {
  test('trả về null khi input là null', () => {
    expect(toFeedbackDto(null)).toBeNull();
  });

  test('trả về null khi input là undefined', () => {
    expect(toFeedbackDto(undefined)).toBeNull();
  });

  test('pass-through feedback object', () => {
    const feedback = { id: 4, message: 'Great service' };
    expect(toFeedbackDto(feedback)).toBe(feedback);
  });
});

// ─── INVENTORY DTO ────────────────────────────────────────────────────────────
const { toInventoryDto } = require('@modules/inventory/dtos/inventory-dto');

describe('toInventoryDto', () => {
  test('trả về null khi model là null', () => {
    expect(toInventoryDto(null)).toBeNull();
  });

  test('trả về null khi model là undefined', () => {
    expect(toInventoryDto(undefined)).toBeNull();
  });

  test('gọi toJSON() khi model có method toJSON và map id', () => {
    const model = { toJSON: () => ({ id: 10, stock: 50 }) };
    expect(toInventoryDto(model)).toEqual({ id: 10 });
  });

  test('dùng trực tiếp object khi không có toJSON', () => {
    const model = { id: 99 };
    expect(toInventoryDto(model)).toEqual({ id: 99 });
  });
});

// ─── ORDERS DTO ───────────────────────────────────────────────────────────────
const { toOrderDto } = require('@modules/orders/dtos/orders-dto');

describe('toOrderDto', () => {
  test('trả về null khi input là null', () => {
    expect(toOrderDto(null)).toBeNull();
  });

  test('trả về null khi input là undefined', () => {
    expect(toOrderDto(undefined)).toBeNull();
  });

  test('pass-through order object', () => {
    const order = { id: 'ord-1', status: 'pending' };
    expect(toOrderDto(order)).toBe(order);
  });
});

// ─── PAYMENT DTO ──────────────────────────────────────────────────────────────
const { toPaymentIntentDto, toRefundDto } = require('@modules/payment/dtos/payment-dto');

describe('toPaymentIntentDto', () => {
  test('trả về null khi input là null', () => {
    expect(toPaymentIntentDto(null)).toBeNull();
  });

  test('trả về null khi input là undefined', () => {
    expect(toPaymentIntentDto(undefined)).toBeNull();
  });

  test('pass-through intent object', () => {
    const intent = { id: 'pi_123', amount: 50000 };
    expect(toPaymentIntentDto(intent)).toBe(intent);
  });
});

describe('toRefundDto', () => {
  test('trả về null khi input là null', () => {
    expect(toRefundDto(null)).toBeNull();
  });

  test('trả về null khi input là undefined', () => {
    expect(toRefundDto(undefined)).toBeNull();
  });

  test('pass-through refund object', () => {
    const refund = { id: 'ref_456', status: 'succeeded' };
    expect(toRefundDto(refund)).toBe(refund);
  });
});

// ─── REVIEWS DTO ──────────────────────────────────────────────────────────────
const { toReviewDto } = require('@modules/reviews/dtos/reviews-dto');

describe('toReviewDto', () => {
  test('trả về null khi input là null', () => {
    expect(toReviewDto(null)).toBeNull();
  });

  test('trả về null khi input là undefined', () => {
    expect(toReviewDto(undefined)).toBeNull();
  });

  test('pass-through review object', () => {
    const review = { id: 1, rating: 5, comment: 'Great!' };
    expect(toReviewDto(review)).toBe(review);
  });
});

// ─── UPLOAD DTO ───────────────────────────────────────────────────────────────
const { toUploadFileDto } = require('@modules/upload/dtos/upload-dto');

describe('toUploadFileDto', () => {
  test('trả về null khi input là null', () => {
    expect(toUploadFileDto(null)).toBeNull();
  });

  test('trả về null khi input là undefined', () => {
    expect(toUploadFileDto(undefined)).toBeNull();
  });

  test('pass-through file object', () => {
    const file = { filename: 'img.jpg', url: 'https://cdn.example.com/img.jpg', size: 1024 };
    expect(toUploadFileDto(file)).toBe(file);
  });
});

// ─── WISHLIST DTO ─────────────────────────────────────────────────────────────
const { toWishlistProductDto } = require('@modules/wishlist/dtos/wishlist-dto');

describe('toWishlistProductDto', () => {
  test('trả về null khi input là null', () => {
    expect(toWishlistProductDto(null)).toBeNull();
  });

  test('trả về null khi input là undefined', () => {
    expect(toWishlistProductDto(undefined)).toBeNull();
  });

  test('pass-through product object', () => {
    const product = { id: 8, name: 'Laptop', price: 20000000 };
    expect(toWishlistProductDto(product)).toBe(product);
  });
});

// ─── UNIT OF WORK ─────────────────────────────────────────────────────────────
// unitOfWork require('../../config/sequelize') → mock trước khi require module.
jest.mock('@config/sequelize', () => ({
  transaction: jest.fn(),
}));

const sequelizeMock = require('@config/sequelize');
const { runInTransaction, lockRow } = require('@shared/persistence/unit-of-work');

describe('runInTransaction', () => {
  beforeEach(() => {
    sequelizeMock.transaction.mockReset();
  });

  test('reuse parent transaction khi options.transaction đã có sẵn', async () => {
    const parentTx = { id: 'parent-tx' };
    const work = jest.fn().mockResolvedValue('result-from-parent');

    const result = await runInTransaction(work, { transaction: parentTx });

    expect(work).toHaveBeenCalledWith(parentTx);
    expect(sequelizeMock.transaction).not.toHaveBeenCalled();
    expect(result).toBe('result-from-parent');
  });

  test('mở transaction mới khi không có options.transaction', async () => {
    const fakeTx = { id: 'new-tx' };
    sequelizeMock.transaction.mockImplementation(async (cb) => cb(fakeTx));
    const work = jest.fn().mockResolvedValue('result-from-new');

    const result = await runInTransaction(work);

    expect(sequelizeMock.transaction).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(fakeTx);
    expect(result).toBe('result-from-new');
  });

  test('mở transaction mới khi options = {} (không có transaction key)', async () => {
    const fakeTx = { id: 'tx-empty-opts' };
    sequelizeMock.transaction.mockImplementation(async (cb) => cb(fakeTx));
    const work = jest.fn().mockResolvedValue('ok');

    await runInTransaction(work, {});

    expect(sequelizeMock.transaction).toHaveBeenCalledTimes(1);
  });

  test('propagate exception từ work function ra ngoài', async () => {
    const fakeTx = { id: 'tx-err' };
    sequelizeMock.transaction.mockImplementation(async (cb) => cb(fakeTx));
    const work = jest.fn().mockRejectedValue(new Error('DB error'));

    await expect(runInTransaction(work)).rejects.toThrow('DB error');
  });
});

describe('lockRow', () => {
  test('throw khi không truyền transaction', async () => {
    const model = { findOne: jest.fn() };
    await expect(lockRow(model, { id: 1 }, null)).rejects.toThrow('lockRow: transaction bắt buộc');
  });

  test('throw khi transaction là undefined', async () => {
    const model = { findOne: jest.fn() };
    await expect(lockRow(model, { id: 1 }, undefined)).rejects.toThrow(
      'lockRow: transaction bắt buộc',
    );
  });

  test('gọi model.findOne với where, transaction, lock đúng', async () => {
    const expectedRow = { id: 5, stockQuantity: 10 };
    const tx = { LOCK: { UPDATE: 'UPDATE' } };
    const model = { findOne: jest.fn().mockResolvedValue(expectedRow) };

    const result = await lockRow(model, { id: 5 }, tx);

    expect(model.findOne).toHaveBeenCalledWith({
      where: { id: 5 },
      transaction: tx,
      lock: 'UPDATE',
    });
    expect(result).toBe(expectedRow);
  });
});

// ─── SEQUELIZE INVENTORY REPOSITORY ──────────────────────────────────────────
const SequelizeInventoryRepository = require('@modules/inventory/repositories/sequelize-inventory-repository');

function buildRepo(overrides = {}) {
  const Product = {
    findByPk: jest.fn(),
    ...overrides.Product,
  };
  const ProductVariant = {
    findOne: jest.fn(),
    sum: jest.fn(),
    ...overrides.ProductVariant,
  };
  const InventoryLog = {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
    ...overrides.InventoryLog,
  };
  const User = { ...overrides.User };
  return new SequelizeInventoryRepository({ Product, ProductVariant, InventoryLog, User });
}

describe('SequelizeInventoryRepository', () => {
  describe('findProductById', () => {
    test('gọi Product.findByPk với id và trả về kết quả', async () => {
      const fakeProduct = { id: 1, name: 'Phone' };
      const repo = buildRepo();
      repo.Product.findByPk.mockResolvedValue(fakeProduct);

      const result = await repo.findProductById(1);

      expect(repo.Product.findByPk).toHaveBeenCalledWith(1);
      expect(result).toBe(fakeProduct);
    });

    test('trả về null khi product không tồn tại', async () => {
      const repo = buildRepo();
      repo.Product.findByPk.mockResolvedValue(null);

      expect(await repo.findProductById(999)).toBeNull();
    });
  });

  describe('findVariantByIdAndProductId', () => {
    test('gọi ProductVariant.findOne với where {id, productId} đúng', async () => {
      const fakeVariant = { id: 10, productId: 1, sku: 'SKU-10' };
      const repo = buildRepo();
      repo.ProductVariant.findOne.mockResolvedValue(fakeVariant);

      const result = await repo.findVariantByIdAndProductId(10, 1);

      expect(repo.ProductVariant.findOne).toHaveBeenCalledWith({
        where: { id: 10, productId: 1 },
      });
      expect(result).toBe(fakeVariant);
    });

    test('trả về null khi variant không tồn tại', async () => {
      const repo = buildRepo();
      repo.ProductVariant.findOne.mockResolvedValue(null);

      expect(await repo.findVariantByIdAndProductId(0, 0)).toBeNull();
    });
  });

  describe('sumVariantStockByProductId', () => {
    test('gọi ProductVariant.sum với field stockQuantity và where productId', async () => {
      const repo = buildRepo();
      repo.ProductVariant.sum.mockResolvedValue(150);

      const result = await repo.sumVariantStockByProductId(5);

      expect(repo.ProductVariant.sum).toHaveBeenCalledWith('stockQuantity', {
        where: { productId: 5 },
      });
      expect(result).toBe(150);
    });

    test('trả về 0 khi không có variant nào', async () => {
      const repo = buildRepo();
      repo.ProductVariant.sum.mockResolvedValue(0);

      expect(await repo.sumVariantStockByProductId(99)).toBe(0);
    });
  });

  describe('saveStockable', () => {
    test('gọi stockable.save() và trả về kết quả', async () => {
      const repo = buildRepo();
      const savedModel = { id: 1, stockQuantity: 20 };
      const stockable = { save: jest.fn().mockResolvedValue(savedModel) };

      const result = await repo.saveStockable(stockable);

      expect(stockable.save).toHaveBeenCalledTimes(1);
      expect(result).toBe(savedModel);
    });
  });

  describe('createInventoryLog', () => {
    test('gọi InventoryLog.create với payload và trả về log mới', async () => {
      const repo = buildRepo();
      const payload = { productId: 1, change: -5, reason: 'sale' };
      const createdLog = { id: 100, ...payload };
      repo.InventoryLog.create.mockResolvedValue(createdLog);

      const result = await repo.createInventoryLog(payload);

      expect(repo.InventoryLog.create).toHaveBeenCalledWith(payload, {});
      expect(result).toBe(createdLog);
    });
  });

  describe('findInventoryLogs', () => {
    test('gọi findAndCountAll với order DESC và include Product, ProductVariant, User', async () => {
      const repo = buildRepo();
      const fakeResult = { count: 1, rows: [{ id: 1 }] };
      repo.InventoryLog.findAndCountAll.mockResolvedValue(fakeResult);

      const result = await repo.findInventoryLogs({
        where: { productId: 2 },
        limit: 10,
        offset: 0,
      });

      expect(repo.InventoryLog.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 2 },
          limit: 10,
          offset: 0,
          order: [['createdAt', 'DESC']],
        }),
      );
      expect(result).toBe(fakeResult);
    });

    test('include Product với attributes [id, name, slug], required false', async () => {
      const repo = buildRepo();
      repo.InventoryLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await repo.findInventoryLogs();

      const callArg = repo.InventoryLog.findAndCountAll.mock.calls[0][0];
      const productInclude = callArg.include.find((i) => i.model === repo.Product);
      expect(productInclude).toMatchObject({
        attributes: ['id', 'nameVi', 'nameEn', 'slug'],
        required: false,
      });
    });

    test('include ProductVariant với attributes [id, sku], required false', async () => {
      const repo = buildRepo();
      repo.InventoryLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await repo.findInventoryLogs();

      const callArg = repo.InventoryLog.findAndCountAll.mock.calls[0][0];
      const variantInclude = callArg.include.find((i) => i.model === repo.ProductVariant);
      expect(variantInclude).toMatchObject({
        attributes: ['id', 'sku'],
        required: false,
      });
    });

    test('include User với as creator và attributes [id, firstName, lastName]', async () => {
      const repo = buildRepo();
      repo.InventoryLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await repo.findInventoryLogs();

      const callArg = repo.InventoryLog.findAndCountAll.mock.calls[0][0];
      const userInclude = callArg.include.find((i) => i.model === repo.User);
      expect(userInclude).toMatchObject({
        attributes: ['id', 'firstName', 'lastName'],
        required: false,
        as: 'creator',
      });
    });

    test('dùng default options (where={}, limit/offset undefined) khi không truyền args', async () => {
      const repo = buildRepo();
      repo.InventoryLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await repo.findInventoryLogs();

      const callArg = repo.InventoryLog.findAndCountAll.mock.calls[0][0];
      expect(callArg.where).toEqual({});
      expect(callArg.limit).toBeUndefined();
      expect(callArg.offset).toBeUndefined();
    });
  });
});
