/**
 * Test isolated cho 2 branch cần vectorStoreService = null:
 * - Line 464: _retrieveProducts khi vectorStoreService null
 * - Line 557: rewriteQuery khi providers rỗng + vectorStoreService null
 *
 * Dùng jest.resetModules() + jest.isolateModules() để require chatbot-service
 * TRƯỚC khi vector-store mock được inject → vectorStoreService = null.
 */

describe('ChatbotService — vectorStoreService = null (isolated module)', () => {
  let service;

  beforeAll(() => {
    jest.resetModules();

    // Mock vector-store trả về null (module không tồn tại / load fail)
    jest.mock('@services/vector-store/vector-store', () => null);

    jest.mock('@models', () => ({
      Product: { findAll: jest.fn().mockResolvedValue([]) },
      Category: { findAll: jest.fn().mockResolvedValue([]) },
      Brand: { findAll: jest.fn().mockResolvedValue([]) },
      ChatMessage: { bulkCreate: jest.fn().mockResolvedValue([]) },
      ProductImage: {},
      ProductVariant: {},
      sequelize: {},
      Op: {},
    }));

    jest.mock('axios');
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    service = require('./chatbot-service');
    service.initialize(require('@models'));
  });

  afterAll(() => {
    jest.resetModules();
  });

  // Line 464: if (!vectorStoreService) return { products: [], finalQuery: enrichedQuery }
  it('_retrieveProducts trả về rỗng ngay khi vectorStoreService = null', async () => {
    const result = await service._retrieveProducts('iphone 15', 'iphone 15');
    expect(result).toEqual({ products: [], finalQuery: 'iphone 15' });
  });

  // Line 557: rewriteQuery — providers rỗng + vectorStoreService null → return null
  it('rewriteQuery trả về null khi providers rỗng và vectorStoreService = null', async () => {
    const original = service.providers;
    service.providers = [];
    const result = await service.rewriteQuery('tìm iphone');
    expect(result).toBeNull();
    service.providers = original;
  });
});
