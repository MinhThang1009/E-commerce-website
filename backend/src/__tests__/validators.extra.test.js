/**
 * validators.extra.test.js
 *
 * Tests for stub Joi validators at 0% coverage:
 *   - src/modules/wishlist/validators/wishlistValidator.js
 *   - src/modules/upload/validators/uploadValidator.js
 *   - src/modules/inventory/validators/inventoryValidator.js
 *   - src/modules/ai/validators/aiValidator.js
 *
 * All four are stub objects with empty Joi.object() schemas for `create` and
 * `update`. Tests verify: module exports the expected shape, and that empty
 * schemas accept any object (including empty input) without error.
 */

process.env.NODE_ENV = 'test';

// ════════════════════════════════════════════════════════════════════════════
// wishlistValidator
// ════════════════════════════════════════════════════════════════════════════

describe('wishlistValidator', () => {
  const wishlistValidator = require('../modules/wishlist/validators/wishlistValidator');

  it('xuất ra object có trường create và update', () => {
    expect(wishlistValidator).toHaveProperty('create');
    expect(wishlistValidator).toHaveProperty('update');
  });

  it('create schema chấp nhận object rỗng mà không có lỗi', () => {
    const { error } = wishlistValidator.create.validate({});
    expect(error).toBeUndefined();
  });

  it('update schema chấp nhận object rỗng mà không có lỗi', () => {
    const { error } = wishlistValidator.update.validate({});
    expect(error).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// uploadValidator
// ════════════════════════════════════════════════════════════════════════════

describe('uploadValidator', () => {
  const uploadValidator = require('../modules/upload/validators/uploadValidator');

  it('xuất ra object có trường create và update', () => {
    expect(uploadValidator).toHaveProperty('create');
    expect(uploadValidator).toHaveProperty('update');
  });

  it('create schema chấp nhận object rỗng mà không có lỗi', () => {
    const { error } = uploadValidator.create.validate({});
    expect(error).toBeUndefined();
  });

  it('update schema chấp nhận object rỗng mà không có lỗi', () => {
    const { error } = uploadValidator.update.validate({});
    expect(error).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// inventoryValidator
// ════════════════════════════════════════════════════════════════════════════

describe('inventoryValidator', () => {
  const inventoryValidator = require('../modules/inventory/validators/inventoryValidator');

  it('xuất ra object có trường create và update', () => {
    expect(inventoryValidator).toHaveProperty('create');
    expect(inventoryValidator).toHaveProperty('update');
  });

  it('create schema chấp nhận object rỗng mà không có lỗi', () => {
    const { error } = inventoryValidator.create.validate({});
    expect(error).toBeUndefined();
  });

  it('update schema chấp nhận object rỗng mà không có lỗi', () => {
    const { error } = inventoryValidator.update.validate({});
    expect(error).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// aiValidator
// ════════════════════════════════════════════════════════════════════════════

describe('aiValidator', () => {
  const aiValidator = require('../modules/ai/validators/aiValidator');

  it('xuất ra object có trường create và update', () => {
    expect(aiValidator).toHaveProperty('create');
    expect(aiValidator).toHaveProperty('update');
  });

  it('create schema chấp nhận object rỗng mà không có lỗi', () => {
    const { error } = aiValidator.create.validate({});
    expect(error).toBeUndefined();
  });

  it('update schema chấp nhận object rỗng mà không có lỗi', () => {
    const { error } = aiValidator.update.validate({});
    expect(error).toBeUndefined();
  });
});
