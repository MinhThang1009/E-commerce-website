/**
 * Phase 44 — Unit tests cho ruleBasedChatbot pure helpers
 * Cover: matchesPatterns, selectPitchType, formatPrice, extractSearchParams (price/color/brand parsing)
 * Mock: models (Product/Category/Brand), logger.
 */

jest.mock('../models', () => ({
  Product: { findAll: jest.fn() },
  Category: { findAll: jest.fn().mockResolvedValue([]) },
  Brand: { findAll: jest.fn().mockResolvedValue([]) },
  Order: { findAll: jest.fn() },
  OrderItem: { findAll: jest.fn() },
  User: { findOne: jest.fn() },
}));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const chatbotService = require('../services/ai/ruleBasedChatbot');

describe('matchesPatterns', () => {
  test('Text chứa pattern → true', () => {
    expect(chatbotService.matchesPatterns('tôi muốn mua iphone', ['mua', 'cần']))
      .toBe(true);
  });

  test('Text không chứa pattern nào → false', () => {
    expect(chatbotService.matchesPatterns('hello world', ['mua', 'cần']))
      .toBe(false);
  });

  test('Patterns rỗng → false', () => {
    expect(chatbotService.matchesPatterns('any text', [])).toBe(false);
  });
});

describe('formatPrice', () => {
  test('Format VND currency Vietnamese locale', () => {
    const result = chatbotService.formatPrice(1500000);
    // Output có thể là "1.500.000 ₫" hoặc "1,500,000 ₫" tùy locale Node version
    expect(result).toMatch(/1[.,]500[.,]000.*₫/);
  });

  test('Số 0 → "0 ₫"', () => {
    expect(chatbotService.formatPrice(0)).toMatch(/0.*₫/);
  });
});

describe('selectPitchType', () => {
  test('VIP user → "personal"', () => {
    expect(chatbotService.selectPitchType(
      { isVip: true },
      'mua điện thoại',
      {}
    )).toBe('personal');
  });

  test('Message chứa "giá" → "value"', () => {
    expect(chatbotService.selectPitchType(
      { isVip: false },
      'sản phẩm này giá bao nhiêu',
      {}
    )).toBe('value');
  });

  test('Message chứa "rẻ" → "value"', () => {
    expect(chatbotService.selectPitchType(
      null,
      'có cái nào rẻ hơn không',
      {}
    )).toBe('value');
  });

  test('Message chứa "hot" → "social_proof"', () => {
    expect(chatbotService.selectPitchType(
      null,
      'sản phẩm hot nhất',
      {}
    )).toBe('social_proof');
  });

  test('Context evening → "urgency"', () => {
    expect(chatbotService.selectPitchType(
      null,
      'xem hàng',
      { timeOfDay: 'evening' }
    )).toBe('urgency');
  });

  test('Default random — return giá trị trong list 4 type', () => {
    const result = chatbotService.selectPitchType(
      null,
      'random message',
      { timeOfDay: 'morning' }
    );
    expect(['urgency', 'social_proof', 'value', 'scarcity']).toContain(result);
  });
});

describe('getSalesPitchTemplates', () => {
  test('Trả về 6 template với placeholder', () => {
    const templates = chatbotService.getSalesPitchTemplates();
    expect(Object.keys(templates)).toEqual(
      expect.arrayContaining(['urgency', 'personal', 'social_proof', 'value', 'scarcity', 'seasonal'])
    );
    expect(templates.urgency).toContain('{discount}');
    expect(templates.personal).toContain('{name}');
    expect(templates.value).toContain('{savings}');
  });
});

describe('extractSearchParams', () => {
  beforeAll(async () => {
    // Mock cache để test parse
    chatbotService._brandsCache = ['apple', 'samsung', 'xiaomi'];
    chatbotService._categoriesCache = ['Điện thoại', 'Laptop', 'Tablet'];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  test('Extract category từ alias — "phone" → "Điện thoại"', () => {
    const params = chatbotService.extractSearchParams('tìm phone giá rẻ');
    expect(params.category).toBe('Điện thoại');
  });

  test('Extract brand từ DB cache', () => {
    const params = chatbotService.extractSearchParams('mua iphone apple đời mới');
    expect(params.brand).toBe('apple');
  });

  test('Extract maxPrice — "dưới 5 triệu"', () => {
    const params = chatbotService.extractSearchParams('điện thoại dưới 5 triệu');
    expect(params.maxPrice).toBe(5000000);
  });

  test('Extract minPrice — "trên 10 triệu"', () => {
    const params = chatbotService.extractSearchParams('laptop trên 10 triệu');
    expect(params.minPrice).toBe(10000000);
  });

  test('Extract maxPrice — "tối đa 1tr"', () => {
    const params = chatbotService.extractSearchParams('có gì tối đa 1tr');
    expect(params.maxPrice).toBe(1000000);
  });

  test('Đơn vị "k/nghìn" → nhân 1000', () => {
    const params = chatbotService.extractSearchParams('phụ kiện dưới 500k');
    expect(params.maxPrice).toBe(500000);
  });

  test('Extract color', () => {
    const params = chatbotService.extractSearchParams('điện thoại màu đen');
    expect(params.color).toBe('đen');
  });

  test('Keyword luôn = message gốc', () => {
    const message = 'tôi muốn mua iphone 15 pro max';
    const params = chatbotService.extractSearchParams(message);
    expect(params.keyword).toBe(message);
  });

  test('Message không có pattern → chỉ keyword', () => {
    const params = chatbotService.extractSearchParams('xin chào');
    expect(params).toEqual({ keyword: 'xin chào' });
  });
});

describe('analyzeIntent', () => {
  beforeAll(async () => {
    chatbotService._brandsCache = ['apple'];
    chatbotService._categoriesCache = ['Điện thoại'];
    chatbotService._cacheExpiry = Date.now() + 60000;
  });

  test('"tìm sản phẩm" → product_search', async () => {
    const intent = await chatbotService.analyzeIntent('tìm điện thoại apple');
    expect(intent.type).toBe('product_search');
    expect(intent.confidence).toBe(0.8);
  });

  test('"gợi ý" → product_recommendation', async () => {
    const intent = await chatbotService.analyzeIntent('gợi ý cho tôi');
    expect(intent.type).toBe('product_recommendation');
    expect(intent.confidence).toBe(0.9);
  });

  test('"recommend" → product_recommendation', async () => {
    const intent = await chatbotService.analyzeIntent('please recommend something');
    expect(intent.type).toBe('product_recommendation');
  });
});
