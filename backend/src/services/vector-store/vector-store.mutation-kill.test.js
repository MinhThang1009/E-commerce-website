/**
 * vector-store.mutation-kill.test.js
 *
 * Bổ sung baseline mutation 65.75%. Kill mutant các cụm:
 *   - cosineSimilarity (math + guards)
 *   - buildEmbeddingText (static: labels, conditionals, join, localizeKey, HTML strip, substring)
 *   - _tokenize (regex unicode + filter len>1)
 *   - _keywordSearch (name×3/text×1, coverage ratio, sort/slice, unique tokens)
 *   - _semanticSearch (cosine score, filter minScore, sort, vector||vectorEn)
 *   - hybridSearch (overlap boost, keyword-only injection lowConfidence, empty, error)
 *   - upsertProduct (embed type passage, dim validation, dedup, metadata)
 *   - save/load/clear/setSpecKeyMap/_localizeSpecKey
 */

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mockEmbed = jest.fn();
jest.mock('@services/embedding/unified-embedding', () => ({
  generateEmbedding: (...a) => mockEmbed(...a),
  generateEmbeddingWithMeta: async (...a) => ({ vector: await mockEmbed(...a), provider: 'mock' }),
  activeName: 'mock',
}));

const mockExistsSync = jest.fn(() => false);
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn().mockResolvedValue();
const mockMkdirSync = jest.fn();
const mockWriteFileSync = jest.fn();
jest.mock('fs', () => ({
  existsSync: (...a) => mockExistsSync(...a),
  mkdirSync: (...a) => mockMkdirSync(...a),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: (...a) => mockWriteFileSync(...a),
  promises: { readFile: (...a) => mockReadFile(...a), writeFile: (...a) => mockWriteFile(...a) },
}));

const logger = require('@utils/logger');
const store = require('./vector-store');
const Cls = store.constructor;
const DIM = 1024;
const dimVec = (fill = 0.1) => Array(DIM).fill(fill);

beforeEach(() => {
  jest.clearAllMocks();
  store.items = [];
  store.loadPromise = Promise.resolve();
});

// ══════════════════════════════════════════════════════════════════════════════
// cosineSimilarity
// ══════════════════════════════════════════════════════════════════════════════

