const InventoryService = require('./inventoryService');

// Mock sequelize.transaction — unit test không connect DB thật
const mockSequelize = { transaction: jest.fn((cb) => cb({})) };
jest.mock('../../../config/sequelize', () => mockSequelize);

describe('InventoryService', () => {
  let repo;
  let eventBus;
  let service;

  beforeEach(() => {
    repo = {
      findProductById: jest.fn(),
      findVariantByIdAndProductId: jest.fn(),
      sumVariantStockByProductId: jest.fn(),
      saveStockable: jest.fn(async (s) => s),
      createInventoryLog: jest.fn(async (p) => ({ id: 1, ...p })),
      findInventoryLogs: jest.fn(),
    };
    eventBus = { publish: jest.fn().mockResolvedValue() };
    service = new InventoryService({
      inventoryRepository: repo,
      sequelize: mockSequelize,
      eventBus,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
  });

  describe('restockProduct', () => {
    test('quantity invalid → 400', async () => {
      await expect(
        service.restockProduct({ productId: 1, quantity: 0, adminId: 5 })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('product không tồn tại → 404', async () => {
      repo.findProductById.mockResolvedValue(null);
      await expect(
        service.restockProduct({ productId: 99, quantity: 5, adminId: 5 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('variantId không tồn tại → 404', async () => {
      repo.findProductById.mockResolvedValue({ id: 1 });
      repo.findVariantByIdAndProductId.mockResolvedValue(null);
      await expect(
        service.restockProduct({ productId: 1, variantId: 99, quantity: 5, adminId: 5 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('product-only restock → cập nhật stockQuantity + log', async () => {
      const product = { id: 1, stockQuantity: 10, save: jest.fn() };
      repo.findProductById.mockResolvedValue(product);

      const result = await service.restockProduct({
        productId: 1, quantity: 20, adminId: 5,
      });

      expect(product.stockQuantity).toBe(30);
      expect(repo.createInventoryLog).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 1, variantId: null,
          changeType: 'restock', changeAmount: 20,
          previousStock: 10, newStock: 30, createdBy: 5,
        })
      );
      expect(result.newStock).toBe(30);
    });

    test('variant restock → sync product totalStock', async () => {
      const product = { id: 1, stockQuantity: 0, save: jest.fn() };
      const variant = { id: 5, stockQuantity: 3, save: jest.fn() };
      repo.findProductById.mockResolvedValue(product);
      repo.findVariantByIdAndProductId.mockResolvedValue(variant);
      repo.sumVariantStockByProductId.mockResolvedValue(15);

      await service.restockProduct({
        productId: 1, variantId: 5, quantity: 12, adminId: 7,
      });

      expect(variant.stockQuantity).toBe(15);
      expect(variant.isAvailable).toBe(true);
      expect(product.stockQuantity).toBe(15);
    });

    test('restock publish StockRestockedEvent', async () => {
      const product = { id: 1, stockQuantity: 0, save: jest.fn() };
      repo.findProductById.mockResolvedValue(product);

      await service.restockProduct({ productId: 1, quantity: 5, adminId: 9 });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'inventory.restocked' })
      );
    });
  });

  describe('getInventoryLogs', () => {
    test('cap limit = 100', async () => {
      repo.findInventoryLogs.mockResolvedValue({ count: 0, rows: [] });
      await service.getInventoryLogs({ limit: 999 });
      expect(repo.findInventoryLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });

    test('filter by productId + changeType', async () => {
      repo.findInventoryLogs.mockResolvedValue({ count: 0, rows: [] });
      await service.getInventoryLogs({ productId: '5', changeType: 'restock' });
      expect(repo.findInventoryLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 5, changeType: 'restock' },
        })
      );
    });
  });
});
