/**
 * vector-store.edge.mutation-kill.test.js
 *
 * Batch 2 — edge cases để đẩy mutation cao hơn:
 *   - buildEmbeddingText: variants (displayName/Màu sắc/Dung lượng/RAM dedup, slice 6),
 *     productSpecifications, descriptionEn, no-variants, specifications check
 *   - upsertProduct metadata đầy đủ (specs join '|', variants all fields, ratingAverage, desc strip 800)
 *   - save error path, load empty-content
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
  activeName: 'mock',
}));

const mockExistsSync = jest.fn(() => false);
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn().mockResolvedValue();
jest.mock('fs', () => ({
  existsSync: (...a) => mockExistsSync(...a),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn(),
  promises: { readFile: (...a) => mockReadFile(...a), writeFile: (...a) => mockWriteFile(...a) },
}));

const logger = require('@utils/logger');
const store = require('./vector-store');
const Cls = store.constructor;
const dimVec = () => Array(1024).fill(0.1);

beforeEach(() => {
  jest.clearAllMocks();
  store.items = [];
  store.loadPromise = Promise.resolve();
  store._specKeyMap = {};
});

// ══════════════════════════════════════════════════════════════════════════════
// buildEmbeddingText — variants + specs edge cases
// ══════════════════════════════════════════════════════════════════════════════

describe('buildEmbeddingText edge', () => {
  it('variants: displayName + Màu sắc/Dung lượng/RAM + dedup tên', () => {
    const p = {
      name: 'P',
      inStock: true,
      variants: [
        { displayName: 'V1', attributes: { 'Màu sắc': 'Xanh', 'Dung lượng': '256GB' } },
        { variantName: 'V1', attributes: { RAM: '8GB', color: 'Đỏ' } },
      ],
    };
    expect(Cls.buildEmbeddingText(p)).toBe(
      'P. Phiên bản: V1. Màu: Xanh, Đỏ. Cấu hình: 256GB, 8GB. Còn hàng',
    );
  });

  it('productSpecifications + descriptionEn (strip HTML)', () => {
    const p = {
      name: 'P',
      inStock: true,
      descriptionEn: '<b>EN desc</b>',
      productSpecifications: [{ name: 'Pin', value: '5000mAh', valueEn: '5000mAh batt' }],
    };
    expect(Cls.buildEmbeddingText(p)).toBe('P. EN desc. Pin 5000mAh 5000mAh batt. Còn hàng');
  });

  it('productSpecifications valueEn === value → không lặp', () => {
    const p = {
      name: 'P',
      inStock: true,
      productSpecifications: [{ name: 'Pin', value: '5000mAh', valueEn: '5000mAh' }],
    };
    expect(Cls.buildEmbeddingText(p)).toBe('P. Pin 5000mAh. Còn hàng');
  });

  it('không variants → KHÔNG có "Phiên bản"', () => {
    expect(Cls.buildEmbeddingText({ name: 'P', inStock: true, variants: [] })).toBe('P. Còn hàng');
  });

  it('chỉ lấy tối đa 6 tên variant', () => {
    const variants = Array.from({ length: 8 }, (_, i) => ({ variantName: `V${i}` }));
    const txt = Cls.buildEmbeddingText({ name: 'P', inStock: true, variants });
    expect(txt).toContain('Phiên bản: V0, V1, V2, V3, V4, V5.');
    expect(txt).not.toContain('V6');
  });

  it('specifications rỗng ({}) → KHÔNG có "Thông số"', () => {
    expect(Cls.buildEmbeddingText({ name: 'P', inStock: true, specifications: {} })).toBe(
      'P. Còn hàng',
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// upsertProduct — metadata đầy đủ
// ══════════════════════════════════════════════════════════════════════════════

describe('upsertProduct metadata đầy đủ', () => {
  it('specs join "|", variants all fields, ratingAverage Number, desc strip', async () => {
    store._specKeyMap = { ram: 'RAM' };
    mockEmbed.mockResolvedValue(dimVec());
    await store.upsertProduct({
      id: 1,
      name: 'iPhone',
      nameEn: 'iPhone EN',
      slug: 's',
      model: 'A1',
      basePrice: 100,
      compareAtPrice: 120,
      thumbnail: 't',
      inStock: true,
      stockQuantity: 5,
      ratingAverage: 4.5,
      description: '<p>' + 'D'.repeat(1000) + '</p>',
      shortDescription: 'ngắn',
      shortDescriptionEn: 'short',
      specifications: { ram: '8GB' },
      productSpecifications: [{ name: 'Pin', value: '5000', valueEn: '5000mAh' }],
      variants: [
        {
          variantName: '128GB',
          displayName: 'D128',
          price: 100,
          compareAtPrice: 120,
          stockQuantity: 3,
          isDefault: true,
          attributes: { color: 'Đen' },
        },
      ],
      tags: ['hot'],
      createdAt: '2026-01-01',
    });
    const m = store.items[0].metadata;
    expect(m.nameEn).toBe('iPhone EN');
    expect(m.model).toBe('A1');
    expect(m.ratingAverage).toBe(4.5);
    expect(m.shortDescriptionEn).toBe('short');
    expect(m.description.length).toBe(800); // strip HTML + substring 800
    expect(m.specifications).toBe('RAM: 8GB | Pin: 5000 (5000mAh)');
    expect(m.variants[0]).toEqual({
      variantName: '128GB',
      displayName: 'D128',
      price: 100,
      compareAtPrice: 120,
      stockQuantity: 3,
      isDefault: true,
      attributes: { color: 'Đen' },
    });
    expect(m.createdAt).toBe('2026-01-01');
  });

  it('basePrice null → price null; ratingAverage null → null', async () => {
    mockEmbed.mockResolvedValue(dimVec());
    await store.upsertProduct({
      id: 2,
      name: 'X',
      slug: 's',
      basePrice: null,
      compareAtPrice: null,
      ratingAverage: null,
      inStock: false,
      stockQuantity: 0,
    });
    const m = store.items[0].metadata;
    expect(m.price).toBeNull();
    expect(m.compareAtPrice).toBeNull();
    expect(m.ratingAverage).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// save error + load edge
// ══════════════════════════════════════════════════════════════════════════════

describe('save / load edge', () => {
  it('save: writeFile lỗi → log error (không throw)', async () => {
    mockExistsSync.mockReturnValue(true);
    mockWriteFile.mockRejectedValueOnce(new Error('disk full'));
    store.items = [{ a: 1 }];
    await expect(store.save()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi khi lưu'),
      expect.anything(),
    );
  });

  it('load: content rỗng/whitespace → KHÔNG parse, giữ items hiện tại', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue('   ');
    store.items = [{ keep: true }];
    await store.load();
    expect(store.items).toEqual([{ keep: true }]);
  });
});
