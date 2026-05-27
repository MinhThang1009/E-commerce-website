/**
 * @file vectorStore.test.js
 * @description Tests cho HybridVectorStore — unified embedding (Jina v3 / e5-instruct / e5-base, 1024d).
 */
// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Giả lập unified embeddingService
const mockEnEmbed = jest.fn();
jest.mock('@services/embedding/unified-embedding', () => ({
  generateEmbedding: mockEnEmbed,
  activeName: 'mock-model',
}));

// Giả lập fs — kiểm soát existsSync và readFile/writeFile
const mockExistsSync = jest.fn();
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();
const mockMkdirSync = jest.fn();

jest.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  mkdirSync: (...args) => mockMkdirSync(...args),
  promises: {
    readFile: (...args) => mockReadFile(...args),
    writeFile: (...args) => mockWriteFile(...args),
  },
}));

// ── Build một vector có N chiều với giá trị 1/sqrt(N) để có norm=1 ──────────
function makeVector(dims, value = null) {
  const v = value !== null ? value : 1 / Math.sqrt(dims);
  return Array(dims).fill(v);
}
// Unified model: Jina v3 / e5-instruct / e5-base — all 1024d
const EXPECTED_DIM = 1024;

// ── Khởi tạo module ──────────────────────────────────────────────────────────
// Phải require SAU khi mock đã đặt (jest.mock hoist lên trên, nhưng ta cần
// control state của mockExistsSync trước khi constructor chạy)