describe('cosineSimilarity', () => {
  it('vector giống nhau → 1', () => {
    expect(store.cosineSimilarity([1, 0], [1, 0])).toBe(1);
  });
  it('vuông góc → 0', () => {
    expect(store.cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });
  it('giá trị dot/magnitude đúng (3-4-5)', () => {
    // [3,0]·[3,4]=9, |[3,0]|=3, |[3,4]|=5 → 9/15 = 0.6
    expect(store.cosineSimilarity([3, 0], [3, 4])).toBeCloseTo(0.6, 5);
  });
  it('null input → 0', () => {
    expect(store.cosineSimilarity(null, [1, 0])).toBe(0);
    expect(store.cosineSimilarity([1, 0], null)).toBe(0);
  });
  it('khác số chiều → 0', () => {
    expect(store.cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });
  it('zero vector → 0 (không NaN)', () => {
    expect(store.cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// buildEmbeddingText (static)
// ══════════════════════════════════════════════════════════════════════════════

describe('buildEmbeddingText', () => {
  it('sản phẩm đầy đủ → chuỗi ghép đúng nhãn + thứ tự', () => {
    const product = {
      name: 'iPhone 16',
      nameEn: 'iPhone 16 EN',
      model: 'A123',
      baseName: 'Apple',
      categories: [{ name: 'Điện thoại' }],
      shortDescription: 'Máy đẹp',
      description: '<p>Mô tả HTML</p>',
      specifications: { ram: '8GB' },
      tags: ['hot', 'new'],
      basePrice: 25000000,
      inStock: true,
      variants: [{ variantName: '128GB', attributes: { color: 'Đen', storage: '128GB' } }],
    };
    expect(Cls.buildEmbeddingText(product, { ram: 'RAM' })).toBe(
      'iPhone 16. iPhone 16 EN. Model: A123. Thương hiệu: Apple. Danh mục: Điện thoại. Máy đẹp. Mô tả HTML. Thông số: RAM: 8GB. Phiên bản: 128GB. Màu: Đen. Cấu hình: 128GB. Tags: hot, new. Giá: 25.000.000 đồng. Còn hàng',
    );
  });

  it('sản phẩm tối thiểu (chỉ name, hết hàng) → "name. Hết hàng"', () => {
    expect(Cls.buildEmbeddingText({ name: 'X', stockQuantity: 0 })).toBe('X. Hết hàng');
  });

  it('nameEn === name → bỏ nameEn (không lặp)', () => {
    expect(Cls.buildEmbeddingText({ name: 'X', nameEn: 'X', stockQuantity: 5 })).toBe(
      'X. Còn hàng',
    );
  });

  it('localizeKey: không có map → snake_case → space', () => {
    const txt = Cls.buildEmbeddingText({
      name: 'X',
      specifications: { man_hinh: 'OLED' },
      inStock: true,
    });
    expect(txt).toContain('Thông số: man hinh: OLED');
  });

  it('cắt tối đa 1500 ký tự', () => {
    const txt = Cls.buildEmbeddingText({ name: 'X'.repeat(2000), inStock: true });
    expect(txt.length).toBe(1500);
  });

  it('inStock undefined + stockQuantity > 0 → Còn hàng', () => {
    expect(Cls.buildEmbeddingText({ name: 'X', stockQuantity: 3 })).toContain('Còn hàng');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// _tokenize
// ══════════════════════════════════════════════════════════════════════════════

describe('_tokenize', () => {
  it('lowercase + strip dấu câu (giữ dấu tiếng Việt) + loại token 1 ký tự', () => {
    expect(store._tokenize('Điện thoại iPhone-15! a')).toEqual(['điện', 'thoại', 'iphone', '15']);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// _keywordSearch
// ══════════════════════════════════════════════════════════════════════════════

describe('_keywordSearch', () => {
  beforeEach(() => {
    store.items = [
      { metadata: { id: 1, name: 'iPhone 16 Pro' }, text: 'điện thoại apple' },
      { metadata: { id: 2, name: 'Samsung Galaxy' }, text: 'iphone clone điện thoại' },
    ];
  });

  it('khớp tên (×3) xếp trên khớp text (×1)', () => {
    const res = store._keywordSearch('iphone', 5);
    expect(res[0].metadata.id).toBe(1); // name match (score 3) > text match (score 1)
    expect(res[0].keywordScore).toBeGreaterThan(res[1].keywordScore);
  });

  it('coverage ratio: khớp nhiều token → score cao hơn', () => {
    const res = store._keywordSearch('iphone pro', 5);
    // id1 khớp cả "iphone"+"pro" (2/2 coverage), id2 chỉ "iphone" (1/2)
    expect(res[0].metadata.id).toBe(1);
  });

  it('query rỗng (toàn token 1 ký tự) → []', () => {
    expect(store._keywordSearch('a b', 5)).toEqual([]);
  });

  it('slice theo limit', () => {
    expect(store._keywordSearch('điện thoại', 1)).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// _semanticSearch
// ══════════════════════════════════════════════════════════════════════════════

describe('_semanticSearch', () => {
  it('score = cosine, lọc theo minScore, sort giảm dần', async () => {
    mockEmbed.mockResolvedValue([1, 0]);
    store.items = [
      { metadata: { id: 1 }, vector: [1, 0] }, // cosine 1
      { metadata: { id: 2 }, vector: [0, 1] }, // cosine 0
    ];
    const res = await store._semanticSearch('q', 5, 0.5);
    expect(res).toHaveLength(1); // chỉ id1 (score 1 >= 0.5)
    expect(res[0].metadata.id).toBe(1);
    expect(res[0].score).toBe(1);
    expect(mockEmbed).toHaveBeenCalledWith('q', 'query');
  });

  it('fallback vectorEn khi không có vector', async () => {
    mockEmbed.mockResolvedValue([1, 0]);
    store.items = [{ metadata: { id: 9 }, vectorEn: [1, 0] }];
    const res = await store._semanticSearch('q', 5, 0.5);
    expect(res[0].metadata.id).toBe(9);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// hybridSearch
// ══════════════════════════════════════════════════════════════════════════════

describe('hybridSearch', () => {
  it('overlap (cả vector + keyword) → boost +0.05', async () => {
    mockEmbed.mockResolvedValue([1, 0]);
    store.items = [{ metadata: { id: 1, name: 'iPhone' }, text: 'iphone', vector: [1, 0] }];
    const res = await store.hybridSearch('iphone', 5, 0.45);
    expect(res[0].metadata.id).toBe(1);
    expect(res[0].score).toBeCloseTo(1, 5); // min(1, 1 + 0.05) = 1
  });

  it('keyword-only (vector miss) → inject lowConfidence, score = minScore + ratio*0.05', async () => {
    mockEmbed.mockResolvedValue([0, 1]); // semantic không match (cosine 0 < 0.45)
    store.items = [{ metadata: { id: 5, name: 'iPhone 16' }, text: 'apple', vector: [1, 0] }];
    const res = await store.hybridSearch('iphone 16', 5, 0.45);
    expect(res[0].metadata.id).toBe(5);
    expect(res[0].lowConfidence).toBe(true);
    expect(res[0].score).toBeCloseTo(0.5, 5); // 0.45 + (1)*0.05
  });

  it('không có kết quả nào → []', async () => {
    mockEmbed.mockResolvedValue([1, 0]); // orthogonal với item vector → cosine 0 < minScore
    store.items = [{ metadata: { id: 1, name: 'Samsung' }, text: 'samsung', vector: [0, 1] }];
    const res = await store.hybridSearch('xyzzz', 5, 0.99); // query không khớp keyword
    expect(res).toEqual([]);
  });

  it('embedding throw → trả [] (không crash)', async () => {
    mockEmbed.mockRejectedValue(new Error('embed down'));
    store.items = [{ metadata: { id: 1, name: 'X' }, text: 'x', vector: [1, 0] }];
    const res = await store.hybridSearch('x', 5);
    expect(res).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi tìm kiếm'),
      'embed down',
    );
  });

  it('slice theo limit sau merge', async () => {
    mockEmbed.mockResolvedValue([1, 0]);
    store.items = [
      { metadata: { id: 1, name: 'A' }, text: 'a', vector: [1, 0] },
      { metadata: { id: 2, name: 'B' }, text: 'b', vector: [1, 0] },
    ];
    const res = await store.hybridSearch('a b', 1, 0.1);
    expect(res).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// upsertProduct
// ══════════════════════════════════════════════════════════════════════════════

describe('upsertProduct', () => {
  const product = () => ({
    id: 10,
    name: 'iPhone 16',
    slug: 'ip16',
    basePrice: 25000000,
    compareAtPrice: 28000000,
    thumbnail: 't',
    inStock: true,
    stockQuantity: 5,
    categories: [{ name: 'Điện thoại' }],
    variants: [{ variantName: '128GB', price: 25000000, stockQuantity: 3 }],
    tags: ['hot'],
  });

  it('embed với type "passage" + build text', async () => {
    mockEmbed.mockResolvedValue(dimVec());
    await store.upsertProduct(product());
    expect(mockEmbed).toHaveBeenCalledWith(expect.stringContaining('iPhone 16'), 'passage');
  });

  it('metadata: price/compareAtPrice → Number, category, variants map', async () => {
    mockEmbed.mockResolvedValue(dimVec());
    await store.upsertProduct(product());
    const meta = store.items[0].metadata;
    expect(meta.id).toBe(10);
    expect(meta.price).toBe(25000000);
    expect(meta.compareAtPrice).toBe(28000000);
    expect(meta.category).toBe('Điện thoại');
    expect(meta.variants[0]).toMatchObject({
      variantName: '128GB',
      price: 25000000,
      stockQuantity: 3,
    });
    expect(meta.tags).toEqual(['hot']);
  });

  it('category fallback "Sản phẩm" khi không có categories', async () => {
    mockEmbed.mockResolvedValue(dimVec());
    await store.upsertProduct({ ...product(), categories: undefined, category: undefined });
    expect(store.items[0].metadata.category).toBe('Sản phẩm');
  });

  it('dedup: id trùng bị thay thế (không nhân đôi)', async () => {
    mockEmbed.mockResolvedValue(dimVec());
    await store.upsertProduct(product());
    await store.upsertProduct(product());
    expect(store.items.filter((i) => i.metadata.id === 10)).toHaveLength(1);
  });

  it('vector sai chiều → throw', async () => {
    mockEmbed.mockResolvedValue(Array(512).fill(0.1));
    await expect(store.upsertProduct(product())).rejects.toThrow(/sai chiều/);
  });

  it('vector không phải array → throw', async () => {
    mockEmbed.mockResolvedValue(null);
    await expect(store.upsertProduct(product())).rejects.toThrow(/không hợp lệ/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// save / load / clear / setSpecKeyMap
// ══════════════════════════════════════════════════════════════════════════════

describe('save / load / clear / specKeyMap', () => {
  it('save: mkdir khi data dir chưa có + writeFile JSON', async () => {
    mockExistsSync.mockReturnValue(false);
    store.items = [{ a: 1 }];
    await store.save();
    expect(mockMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify([{ a: 1 }], null, 2),
    );
  });

  it('save: không mkdir khi dir đã tồn tại', async () => {
    mockExistsSync.mockReturnValue(true);
    store.items = [];
    await store.save();
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it('load: file tồn tại + JSON hợp lệ → set items', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(JSON.stringify([{ x: 1 }, { x: 2 }]));
    await store.load();
    expect(store.items).toEqual([{ x: 1 }, { x: 2 }]);
  });

  it('load: JSON lỗi → items = [] (không crash)', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue('{ broken json');
    await store.load();
    expect(store.items).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });

  it('clear → items rỗng', () => {
    store.items = [{ a: 1 }];
    store.clear();
    expect(store.items).toEqual([]);
  });

  it('setSpecKeyMap → ghi file + _localizeSpecKey dùng map', () => {
    store.setSpecKeyMap({ ram: 'RAM' });
    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(store._localizeSpecKey('ram')).toBe('RAM');
    expect(store._localizeSpecKey('man_hinh')).toBe('man hinh'); // fallback snake→space
  });
});
