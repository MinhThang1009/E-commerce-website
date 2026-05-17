'use strict';
/**
 * Unit tests cho hooks trong Brand, Category, Collection models.
 *
 * Strategy: mock sequelize.define ở module level để capture hooks.
 * Không kết nối DB thật.
 *
 * Uncovered branches:
 *   brand.js    line 48: if (brand.name && !brand.slug)
 *   category.js line 52: if (category.name)
 *   collection.js line 44: if (collection.name && !collection.slug)
 */

// ─── Module-level storage for captured hooks ─────────────────────────────────
// Must be at module level (not inside beforeAll) because jest.mock() factory
// is hoisted and can only reference module-level variables.

const brandHooks = {};
const categoryHooks = {};
const collectionHooks = {};

// ─── Mock slugify once for all tests ─────────────────────────────────────────

jest.mock('slugify', () => (text, opts) =>
  // Simplified: lowercase, replace non-alphanumeric with '-', trim hyphens
  String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
);

// ─────────────────────────────────────────────────────────────────────────────
// Brand model
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('../config/sequelize', () => {
  // Single mock that routes to the correct hooks object based on model name
  return {
    define: jest.fn((modelName, fields, opts) => {
      if (opts && opts.hooks) {
        if (modelName === 'Brand') Object.assign(brandHooks, opts.hooks);
        else if (modelName === 'Category') Object.assign(categoryHooks, opts.hooks);
        else if (modelName === 'Collection') Object.assign(collectionHooks, opts.hooks);
      }
      return {};  // mock Model object
    }),
  };
});

// Load all 3 models at the top level so their hooks are registered
require('../models/brand');
require('../models/category');
require('../models/collection');

// ─────────────────────────────────────────────────────────────────────────────
// Brand model tests — hook: beforeValidate
// if (brand.name && !brand.slug) → auto-generate slug
// ─────────────────────────────────────────────────────────────────────────────

describe('Brand model — beforeValidate hook', () => {
  it('tạo slug từ name khi brand.name có giá trị và slug chưa được đặt', () => {
    // Branch: both conditions true → generate slug
    const brand = { name: 'Apple', slug: undefined };
    brandHooks.beforeValidate(brand);
    expect(brand.slug).toBe('apple');
  });

  it('không thay đổi slug khi brand.slug đã có giá trị (false branch: !slug = false)', () => {
    // Branch false: slug already set → condition (name && !slug) = false
    const brand = { name: 'Samsung', slug: 'existing-slug' };
    brandHooks.beforeValidate(brand);
    expect(brand.slug).toBe('existing-slug');
  });

  it('không tạo slug khi brand.name là null (false branch: name = false)', () => {
    // Branch false: name is null/falsy → condition = false
    const brand = { name: null, slug: undefined };
    brandHooks.beforeValidate(brand);
    expect(brand.slug).toBeUndefined();
  });

  it('không tạo slug khi brand.name là chuỗi rỗng (false branch)', () => {
    const brand = { name: '', slug: undefined };
    brandHooks.beforeValidate(brand);
    expect(brand.slug).toBeUndefined();
  });

  it('tạo slug đúng format cho tên nhiều từ', () => {
    const brand = { name: 'HP Elitebook', slug: undefined };
    brandHooks.beforeValidate(brand);
    expect(brand.slug).toBe('hp-elitebook');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Category model tests — hook: beforeValidate
// if (category.name) → always overwrites slug
// ─────────────────────────────────────────────────────────────────────────────

describe('Category model — beforeValidate hook', () => {
  it('tạo slug từ name khi category.name có giá trị (true branch)', () => {
    // Branch true: category.name is truthy → generate slug
    const category = { name: 'Laptop', slug: undefined };
    categoryHooks.beforeValidate(category);
    expect(category.slug).toBe('laptop');
  });

  it('ghi đè slug hiện tại khi name có giá trị (category luôn overwrite)', () => {
    // Category hook doesn't check !slug, it always overwrites
    const category = { name: 'Gaming Gear', slug: 'old-slug' };
    categoryHooks.beforeValidate(category);
    expect(category.slug).toBe('gaming-gear');
  });

  it('không thay đổi slug khi category.name là null (false branch)', () => {
    // Branch false: category.name is null → if(null) = false → skip
    const category = { name: null, slug: 'existing' };
    categoryHooks.beforeValidate(category);
    expect(category.slug).toBe('existing');  // unchanged
  });

  it('không thay đổi slug khi category.name là chuỗi rỗng (false branch: "" is falsy)', () => {
    // False branch: '' is falsy → skip
    const category = { name: '', slug: 'keep-this' };
    categoryHooks.beforeValidate(category);
    expect(category.slug).toBe('keep-this');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Collection model tests — hook: beforeValidate
// if (collection.name && !collection.slug) → auto-generate slug
// ─────────────────────────────────────────────────────────────────────────────

describe('Collection model — beforeValidate hook', () => {
  it('tạo slug khi collection.name có giá trị và slug chưa được đặt', () => {
    // Branch: both conditions true → generate slug
    const collection = { name: 'Summer Sale', slug: undefined };
    collectionHooks.beforeValidate(collection);
    expect(collection.slug).toBe('summer-sale');
  });

  it('không thay đổi slug khi collection.slug đã được đặt (false: !slug = false)', () => {
    // Branch false: slug already set → condition (name && !slug) = false
    const collection = { name: 'New Arrivals', slug: 'existing-slug' };
    collectionHooks.beforeValidate(collection);
    expect(collection.slug).toBe('existing-slug');
  });

  it('không tạo slug khi collection.name là null (false: name is falsy)', () => {
    // Branch false: name is null → condition = false
    const collection = { name: null, slug: undefined };
    collectionHooks.beforeValidate(collection);
    expect(collection.slug).toBeUndefined();
  });

  it('không tạo slug khi collection.name là undefined (false branch)', () => {
    const collection = { name: undefined, slug: undefined };
    collectionHooks.beforeValidate(collection);
    expect(collection.slug).toBeUndefined();
  });

  it('tạo slug đúng format cho tên nhiều từ', () => {
    const collection = { name: 'Black Friday Deals', slug: undefined };
    collectionHooks.beforeValidate(collection);
    expect(collection.slug).toBe('black-friday-deals');
  });
});