describe('HybridVectorStore — load()', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Re-mock sau resetModules
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: jest.fn(),
      activeName: 'mock-model',
    }));
  });

  it('load từ file JSON hợp lệ → this.items chứa dữ liệu', async () => {
    const sampleItems = [{ vector: [1, 2], metadata: { id: 1, name: 'A' } }];
    const mockFs = {
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn().mockResolvedValue(JSON.stringify(sampleItems)),
        writeFile: jest.fn(),
      },
    };
    jest.mock('fs', () => mockFs);

    const store = require('./vector-store');
    await store.loadPromise;

    expect(store.items).toHaveLength(1);
    expect(store.items[0].metadata.id).toBe(1);
  });

  it('file không tồn tại → items rỗng, không throw', async () => {
    const mockFs = {
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
      },
    };
    jest.mock('fs', () => mockFs);

    const store = require('./vector-store');
    await store.loadPromise;

    expect(store.items).toEqual([]);
  });

  it('file tồn tại nhưng nội dung rỗng → items rỗng', async () => {
    const mockFs = {
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn().mockResolvedValue(''),
        writeFile: jest.fn(),
      },
    };
    jest.mock('fs', () => mockFs);

    const store = require('./vector-store');
    await store.loadPromise;

    expect(store.items).toEqual([]);
  });

  it('file chứa JSON invalid → items rỗng, không throw', async () => {
    const mockFs = {
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn().mockResolvedValue('{ broken json '),
        writeFile: jest.fn(),
      },
    };
    jest.mock('fs', () => mockFs);

    const store = require('./vector-store');
    await store.loadPromise;

    expect(store.items).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Để test logic thuần (cosineSimilarity, clear, enrichProductData) mà không cần
// fs phức tạp, ta instantiate fresh class bằng cách extract và test direct.

describe('cosineSimilarity (thuật toán thuần)', () => {
  // Reset modules và lấy instance mới với fs-mock đơn giản
  let store;

  beforeAll(async () => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: jest.fn(),
      activeName: 'mock-model',
    }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn().mockResolvedValue(''),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    store = require('./vector-store');
    await store.loadPromise;
  });

  it('hai vector giống hệt → similarity = 1', () => {
    const v = makeVector(4, 1);
    expect(store.cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('hai vector trực giao (dot product = 0) → similarity = 0', () => {
    const v1 = [1, 0, 0, 0];
    const v2 = [0, 1, 0, 0];
    expect(store.cosineSimilarity(v1, v2)).toBe(0);
  });

  it('vector null → trả về 0 (không throw)', () => {
    expect(store.cosineSimilarity(null, [1, 2])).toBe(0);
    expect(store.cosineSimilarity([1, 2], null)).toBe(0);
  });

  it('hai vector null → trả về 0', () => {
    expect(store.cosineSimilarity(null, null)).toBe(0);
  });

  it('chiều khác nhau → trả về 0', () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0];
    expect(store.cosineSimilarity(v1, v2)).toBe(0);
  });

  it('vector zero (tất cả phần tử = 0) → magnitude = 0 → trả về 0', () => {
    const zero = [0, 0, 0, 0];
    expect(store.cosineSimilarity(zero, [1, 2, 3, 4])).toBe(0);
  });

  it('vector toàn NaN → kết quả là 0 (không phải NaN)', () => {
    const nanVec = [NaN, NaN];
    const result = store.cosineSimilarity(nanVec, nanVec);
    expect(result).toBe(0);
  });

  it('similarity với edge case Number.MAX_VALUE → không bao giờ NaN', () => {
    const v1 = new Array(4).fill(Number.MAX_VALUE / 2);
    const v2 = new Array(4).fill(Number.MAX_VALUE / 2);
    const result = store.cosineSimilarity(v1, v2);
    // Kết quả phải là 0 hoặc 1 (finite) — không bao giờ là NaN
    expect(isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('clear()', () => {
  let store;

  beforeAll(async () => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: jest.fn(),
      activeName: 'mock-model',
    }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    store = require('./vector-store');
    await store.loadPromise;
  });

  it('xóa toàn bộ items sau khi đã thêm', () => {
    store.items = [{ vector: [1], metadata: { id: 1 } }];
    store.clear();
    expect(store.items).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('upsertProduct()', () => {
  let store;
  let mockEn;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    mockEn = jest.fn().mockResolvedValue(makeVector(EXPECTED_DIM));

    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: mockEn,
      activeName: 'mock-model',
    }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    store = require('./vector-store');
    await store.loadPromise;
  });

  it('thêm sản phẩm hợp lệ → items.length tăng lên 1', async () => {
    const product = {
      id: 1,
      name: 'Laptop',
      slug: 'laptop',
      basePrice: 10000000,
      status: 'active',
    };

    await store.upsertProduct(product);

    expect(store.items).toHaveLength(1);
    expect(store.items[0].metadata.id).toBe(1);
    expect(store.items[0].metadata.name).toBe('Laptop');
    expect(store.items[0].vector).toHaveLength(EXPECTED_DIM);
  });

  it('thêm cùng productId lần 2 → cập nhật, không tạo duplicate', async () => {
    const product = {
      id: 5,
      name: 'Laptop',
      slug: 'laptop-5',
      basePrice: 5000000,
      status: 'active',
    };

    await store.upsertProduct(product);
    await store.upsertProduct({ ...product, name: 'Laptop Updated' });

    expect(store.items).toHaveLength(1);
    expect(store.items[0].metadata.name).toBe('Laptop Updated');
  });

  it('vector có chiều sai → throw Error (dimension mismatch)', async () => {
    mockEn.mockResolvedValue(makeVector(128)); // wrong dim

    const product = { id: 2, name: 'Phone', slug: 'phone', basePrice: 2000000 };

    await expect(store.upsertProduct(product)).rejects.toThrow(/sai chiều/);
  });

  it('vector là null → throw Error', async () => {
    mockEn.mockResolvedValue(null);

    const product = { id: 3, name: 'Mouse', slug: 'mouse', basePrice: 500000 };

    await expect(store.upsertProduct(product)).rejects.toThrow();
  });

  it('embeddingService throw → upsert reject với cùng error', async () => {
    mockEn.mockRejectedValue(new Error('API down'));

    const product = { id: 9, name: 'Sản phẩm', slug: 'sp', basePrice: 1000000 };

    await expect(store.upsertProduct(product)).rejects.toThrow('API down');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('search()', () => {
  let store;
  let mockEn;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    mockEn = jest.fn().mockResolvedValue(makeVector(EXPECTED_DIM));

    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: mockEn,
      activeName: 'mock-model',
    }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    store = require('./vector-store');
    await store.loadPromise;
  });

  it('store rỗng → trả về mảng rỗng', async () => {
    const results = await store.hybridSearch('laptop');
    expect(results).toEqual([]);
  });

  it('kết quả có score >= 0.45 → được trả về', async () => {
    // Đặt item với vector giống query vector → similarity = 1
    const queryVec = makeVector(EXPECTED_DIM);
    mockEn.mockResolvedValue(queryVec);

    store.items = [
      {
        vector: queryVec,
        text: 'laptop',
        metadata: { id: 1, name: 'Laptop' },
      },
    ];

    const results = await store.hybridSearch('laptop');
    expect(results).toHaveLength(1);
    expect(results[0].score).toBeCloseTo(1);
  });

  it('kết quả có score < 0.45 → bị lọc bỏ', async () => {
    // Query vector trực giao với item vector → similarity = 0
    const queryVec = Array(EXPECTED_DIM).fill(0);
    queryVec[0] = 1;
    mockEn.mockResolvedValue(queryVec);

    const itemVec = Array(EXPECTED_DIM).fill(0);
    itemVec[1] = 1; // trực giao
    store.items = [
      {
        vector: itemVec,
        text: 'chair',
        metadata: { id: 2, name: 'Chair' },
      },
    ];

    const results = await store.hybridSearch('lamp');
    expect(results).toEqual([]);
  });

  it('limit mặc định 5 → trả về tối đa 5 kết quả', async () => {
    const queryVec = makeVector(EXPECTED_DIM);
    mockEn.mockResolvedValue(queryVec);

    // 8 items giống query vector
    store.items = Array.from({ length: 8 }, (_, i) => ({
      vector: queryVec,
      text: `item ${i}`,
      metadata: { id: i, name: `Item ${i}` },
    }));

    const results = await store.hybridSearch('test');
    expect(results).toHaveLength(5);
  });

  it('limit tùy chỉnh được tôn trọng', async () => {
    const queryVec = makeVector(EXPECTED_DIM);
    mockEn.mockResolvedValue(queryVec);

    store.items = Array.from({ length: 8 }, (_, i) => ({
      vector: queryVec,
      text: `item ${i}`,
      metadata: { id: i, name: `Item ${i}` },
    }));

    const results = await store.hybridSearch('test', 3);
    expect(results).toHaveLength(3);
  });

  it('embeddingService throw → trả về mảng rỗng (không propagate lỗi)', async () => {
    mockEn.mockRejectedValue(new Error('API down'));
    // Cần ít nhất 1 item để hybridSearch không trả về [] sớm trước khi gọi embedding
    store.items = [
      {
        vector: makeVector(EXPECTED_DIM),
        text: 'laptop',
        metadata: { id: 1, name: 'Laptop' },
      },
    ];

    const results = await store.hybridSearch('query');
    expect(results).toEqual([]);
  });

  it('item lưu field cũ "vectorEn" → vẫn search được nhờ backward-compat fallback', async () => {
    const queryVec = makeVector(EXPECTED_DIM);
    mockEn.mockResolvedValue(queryVec);

    // Item kiểu cũ (trước migration): không có field vector, chỉ có vectorEn
    store.items = [
      {
        vectorEn: queryVec,
        text: 'legacy item',
        metadata: { id: 99, name: 'Legacy' },
      },
    ];

    const results = await store.hybridSearch('legacy');
    expect(results).toHaveLength(1);
    expect(results[0].score).toBeCloseTo(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// save() — lines 57-68: ghi file, tạo thư mục nếu chưa có, catch error
// ─────────────────────────────────────────────────────────────────────────────

describe('save()', () => {
  let store;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: jest.fn(),
      activeName: 'mock-model',
    }));
  });

  it('thư mục đã tồn tại → writeFile được gọi với JSON items, mkdirSync KHÔNG được gọi', async () => {
    const mockSaveWriteFile = jest.fn().mockResolvedValue(undefined);
    const mockSaveExistsSync = jest.fn().mockReturnValue(true); // thư mục đã có
    const mockSaveMkdirSync = jest.fn();

    jest.mock('fs', () => ({
      existsSync: (...args) => mockSaveExistsSync(...args),
      mkdirSync: (...args) => mockSaveMkdirSync(...args),
      promises: {
        readFile: jest.fn().mockResolvedValue(''),
        writeFile: (...args) => mockSaveWriteFile(...args),
      },
    }));

    store = require('./vector-store');
    await store.loadPromise;

    store.items = [{ vector: [1, 2], metadata: { id: 10, name: 'Test' } }];

    await store.save();

    expect(mockSaveWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"id": 10'),
    );
    expect(mockSaveMkdirSync).not.toHaveBeenCalled();
  });

  it('thư mục chưa tồn tại → mkdirSync được gọi trước khi ghi file', async () => {
    const mockSaveWriteFile2 = jest.fn().mockResolvedValue(undefined);
    const mockSaveExistsSync2 = jest.fn().mockReturnValue(false); // thư mục chưa có
    const mockSaveMkdirSync2 = jest.fn();

    jest.mock('fs', () => ({
      existsSync: (...args) => mockSaveExistsSync2(...args),
      mkdirSync: (...args) => mockSaveMkdirSync2(...args),
      promises: {
        readFile: jest.fn().mockResolvedValue(''),
        writeFile: (...args) => mockSaveWriteFile2(...args),
      },
    }));

    store = require('./vector-store');
    await store.loadPromise;

    await store.save();

    expect(mockSaveMkdirSync2).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ recursive: true }),
    );
    expect(mockSaveWriteFile2).toHaveBeenCalled();
  });

  it('writeFile throw → ghi error log, không re-throw — covers catch block', async () => {
    const mockSaveWriteFile3 = jest.fn().mockRejectedValue(new Error('EACCES: permission denied'));
    const mockLogger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

    jest.mock('@utils/logger', () => mockLogger);
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn().mockResolvedValue(''),
        writeFile: (...args) => mockSaveWriteFile3(...args),
      },
    }));

    store = require('./vector-store');
    await store.loadPromise;

    // Không throw
    await expect(store.save()).resolves.not.toThrow();

    expect(mockLogger.error).toHaveBeenCalledWith('Lỗi khi lưu vector store:', expect.any(Error));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Branch coverage cho buildEmbeddingText (tested gián tiếp qua upsertProduct)
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildEmbeddingText — uncovered branches', () => {
  let store;
  let mockEn;

  beforeEach(async () => {
    jest.resetModules();

    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    mockEn = jest.fn().mockResolvedValue(makeVector(EXPECTED_DIM));
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: mockEn,
      activeName: 'mock-model',
    }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    store = require('./vector-store');
    await store.loadPromise;
  });

  it('baseName falsy (undefined) → phần "Thương hiệu: ..." bị bỏ qua', async () => {
    const product = {
      id: 1,
      name: 'iPhone 15',
      // baseName: undefined → '' → filter(Boolean) loại bỏ
      categories: [],
      shortDescription: 'Flagship',
      description: undefined, // falsy
      basePrice: 20000000,
      inStock: true,
    };

    await expect(store.upsertProduct(product)).resolves.not.toThrow();

    const embedCallArg = mockEn.mock.calls[0][0];
    expect(embedCallArg).not.toContain('Thương hiệu:');
    expect(embedCallArg).toContain('iPhone 15');
  });

  it('description falsy → phần description bị bỏ qua', async () => {
    const product = {
      id: 2,
      name: 'Samsung Galaxy',
      baseName: 'Samsung',
      categories: [],
      shortDescription: 'Android',
      description: null, // null → falsy → '' → bị filter(Boolean) bỏ
      basePrice: 15000000,
      inStock: true,
    };

    await expect(store.upsertProduct(product)).resolves.not.toThrow();
    expect(mockEn).toHaveBeenCalled();
  });

  it('basePrice falsy (0 / undefined) → phần "Giá: ..." bị bỏ qua', async () => {
    const product = {
      id: 3,
      name: 'Free Product',
      baseName: undefined,
      categories: [],
      shortDescription: 'Miễn phí',
      description: undefined,
      basePrice: 0, // 0 → falsy → '' → bị filter(Boolean) bỏ
      inStock: true,
    };

    await expect(store.upsertProduct(product)).resolves.not.toThrow();
    const embedCallArg = mockEn.mock.calls[0][0];
    expect(embedCallArg).not.toContain('Giá:');
  });

  it('inStock undefined + stockQuantity > 0 → "Còn hàng"', async () => {
    const product = {
      id: 4,
      name: 'Mystery Product',
      baseName: undefined,
      categories: [],
      shortDescription: undefined,
      description: undefined,
      basePrice: 5000000,
      // inStock: undefined → dùng stockQuantity > 0
      stockQuantity: 10, // > 0 → true → 'Còn hàng'
    };

    await expect(store.upsertProduct(product)).resolves.not.toThrow();
    const embedCallArg = mockEn.mock.calls[0][0];
    expect(embedCallArg).toContain('Còn hàng');
  });

  it('inStock undefined + stockQuantity = 0 → "Hết hàng"', async () => {
    const product = {
      id: 5,
      name: 'Sold Out Product',
      baseName: undefined,
      categories: [],
      shortDescription: undefined,
      description: undefined,
      basePrice: 3000000,
      // inStock: undefined, stockQuantity = 0 → false → 'Hết hàng'
      stockQuantity: 0,
    };

    await expect(store.upsertProduct(product)).resolves.not.toThrow();
    const embedCallArg = mockEn.mock.calls[0][0];
    expect(embedCallArg).toContain('Hết hàng');
  });

  it('categories[0].name undefined → phần "Danh mục: ..." bị bỏ qua', async () => {
    const product = {
      id: 6,
      name: 'No Category Product',
      baseName: 'Brand X',
      categories: [], // empty → categories?.[0]?.name = undefined → '' → bị filter
      shortDescription: 'Test',
      description: undefined,
      basePrice: 1000000,
      inStock: true,
    };

    await expect(store.upsertProduct(product)).resolves.not.toThrow();
    const embedCallArg = mockEn.mock.calls[0][0];
    expect(embedCallArg).not.toContain('Danh mục:');
  });

  it('categories[0].name truthy → "Danh mục: ..." được đưa vào text', async () => {
    const product = {
      id: 10,
      name: 'iPhone 15',
      baseName: undefined,
      categories: [{ name: 'Điện thoại' }], // truthy → "Danh mục: Điện thoại"
      shortDescription: undefined,
      description: undefined,
      basePrice: 20000000,
      inStock: true,
    };

    await store.upsertProduct(product);
    const embedArg = mockEn.mock.calls[0][0];
    expect(embedArg).toContain('Danh mục: Điện thoại');
  });

  it('description truthy → được strip HTML và thêm vào text', async () => {
    const product = {
      id: 11,
      name: 'Samsung Galaxy',
      baseName: undefined,
      categories: [],
      shortDescription: undefined,
      description: '<p>Mô tả sản phẩm tốt</p>', // truthy → strip HTML → "Mô tả sản phẩm tốt"
      basePrice: 15000000,
      inStock: true,
    };

    await store.upsertProduct(product);
    const embedArg = mockEn.mock.calls[0][0];
    expect(embedArg).toContain('Mô tả sản phẩm tốt');
    expect(embedArg).not.toContain('<p>');
  });
});

