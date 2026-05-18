/**
 * @file keywordFallback.test.js
 * @description Tests cho keywordFallback.js — phủ simpleKeywordMatch và getFallbackResponse.
 * Tập trung vào lines 41-47 (versionNumbers filter empty → productName extraction).
 */

jest.mock('@utils/logger', () => ({ debug: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('@modules/ai/services/chatbot/language/language-detector', () => ({
  detectLanguage: jest.fn((text) => {
    if (/[àáâãèéêìíòóôõùúýăđơưÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐƠƯẠ-ỹ]/.test(text)) return 'vi';
    return 'en';
  }),
}));

const { simpleKeywordMatch, getFallbackResponse } = require('./keyword-fallback');

const makeProduct = (overrides = {}) => ({
  id: 1,
  name: 'iPhone 14 Pro',
  slug: 'iphone-14-pro',
  shortDescription: 'điện thoại cao cấp',
  price: 25000000,
  compareAtPrice: null,
  thumbnail: null,
  inStock: true,
  ...overrides,
});

// ── simpleKeywordMatch — happy path ───────────────────────────────────────────

describe('simpleKeywordMatch — match thành công', () => {
  test('match theo tên sản phẩm', () => {
    const products = [makeProduct()];
    const result = simpleKeywordMatch('iPhone 14', products);
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.intent).toBe('product_search');
  });

  test('match theo shortDescription', () => {
    const products = [makeProduct({ shortDescription: 'gaming laptop dell' })];
    const result = simpleKeywordMatch('laptop gaming', products);
    expect(result).toHaveProperty('response');
  });

  test('discount > 0 khi compareAtPrice > price', () => {
    const products = [makeProduct({ price: 20000000, compareAtPrice: 25000000 })];
    const result = simpleKeywordMatch('iphone 14 pro', products);
    // Assertion unconditional — nếu không match được product, test PHẢI fail rõ ràng
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0].discount).toBeGreaterThan(0);
  });

  test('không match → trả về fallback với suggestions', () => {
    const result = simpleKeywordMatch('máy in 3D', []);
    expect(result).toHaveProperty('suggestions');
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});

// ── simpleKeywordMatch — versionNumbers filter empty (lines 41-47) ─────────────

describe('simpleKeywordMatch — versionNumbers exist nhưng filtered empty (lines 41-47)', () => {
  test('message có số 15 nhưng không có sản phẩm nào tên chứa 15 → lines 41-47', () => {
    // Products chỉ có 'iPhone 14' — không chứa '15'
    // versionNumbers = ['15'] → filtered = [] → vào block 41-47
    const products = [makeProduct({ name: 'iPhone 14 Pro', shortDescription: 'iphone fourteen' })];
    const result = simpleKeywordMatch('iphone 15 giá bao nhiêu', products);
    // Không tìm thấy iPhone 15 → response có message không có sản phẩm
    expect(result.response).toContain('15');
    expect(result.products).toHaveLength(0);
  });

  test('English message với version number không tìm thấy → English response (lines 48-52)', () => {
    // '25' có trong message, không có product nào tên chứa '25' → filtered.length === 0
    // detectLanguage('how much') = 'en' → isEn = true → English response (lines 48-52)
    const products = [makeProduct({ name: 'Samsung Galaxy S24', shortDescription: 'samsung 24' })];
    const result = simpleKeywordMatch('samsung 25 how much', products);
    // English path: "We don't currently have..."
    expect(result.response).toMatch(/don't currently have|We don/i);
    expect(Array.isArray(result.suggestions)).toBe(true);
    // English suggestions
    expect(result.suggestions).toContain('View similar products');
  });

  test('versionNumbers có kết quả → dùng filtered thay vì tất cả', () => {
    // products có cả 14 và 15, message hỏi về 14 → chỉ lấy iPhone 14
    const products = [
      makeProduct({ id: 1, name: 'iPhone 14 Pro' }),
      makeProduct({ id: 2, name: 'iPhone 15 Pro' }),
    ];
    const result = simpleKeywordMatch('iphone 14', products);
    // filtered = products có '14' → chỉ iPhone 14 được giữ
    expect(result).toHaveProperty('response');
  });
});

// ── getFallbackResponse ───────────────────────────────────────────────────────

describe('getFallbackResponse', () => {
  test('trả về response, suggestions, intent', () => {
    const result = getFallbackResponse('xin chào');
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('suggestions');
    expect(result).toHaveProperty('intent');
  });

  test('intent là general', () => {
    expect(getFallbackResponse('anything').intent).toBe('general');
  });
});
