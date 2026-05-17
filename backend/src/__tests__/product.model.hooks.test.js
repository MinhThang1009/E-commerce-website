/**
 * Tests cho Product model hooks, getters, và setters (src/models/product.js)
 *
 * Strategy: mock sequelize.define để capture hooks; test getter/setter logic
 * trực tiếp bằng simulated Sequelize instance; test hooks bằng cách gọi
 * thẳng vào extracted hook functions với mock vectorStore.
 *
 * File nằm trong src/__tests__/ để jest testMatch pattern nhận được.
 */

// ── Env ───────────────────────────────────────────────────────────────────────
process.env.NODE_ENV = 'test';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('slugify', () =>
  jest.fn((text, opts) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  )
);

// vectorStore module — mock toàn bộ để hook không thật sự call DB
const mockVectorStore = {
  addProduct: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  items: [],
  enrichProductData: jest.fn((p) => p),
};
jest.mock('../services/ai/vectorStore', () => mockVectorStore);

// category / productImage dùng trong hook (lazy require inside hooks)
jest.mock('../models/category', () => ({}), { virtual: true });
jest.mock('../models/productImage', () => ({}), { virtual: true });

// Capture hooks và model khi sequelize.define() được gọi
let capturedHooks = {};
let capturedFields = {};
const mockProductInstance = { findByPk: jest.fn() };

jest.mock('../config/sequelize', () => ({
  define: jest.fn((modelName, fields, opts) => {
    capturedFields = fields;
    if (opts && opts.hooks) {
      capturedHooks = { ...opts.hooks };
    }
    return mockProductInstance;
  }),
}));

// ── Load model AFTER mocks ────────────────────────────────────────────────────
const Product = require('../models/product');

// ── Helper: Sequelize instance simulator ─────────────────────────────────────
function makeInstance(initialData = {}) {
  const dataValues = { ...initialData };
  const changedFields = new Set();
  return {
    getDataValue(field) {
      return dataValues[field];
    },
    setDataValue(field, value) {
      dataValues[field] = value;
    },
    changed(field) {
      return changedFields.has(field);
    },
    _markChanged(field) {
      changedFields.add(field);
    },
    get _raw() {
      return dataValues;
    },
  };
}

// ── Helper: extract getter/setter from field definition ───────────────────────
function getFieldDef(fieldName) {
  return capturedFields[fieldName];
}