// ── cosineSimilarity — !isFinite guard ────────────────────────────────────────

describe('HybridVectorStore.cosineSimilarity — !isFinite guards', () => {
  let store;

  beforeAll(async () => {
    jest.resetModules();

    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: jest.fn(),
      activeName: 'mock-model',
    }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    store = require('./vector-store');
    await store.loadPromise;
  });

  it('vector chứa Infinity → magnitude Infinity → return 0', () => {
    const v1 = [Infinity];
    const v2 = [1];
    expect(store.cosineSimilarity(v1, v2)).toBe(0);
  });

  it('vector toàn NaN vs vector thường → return 0', () => {
    const vNaN = Array(4).fill(NaN);
    const vNormal = [1, 0, 0, 0];
    expect(store.cosineSimilarity(vNaN, vNormal)).toBe(0);
  });
});

// ── hybridSearch — boost overlap, inject keyword-only results ─────────────────

describe('hybridSearch — boost & inject branches', () => {
  let store;
  let mockEn;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    const mockLogger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    jest.mock('@utils/logger', () => mockLogger);

    mockEn = jest.fn();
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: mockEn,
      activeName: 'mock-model',
    }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    store = require('./vector-store');
    await store.loadPromise;
  });

  it('item match cả vector lẫn keyword → score được boost +0.05', async () => {
    const queryVec = makeVector(EXPECTED_DIM);
    mockEn.mockResolvedValue(queryVec);

    store.items = [
      {
        vector: queryVec,
        text: 'iphone 15 pro',
        metadata: { id: 99, name: 'iPhone 15 Pro' },
      },
    ];

    const results = await store.hybridSearch('iphone 15 pro', 5, 0);
    expect(results.length).toBeGreaterThan(0);
    // Score boosted (cosine = 1, boost +0.05 → capped at 1)
    expect(results[0].score).toBeCloseTo(1);
  });

  it('keyword finds item mà vector miss → injected với lowConfidence flag', async () => {
    const mockLogger = require('@utils/logger');

    // Query vector orthogonal với item vector → vector search miss
    const queryVec = Array(EXPECTED_DIM).fill(0);
    queryVec[0] = 1;
    mockEn.mockResolvedValue(queryVec);

    const itemVec = Array(EXPECTED_DIM).fill(0);
    itemVec[1] = 1; // trực giao với query

    store.items = [
      {
        vector: itemVec,
        text: 'samsung galaxy tab a9',
        metadata: { id: 50, name: 'Samsung Galaxy Tab A9' },
      },
    ];

    // minScore cao để vector miss item
    const results = await store.hybridSearch('samsung galaxy tab', 5, 0.5);

    // Keyword tìm thấy → injected
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].lowConfidence).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[HYBRID] Injected'));
  });
});

