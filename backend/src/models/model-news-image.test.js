/**
 * model.news.image.test.js
 *
 * Tests cho các Sequelize model files:
 *   - src/models/news.js   — VIRTUAL fields (title, content, description, category)
 *   - src/models/image.js  — model definition, field defaults, indexes
 *
 * Strategy: mock ../config/sequelize để capture field definitions từ
 * sequelize.define(), rồi test getter/setter trực tiếp mà không cần DB thật.
 * Theo pattern của model.hooks.additional.test.js.
 */

process.env.NODE_ENV = 'test';

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Tạo mock Sequelize instance để test getter/setter trực tiếp.
 */
function makeInstance(initialData = {}) {
  const dataValues = { ...initialData };
  return {
    getDataValue(field) {
      return dataValues[field];
    },
    setDataValue(field, value) {
      dataValues[field] = value;
    },
    get _data() {
      return dataValues;
    },
  };
}

/**
 * Load model trong isolated scope, capture field definitions từ sequelize.define().
 */
function loadModelCapture(modelPath) {
  let capturedFields = {};
  let capturedOptions = {};

  jest.isolateModules(() => {
    jest.mock('@config/sequelize', () => {
      const { DataTypes } = require('sequelize');
      return {
        define(modelName, fields, opts) {
          capturedFields = fields;
          capturedOptions = opts || {};
          return {};
        },
        DataTypes,
      };
    });

    require(modelPath);
  });

  return { fields: capturedFields, options: capturedOptions };
}

// ════════════════════════════════════════════════════════════════════════════
// src/models/news.js — VIRTUAL fields
// ════════════════════════════════════════════════════════════════════════════

describe('news.js — title VIRTUAL field getter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./news');
    fieldDef = fields.title;
  });

  it('getter trả về giá trị của titleVi', () => {
    const inst = makeInstance({ titleVi: 'Tin tức mới nhất' });
    expect(fieldDef.get.call(inst)).toBe('Tin tức mới nhất');
  });

  it('getter trả về undefined khi titleVi chưa được đặt', () => {
    const inst = makeInstance({});
    expect(fieldDef.get.call(inst)).toBeUndefined();
  });
});

describe('news.js — title VIRTUAL field setter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./news');
    fieldDef = fields.title;
  });

  it('setter lưu giá trị vào titleVi', () => {
    const inst = makeInstance({ titleVi: null });
    fieldDef.set.call(inst, 'Bài viết về công nghệ');
    expect(inst.getDataValue('titleVi')).toBe('Bài viết về công nghệ');
  });

  it('setter ghi đè titleVi khi đã có giá trị trước đó', () => {
    const inst = makeInstance({ titleVi: 'Giá trị cũ' });
    fieldDef.set.call(inst, 'Giá trị mới');
    expect(inst.getDataValue('titleVi')).toBe('Giá trị mới');
  });
});

describe('news.js — content VIRTUAL field getter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./news');
    fieldDef = fields.content;
  });

  it('getter trả về giá trị của contentVi', () => {
    const inst = makeInstance({ contentVi: 'Nội dung bài viết dài...' });
    expect(fieldDef.get.call(inst)).toBe('Nội dung bài viết dài...');
  });

  it('getter trả về null khi contentVi là null', () => {
    const inst = makeInstance({ contentVi: null });
    expect(fieldDef.get.call(inst)).toBeNull();
  });
});

describe('news.js — content VIRTUAL field setter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./news');
    fieldDef = fields.content;
  });

  it('setter lưu giá trị vào contentVi', () => {
    const inst = makeInstance({ contentVi: null });
    fieldDef.set.call(inst, 'Nội dung mới được cập nhật.');
    expect(inst.getDataValue('contentVi')).toBe('Nội dung mới được cập nhật.');
  });
});

describe('news.js — description VIRTUAL field getter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./news');
    fieldDef = fields.description;
  });

  it('getter trả về giá trị của descriptionVi', () => {
    const inst = makeInstance({ descriptionVi: 'Mô tả ngắn về bài viết' });
    expect(fieldDef.get.call(inst)).toBe('Mô tả ngắn về bài viết');
  });

  it('getter trả về undefined khi descriptionVi chưa được đặt', () => {
    const inst = makeInstance({});
    expect(fieldDef.get.call(inst)).toBeUndefined();
  });
});

