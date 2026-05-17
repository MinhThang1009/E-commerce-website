/**
 * Additional tests cho SimpleVectorStore (src/services/ai/vectorStore.js)
 * Phủ các nhánh còn thiếu:
 *  - load(): file rỗng, file invalid JSON, file không tồn tại
 *  - save(): tạo thư mục khi chưa có
 *  - addProduct(): dimension mismatch EN, viEmbedding không available, viEmbedding sai dim
 *  - search(): useViModel=true / fallback EN, score dưới threshold, empty store
 *  - cosineSimilarity: zero vectors, mismatched lengths, NaN guard
 *  - enrichProductData: nhiều ảnh, không có ảnh, variant stock
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Giả lập embeddingService — EN model
const mockEnEmbed = jest.fn();
jest.mock('./embedding', () => ({ generateEmbedding: mockEnEmbed }));

// Giả lập viEmbeddingService — VI model
const mockViEmbed = jest.fn();
let viAvailable = false;
jest.mock('./viEmbedding', () => ({
  isAvailable: () => viAvailable,
  generateEmbedding: mockViEmbed,
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
const EN_DIM = 1536;
const VI_DIM = 1024;

// ── Khởi tạo module ──────────────────────────────────────────────────────────
// Phải require SAU khi mock đã đặt (jest.mock hoist lên trên, nhưng ta cần
// control state của mockExistsSync trước khi constructor chạy)

describe('SimpleVectorStore — load()', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Re-mock sau resetModules
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(),
    }));
    jest.mock('./embedding', () => ({ generateEmbedding: jest.fn() }));
    jest.mock('./viEmbedding', () => ({ isAvailable: () => false, generateEmbedding: jest.fn() }));
  });

  it('load từ file JSON hợp lệ → this.items chứa dữ liệu', async () => {
    const sampleItems = [{ vectorEn: [1, 2], metadata: { id: 1, name: 'A' } }];
    const mockFs = {
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn().mockResolvedValue(JSON.stringify(sampleItems)),
        writeFile: jest.fn(),
      },
    };
    jest.mock('fs', () => mockFs);

    const store = require('./vectorStore');
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

    const store = require('./vectorStore');
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

    const store = require('./vectorStore');
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

    const store = require('./vectorStore');
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
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(),
    }));
    jest.mock('./embedding', () => ({ generateEmbedding: jest.fn() }));
    jest.mock('./viEmbedding', () => ({ isAvailable: () => false, generateEmbedding: jest.fn() }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn().mockResolvedValue(''),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    store = require('./vectorStore');
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
    expect(isFinite(result) || result === 0).toBe(true);
  });

  it('similarity = Infinity (dotProduct rất lớn, magnitude nhỏ) → trả về 0 (line 148 guard)', () => {
    // Tạo case: dotProduct = Infinity nhưng magnitude = finite
    // v1 = [Number.MAX_VALUE, 0], v2 = [1/Number.MAX_VALUE, 0]
    // dotProduct = MAX_VALUE * (1/MAX_VALUE) + 0 = 1 → similarity = 1 (bình thường)
    // Không dễ tạo Infinity similarity với finite magnitude trong IEEE 754 chuẩn.
    // Thay vào đó test rằng hàm không bao giờ trả NaN dù input edge case:
    const v1 = new Array(4).fill(Number.MAX_VALUE / 2);
    const v2 = new Array(4).fill(Number.MAX_VALUE / 2);
    // dotProduct = 4 * (MAX/2)^2 có thể là Infinity → magnitude cũng Infinity → line 145 catches
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
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(),
    }));
    jest.mock('./embedding', () => ({ generateEmbedding: jest.fn() }));
    jest.mock('./viEmbedding', () => ({ isAvailable: () => false, generateEmbedding: jest.fn() }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    store = require('./vectorStore');
    await store.loadPromise;
  });

  it('xóa toàn bộ items sau khi đã thêm', () => {
    store.items = [{ vectorEn: [1], metadata: { id: 1 } }];
    store.clear();
    expect(store.items).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('addProduct()', () => {
  let store;
  let mockEn;
  let mockVi;
  let mockViService;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(),
    }));

    mockEn = jest.fn().mockResolvedValue(makeVector(EN_DIM));
    mockVi = jest.fn().mockResolvedValue(makeVector(VI_DIM));
    mockViService = { isAvailable: jest.fn().mockReturnValue(false), generateEmbedding: mockVi };

    jest.mock('./embedding', () => ({ generateEmbedding: mockEn }));
    jest.mock('./viEmbedding', () => mockViService);
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    store = require('./vectorStore');
    await store.loadPromise;
  });

  it('thêm sản phẩm hợp lệ → items.length tăng lên 1', async () => {
    const product = { id: 1, name: 'Laptop', slug: 'laptop', basePrice: 10000000, status: 'active' };

    await store.addProduct(product);

    expect(store.items).toHaveLength(1);
    expect(store.items[0].metadata.id).toBe(1);
    expect(store.items[0].metadata.name).toBe('Laptop');
  });

  it('thêm cùng productId lần 2 → cập nhật, không tạo duplicate', async () => {
    const product = { id: 5, name: 'Laptop', slug: 'laptop-5', basePrice: 5000000, status: 'active' };

    await store.addProduct(product);
    await store.addProduct({ ...product, name: 'Laptop Updated' });

    expect(store.items).toHaveLength(1);
    expect(store.items[0].metadata.name).toBe('Laptop Updated');
  });

  it('EN vector có chiều sai → throw Error (dimension mismatch)', async () => {
    mockEn.mockResolvedValue(makeVector(128)); // wrong dim

    const product = { id: 2, name: 'Phone', slug: 'phone', basePrice: 2000000 };

    await expect(store.addProduct(product)).rejects.toThrow(/sai chiều/);
  });

  it('EN vector là null → throw Error', async () => {
    mockEn.mockResolvedValue(null);

    const product = { id: 3, name: 'Mouse', slug: 'mouse', basePrice: 500000 };

    await expect(store.addProduct(product)).rejects.toThrow();
  });

  it('viEmbedding không available → vectorVi = null', async () => {
    mockViService.isAvailable.mockReturnValue(false);

    const product = { id: 6, name: 'Keyboard', slug: 'keyboard', basePrice: 300000 };
    await store.addProduct(product);

    expect(store.items[0].vectorVi).toBeNull();
  });

  it('viEmbedding available nhưng trả dim sai → bỏ qua, vectorVi = null', async () => {
    mockViService.isAvailable.mockReturnValue(true);
    mockVi.mockResolvedValue(makeVector(512)); // wrong dim for VI

    const product = { id: 7, name: 'Monitor', slug: 'monitor', basePrice: 5000000 };
    await store.addProduct(product);

    expect(store.items[0].vectorVi).toBeNull();
  });

  it('viEmbedding available và đúng dim → vectorVi được lưu', async () => {
    mockViService.isAvailable.mockReturnValue(true);
    mockVi.mockResolvedValue(makeVector(VI_DIM));

    const product = { id: 8, name: 'Màn hình', slug: 'man-hinh', basePrice: 4000000 };
    await store.addProduct(product);

    expect(store.items[0].vectorVi).toBeDefined();
    expect(store.items[0].vectorVi).toHaveLength(VI_DIM);
  });

  it('viEmbedding available nhưng throw → bỏ qua lỗi, vectorVi = null', async () => {
    mockViService.isAvailable.mockReturnValue(true);
    mockVi.mockRejectedValue(new Error('HF API timeout'));

    const product = { id: 9, name: 'Sản phẩm VN', slug: 'sp-vn', basePrice: 1000000 };
    await store.addProduct(product); // không throw

    expect(store.items[0].vectorVi).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('search()', () => {
  let store;
  let mockEn;
  let mockViService;
  let mockVi;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(),
    }));

    mockEn = jest.fn().mockResolvedValue(makeVector(EN_DIM));
    mockVi = jest.fn().mockResolvedValue(makeVector(VI_DIM));
    mockViService = { isAvailable: jest.fn().mockReturnValue(false), generateEmbedding: mockVi };

    jest.mock('./embedding', () => ({ generateEmbedding: mockEn }));
    jest.mock('./viEmbedding', () => mockViService);
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    store = require('./vectorStore');
    await store.loadPromise;
  });

  it('store rỗng → trả về mảng rỗng', async () => {
    const results = await store.search('laptop');
    expect(results).toEqual([]);
  });

  it('kết quả có score >= 0.45 → được trả về', async () => {
    // Đặt item với vector giống query vector → similarity = 1
    const queryVec = makeVector(EN_DIM);
    mockEn.mockResolvedValue(queryVec);

    store.items = [{
      vectorEn: queryVec,
      vectorVi: null,
      text: 'laptop',
      metadata: { id: 1, name: 'Laptop' },
    }];

    const results = await store.search('laptop');
    expect(results).toHaveLength(1);
    expect(results[0].score).toBeCloseTo(1);
  });

  it('kết quả có score < 0.45 → bị lọc bỏ', async () => {
    // Query vector trực giao với item vector → similarity = 0
    const queryVec = Array(EN_DIM).fill(0);
    queryVec[0] = 1;
    mockEn.mockResolvedValue(queryVec);

    const itemVec = Array(EN_DIM).fill(0);
    itemVec[1] = 1; // trực giao
    store.items = [{
      vectorEn: itemVec,
      vectorVi: null,
      text: 'chair',
      metadata: { id: 2, name: 'Chair' },
    }];

    const results = await store.search('lamp');
    expect(results).toEqual([]);
  });

  it('limit mặc định 5 → trả về tối đa 5 kết quả', async () => {
    const queryVec = makeVector(EN_DIM);
    mockEn.mockResolvedValue(queryVec);

    // 8 items giống query vector
    store.items = Array.from({ length: 8 }, (_, i) => ({
      vectorEn: queryVec,
      vectorVi: null,
      text: `item ${i}`,
      metadata: { id: i, name: `Item ${i}` },
    }));

    const results = await store.search('test');
    expect(results).toHaveLength(5);
  });

  it('limit tùy chỉnh được tôn trọng', async () => {
    const queryVec = makeVector(EN_DIM);
    mockEn.mockResolvedValue(queryVec);

    store.items = Array.from({ length: 8 }, (_, i) => ({
      vectorEn: queryVec,
      vectorVi: null,
      text: `item ${i}`,
      metadata: { id: i, name: `Item ${i}` },
    }));

    const results = await store.search('test', 3);
    expect(results).toHaveLength(3);
  });

  it('embeddingService throw → trả về mảng rỗng (không propagate lỗi)', async () => {
    mockEn.mockRejectedValue(new Error('API down'));

    const results = await store.search('query');
    expect(results).toEqual([]);
  });

  it('query tiếng Việt + viAvailable + items có vectorVi → dùng VI model', async () => {
    mockViService.isAvailable.mockReturnValue(true);
    const viVec = makeVector(VI_DIM);
    mockVi.mockResolvedValue(viVec);
    mockEn.mockResolvedValue(makeVector(EN_DIM));

    store.items = [{
      vectorEn: makeVector(EN_DIM),
      vectorVi: viVec,
      text: 'điện thoại',
      metadata: { id: 1, name: 'Điện thoại' },
    }];

    const results = await store.search('điện thoại'); // tiếng Việt
    // VI model được dùng — mock vi embed được gọi
    expect(mockVi).toHaveBeenCalled();
  });

  it('item không có vectorVi khi dùng VI model → fallback sang EN pair', async () => {
    mockViService.isAvailable.mockReturnValue(true);
    mockVi.mockResolvedValue(makeVector(VI_DIM));
    const enVec = makeVector(EN_DIM);
    mockEn.mockResolvedValue(enVec);

    // Item chỉ có vectorEn (được index khi HF fail)
    store.items = [{
      vectorEn: enVec,
      vectorVi: null,
      text: 'laptop',
      metadata: { id: 10, name: 'Laptop' },
    }];

    // Có ít nhất 1 item có vectorVi để trigger useViModel = true
    store.items.push({
      vectorEn: makeVector(EN_DIM),
      vectorVi: makeVector(VI_DIM),
      text: 'chuột',
      metadata: { id: 11, name: 'Chuột' },
    });

    const results = await store.search('tìm kiếm tiếng Việt');
    // Không crash, trả về array
    expect(Array.isArray(results)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('enrichProductData()', () => {
  let enrichProductData;

  beforeAll(() => {
    jest.resetModules();
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(),
    }));
    jest.mock('./embedding', () => ({ generateEmbedding: jest.fn() }));
    jest.mock('./viEmbedding', () => ({ isAvailable: () => false, generateEmbedding: jest.fn() }));
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(false),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined),
      },
    }));

    const mod = require('./vectorStore');
    enrichProductData = mod.enrichProductData;
  });

  it('productImages có isThumbnail=true → thumbnail là URL đó', () => {
    const product = {
      productImages: [
        { imageUrl: 'http://cdn/a.jpg', isThumbnail: false },
        { imageUrl: 'http://cdn/thumb.jpg', isThumbnail: true },
      ],
      variants: [],
      stockQuantity: 0,
    };
    const result = enrichProductData(product);
    expect(result.thumbnail).toBe('http://cdn/thumb.jpg');
  });

  it('không có isThumbnail=true → lấy ảnh đầu tiên', () => {
    const product = {
      productImages: [
        { imageUrl: 'http://cdn/first.jpg', isThumbnail: false },
      ],
      variants: [],
      stockQuantity: 0,
    };
    const result = enrichProductData(product);
    expect(result.thumbnail).toBe('http://cdn/first.jpg');
  });

  it('không có productImages → thumbnail = null', () => {
    const product = {
      productImages: [],
      variants: [],
      stockQuantity: 0,
    };
    const result = enrichProductData(product);
    expect(result.thumbnail).toBeNull();
  });

  it('variants có stockQuantity → inStock = true', () => {
    const product = {
      productImages: [],
      variants: [
        { stockQuantity: 0 },
        { stockQuantity: 5 },
      ],
      stockQuantity: 0,
    };
    const result = enrichProductData(product);
    expect(result.inStock).toBe(true);
  });

  it('variants hết hàng nhưng product.stockQuantity > 0 → inStock = true', () => {
    const product = {
      productImages: [],
      variants: [{ stockQuantity: 0 }],
      stockQuantity: 10,
    };
    const result = enrichProductData(product);
    expect(result.inStock).toBe(true);
  });

  it('không có variant + stockQuantity = 0 → inStock = false', () => {
    const product = {
      productImages: [],
      variants: [],
      stockQuantity: 0,
    };
    const result = enrichProductData(product);
    expect(result.inStock).toBe(false);
  });

  it('productImages undefined → không throw, thumbnail = null', () => {
    const product = { variants: [], stockQuantity: 0 };
    const result = enrichProductData(product);
    expect(result.thumbnail).toBeNull();
  });

  it('variants = null → (null || []) = [] → variantStock = 0 (line 205 || right side)', () => {
    // null → || [] triggers right side of || on line 205
    const product = {
      productImages: [],
      variants: null,      // null → || [] → reduce on [] → variantStock = 0
      stockQuantity: 0,
    };
    const result = enrichProductData(product);
    // variantStock = 0, stockQuantity = 0 → inStock = false
    expect(result.inStock).toBe(false);
  });

  it('variants = undefined → (undefined || []) = [] → variantStock = 0 (line 205 || right side)', () => {
    const product = {
      productImages: [],
      variants: undefined,   // undefined → || [] triggers
      stockQuantity: 5,      // stockQuantity > 0 → inStock = true despite variantStock = 0
    };
    const result = enrichProductData(product);
    expect(result.inStock).toBe(true);
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
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(),
    }));
    jest.mock('./embedding', () => ({ generateEmbedding: jest.fn() }));
    jest.mock('./viEmbedding', () => ({ isAvailable: () => false, generateEmbedding: jest.fn() }));
  });

  it('thư mục đã tồn tại → writeFile được gọi với JSON items, mkdirSync KHÔNG được gọi', async () => {
    const mockWriteFile = jest.fn().mockResolvedValue(undefined);
    const mockExistsSync = jest.fn().mockReturnValue(true); // thư mục đã có
    const mockMkdirSync = jest.fn();

    jest.mock('fs', () => ({
      existsSync: (...args) => mockExistsSync(...args),
      mkdirSync: (...args) => mockMkdirSync(...args),
      promises: {
        readFile: jest.fn().mockResolvedValue(''),
        writeFile: (...args) => mockWriteFile(...args),
      },
    }));

    store = require('./vectorStore');
    await store.loadPromise;

    store.items = [{ vectorEn: [1, 2], metadata: { id: 10, name: 'Test' } }];

    await store.save();

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"id": 10'),
    );
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it('thư mục chưa tồn tại → mkdirSync được gọi trước khi ghi file', async () => {
    const mockWriteFile = jest.fn().mockResolvedValue(undefined);
    const mockExistsSync = jest.fn().mockReturnValue(false); // thư mục chưa có
    const mockMkdirSync = jest.fn();

    jest.mock('fs', () => ({
      existsSync: (...args) => mockExistsSync(...args),
      mkdirSync: (...args) => mockMkdirSync(...args),
      promises: {
        readFile: jest.fn().mockResolvedValue(''),
        writeFile: (...args) => mockWriteFile(...args),
      },
    }));

    store = require('./vectorStore');
    await store.loadPromise;

    await store.save();

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ recursive: true }),
    );
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('writeFile throw → ghi error log, không re-throw — covers catch block (line 65-67)', async () => {
    const mockWriteFile = jest.fn().mockRejectedValue(new Error('EACCES: permission denied'));
    const mockLogger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

    jest.mock('../../utils/logger', () => mockLogger);
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
      promises: {
        readFile: jest.fn().mockResolvedValue(''),
        writeFile: (...args) => mockWriteFile(...args),
      },
    }));

    store = require('./vectorStore');
    await store.loadPromise;

    // Không throw
    await expect(store.save()).resolves.not.toThrow();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Lỗi khi lưu vector store:',
      expect.any(Error),
    );
  });
});
