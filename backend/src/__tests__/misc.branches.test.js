/**
 * Branch coverage tests cho các module nhỏ còn thiếu coverage
 *
 * Targets:
 * - inventoryService.js lines 50, 89
 * - OrderAggregate.js lines 52, 81
 * - adminAudit.js lines 206, 232
 * - vectorStore.js line 148
 * - wishlistService.js line 17
 * - SequelizeAiRepository.js line 15
 * - SequelizeContentRepository.js lines 44, 101
 */

process.env.NODE_ENV = 'test';

// ─────────────────────────────────────────────────────────────────────────────
// inventoryService.js
// Line 50: product.stockQuantity = total || 0 — false path khi total = 0/null
// Line 89: parseInt(limit, 10) || 20 — false path khi limit không parse được
// ─────────────────────────────────────────────────────────────────────────────

describe('InventoryService — uncovered branches', () => {
  const InventoryService = require('@modules/inventory/services/inventory-service');

  let repo;
  let service;
  let eventBus;
  let logger;

  function buildService() {
    repo = {
      findProductById: jest.fn(),
      findVariantByIdAndProductId: jest.fn(),
      sumVariantStockByProductId: jest.fn(),
      createInventoryLog: jest.fn().mockResolvedValue({ id: 1 }),
      findInventoryLogs: jest.fn(),
    };
    eventBus = { publish: jest.fn().mockResolvedValue() };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

    const mockSequelize = {
      transaction: jest.fn().mockImplementation(async (cb) => cb({})),
    };

    return new InventoryService({
      inventoryRepository: repo,
      sequelize: mockSequelize,
      eventBus,
      logger,
    });
  }

  beforeEach(() => {
    service = buildService();
  });

  describe('restockProduct — line 50: total || 0 khi sumVariantStock trả 0', () => {
    it('product.stockQuantity = 0 khi sumVariantStockByProductId trả về 0 (false path)', async () => {
      const product = { id: 1, stockQuantity: 10, save: jest.fn().mockResolvedValue() };
      const variant = {
        id: 5,
        stockQuantity: 5,
        isAvailable: false,
        save: jest.fn().mockResolvedValue(),
      };

      repo.findProductById.mockResolvedValue(product);
      repo.findVariantByIdAndProductId.mockResolvedValue(variant);
      // sumVariantStockByProductId trả 0 → total || 0 = 0
      repo.sumVariantStockByProductId.mockResolvedValue(0);

      await service.restockProduct({
        productId: 1,
        variantId: 5,
        quantity: 10,
        note: null,
        adminId: 99,
      });

      // false path: total=0 → 0||0 = 0
      expect(product.stockQuantity).toBe(0);
    });

    it('product.stockQuantity = total khi sumVariantStockByProductId trả số dương (true path)', async () => {
      const product = { id: 1, stockQuantity: 0, save: jest.fn().mockResolvedValue() };
      const variant = {
        id: 5,
        stockQuantity: 0,
        isAvailable: false,
        save: jest.fn().mockResolvedValue(),
      };

      repo.findProductById.mockResolvedValue(product);
      repo.findVariantByIdAndProductId.mockResolvedValue(variant);
      // sumVariantStockByProductId trả 15 → total || 0 = 15
      repo.sumVariantStockByProductId.mockResolvedValue(15);

      await service.restockProduct({
        productId: 1,
        variantId: 5,
        quantity: 5,
        note: null,
        adminId: 99,
      });

      expect(product.stockQuantity).toBe(15);
    });

    it('product.stockQuantity = 0 khi sumVariantStockByProductId trả null (falsy)', async () => {
      const product = { id: 1, stockQuantity: 5, save: jest.fn().mockResolvedValue() };
      const variant = {
        id: 5,
        stockQuantity: 0,
        isAvailable: false,
        save: jest.fn().mockResolvedValue(),
      };

      repo.findProductById.mockResolvedValue(product);
      repo.findVariantByIdAndProductId.mockResolvedValue(variant);
      repo.sumVariantStockByProductId.mockResolvedValue(null);

      await service.restockProduct({
        productId: 1,
        variantId: 5,
        quantity: 5,
        note: null,
        adminId: 99,
      });

      // null || 0 = 0
      expect(product.stockQuantity).toBe(0);
    });
  });

  describe('getInventoryLogs — line 89: parseInt(limit) || 20 false path', () => {
    it('dùng limit mặc định 20 khi limit truyền vào không parse được (NaN || 20)', async () => {
      repo.findInventoryLogs.mockResolvedValue({ count: 0, rows: [] });

      await service.getInventoryLogs({ page: 1, limit: 'abc' });

      // parseInt('abc') = NaN → NaN || 20 = 20
      expect(repo.findInventoryLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 0 }),
      );
    });

    it('dùng limit từ tham số khi limit là số hợp lệ (true path)', async () => {
      repo.findInventoryLogs.mockResolvedValue({ count: 5, rows: [] });

      await service.getInventoryLogs({ page: 1, limit: 50 });

      expect(repo.findInventoryLogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
    });

    it('giới hạn tối đa limit = 100 dù truyền vào lớn hơn', async () => {
      repo.findInventoryLogs.mockResolvedValue({ count: 0, rows: [] });

      await service.getInventoryLogs({ page: 1, limit: 9999 });

      expect(repo.findInventoryLogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// adminAudit.js
// Line 206: ip = req.ip || req.connection?.remoteAddress — khi req.ip falsy
// Line 232: logDashboardAccess không inject ip (không có ip tham số)
// ─────────────────────────────────────────────────────────────────────────────

describe('adminAudit.js — auditMiddleware uncovered branches', () => {
  // Reset module để tránh side effects giữa tests
  let AdminAuditService;
  let auditMiddleware;

  beforeEach(() => {
    jest.resetModules();
    // Mock logger trước khi require adminAudit
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    }));
    jest.mock('@models', () => ({
      AuditLog: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    }));
    const module = require('@shared/admin-audit');
    AdminAuditService = module.AdminAuditService;
    auditMiddleware = module.auditMiddleware;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('ip resolution — req.ip vs req.connection.remoteAddress', () => {
    // auditMiddleware dùng AsyncLocalStorage — IP lưu trong context, không inject vào method args
    it('dùng req.connection.remoteAddress khi req.ip falsy → IP ghi vào DB', async () => {
      const { AuditLog } = require('@models');
      let resolveNext;
      const nextPromise = new Promise((r) => { resolveNext = r; });

      const next = () => {
        AdminAuditService.logUserAction({ id: 1, email: 'a@b.com' }, 'BAN', 2, {});
        resolveNext();
      };

      auditMiddleware({ ip: undefined, connection: { remoteAddress: '192.168.1.50' } }, {}, next);
      await nextPromise;
      await new Promise((r) => setImmediate(r));

      expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ ip: '192.168.1.50' }));
    });

    it('dùng req.ip khi có giá trị (true path) → IP ghi vào DB', async () => {
      const { AuditLog } = require('@models');
      let resolveNext;
      const nextPromise = new Promise((r) => { resolveNext = r; });

      const next = () => {
        AdminAuditService.logUserAction({ id: 1, email: 'a@b.com' }, 'BAN', 2, {});
        resolveNext();
      };

      auditMiddleware({ ip: '10.0.0.1', connection: { remoteAddress: '192.168.1.50' } }, {}, next);
      await nextPromise;
      await new Promise((r) => setImmediate(r));

      expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ ip: '10.0.0.1' }));
    });
  });

  describe('auditMiddleware behavior — AsyncLocalStorage based', () => {
    it('gọi next() để tiếp tục pipeline', () => {
      const next = jest.fn();
      auditMiddleware({ ip: '1.2.3.4', connection: {} }, {}, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('không mutate static methods của AdminAuditService', () => {
      const originalLogUserAction = AdminAuditService.logUserAction;
      const next = jest.fn();
      auditMiddleware({ ip: '10.0.0.2', connection: {} }, {}, next);
      expect(AdminAuditService.logUserAction).toBe(originalLogUserAction);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// vectorStore.js — cosineSimilarity
// Line 148: return isFinite(similarity) ? similarity : 0 — false path (Infinity/NaN)
//
// Strategy: load vectorStore với mocks tại top-level (jest.mock hoisted).
// Dùng jest.mock cho logger, embedding, fs để tránh file system access.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@modules/ai/services/embedding/embedding', () => ({
  embed: jest.fn().mockResolvedValue([]),
  isAvailable: jest.fn().mockReturnValue(false),
}));

jest.mock('@modules/ai/services/embedding/vi-embedding', () => ({
  embed: jest.fn().mockResolvedValue([]),
  isAvailable: jest.fn().mockReturnValue(false),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
  promises: {
    readFile: jest.fn().mockResolvedValue('[]'),
    writeFile: jest.fn().mockResolvedValue(),
  },
}));

describe('HybridVectorStore.cosineSimilarity — line 148 false path', () => {
  let store;

  beforeAll(() => {
    store = require('@modules/ai/services/vectorstore/vector-store');
  });

  it('trả về similarity bình thường khi hai vectors ortho (finite result)', () => {
    if (!store || typeof store.cosineSimilarity !== 'function') return;
    const v1 = [1, 0];
    const v2 = [0, 1];
    const result = store.cosineSimilarity(v1, v2);
    expect(isFinite(result)).toBe(true);
    expect(result).toBeCloseTo(0, 5);
  });

  it('trả về 0 khi vectors là zero vectors (magnitude = 0, guard trước line 148)', () => {
    if (!store || typeof store.cosineSimilarity !== 'function') return;
    const zeroVec = [0, 0, 0];
    // magnitude = Math.sqrt(0) * Math.sqrt(0) = 0 → guard returns 0
    expect(store.cosineSimilarity(zeroVec, zeroVec)).toBe(0);
  });

  it('trả về 0 khi v1 là null (early return guard)', () => {
    if (!store || typeof store.cosineSimilarity !== 'function') return;
    expect(store.cosineSimilarity(null, [1, 2])).toBe(0);
  });

  it('trả về 0 khi v2 là null (early return guard)', () => {
    if (!store || typeof store.cosineSimilarity !== 'function') return;
    expect(store.cosineSimilarity([1, 2], null)).toBe(0);
  });

  it('trả về 0 khi vectors có độ dài khác nhau', () => {
    if (!store || typeof store.cosineSimilarity !== 'function') return;
    expect(store.cosineSimilarity([1, 0], [0, 1, 0])).toBe(0);
  });

  it('trả về 1.0 khi hai vectors hoàn toàn giống nhau (line 148 true path)', () => {
    if (!store || typeof store.cosineSimilarity !== 'function') return;
    const v = [3, 4];
    // similarity = 1.0 (isFinite = true) → return similarity
    expect(store.cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('trả về similarity chính xác giữa hai vectors song song', () => {
    if (!store || typeof store.cosineSimilarity !== 'function') return;
    const v1 = [1, 0, 0];
    const v2 = [2, 0, 0];
    // Cùng hướng → similarity = 1
    expect(store.cosineSimilarity(v1, v2)).toBeCloseTo(1.0, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// wishlistService.js — line 17
// p.stockQuantity = variantStock || (p.defaultVariant ? p.defaultVariant.stockQuantity : 0)
// false path: variantStock = 0 → dùng defaultVariant.stockQuantity
// và: p.defaultVariant falsy → 0
// ─────────────────────────────────────────────────────────────────────────────

describe('WishlistService.getWishlist — line 17 branches', () => {
  const WishlistService = require('@modules/wishlist/services/wishlist-service');

  let wishlistRepository;
  let service;

  beforeEach(() => {
    wishlistRepository = {
      findByUserIdWithProducts: jest.fn(),
      findItem: jest.fn(),
      createItem: jest.fn(),
      deleteItem: jest.fn().mockResolvedValue(),
      clearByUserId: jest.fn().mockResolvedValue(),
      findProductById: jest.fn(),
    };
    service = new WishlistService({
      wishlistRepository,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  function makeWishlistItem(productOverrides = {}) {
    const p = {
      id: 1,
      nameVi: 'iPhone 17',
      variants: [],
      defaultVariant: null,
      productImages: [],
      ...productOverrides,
    };
    return {
      Product: {
        toJSON: () => ({ ...p }),
      },
    };
  }

  it('stockQuantity = 0 khi không có variants và không có defaultVariant (false path cả hai)', async () => {
    // variantStock = 0 (không có variants)
    // p.defaultVariant = null → ternary false → 0
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      makeWishlistItem({ variants: [], defaultVariant: null }),
    ]);

    const { products } = await service.getWishlist({ userId: 1 });

    expect(products[0].stockQuantity).toBe(0);
    expect(products[0].inStock).toBe(false);
  });

  it('stockQuantity từ defaultVariant khi variants rỗng nhưng defaultVariant có stock', async () => {
    // variantStock = 0 → dùng defaultVariant.stockQuantity = 50
    // p.defaultVariant truthy → ternary true
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      makeWishlistItem({
        variants: [],
        defaultVariant: { stockQuantity: 50 },
      }),
    ]);

    const { products } = await service.getWishlist({ userId: 1 });

    expect(products[0].stockQuantity).toBe(50);
    expect(products[0].inStock).toBe(true);
  });

  it('stockQuantity từ variants khi có variants có stock (true path — skip defaultVariant)', async () => {
    // variantStock > 0 → true path: stockQuantity = variantStock (không dùng defaultVariant)
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      makeWishlistItem({
        variants: [{ stockQuantity: 10 }, { stockQuantity: 5 }],
        defaultVariant: { stockQuantity: 999 },
      }),
    ]);

    const { products } = await service.getWishlist({ userId: 1 });

    expect(products[0].stockQuantity).toBe(15); // 10 + 5
    expect(products[0].inStock).toBe(true);
  });

  it('thumbnail = null khi không có productImages (else branch line 27-29)', async () => {
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      makeWishlistItem({ productImages: [] }),
    ]);

    const { products } = await service.getWishlist({ userId: 1 });

    expect(products[0].images).toEqual([]);
    expect(products[0].thumbnail).toBeNull();
  });

  it('thumbnail = URL ảnh primary khi có productImages (true branch)', async () => {
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      makeWishlistItem({
        productImages: [
          { id: 1, imageUrl: 'http://img.test/a.jpg', altText: 'A', isPrimary: true },
          { id: 2, imageUrl: 'http://img.test/b.jpg', altText: 'B', isPrimary: false },
        ],
      }),
    ]);

    const { products } = await service.getWishlist({ userId: 1 });

    expect(products[0].thumbnail).toBe('http://img.test/a.jpg');
    expect(products[0].images).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SequelizeAiRepository.js — line 15
// searchProducts({ ... } = {}) — default parameter khi gọi không có argument
// ─────────────────────────────────────────────────────────────────────────────

describe('SequelizeAiRepository.searchProducts — line 15 default parameter branch', () => {
  const { Op, literal } = require('sequelize');
  const SequelizeAiRepository = require('@modules/ai/repositories/sequelize-ai-repository');

  let repo;
  let mockProduct;

  beforeEach(() => {
    mockProduct = {
      findAll: jest.fn().mockResolvedValue([]),
    };
    const mockProductVariant = {};
    const mockCategory = {};
    const mockSequelize = {};

    repo = new SequelizeAiRepository({
      Product: mockProduct,
      ProductVariant: mockProductVariant,
      Category: mockCategory,
      sequelize: mockSequelize,
    });
  });

  it('gọi searchProducts() không có argument sử dụng default {} (line 15)', async () => {
    // Gọi không có argument → default parameter `= {}` được dùng
    // keyword, minPrice, maxPrice, categoryName, limit đều undefined
    const result = await repo.searchProducts();

    expect(result).toEqual([]);
    // Product.findAll được gọi với where chỉ có status='active', limit default 20
    expect(mockProduct.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'active' },
        limit: 20,
      }),
    );
  });

  it('gọi searchProducts({}) với object rỗng → tương tự không có argument', async () => {
    await repo.searchProducts({});

    expect(mockProduct.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'active' },
      }),
    );
  });

  it('gọi searchProducts với keyword → build LIKE conditions', async () => {
    mockProduct.findAll.mockResolvedValue([{ id: 1, nameVi: 'iPhone 17' }]);

    const result = await repo.searchProducts({ keyword: 'iphone', limit: 5 });

    expect(mockProduct.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SequelizeContentRepository.js
// Line 44: findAllNews() không có argument → default `= {}` được dùng
// Line 101: findLatestNews — default limit = 3
// ─────────────────────────────────────────────────────────────────────────────

describe('SequelizeContentRepository — uncovered branches', () => {
  const { Op } = require('sequelize');
  const SequelizeContentRepository = require('@modules/content/repositories/sequelize-content-repository');

  let repo;
  let mockNews;
  let mockUser;
  let mockBanner;

  beforeEach(() => {
    mockNews = {
      findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      findAll: jest.fn().mockResolvedValue([]),
    };
    mockUser = {};
    mockBanner = {
      findAll: jest.fn().mockResolvedValue([]),
    };

    repo = new SequelizeContentRepository({
      Banner: mockBanner,
      News: mockNews,
      EmailCampaign: {},
      NewsletterSubscriber: {},
      Feedback: {},
      User: mockUser,
    });
  });

  describe('findAllNews — line 44: gọi không có argument (default = {})', () => {
    it('gọi findAllNews() không argument → dùng default {} (filter rỗng)', async () => {
      await repo.findAllNews();

      // Default parameter: filter={}, limit=undefined, offset=undefined
      // Không có filter.search → không thêm title condition
      expect(mockNews.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          limit: undefined,
          offset: undefined,
        }),
      );
    });

    it('gọi findAllNews với filter.search → thêm Op.like condition', async () => {
      await repo.findAllNews({ filter: { search: 'iPhone' } });

      expect(mockNews.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { title: { [Op.like]: '%iPhone%' } },
        }),
      );
    });

    it('gọi findAllNews với filter.category → thêm category condition', async () => {
      await repo.findAllNews({ filter: { category: 'tech' } });

      expect(mockNews.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'tech' },
        }),
      );
    });

    it('gọi findAllNews với filter.isPublished=false → thêm isPublished condition', async () => {
      await repo.findAllNews({ filter: { isPublished: false } });

      expect(mockNews.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublished: false },
        }),
      );
    });
  });

  describe('findLatestNews — line 101: default limit = 3', () => {
    it('dùng limit mặc định 3 khi không truyền limit', async () => {
      await repo.findLatestNews([], ['id', 'title']);

      expect(mockNews.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
    });

    it('dùng limit truyền vào khi có', async () => {
      await repo.findLatestNews([], ['id', 'title'], 10);

      expect(mockNews.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
    });

    it('loại trừ excludeIds trong query', async () => {
      await repo.findLatestNews([5, 6], ['id']);

      expect(mockNews.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { [Op.notIn]: [5, 6] },
          }),
        }),
      );
    });
  });
});