// ─────────────────────────────────────────────────────────────────────────────
// tags getter — JSON array field
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: tags getter', () => {
  function callGetter(rawValue) {
    const inst = makeInstance({ tags: rawValue });
    return getFieldDef('tags').get.call(inst);
  }

  it('trả về [] khi rawValue = null', () => {
    expect(callGetter(null)).toEqual([]);
  });

  it('trả về [] khi rawValue = undefined', () => {
    expect(callGetter(undefined)).toEqual([]);
  });

  it('trả về [] khi rawValue = empty string', () => {
    expect(callGetter('')).toEqual([]);
  });

  it('parse JSON string thành array', () => {
    expect(callGetter('["sale","new"]')).toEqual(['sale', 'new']);
  });

  it('trả về [] khi JSON không hợp lệ', () => {
    expect(callGetter('{ bad json')).toEqual([]);
  });

  it('trả về nguyên mảng khi rawValue đã là array', () => {
    const arr = ['a', 'b'];
    expect(callGetter(arr)).toBe(arr);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tags setter
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: tags setter', () => {
  function callSetter(value) {
    const inst = makeInstance({});
    getFieldDef('tags').set.call(inst, value);
    return inst.getDataValue('tags');
  }

  it('array → JSON string', () => {
    expect(callSetter(['laptop', 'gaming'])).toBe('["laptop","gaming"]');
  });

  it('string → lưu nguyên', () => {
    expect(callSetter('already-string')).toBe('already-string');
  });

  it('array rỗng → "[]"', () => {
    expect(callSetter([])).toBe('[]');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// specifications getter/setter
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: specifications getter', () => {
  function callGetter(rawValue) {
    const inst = makeInstance({ specifications: rawValue });
    return getFieldDef('specifications').get.call(inst);
  }

  it('null → {}', () => {
    expect(callGetter(null)).toEqual({});
  });

  it('JSON string hợp lệ → object', () => {
    expect(callGetter('{"cpu":"M4","ram":"16GB"}')).toEqual({ cpu: 'M4', ram: '16GB' });
  });

  it('JSON không hợp lệ → {}', () => {
    expect(callGetter('not-json')).toEqual({});
  });

  it('đã là object → trả về nguyên', () => {
    const obj = { cpu: 'M4' };
    expect(callGetter(obj)).toBe(obj);
  });
});

describe('Product model: specifications setter', () => {
  function callSetter(value) {
    const inst = makeInstance({});
    getFieldDef('specifications').set.call(inst, value);
    return inst.getDataValue('specifications');
  }

  it('object → JSON string', () => {
    expect(callSetter({ cpu: 'M4' })).toBe('{"cpu":"M4"}');
  });

  it('string → lưu nguyên', () => {
    expect(callSetter('raw')).toBe('raw');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// attributes getter/setter
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: attributes getter', () => {
  function callGetter(rawValue) {
    const inst = makeInstance({ attributes: rawValue });
    return getFieldDef('attributes').get.call(inst);
  }

  it('null → {}', () => {
    expect(callGetter(null)).toEqual({});
  });

  it('JSON string → object', () => {
    expect(callGetter('{"color":"red"}')).toEqual({ color: 'red' });
  });

  it('invalid JSON → {}', () => {
    expect(callGetter('broken')).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// shippingInfo getter/setter
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: shippingInfo getter', () => {
  function callGetter(rawValue) {
    const inst = makeInstance({ shippingInfo: rawValue });
    return getFieldDef('shippingInfo').get.call(inst);
  }

  it('null → {}', () => {
    expect(callGetter(null)).toEqual({});
  });

  it('JSON string → object', () => {
    expect(callGetter('{"weight":500}')).toEqual({ weight: 500 });
  });

  it('invalid JSON → {}', () => {
    expect(callGetter('{bad')).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// seoKeywords getter/setter
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: seoKeywords getter', () => {
  function callGetter(rawValue) {
    const inst = makeInstance({ seoKeywords: rawValue });
    return getFieldDef('seoKeywords').get.call(inst);
  }

  it('null → []', () => {
    expect(callGetter(null)).toEqual([]);
  });

  it('JSON array string → array', () => {
    expect(callGetter('["seo","laptop"]')).toEqual(['seo', 'laptop']);
  });

  it('invalid JSON → []', () => {
    expect(callGetter('bad')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// faqs getter/setter
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: faqs getter', () => {
  function callGetter(rawValue) {
    const inst = makeInstance({ faqs: rawValue });
    return getFieldDef('faqs').get.call(inst);
  }

  it('null → []', () => {
    expect(callGetter(null)).toEqual([]);
  });

  it('empty string → []', () => {
    expect(callGetter('')).toEqual([]);
  });

  it('JSON array → array of FAQ objects', () => {
    const faqs = [{ q: 'Bảo hành?', a: '12 tháng' }];
    expect(callGetter(JSON.stringify(faqs))).toEqual(faqs);
  });

  it('invalid JSON → []', () => {
    expect(callGetter('{broken')).toEqual([]);
  });
});

describe('Product model: faqs setter', () => {
  function callSetter(value) {
    const inst = makeInstance({});
    getFieldDef('faqs').set.call(inst, value);
    return inst.getDataValue('faqs');
  }

  it('array → JSON string', () => {
    const faqs = [{ q: 'Q', a: 'A' }];
    expect(callSetter(faqs)).toBe(JSON.stringify(faqs));
  });

  it('string → lưu nguyên', () => {
    expect(callSetter('raw')).toBe('raw');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// name virtual field (VIRTUAL — alias cho nameVi)
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: name virtual field', () => {
  it('getter trả về giá trị nameVi', () => {
    const inst = makeInstance({ nameVi: 'iPhone 17 Pro Max' });
    const result = getFieldDef('name').get.call(inst);
    expect(result).toBe('iPhone 17 Pro Max');
  });

  it('setter ghi vào nameVi', () => {
    const inst = makeInstance({ nameVi: null });
    getFieldDef('name').set.call(inst, 'Galaxy S25');
    expect(inst.getDataValue('nameVi')).toBe('Galaxy S25');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// shortDescription virtual field
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: shortDescription virtual field', () => {
  it('getter trả về shortDescriptionVi', () => {
    const inst = makeInstance({ shortDescriptionVi: 'Mô tả ngắn' });
    expect(getFieldDef('shortDescription').get.call(inst)).toBe('Mô tả ngắn');
  });

  it('setter ghi vào shortDescriptionVi', () => {
    const inst = makeInstance({});
    getFieldDef('shortDescription').set.call(inst, 'Mô tả mới');
    expect(inst.getDataValue('shortDescriptionVi')).toBe('Mô tả mới');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// description virtual field
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: description virtual field', () => {
  it('getter trả về descriptionVi', () => {
    const inst = makeInstance({ descriptionVi: 'Mô tả chi tiết' });
    expect(getFieldDef('description').get.call(inst)).toBe('Mô tả chi tiết');
  });

  it('setter ghi vào descriptionVi', () => {
    const inst = makeInstance({});
    getFieldDef('description').set.call(inst, 'Chi tiết mới');
    expect(inst.getDataValue('descriptionVi')).toBe('Chi tiết mới');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// seoTitle virtual field
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: seoTitle virtual field', () => {
  it('getter trả về seoTitleVi', () => {
    const inst = makeInstance({ seoTitleVi: 'Mua iPhone giá rẻ' });
    expect(getFieldDef('seoTitle').get.call(inst)).toBe('Mua iPhone giá rẻ');
  });

  it('setter ghi vào seoTitleVi', () => {
    const inst = makeInstance({});
    getFieldDef('seoTitle').set.call(inst, 'Tiêu đề SEO mới');
    expect(inst.getDataValue('seoTitleVi')).toBe('Tiêu đề SEO mới');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// seoDescription virtual field
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: seoDescription virtual field', () => {
  it('getter trả về seoDescriptionVi', () => {
    const inst = makeInstance({ seoDescriptionVi: 'Mô tả SEO tiếng Việt' });
    expect(getFieldDef('seoDescription').get.call(inst)).toBe('Mô tả SEO tiếng Việt');
  });

  it('setter ghi vào seoDescriptionVi', () => {
    const inst = makeInstance({});
    getFieldDef('seoDescription').set.call(inst, 'SEO mới');
    expect(inst.getDataValue('seoDescriptionVi')).toBe('SEO mới');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// beforeValidate hook — slug auto-generation
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: beforeValidate hook', () => {
  const hook = () => capturedHooks.beforeValidate;

  it('tạo slug khi product.name có giá trị và slug chưa có', () => {
    const product = { name: 'Laptop ThinkPad X1', slug: null, changed: jest.fn(() => false) };
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    hook()(product);
    Math.random.mockRestore();
    expect(product.slug).toBeDefined();
    expect(product.slug).toMatch(/laptop/);
  });

  it('tạo lại slug khi name thay đổi (changed=true) dù slug đã tồn tại', () => {
    const product = {
      name: 'MacBook Pro M4',
      slug: 'old-slug-xxx',
      changed: jest.fn(() => true),
    };
    jest.spyOn(Math, 'random').mockReturnValue(0.25);
    hook()(product);
    Math.random.mockRestore();
    expect(product.slug).not.toBe('old-slug-xxx');
    expect(product.slug).toMatch(/macbook/);
  });

  it('giữ nguyên slug khi slug đã có và name KHÔNG thay đổi', () => {
    const product = {
      name: 'iPhone 17',
      slug: 'iphone-17-existing',
      changed: jest.fn(() => false),
    };
    hook()(product);
    expect(product.slug).toBe('iphone-17-existing');
  });

  it('KHÔNG tạo slug khi name = null', () => {
    const product = { name: null, slug: null, changed: jest.fn() };
    hook()(product);
    expect(product.slug).toBeNull();
  });

  it('slug mới có dạng <slugified-name>-<random-suffix>', () => {
    const product = { name: 'Test Product', slug: null, changed: jest.fn(() => false) };
    hook()(product);
    // slug phải kết thúc bằng dấu gạch + suffix
    expect(product.slug).toMatch(/^[a-z0-9-]+-[a-z0-9]+$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// afterCreate hook — vector store indexing
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: afterCreate hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVectorStore.items = [];
  });

  it('product status=active → addProduct và save được gọi', async () => {
    const fullProduct = {
      id: 1,
      name: 'Active Product',
      status: 'active',
      toJSON: () => ({ id: 1, name: 'Active Product', status: 'active' }),
    };
    mockProductInstance.findByPk.mockResolvedValue(fullProduct);

    await capturedHooks.afterCreate({ id: 1, status: 'active' });

    expect(mockVectorStore.addProduct).toHaveBeenCalled();
    expect(mockVectorStore.save).toHaveBeenCalled();
  });

  it('product status=inactive → KHÔNG gọi addProduct', async () => {
    await capturedHooks.afterCreate({ id: 2, status: 'inactive' });
    expect(mockVectorStore.addProduct).not.toHaveBeenCalled();
  });

  it('product status=draft → KHÔNG gọi addProduct', async () => {
    await capturedHooks.afterCreate({ id: 3, status: 'draft' });
    expect(mockVectorStore.addProduct).not.toHaveBeenCalled();
  });

  it('không throw khi findByPk trả về null', async () => {
    mockProductInstance.findByPk.mockResolvedValue(null);
    await expect(capturedHooks.afterCreate({ id: 99, status: 'active' })).resolves.not.toThrow();
    // addProduct không được gọi vì fullProduct = null
    expect(mockVectorStore.addProduct).not.toHaveBeenCalled();
  });

  it('không throw khi vectorStore.addProduct fail — lỗi được swallow', async () => {
    const fullProduct = {
      id: 10,
      status: 'active',
      toJSON: () => ({ id: 10, status: 'active' }),
    };
    mockProductInstance.findByPk.mockResolvedValue(fullProduct);
    mockVectorStore.addProduct.mockRejectedValueOnce(new Error('vector fail'));

    await expect(capturedHooks.afterCreate({ id: 10, status: 'active' })).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// afterUpdate hook — vector store sync
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: afterUpdate hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVectorStore.items = [
      { metadata: { id: 5 } },
      { metadata: { id: 6 } },
    ];
  });

  it('status=active → gọi addProduct với full product data', async () => {
    const fullProduct = {
      id: 5,
      status: 'active',
      toJSON: () => ({ id: 5, status: 'active' }),
    };
    mockProductInstance.findByPk.mockResolvedValue(fullProduct);

    await capturedHooks.afterUpdate({ id: 5, status: 'active' });

    expect(mockVectorStore.addProduct).toHaveBeenCalled();
    expect(mockVectorStore.save).toHaveBeenCalled();
  });

  it('status=inactive → item bị xóa khỏi vector store, save được gọi', async () => {
    await capturedHooks.afterUpdate({ id: 5, status: 'inactive' });

    expect(mockVectorStore.items.find((i) => i.metadata.id === 5)).toBeUndefined();
    expect(mockVectorStore.save).toHaveBeenCalled();
    expect(mockVectorStore.addProduct).not.toHaveBeenCalled();
  });

  it('status=archived → item bị xóa khỏi vector store', async () => {
    await capturedHooks.afterUpdate({ id: 5, status: 'archived' });

    expect(mockVectorStore.items.find((i) => i.metadata.id === 5)).toBeUndefined();
  });

  it('status=active nhưng findByPk trả về null → addProduct không được gọi', async () => {
    mockProductInstance.findByPk.mockResolvedValue(null);

    await capturedHooks.afterUpdate({ id: 5, status: 'active' });

    expect(mockVectorStore.addProduct).not.toHaveBeenCalled();
  });

  it('không throw khi vectorStore.save fail', async () => {
    mockVectorStore.save.mockRejectedValueOnce(new Error('disk full'));

    await expect(
      capturedHooks.afterUpdate({ id: 6, status: 'inactive' })
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// afterDestroy hook — remove from vector store
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: afterDestroy hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVectorStore.items = [
      { metadata: { id: 1 } },
      { metadata: { id: 2 } },
      { metadata: { id: 3 } },
    ];
  });

  it('xóa item có id khớp khỏi vector store và gọi save', async () => {
    await capturedHooks.afterDestroy({ id: 2 });

    expect(mockVectorStore.items).toHaveLength(2);
    expect(mockVectorStore.items.find((i) => i.metadata.id === 2)).toBeUndefined();
    expect(mockVectorStore.save).toHaveBeenCalled();
  });

  it('giữ nguyên items khi id không có trong vector store', async () => {
    await capturedHooks.afterDestroy({ id: 99 });

    expect(mockVectorStore.items).toHaveLength(3);
    expect(mockVectorStore.save).toHaveBeenCalled();
  });

  it('không throw khi vectorStore.save fail', async () => {
    mockVectorStore.save.mockRejectedValueOnce(new Error('IO error'));

    await expect(capturedHooks.afterDestroy({ id: 1 })).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// attributes setter — nhánh string passthrough (line 172)
// Các test này cover nhánh `typeof value !== 'object'` chưa được test trước đó.
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: attributes setter', () => {
  function callSetter(value) {
    const inst = makeInstance({});
    getFieldDef('attributes').set.call(inst, value);
    return inst.getDataValue('attributes');
  }

  it('string → lưu nguyên string (else-branch — line 172)', () => {
    expect(callSetter('pre-serialized-string')).toBe('pre-serialized-string');
  });

  it('object → JSON.stringify (object-branch)', () => {
    expect(callSetter({ color: 'red', size: 'M' })).toBe('{"color":"red","size":"M"}');
  });

  it('array → JSON.stringify (array là typeof object)', () => {
    expect(callSetter([{ key: 'val' }])).toBe('[{"key":"val"}]');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// shippingInfo setter — nhánh string passthrough (line 213)
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: shippingInfo setter', () => {
  function callSetter(value) {
    const inst = makeInstance({});
    getFieldDef('shippingInfo').set.call(inst, value);
    return inst.getDataValue('shippingInfo');
  }

  it('string → lưu nguyên string (else-branch — line 213)', () => {
    expect(callSetter('already-serialized-shipping')).toBe('already-serialized-shipping');
  });

  it('object → JSON.stringify (object-branch)', () => {
    expect(callSetter({ weight: 500, dimensions: '30x20x10' })).toBe(
      '{"weight":500,"dimensions":"30x20x10"}'
    );
  });

  it('số (typeof number) → lưu nguyên (else-branch)', () => {
    expect(callSetter(42)).toBe(42);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// seoKeywords setter — nhánh string passthrough (line 249)
// ─────────────────────────────────────────────────────────────────────────────
describe('Product model: seoKeywords setter', () => {
  function callSetter(value) {
    const inst = makeInstance({});
    getFieldDef('seoKeywords').set.call(inst, value);
    return inst.getDataValue('seoKeywords');
  }

  it('string → lưu nguyên string (else-branch — line 249)', () => {
    expect(callSetter('laptop,gaming,thinkpad')).toBe('laptop,gaming,thinkpad');
  });

  it('array → JSON.stringify (object-branch)', () => {
    expect(callSetter(['laptop', 'gaming'])).toBe('["laptop","gaming"]');
  });

  it('boolean (typeof boolean) → lưu nguyên (else-branch)', () => {
    expect(callSetter(false)).toBe(false);
  });
});
