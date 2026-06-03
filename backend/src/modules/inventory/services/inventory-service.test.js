const InventoryService = require('./inventory-service');

// Mock sequelize.transaction — unit test không connect DB thật
const mockSequelize = { transaction: jest.fn((cb) => cb({})) };
jest.mock('@config/sequelize', () => mockSequelize);

describe('InventoryService', () => {
  let repo;
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
    service = new InventoryService({
      inventoryRepository: repo,
      sequelize: mockSequelize,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
  });

  describe('restockProduct', () => {
    test('quantity invalid → 400', async () => {
      await expect(
        service.restockProduct({ productId: 1, quantity: 0, adminId: 5 }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('product không tồn tại → 404', async () => {
      repo.findProductById.mockResolvedValue(null);
      await expect(
        service.restockProduct({ productId: 99, quantity: 5, adminId: 5 }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('variantId không tồn tại → 404', async () => {
      repo.findProductById.mockResolvedValue({ id: 1 });
      repo.findVariantByIdAndProductId.mockResolvedValue(null);
      await expect(
        service.restockProduct({ productId: 1, variantId: 99, quantity: 5, adminId: 5 }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('product-only restock → cập nhật stockQuantity + log', async () => {
      const product = { id: 1, stockQuantity: 10, save: jest.fn() };
      repo.findProductById.mockResolvedValue(product);

      const result = await service.restockProduct({
        productId: 1,
        quantity: 20,
        adminId: 5,
      });

      expect(product.stockQuantity).toBe(30);
      expect(repo.createInventoryLog).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 1,
          variantId: null,
          changeType: 'restock',
          changeAmount: 20,
          previousStock: 10,
          newStock: 30,
          createdBy: 5,
        }),
        expect.objectContaining({}),
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
        productId: 1,
        variantId: 5,
        quantity: 12,
        adminId: 7,
      });

      expect(variant.stockQuantity).toBe(15);
      expect(variant.isAvailable).toBe(true);
      expect(product.stockQuantity).toBe(15);
      // sumVariantStockByProductId phải chạy trong transaction để đảm bảo atomicity
      expect(repo.sumVariantStockByProductId).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ transaction: expect.any(Object) }),
      );
    });

    test('restock không còn publish event (inventory.restocked đã xóa)', async () => {
      // inventory.restocked không có subscriber → đã xóa khỏi service
      const product = { id: 1, stockQuantity: 0, save: jest.fn() };
      repo.findProductById.mockResolvedValue(product);

      const result = await service.restockProduct({ productId: 1, quantity: 5, adminId: 9 });

      expect(result.productId).toBe(1);
      expect(result.quantity).toBe(5);
    });
  });

  describe('getInventoryLogs', () => {
    test('cap limit = 100', async () => {
      repo.findInventoryLogs.mockResolvedValue({ count: 0, rows: [] });
      await service.getInventoryLogs({ limit: 999 });
      expect(repo.findInventoryLogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
    });

    test('filter by productId + changeType', async () => {
      repo.findInventoryLogs.mockResolvedValue({ count: 0, rows: [] });
      await service.getInventoryLogs({ productId: '5', changeType: 'restock' });
      expect(repo.findInventoryLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 5, changeType: 'restock' },
        }),
      );
    });
  });

  // ── Tests bổ sung để giết surviving mutants ────────────────────────────────

  describe('_validateRestockQty (via restockProduct)', () => {
    test('quantity âm → ném AppError 400 với message đúng', async () => {
      // Kills L14:7 LogicalOperator (!qty && qty<=0 → sẽ không reject qty=-5 nếu && thay ||)
      await expect(
        service.restockProduct({ productId: 1, quantity: -5, adminId: 1 }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Số lượng nhập phải là số nguyên dương',
      });
    });

    test('quantity string không phải số → ném AppError 400 với message đúng', async () => {
      // Kills L14:15 ConditionalExpression (condition → false: không bao giờ invalid)
      // Kills L14:56 StringLiteral (reason → "": message sẽ trống)
      await expect(
        service.restockProduct({ productId: 1, quantity: 'abc', adminId: 1 }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Số lượng nhập phải là số nguyên dương',
      });
    });

    test('quantity hợp lệ → trả về đúng quantity đã parse (kills ObjectLiteral {})', async () => {
      // Kills L14:32 ObjectLiteral (return {} → validated.quantity = undefined → NaN → lỗi sai)
      const product = { id: 1, stockQuantity: 5, save: jest.fn() };
      repo.findProductById.mockResolvedValue(product);

      const result = await service.restockProduct({ productId: 1, quantity: '7', adminId: 1 });

      // quantity phải được parse đúng: 7
      expect(result.quantity).toBe(7);
      expect(result.newStock).toBe(12); // 5 + 7
    });
  });

  describe('restockProduct — error messages', () => {
    test('product không tồn tại → message chứa inventory.productNotFound', async () => {
      // Kills L40:38 StringLiteral (message → "")
      repo.findProductById.mockResolvedValue(null);
      await expect(
        service.restockProduct({ productId: 99, quantity: 5, adminId: 1 }),
      ).rejects.toMatchObject({ message: 'inventory.productNotFound', statusCode: 404 });
    });

    test('variant không tồn tại → message chứa inventory.variantNotFound', async () => {
      // Kills L46:40 StringLiteral (message → "")
      repo.findProductById.mockResolvedValue({ id: 1, stockQuantity: 0, save: jest.fn() });
      repo.findVariantByIdAndProductId.mockResolvedValue(null);
      await expect(
        service.restockProduct({ productId: 1, variantId: 5, quantity: 10, adminId: 1 }),
      ).rejects.toMatchObject({ message: 'inventory.variantNotFound', statusCode: 404 });
    });

    test('kind = product → else branch: product.save gọi với transaction (kills BlockStatement {})', async () => {
      // Kills L51:14 StringLiteral (kind = "" → else branch không đúng path) và L67 BlockStatement
      const product = { id: 1, stockQuantity: 0, save: jest.fn() };
      repo.findProductById.mockResolvedValue(product);

      await service.restockProduct({ productId: 1, quantity: 5, adminId: 1 });

      // product.save phải được gọi khi không có variantId (else branch phải chạy)
      expect(product.save).toHaveBeenCalledWith(
        expect.objectContaining({ transaction: expect.any(Object) }),
      );
    });
  });

  describe('restockProduct — return object fields (note, variantId)', () => {
    test('note không truyền → createInventoryLog với note = null', async () => {
      // Kills L79:17 ConditionalExpression (true/false) và LogicalOperator (note && null)
      const product = { id: 1, stockQuantity: 0, save: jest.fn() };
      repo.findProductById.mockResolvedValue(product);

      await service.restockProduct({ productId: 1, quantity: 3, adminId: 1 });

      expect(repo.createInventoryLog).toHaveBeenCalledWith(
        expect.objectContaining({ note: null }),
        expect.anything(),
      );
    });

    test('note có giá trị → createInventoryLog với note = giá trị đó', async () => {
      // Kills L79:17 ConditionalExpression (false) và LogicalOperator (note && null → null)
      const product = { id: 1, stockQuantity: 0, save: jest.fn() };
      repo.findProductById.mockResolvedValue(product);

      await service.restockProduct({
        productId: 1,
        quantity: 3,
        note: 'nhập từ nhà cung cấp',
        adminId: 1,
      });

      expect(repo.createInventoryLog).toHaveBeenCalledWith(
        expect.objectContaining({ note: 'nhập từ nhà cung cấp' }),
        expect.anything(),
      );
    });

    test('không truyền variantId → return variantId = null', async () => {
      // Kills L88:18 ConditionalExpression (true/false) và LogicalOperator (variantId && null)
      const product = { id: 1, stockQuantity: 0, save: jest.fn() };
      repo.findProductById.mockResolvedValue(product);

      const result = await service.restockProduct({ productId: 1, quantity: 5, adminId: 1 });

      expect(result.variantId).toBeNull();
    });

    test('truyền variantId → return variantId đúng giá trị', async () => {
      // Kills L88:18 ConditionalExpression (false) và LogicalOperator (variantId && null → null)
      const product = { id: 1, stockQuantity: 0, save: jest.fn() };
      const variant = { id: 7, stockQuantity: 0, save: jest.fn() };
      repo.findProductById.mockResolvedValue(product);
      repo.findVariantByIdAndProductId.mockResolvedValue(variant);
      repo.sumVariantStockByProductId.mockResolvedValue(5);

      const result = await service.restockProduct({
        productId: 1,
        variantId: 7,
        quantity: 5,
        adminId: 1,
      });

      expect(result.variantId).toBe(7); // bắt cả true (7≠true) và false (7≠null) và && (7&&null=null)
    });
  });

  describe('getInventoryLogs — offset, filter conditions, return object', () => {
    test('page=3, limit=10 → offset = 20 không phải 1 (kills ArithmeticOperator /)', async () => {
      // Kills L99:17 ArithmeticOperator ((page-1)/lim vs (page-1)*lim)
      repo.findInventoryLogs.mockResolvedValue({ count: 0, rows: [] });
      await service.getInventoryLogs({ page: 3, limit: 10 });
      expect(repo.findInventoryLogs).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }));
    });

    test('không truyền productId → where không có key productId', async () => {
      // Kills L102:9 ConditionalExpression (if(true) → luôn set productId)
      repo.findInventoryLogs.mockResolvedValue({ count: 0, rows: [] });
      await service.getInventoryLogs({ changeType: 'restock' });
      const callArg = repo.findInventoryLogs.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('productId');
    });

    test('không truyền changeType → where không có key changeType', async () => {
      // Kills L103:9 ConditionalExpression (if(true) → luôn set changeType)
      repo.findInventoryLogs.mockResolvedValue({ count: 0, rows: [] });
      await service.getInventoryLogs({ productId: '3' });
      const callArg = repo.findInventoryLogs.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('changeType');
    });

    test('trả về đúng structure { data, total, page, limit } (kills ObjectLiteral {})', async () => {
      // Kills L106:12 ObjectLiteral (return {} → các field undefined)
      const rows = [{ id: 1 }, { id: 2 }];
      repo.findInventoryLogs.mockResolvedValue({ count: 42, rows });
      const result = await service.getInventoryLogs({ page: 2, limit: 10 });

      expect(result).toEqual({ data: rows, total: 42, page: 2, limit: 10 });
    });
  });
});
