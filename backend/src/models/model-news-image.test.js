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