describe('news.js — description VIRTUAL field setter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./news');
    fieldDef = fields.description;
  });

  it('setter lưu giá trị vào descriptionVi', () => {
    const inst = makeInstance({ descriptionVi: null });
    fieldDef.set.call(inst, 'Mô tả mới');
    expect(inst.getDataValue('descriptionVi')).toBe('Mô tả mới');
  });
});

describe('news.js — category VIRTUAL field getter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./news');
    fieldDef = fields.category;
  });

  it('getter trả về giá trị của categoryVi', () => {
    const inst = makeInstance({ categoryVi: 'Công nghệ' });
    expect(fieldDef.get.call(inst)).toBe('Công nghệ');
  });

  it('getter trả về undefined khi categoryVi chưa được đặt', () => {
    const inst = makeInstance({});
    expect(fieldDef.get.call(inst)).toBeUndefined();
  });
});

describe('news.js — category VIRTUAL field setter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./news');
    fieldDef = fields.category;
  });

  it('setter lưu giá trị vào categoryVi', () => {
    const inst = makeInstance({ categoryVi: null });
    fieldDef.set.call(inst, 'Sức khoẻ');
    expect(inst.getDataValue('categoryVi')).toBe('Sức khoẻ');
  });
});

describe('news.js — model options', () => {
  it('tableName là "news"', () => {
    const { options } = loadModelCapture('./news');
    expect(options.tableName).toBe('news');
  });

  it('timestamps là true', () => {
    const { options } = loadModelCapture('./news');
    expect(options.timestamps).toBe(true);
  });

  it('paranoid là true (soft delete)', () => {
    const { options } = loadModelCapture('./news');
    expect(options.paranoid).toBe(true);
  });

  it('underscored là true', () => {
    const { options } = loadModelCapture('./news');
    expect(options.underscored).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// src/models/image.js — model definition
// ════════════════════════════════════════════════════════════════════════════

describe('image.js — field definitions', () => {
  let fields;
  let options;

  beforeAll(() => {
    const result = loadModelCapture('./image');
    fields = result.fields;
    options = result.options;
  });

  it('tableName là "images"', () => {
    expect(options.tableName).toBe('images');
  });

  it('timestamps là true', () => {
    expect(options.timestamps).toBe(true);
  });

  it('underscored là true', () => {
    expect(options.underscored).toBe(true);
  });

  it('field id là PRIMARY KEY AUTO INCREMENT', () => {
    expect(fields.id).toBeDefined();
    expect(fields.id.primaryKey).toBe(true);
    expect(fields.id.autoIncrement).toBe(true);
  });

  it('field originalName không cho phép null', () => {
    expect(fields.originalName).toBeDefined();
    expect(fields.originalName.allowNull).toBe(false);
  });

  it('field fileName là unique và không cho phép null', () => {
    expect(fields.fileName).toBeDefined();
    expect(fields.fileName.allowNull).toBe(false);
    expect(fields.fileName.unique).toBe(true);
  });

  it('field filePath không cho phép null', () => {
    expect(fields.filePath).toBeDefined();
    expect(fields.filePath.allowNull).toBe(false);
  });

  it('field fileSize không cho phép null', () => {
    expect(fields.fileSize).toBeDefined();
    expect(fields.fileSize.allowNull).toBe(false);
  });

  it('field mimeType không cho phép null', () => {
    expect(fields.mimeType).toBeDefined();
    expect(fields.mimeType.allowNull).toBe(false);
  });

  it('field width và height cho phép null', () => {
    expect(fields.width.allowNull).toBe(true);
    expect(fields.height.allowNull).toBe(true);
  });

  it('field category có defaultValue là "product"', () => {
    expect(fields.category).toBeDefined();
    expect(fields.category.defaultValue).toBe('product');
  });

  it('field isActive có defaultValue là true', () => {
    expect(fields.isActive).toBeDefined();
    expect(fields.isActive.defaultValue).toBe(true);
  });

  it('model có indexes định nghĩa', () => {
    expect(Array.isArray(options.indexes)).toBe(true);
    expect(options.indexes.length).toBeGreaterThan(0);
  });
});
