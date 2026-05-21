'use strict';
/**
 * Tests cho productVariant.js model.
 * Nhắm vào getter/setter của attributesEn (lines 80-85) bằng cách
 * capture Sequelize.define và gọi trực tiếp getter/setter.
 *
 * Approach: mock sequelize.define để capture field definitions,
 * sau đó gọi getter/setter trực tiếp với fake 'this' context.
 */

// ─── Mock sequelize trước khi require model ───────────────────────────────────

let capturedFields = {};

jest.mock('@config/sequelize', () => {
  const mockSequelize = {
    define: jest.fn((modelName, fields, options) => {
      capturedFields = fields;
      // Trả về pseudo-model object (không dùng DB thực)
      return {
        modelName,
        options,
        belongsTo: jest.fn(),
        hasMany: jest.fn(),
        belongsToMany: jest.fn(),
        addHook: jest.fn(),
      };
    }),
    fn: jest.fn(),
    col: jest.fn(),
    literal: jest.fn(),
  };
  return mockSequelize;
});

// ─── Load model (sẽ trigger sequelize.define và fill capturedFields) ──────────

require('./product-variant');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tạo fake Sequelize instance context để gọi getter/setter.
 * Sequelize gọi getter với `this` là instance, getter gọi this.getDataValue().
 */
function makeFakeInstance(rawValues = {}) {
  const store = { ...rawValues };
  return {
    getDataValue: jest.fn((key) => store[key]),
    setDataValue: jest.fn((key, value) => {
      store[key] = value;
    }),
    _store: store,
  };
}

// ─── attributes getter/setter (lines 59-73) ───────────────────────────────────

describe('ProductVariant.attributes — getter', () => {
  let getter;
  let setter;

  beforeEach(() => {
    getter = capturedFields.attributes.get;
    setter = capturedFields.attributes.set;
  });

  it('trả về {} khi rawValue là null/falsy', () => {
    const ctx = makeFakeInstance({ attributes: null });
    const result = getter.call(ctx);
    expect(result).toEqual({});
  });

  it('parse JSON string thành object', () => {
    const ctx = makeFakeInstance({ attributes: '{"color":"red"}' });
    const result = getter.call(ctx);
    expect(result).toEqual({ color: 'red' });
  });

  it('trả về {} khi JSON string không hợp lệ', () => {
    const ctx = makeFakeInstance({ attributes: 'not-json' });
    const result = getter.call(ctx);
    expect(result).toEqual({});
  });

  it('trả về value trực tiếp khi đã là object', () => {
    const obj = { size: 'L' };
    const ctx = makeFakeInstance({ attributes: obj });
    const result = getter.call(ctx);
    expect(result).toBe(obj);
  });

  it('setter stringify object thành JSON', () => {
    const ctx = makeFakeInstance({});
    setter.call(ctx, { ram: '8GB' });
    expect(ctx.setDataValue).toHaveBeenCalledWith('attributes', '{"ram":"8GB"}');
  });

  it('setter giữ nguyên string khi value là string', () => {
    const ctx = makeFakeInstance({});
    setter.call(ctx, 'already-string');
    expect(ctx.setDataValue).toHaveBeenCalledWith('attributes', 'already-string');
  });
});

// ─── attributesEn getter (lines 79-83) ───────────────────────────────────────

describe('ProductVariant.attributesEn — getter (lines 79-83)', () => {
  let getter;

  beforeEach(() => {
    getter = capturedFields.attributesEn.get;
  });

  it('trả về null khi rawValue là null (line 81)', () => {
    // Falsy value → `if (!value) return null;`
    const ctx = makeFakeInstance({ attributesEn: null });
    const result = getter.call(ctx);
    expect(result).toBeNull();
  });

  it('trả về null khi rawValue là undefined (line 81)', () => {
    const ctx = makeFakeInstance({ attributesEn: undefined });
    const result = getter.call(ctx);
    expect(result).toBeNull();
  });

  it('trả về null khi rawValue là empty string (line 81)', () => {
    const ctx = makeFakeInstance({ attributesEn: '' });
    const result = getter.call(ctx);
    expect(result).toBeNull();
  });

  it('parse JSON string thành object (line 82 — happy path)', () => {
    const ctx = makeFakeInstance({ attributesEn: '{"color_en":"red"}' });
    const result = getter.call(ctx);
    expect(result).toEqual({ color_en: 'red' });
  });

  it('trả về value trực tiếp khi đã là object (line 82 — đã là object)', () => {
    const obj = { size_en: 'Large' };
    const ctx = makeFakeInstance({ attributesEn: obj });
    const result = getter.call(ctx);
    expect(result).toBe(obj);
  });

  it('trả về null khi JSON string không hợp lệ (line 82 — catch branch)', () => {
    const ctx = makeFakeInstance({ attributesEn: 'bad-json{{}' });
    const result = getter.call(ctx);
    expect(result).toBeNull();
  });
});

// ─── attributesEn setter (lines 84-86) ───────────────────────────────────────

describe('ProductVariant.attributesEn — setter (lines 84-86)', () => {
  let setter;

  beforeEach(() => {
    setter = capturedFields.attributesEn.set;
  });

  it('stringify object thành JSON khi value là object (line 85)', () => {
    const ctx = makeFakeInstance({});
    setter.call(ctx, { color: 'blue' });
    expect(ctx.setDataValue).toHaveBeenCalledWith('attributesEn', '{"color":"blue"}');
  });

  it('giữ nguyên string khi value là string (line 85)', () => {
    const ctx = makeFakeInstance({});
    setter.call(ctx, 'plain-string');
    expect(ctx.setDataValue).toHaveBeenCalledWith('attributesEn', 'plain-string');
  });

  it('stringify null thành JSON string "null" (line 85 — typeof null === object)', () => {
    const ctx = makeFakeInstance({});
    // typeof null === 'object' → JSON.stringify(null) = 'null'
    setter.call(ctx, null);
    expect(ctx.setDataValue).toHaveBeenCalledWith('attributesEn', 'null');
  });
});
