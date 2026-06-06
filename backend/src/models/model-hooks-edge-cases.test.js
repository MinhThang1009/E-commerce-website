/**
 * Tests for Sequelize model hooks, getters, setters, and validators.
 *
 * Strategy: mock `../config/sequelize` to capture the hooks/fields passed to
 * sequelize.define(), then invoke them directly without a real DB connection.
 *
 * Each model gets its own jest.isolateModules() block so the mock can be set up
 * fresh and the require() module state doesn't bleed between models.
 *
 * Files under test:
 *   src/models/brand.js
 *   src/models/category.js
 *   src/models/productVariant.js
 *   src/models/user.js
 *   src/models/attributeValue.js
 */

process.env.NODE_ENV = 'test';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a plain object that mimics the Sequelize instance surface used by
 * getters, setters, and hooks (getDataValue / setDataValue / changed).
 */
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
    get(opts) {
      // Sequelize .get() with no args returns all data values
      return { ...dataValues };
    },
    get _data() {
      return dataValues;
    },
  };
}

/**
 * Loads a model in isolation and returns the hooks and field definitions
 * captured from the sequelize.define() call.
 *
 * @param {string} modelPath - require path relative to __tests__
 * @param {function} extraMockSetup - optional callback run inside isolateModules
 *   to set up additional mocks before the model is required.
 * @returns {{ hooks: object, fields: object, model: any }}
 */
function loadModelCapture(modelPath, extraMockSetup) {
  let capturedHooks = {};
  let capturedFields = {};
  let model;

  jest.isolateModules(() => {
    // Extra per-model mocks (e.g. slugify, argon2) must be set up BEFORE the
    // model is required so they are in place when the module executes.
    if (extraMockSetup) extraMockSetup();

    jest.mock('@config/sequelize', () => {
      const { DataTypes } = require('sequelize');
      return {
        define(modelName, fields, opts) {
          capturedFields = fields;
          if (opts && opts.hooks) {
            capturedHooks = { ...opts.hooks };
          }
          // Return a minimal fake model object; methods are added separately
          // (e.g. User.prototype) so we return a plain object here.
          const fakeModel = {};
          return fakeModel;
        },
        DataTypes,
      };
    });

    model = require(modelPath);
  });

  return { hooks: capturedHooks, fields: capturedFields, model };
}

// ─────────────────────────────────────────────────────────────────────────────
// brand.js
// ─────────────────────────────────────────────────────────────────────────────

describe('brand.js — name virtual field getter/setter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./brand');
    fieldDef = fields.name;
  });

  it('getter should return the value of nameVi', () => {
    const inst = makeInstance({ nameVi: 'Samsung' });
    expect(fieldDef.get.call(inst)).toBe('Samsung');
  });

  it('setter should store the value in nameVi', () => {
    const inst = makeInstance({ nameVi: null });
    fieldDef.set.call(inst, 'Apple');
    expect(inst.getDataValue('nameVi')).toBe('Apple');
  });
});

describe('brand.js — beforeValidate hook', () => {
  let hook;

  beforeAll(() => {
    // slugify is a real package; let it run normally inside isolateModules.
    const { hooks } = loadModelCapture('./brand');
    hook = hooks.beforeValidate;
  });

  it('should generate slug from name when slug is empty', () => {
    const brand = { name: 'Nike', slug: null };
    hook(brand);
    expect(brand.slug).toBe('nike');
  });

  it('should generate slug from a Vietnamese name', () => {
    // slugify with { lower: true, strict: true } strips diacritics
    const brand = { name: 'Điện thoại Samsung', slug: null };
    hook(brand);
    expect(brand.slug).toBeTruthy();
    expect(brand.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('should NOT overwrite an existing slug', () => {
    const brand = { name: 'Apple', slug: 'apple-existing' };
    hook(brand);
    // brand.js checks: if (brand.name && !brand.slug)
    expect(brand.slug).toBe('apple-existing');
  });

  it('should NOT set slug when name is null', () => {
    const brand = { name: null, slug: null };
    hook(brand);
    expect(brand.slug).toBeNull();
  });

  it('should NOT set slug when name is empty string', () => {
    const brand = { name: '', slug: null };
    hook(brand);
    expect(brand.slug).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// category.js
// ─────────────────────────────────────────────────────────────────────────────

describe('category.js — name virtual field getter/setter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./category');
    fieldDef = fields.name;
  });

  it('getter should return the value of nameVi', () => {
    const inst = makeInstance({ nameVi: 'Điện thoại' });
    expect(fieldDef.get.call(inst)).toBe('Điện thoại');
  });

  it('setter should store the value in nameVi', () => {
    const inst = makeInstance({ nameVi: null });
    fieldDef.set.call(inst, 'Laptop');
    expect(inst.getDataValue('nameVi')).toBe('Laptop');
  });
});

describe('category.js — description virtual field getter/setter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./category');
    fieldDef = fields.description;
  });

  it('getter should return the value of descriptionVi', () => {
    const inst = makeInstance({ descriptionVi: 'Mô tả danh mục' });
    expect(fieldDef.get.call(inst)).toBe('Mô tả danh mục');
  });

  it('setter should store the value in descriptionVi', () => {
    const inst = makeInstance({ descriptionVi: null });
    fieldDef.set.call(inst, 'Danh mục mới');
    expect(inst.getDataValue('descriptionVi')).toBe('Danh mục mới');
  });
});