// ── _keywordSearch — edge cases ───────────────────────────────────────────────

describe('_keywordSearch — empty query và edge cases', () => {
  let store;

  beforeAll(async () => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: jest.fn(),
      activeName: 'mock-model',
    }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: { readFile: jest.fn(), writeFile: jest.fn().mockResolvedValue(undefined) },
    }));

    store = require('./vector-store');
    await store.loadPromise;
  });

  afterEach(() => {
    store.items = [];
  });

  it('trả về [] khi query rỗng', () => {
    store.items = [{ metadata: { id: 1, name: 'iPhone 15' }, text: 'iphone' }];
    expect(store._keywordSearch('')).toEqual([]);
  });

  it('trả về [] khi query chỉ có ký tự đặc biệt', () => {
    store.items = [{ metadata: { id: 1, name: 'iPhone 15' }, text: 'iphone' }];
    expect(store._keywordSearch('!!!???')).toEqual([]);
  });

  it('xử lý item không có metadata.name → || "" fallback', () => {
    store.items = [{ metadata: { id: 1 }, text: 'iPhone 15 laptop' }];
    const result = store._keywordSearch('iphone');
    expect(Array.isArray(result)).toBe(true);
  });

  it('item không có text → text||"" fallback và inText=false (chỉ match qua name)', () => {
    // item.text undefined → cover line 163 false branch của || ''
    // token 'iphone' match name nhưng không match text → cover inText=false branch của line 172
    store.items = [{ metadata: { id: 1, name: 'iPhone Pro' }, text: undefined }];
    const result = store._keywordSearch('iphone');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].keywordScore).toBeGreaterThan(0);
  });

  it('sort callback gọi khi có 2+ results', () => {
    store.items = [
      {
        metadata: { id: 1, name: 'iPhone 15' },
        text: 'iPhone 15 Pro Max',
      },
      {
        metadata: { id: 2, name: 'Samsung Galaxy' },
        text: 'Samsung Galaxy S24',
      },
    ];
    const result = store._keywordSearch('iphone samsung', 10);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── cosineSimilarity additional edge cases ────────────────────────────────────

describe('cosineSimilarity — additional edge cases', () => {
  let store;

  beforeAll(async () => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: jest.fn(),
      activeName: 'mock-model',
    }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: { readFile: jest.fn(), writeFile: jest.fn().mockResolvedValue(undefined) },
    }));
    store = require('./vector-store');
    await store.loadPromise;
  });

  it('trả về 0 khi vectors zero (magnitude = 0)', () => {
    expect(store.cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
  });

  it('trả về 0 khi vector chứa NaN', () => {
    expect(store.cosineSimilarity([NaN, 1, 0], [1, 1, 0])).toBe(0);
  });

  it('trả về 0 khi vectors có độ dài khác nhau', () => {
    expect(store.cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });

  it('trả về 1.0 khi 2 vectors giống hệt nhau', () => {
    const v = [0.6, 0.8];
    expect(store.cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildEmbeddingText — variants, specifications, productSpecifications, tags
// Lines 87-100, 116-121, 264-271
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildEmbeddingText — variants & specs branches', () => {
  let store;
  let mockEn;

  beforeEach(async () => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    mockEn = jest.fn().mockResolvedValue(makeVector(EXPECTED_DIM));
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: mockEn,
      activeName: 'mock-model',
    }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn(),
      readFileSync: jest.fn().mockReturnValue('{}'),
      promises: { readFile: jest.fn(), writeFile: jest.fn().mockResolvedValue(undefined) },
    }));
    store = require('./vector-store');
    await store.loadPromise;
  });

  it('product có variants với variantName, color, storage → text chứa Phiên bản, Màu, Cấu hình', async () => {
    const product = {
      id: 100,
      name: 'iPhone 15',
      slug: 'iphone-15',
      basePrice: 25000000,
      inStock: true,
      variants: [
        {
          variantName: '128GB Xanh',
          displayName: '128GB',
          attributes: { color: 'Xanh', 'Màu sắc': 'Xanh', storage: '128GB', 'Dung lượng': '128GB' },
        },
        {
          variantName: '256GB Đỏ',
          displayName: '256GB',
          attributes: { color: 'Đỏ', 'Màu sắc': 'Đỏ', storage: '256GB', 'Dung lượng': '256GB' },
        },
      ],
    };
    await store.upsertProduct(product);
    const text = mockEn.mock.calls[0][0];
    expect(text).toContain('Phiên bản:');
    expect(text).toContain('Màu:');
    expect(text).toContain('Cấu hình:');
  });

  it('variants rỗng → không thêm phần Phiên bản/Màu/Cấu hình', async () => {
    const product = {
      id: 101,
      name: 'Mouse',
      slug: 'mouse',
      basePrice: 500000,
      inStock: true,
      variants: [],
    };
    await store.upsertProduct(product);
    const text = mockEn.mock.calls[0][0];
    expect(text).not.toContain('Phiên bản:');
  });

  it('variants chỉ có variantName, không có color/storage', async () => {
    const product = {
      id: 102,
      name: 'Laptop',
      slug: 'laptop',
      basePrice: 20000000,
      inStock: true,
      variants: [{ variantName: 'i7 16GB', attributes: {} }],
    };
    await store.upsertProduct(product);
    const text = mockEn.mock.calls[0][0];
    expect(text).toContain('Phiên bản:');
    expect(text).not.toContain('Màu:');
    expect(text).not.toContain('Cấu hình:');
  });

  it('product có specifications object → text chứa "Thông số:"', async () => {
    const product = {
      id: 103,
      name: 'Phone',
      slug: 'phone',
      basePrice: 10000000,
      inStock: true,
      specifications: { pin: '4000mAh', ram: '8GB' },
    };
    await store.upsertProduct(product);
    const text = mockEn.mock.calls[0][0];
    expect(text).toContain('Thông số:');
    expect(text).toContain('pin: 4000mAh');
  });

  it('specifications rỗng hoặc không phải object → bỏ qua', async () => {
    const product = {
      id: 104,
      name: 'Phone2',
      slug: 'phone2',
      basePrice: 10000000,
      inStock: true,
      specifications: {},
    };
    await store.upsertProduct(product);
    const text = mockEn.mock.calls[0][0];
    expect(text).not.toContain('Thông số:');
  });

  it('product có productSpecifications array → text chứa spec values', async () => {
    const product = {
      id: 105,
      name: 'Tablet',
      slug: 'tablet',
      basePrice: 8000000,
      inStock: true,
      productSpecifications: [
        { name: 'Màn hình', value: '10 inch', valueEn: '10 inch' },
        { name: 'Pin', value: '7000mAh', valueEn: '7000mAh battery' },
      ],
    };
    await store.upsertProduct(product);
    const text = mockEn.mock.calls[0][0];
    expect(text).toContain('Màn hình 10 inch');
    // valueEn khác value → append
    expect(text).toContain('7000mAh battery');
  });

  it('productSpecifications với valueEn === value → không duplicate', async () => {
    const product = {
      id: 106,
      name: 'Watch',
      slug: 'watch',
      basePrice: 3000000,
      inStock: true,
      productSpecifications: [{ name: 'Pin', value: '300mAh', valueEn: '300mAh' }],
    };
    await store.upsertProduct(product);
    const text = mockEn.mock.calls[0][0];
    expect(text).toContain('Pin 300mAh');
    // valueEn === value → không thêm " 300mAh" lần 2
    expect(text).not.toContain('300mAh 300mAh');
  });

  it('tags array → text chứa "Tags:"', async () => {
    const product = {
      id: 107,
      name: 'Gaming',
      slug: 'gaming',
      basePrice: 30000000,
      inStock: true,
      tags: ['gaming', 'pro', 'mới'],
    };
    await store.upsertProduct(product);
    const text = mockEn.mock.calls[0][0];
    expect(text).toContain('Tags:');
    expect(text).toContain('gaming');
  });

  it('nameEn khác name → text chứa cả hai', async () => {
    const product = {
      id: 108,
      name: 'Điện thoại iPhone',
      nameEn: 'iPhone Phone',
      slug: 'dt-iphone',
      basePrice: 25000000,
      inStock: true,
    };
    await store.upsertProduct(product);
    const text = mockEn.mock.calls[0][0];
    expect(text).toContain('Điện thoại iPhone');
    expect(text).toContain('iPhone Phone');
  });

  it('nameEn === name → không duplicate', async () => {
    const product = {
      id: 109,
      name: 'iPhone 15',
      nameEn: 'iPhone 15',
      slug: 'iphone-15',
      basePrice: 25000000,
      inStock: true,
    };
    await store.upsertProduct(product);
    const text = mockEn.mock.calls[0][0];
    const count = (text.match(/iPhone 15/g) || []).length;
    expect(count).toBe(1);
  });

  it('model truthy → text chứa "Model:"', async () => {
    const product = {
      id: 110,
      name: 'MacBook',
      model: 'MBP-M3-2024',
      slug: 'macbook',
      basePrice: 40000000,
      inStock: true,
    };
    await store.upsertProduct(product);
    const text = mockEn.mock.calls[0][0];
    expect(text).toContain('Model: MBP-M3-2024');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// setSpecKeyMap + _localizeSpecKey — Lines 137-146
// ═══════════════════════════════════════════════════════════════════════════════

describe('setSpecKeyMap & _localizeSpecKey', () => {
  let store;
  let mockWriteFileSync;

  beforeEach(async () => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: jest.fn(),
      activeName: 'mock-model',
    }));
    mockWriteFileSync = jest.fn();
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      writeFileSync: mockWriteFileSync,
      readFileSync: jest.fn().mockReturnValue('{}'),
      promises: { readFile: jest.fn(), writeFile: jest.fn().mockResolvedValue(undefined) },
    }));
    store = require('./vector-store');
    await store.loadPromise;
  });

  it('setSpecKeyMap lưu map và persist ra file', () => {
    store.setSpecKeyMap({ battery: 'Pin', ram: 'Bộ nhớ' });
    expect(store._specKeyMap).toEqual({ battery: 'Pin', ram: 'Bộ nhớ' });
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('setSpecKeyMap(null) → map rỗng', () => {
    store.setSpecKeyMap(null);
    expect(store._specKeyMap).toEqual({});
  });

  it('setSpecKeyMap khi writeFileSync throw → bỏ qua lỗi (catch block)', () => {
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('EACCES');
    });
    expect(() => store.setSpecKeyMap({ a: 'b' })).not.toThrow();
    expect(store._specKeyMap).toEqual({ a: 'b' });
  });

  it('_localizeSpecKey trả tiếng Việt nếu có map', () => {
    store._specKeyMap = { battery: 'Pin' };
    expect(store._localizeSpecKey('battery')).toBe('Pin');
  });

  it('_localizeSpecKey fallback snake→space nếu không có map', () => {
    store._specKeyMap = {};
    expect(store._localizeSpecKey('screen_size')).toBe('screen size');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// upsertProduct — metadata specifications & variants (Lines 264-271)
// ═══════════════════════════════════════════════════════════════════════════════

describe('upsertProduct — metadata specs & variants', () => {
  let store;
  let mockEn;

  beforeEach(async () => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    mockEn = jest.fn().mockResolvedValue(makeVector(EXPECTED_DIM));
    jest.mock('@services/embedding/unified-embedding', () => ({
      generateEmbedding: mockEn,
      activeName: 'mock-model',
    }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn(),
      readFileSync: jest.fn().mockReturnValue('{}'),
      promises: { readFile: jest.fn(), writeFile: jest.fn().mockResolvedValue(undefined) },
    }));
    store = require('./vector-store');
    await store.loadPromise;
  });

  it('metadata.specifications kết hợp JSON specs + productSpecifications', async () => {
    store._specKeyMap = { battery: 'Pin' };
    const product = {
      id: 200,
      name: 'Phone',
      slug: 'phone',
      basePrice: 10000000,
      inStock: true,
      specifications: { battery: '4000mAh' },
      productSpecifications: [{ name: 'RAM', value: '8GB', valueEn: '8GB RAM' }],
    };
    await store.upsertProduct(product);
    const item = store.items[0];
    expect(item.metadata.specifications).toContain('Pin: 4000mAh');
    expect(item.metadata.specifications).toContain('RAM: 8GB (8GB RAM)');
  });

  it('metadata.variants lưu đúng cấu trúc', async () => {
    const product = {
      id: 201,
      name: 'Laptop',
      slug: 'laptop',
      basePrice: 20000000,
      inStock: true,
      variants: [
        {
          variantName: 'i7 16GB',
          displayName: 'Core i7',
          price: 25000000,
          compareAtPrice: 28000000,
          stockQuantity: 5,
          isDefault: true,
          attributes: { ram: '16GB' },
        },
      ],
    };
    await store.upsertProduct(product);
    const v = store.items[0].metadata.variants[0];
    expect(v.variantName).toBe('i7 16GB');
    expect(v.displayName).toBe('Core i7');
    expect(v.price).toBe(25000000);
    expect(v.compareAtPrice).toBe(28000000);
    expect(v.stockQuantity).toBe(5);
    expect(v.isDefault).toBe(true);
    expect(v.attributes).toEqual({ ram: '16GB' });
  });

  it('metadata lưu ratingAverage, shortDescriptionEn, description stripped HTML', async () => {
    const product = {
      id: 202,
      name: 'Watch',
      slug: 'watch',
      basePrice: 5000000,
      inStock: true,
      ratingAverage: 4.5,
      shortDescriptionEn: 'Smart watch',
      description: '<b>Bold desc</b>',
    };
    await store.upsertProduct(product);
    const m = store.items[0].metadata;
    expect(m.ratingAverage).toBe(4.5);
    expect(m.shortDescriptionEn).toBe('Smart watch');
    expect(m.description).toBe('Bold desc');
    expect(m.description).not.toContain('<b>');
  });

  it('product không có variants → metadata.variants = []', async () => {
    const product = { id: 203, name: 'Simple', slug: 'simple', basePrice: 1000000, inStock: true };
    await store.upsertProduct(product);
    expect(store.items[0].metadata.variants).toEqual([]);
  });

  it('product không có tags → metadata.tags = []', async () => {
    const product = { id: 204, name: 'NoTags', slug: 'notags', basePrice: 1000000, inStock: true };
    await store.upsertProduct(product);
    expect(store.items[0].metadata.tags).toEqual([]);
  });
});
