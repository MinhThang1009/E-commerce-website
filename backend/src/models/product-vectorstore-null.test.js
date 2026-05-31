/**
 * Branch coverage tests cho src/models/product.js
 * Target: lines 332, 365 — `if (vectorStoreService)` FALSE branches
 *
 * vectorStoreService là module-level variable được gán trong try/catch khi load.
 * Để test false path (vectorStoreService = null), cần load product.js trong
 * một module context riêng biệt với vectorStore mock bị throw khi require.
 *
 * Dùng jest.isolateModules để mỗi test có module registry độc lập.
 */

process.env.NODE_ENV = 'test';

describe('Product model: afterUpdate + afterDestroy hooks — vectorStoreService = null (lines 332, 365)', () => {
  // Trong mỗi test, ta sẽ dùng isolateModules để load product.js
  // với vectorStore mock throw → vectorStoreService = null

  function loadProductWithNullVectorStore() {
    let capturedHooks = {};
    let capturedProductInstance;

    jest.isolateModules(() => {
      // Mock logger
      jest.doMock('@utils/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }));

      // Mock vectorStore để throw → catch block → vectorStoreService = null
      jest.doMock('@services/vector-store/vector-store', () => {
        throw new Error('vectorStore unavailable');
      });

      jest.doMock('slugify', () =>
        jest.fn((text) =>
          text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
        ),
      );

      jest.doMock('./category', () => ({}), { virtual: true });
      jest.doMock('./product-image', () => ({}), { virtual: true });

      // Mock sequelize để capture hooks
      capturedProductInstance = {
        findByPk: jest.fn(),
      };
      jest.doMock('@config/sequelize', () => ({
        define: jest.fn((_modelName, _fields, opts) => {
          if (opts && opts.hooks) {
            capturedHooks = { ...opts.hooks };
          }
          return capturedProductInstance;
        }),
      }));

      // Load product — vectorStoreService sẽ là null vì mock throw
      require('./product');
    });

    return { capturedHooks, capturedProductInstance };
  }

  // ── afterUpdate: vectorStoreService = null → không làm gì (false branch) ──

  describe('afterUpdate hook — vectorStoreService null → skip (line 332 false branch)', () => {
    it('không throw và không tương tác với vectorStore khi vectorStoreService null', async () => {
      const { capturedHooks } = loadProductWithNullVectorStore();

      // afterUpdate với status active — nếu vectorStoreService null, không làm gì
      await expect(capturedHooks.afterUpdate({ id: 1, status: 'active' })).resolves.toBeUndefined();
    });

    it('không throw khi status inactive và vectorStoreService null', async () => {
      const { capturedHooks } = loadProductWithNullVectorStore();

      // status inactive — nếu vectorStoreService null, if block không chạy
      await expect(
        capturedHooks.afterUpdate({ id: 2, status: 'inactive' }),
      ).resolves.toBeUndefined();
    });
  });

  // ── afterDestroy: vectorStoreService = null → không làm gì (false branch) ──

  describe('afterDestroy hook — vectorStoreService null → skip (line 365 false branch)', () => {
    it('không throw và không tương tác với vectorStore khi vectorStoreService null', async () => {
      const { capturedHooks } = loadProductWithNullVectorStore();

      await expect(capturedHooks.afterDestroy({ id: 5 })).resolves.toBeUndefined();
    });

    it('afterDestroy với bất kỳ productId → không crash khi vectorStoreService null', async () => {
      const { capturedHooks } = loadProductWithNullVectorStore();

      await expect(capturedHooks.afterDestroy({ id: 999 })).resolves.toBeUndefined();
    });
  });

  // ── afterBulkDestroy: vectorStoreService = null → return sớm (line 424 false branch) ──

  describe('afterBulkDestroy hook — vectorStoreService null → skip (line 424 false branch)', () => {
    it('không throw và không làm gì khi vectorStoreService null', async () => {
      const { capturedHooks } = loadProductWithNullVectorStore();

      await expect(capturedHooks.afterBulkDestroy()).resolves.toBeUndefined();
    });
  });
});