describe('category.js — beforeValidate hook', () => {
  let hook;

  beforeAll(() => {
    const { hooks } = loadModelCapture('./category');
    hook = hooks.beforeValidate;
  });

  it('should generate slug from name when slug is empty', () => {
    const category = { name: 'Laptop', slug: null };
    hook(category);
    expect(category.slug).toBe('laptop');
  });

  it('should PRESERVE existing slug when slug is already set', () => {
    // category.js: if (category.name && !category.slug) — slug preserved if already exists
    const category = { name: 'Tablet', slug: 'old-slug' };
    hook(category);
    expect(category.slug).toBe('old-slug');
  });

  it('should generate slug from a Vietnamese category name', () => {
    const category = { name: 'Đồng hồ thông minh', slug: null };
    hook(category);
    expect(category.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('should NOT set slug when name is null', () => {
    const category = { name: null, slug: null };
    hook(category);
    expect(category.slug).toBeNull();
  });

  it('should NOT set slug when name is empty string', () => {
    const category = { name: '', slug: null };
    hook(category);
    expect(category.slug).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// productVariant.js — attributes getter / setter
// ─────────────────────────────────────────────────────────────────────────────

describe('productVariant.js — attributes getter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./product-variant');
    fieldDef = fields.attributes;
  });

  it('should return {} when stored value is null', () => {
    const inst = makeInstance({ attributes: null });
    expect(fieldDef.get.call(inst)).toEqual({});
  });

  it('should return {} when stored value is undefined', () => {
    const inst = makeInstance({ attributes: undefined });
    expect(fieldDef.get.call(inst)).toEqual({});
  });

  it('should return {} when stored value is empty string', () => {
    const inst = makeInstance({ attributes: '' });
    expect(fieldDef.get.call(inst)).toEqual({});
  });

  it('should parse a valid JSON string into an object', () => {
    const inst = makeInstance({ attributes: '{"color":"black","storage":"256GB"}' });
    expect(fieldDef.get.call(inst)).toEqual({ color: 'black', storage: '256GB' });
  });

  it('should return {} when stored value is invalid JSON', () => {
    const inst = makeInstance({ attributes: '{not valid json' });
    expect(fieldDef.get.call(inst)).toEqual({});
  });

  it('should return the value as-is when it is already an object', () => {
    const obj = { color: 'red' };
    const inst = makeInstance({ attributes: obj });
    const result = fieldDef.get.call(inst);
    expect(result).toBe(obj);
  });
});

describe('productVariant.js — attributes setter', () => {
  let fieldDef;

  beforeAll(() => {
    const { fields } = loadModelCapture('./product-variant');
    fieldDef = fields.attributes;
  });

  it('should JSON-stringify an object value before storing', () => {
    const inst = makeInstance({});
    fieldDef.set.call(inst, { color: 'blue', ram: '8GB' });
    expect(inst.getDataValue('attributes')).toBe('{"color":"blue","ram":"8GB"}');
  });

  it('should store a string value as-is', () => {
    const inst = makeInstance({});
    fieldDef.set.call(inst, 'already-a-string');
    expect(inst.getDataValue('attributes')).toBe('already-a-string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// user.js — beforeCreate, beforeUpdate hooks + prototype methods
// ─────────────────────────────────────────────────────────────────────────────

// ── User model: shared isolation helper ───────────────────────────────────────
// user.js assigns prototype methods onto the return value of sequelize.define(),
// so the mock must return something with a .prototype (i.e. a function/class).
//
// We use jest.doMock() inside isolateModules because jest.mock() factories are
// hoisted by Babel and cannot close over locally-defined variables.

function loadUserModel({ bcryptHash, bcryptCompare } = {}) {
  let capturedHooks = {};
  let UserModel;

  const mockHash = jest.fn().mockResolvedValue(bcryptHash || '$2b$12$hashed');
  const mockBcryptCompare = jest
    .fn()
    .mockResolvedValue(bcryptCompare !== undefined ? bcryptCompare : true);

  jest.isolateModules(() => {
    jest.doMock('bcrypt', () => ({
      hash: mockHash,
      compare: mockBcryptCompare,
    }));

    jest.doMock('@config/sequelize', () => {
      function FakeModel() {}
      return {
        define(modelName, fields, opts) {
          if (opts && opts.hooks) capturedHooks = { ...opts.hooks };
          return FakeModel;
        },
      };
    });

    UserModel = require('./user');
  });

  return {
    hooks: capturedHooks,
    UserModel,
    mockHash,
    mockBcryptCompare,
  };
}

describe('user.js — beforeCreate hook', () => {
  let hook;
  let mockHash;

  beforeAll(() => {
    const result = loadUserModel();
    hook = result.hooks.beforeCreate;
    mockHash = result.mockHash;
  });

  it('should hash password with bcrypt when password is provided', async () => {
    const user = { password: 'plaintext-password' };
    await hook(user);
    expect(mockHash).toHaveBeenCalledWith('plaintext-password', 12);
    expect(user.password).toBe('$2b$12$hashed');
  });

  it('should leave password unchanged when password is falsy (null)', async () => {
    const user = { password: null };
    mockHash.mockClear();
    await hook(user);
    expect(mockHash).not.toHaveBeenCalled();
    expect(user.password).toBeNull();
  });

  it('should leave password unchanged when password is undefined', async () => {
    const user = {};
    mockHash.mockClear();
    await hook(user);
    expect(mockHash).not.toHaveBeenCalled();
  });
});

describe('user.js — beforeUpdate hook', () => {
  let hook;
  let mockHash;

  beforeAll(() => {
    const result = loadUserModel({ bcryptHash: '$2b$12$updated' });
    hook = result.hooks.beforeUpdate;
    mockHash = result.mockHash;
  });

  it('should hash password when changed() returns true for password field', async () => {
    const changedFields = new Set(['password']);
    const user = {
      password: 'new-plain-password',
      changed: (field) => changedFields.has(field),
    };
    await hook(user);
    expect(mockHash).toHaveBeenCalledWith('new-plain-password', 12);
    expect(user.password).toBe('$2b$12$updated');
  });

  it('should NOT hash password when changed() returns false for password field', async () => {
    mockHash.mockClear();
    const user = {
      password: '$2b$12$already-hashed',
      changed: () => false,
    };
    await hook(user);
    expect(mockHash).not.toHaveBeenCalled();
    expect(user.password).toBe('$2b$12$already-hashed');
  });
});

describe('user.js — User.prototype.comparePassword', () => {
  let UserModel;
  let mockBcryptCompare;

  beforeAll(() => {
    const result = loadUserModel({ bcryptCompare: false });
    UserModel = result.UserModel;
    mockBcryptCompare = result.mockBcryptCompare;
  });

  it('should use bcrypt.compare for password verification', async () => {
    const userContext = { password: '$2b$12$somebcrypthash' };
    const result = await UserModel.prototype.comparePassword.call(userContext, 'candidate');
    expect(mockBcryptCompare).toHaveBeenCalledWith('candidate', userContext.password);
    expect(result).toBe(false);
  });
});

describe('user.js — User.prototype.toJSON', () => {
  let UserModel;

  beforeAll(() => {
    const result = loadUserModel();
    UserModel = result.UserModel;
  });

  it('should remove sensitive fields from serialized output', () => {
    const sensitiveInstance = makeInstance({
      id: 42,
      email: 'user@example.com',
      password: '$argon2id$secret',
      otpCode: '123456',
      otpExpires: new Date(),
      resetPasswordToken: 'reset-token-xyz',
      resetPasswordExpires: new Date(),
      firstName: 'John',
      lastName: 'Doe',
    });

    const result = UserModel.prototype.toJSON.call(sensitiveInstance);

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('otpCode');
    expect(result).not.toHaveProperty('otpExpires');
    expect(result).not.toHaveProperty('resetPasswordToken');
    expect(result).not.toHaveProperty('resetPasswordExpires');
  });

  it('should retain non-sensitive fields in serialized output', () => {
    const inst = makeInstance({
      id: 7,
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      password: '$argon2id$secret',
    });

    const result = UserModel.prototype.toJSON.call(inst);

    expect(result.id).toBe(7);
    expect(result.email).toBe('admin@example.com');
    expect(result.firstName).toBe('Admin');
    expect(result.role).toBe('admin');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// attributeValue.js — isValidColor inline validator
// ─────────────────────────────────────────────────────────────────────────────

describe('attributeValue.js — colorCode isValidColor validator', () => {
  let validator;

  beforeAll(() => {
    const { fields } = loadModelCapture('./attribute-value');
    validator = fields.colorCode.validate.isValidColor;
  });

  it('should not throw for a valid uppercase hex color', () => {
    expect(() => validator('#FF0000')).not.toThrow();
  });

  it('should not throw for a valid lowercase hex color', () => {
    expect(() => validator('#aabbcc')).not.toThrow();
  });

  it('should not throw for a valid mixed-case hex color', () => {
    expect(() => validator('#1A2b3C')).not.toThrow();
  });

  it('should throw for a named color string (not hex)', () => {
    expect(() => validator('red')).toThrow('Mã màu phải ở định dạng hex');
  });

  it('should throw for hex without leading #', () => {
    expect(() => validator('FF0000')).toThrow('Mã màu phải ở định dạng hex');
  });

  it('should throw for a hex with wrong digit count', () => {
    expect(() => validator('#FFF')).toThrow('Mã màu phải ở định dạng hex');
  });

  it('should NOT throw when value is null (guard: if (value))', () => {
    expect(() => validator(null)).not.toThrow();
  });

  it('should NOT throw when value is undefined', () => {
    expect(() => validator(undefined)).not.toThrow();
  });

  it('should NOT throw when value is empty string', () => {
    // Empty string is falsy — the guard `if (value)` skips validation
    expect(() => validator('')).not.toThrow();
  });
});
