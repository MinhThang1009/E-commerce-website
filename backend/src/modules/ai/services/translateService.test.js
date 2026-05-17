/**
 * translateService.test.js
 *
 * 100% branch coverage for src/services/ai/translateService.js
 *
 * Branches to cover:
 *   1. texts null          → return texts
 *   2. texts undefined     → return texts
 *   3. texts empty array   → return texts
 *   4. apiKey not set      → return texts
 *   5. apiKey === 'demo-key' → return texts
 *   6. content is null/undefined → return texts
 *   7. parsed is a direct JSON array (same length) → return translated array
 *   8. parsed is object with `translations` key    → extract array
 *   9. parsed is object with `result` key          → extract array
 *  10. parsed is object with `items` key           → extract array
 *  11. parsed is object with none of those keys    → fall back to texts
 *  12. result array has wrong length               → fall back to texts
 *  13. JSON.parse throws                           → catch → logger.warn + return texts
 *  14. axios.post throws (network error)           → catch → logger.warn + return texts
 */

process.env.NODE_ENV = 'test';

jest.mock('axios');
jest.mock('../../../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const axios = require('axios');
const logger = require('../../../utils/logger');
const { translateBatch } = require('./translateService');

// Convenience: build the axios response shape the service expects
function makeAxiosResponse(content) {
  return {
    data: {
      choices: [{ message: { content } }],
    },
  };
}

// ─── reset mocks between tests ────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  // Set a valid API key by default; individual tests override when needed
  process.env.OPENROUTER_API_KEY = 'sk-real-key';
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
});

// ══════════════════════════════════════════════════════════════════════════════
// Early-return guards (no API call made)
// ══════════════════════════════════════════════════════════════════════════════

describe('translateBatch — early-return guards (no API call)', () => {
  it('trả về nguyên texts khi texts là null', async () => {
    const result = await translateBatch(null);
    expect(result).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('trả về nguyên texts khi texts là undefined', async () => {
    const result = await translateBatch(undefined);
    expect(result).toBeUndefined();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('trả về nguyên texts khi texts là mảng rỗng', async () => {
    const emptyTexts = [];
    const result = await translateBatch(emptyTexts);
    expect(result).toBe(emptyTexts);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('trả về nguyên texts khi OPENROUTER_API_KEY chưa được đặt', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const texts = ['xin chào'];
    const result = await translateBatch(texts);
    expect(result).toBe(texts);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("trả về nguyên texts khi OPENROUTER_API_KEY === 'demo-key'", async () => {
    process.env.OPENROUTER_API_KEY = 'demo-key';
    const texts = ['xin chào'];
    const result = await translateBatch(texts);
    expect(result).toBe(texts);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// content guard (choices[0].message.content is falsy)
// ══════════════════════════════════════════════════════════════════════════════

describe('translateBatch — content null/undefined branch', () => {
  it('trả về nguyên texts khi content là null', async () => {
    axios.post.mockResolvedValue(makeAxiosResponse(null));
    const texts = ['xin chào', 'tạm biệt'];
    const result = await translateBatch(texts);
    expect(result).toBe(texts);
  });

  it('trả về nguyên texts khi choices mảng rỗng (content undefined qua optional chain)', async () => {
    axios.post.mockResolvedValue({ data: { choices: [] } });
    const texts = ['laptop gaming'];
    const result = await translateBatch(texts);
    expect(result).toBe(texts);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Happy path — parsed is direct JSON array
// ══════════════════════════════════════════════════════════════════════════════

describe('translateBatch — parsed là mảng JSON trực tiếp', () => {
  it('trả về mảng đã dịch khi API trả về JSON array cùng độ dài', async () => {
    const texts = ['xin chào', 'tạm biệt'];
    const translated = ['hello', 'goodbye'];
    axios.post.mockResolvedValue(makeAxiosResponse(JSON.stringify(translated)));

    const result = await translateBatch(texts);
    expect(result).toEqual(translated);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Parsed is an object with wrapper key
// ══════════════════════════════════════════════════════════════════════════════

describe('translateBatch — API trả về object có key bọc ngoài', () => {
  it("trích xuất mảng từ key 'translations'", async () => {
    const texts = ['laptop', 'điện thoại'];
    const translated = ['laptop', 'phone'];
    const payload = { translations: translated };
    axios.post.mockResolvedValue(makeAxiosResponse(JSON.stringify(payload)));

    const result = await translateBatch(texts);
    expect(result).toEqual(translated);
  });

  it("trích xuất mảng từ key 'result'", async () => {
    const texts = ['màn hình'];
    const translated = ['monitor'];
    const payload = { result: translated };
    axios.post.mockResolvedValue(makeAxiosResponse(JSON.stringify(payload)));

    const result = await translateBatch(texts);
    expect(result).toEqual(translated);
  });

  it("trích xuất mảng từ key 'items'", async () => {
    const texts = ['bàn phím', 'chuột'];
    const translated = ['keyboard', 'mouse'];
    const payload = { items: translated };
    axios.post.mockResolvedValue(makeAxiosResponse(JSON.stringify(payload)));

    const result = await translateBatch(texts);
    expect(result).toEqual(translated);
  });

  it("fallback về texts khi object không có key 'translations', 'result', hay 'items'", async () => {
    const texts = ['bộ nhớ'];
    // Object but none of the known keys → ?? falls through to texts
    const payload = { data: ['memory'] };
    axios.post.mockResolvedValue(makeAxiosResponse(JSON.stringify(payload)));

    const result = await translateBatch(texts);
    // parsed.translations = undefined → parsed.result = undefined → parsed.items = undefined → texts
    expect(result).toBe(texts);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Length mismatch — result array has wrong length → fall back
// ══════════════════════════════════════════════════════════════════════════════

describe('translateBatch — mảng kết quả có độ dài sai', () => {
  it('fallback về texts khi mảng dịch có ít phần tử hơn texts', async () => {
    const texts = ['xin chào', 'tạm biệt', 'cảm ơn'];
    const shortArray = ['hello', 'goodbye']; // length 2, texts.length 3
    axios.post.mockResolvedValue(makeAxiosResponse(JSON.stringify(shortArray)));

    const result = await translateBatch(texts);
    expect(result).toBe(texts);
  });

  it('fallback về texts khi mảng dịch có nhiều phần tử hơn texts', async () => {
    const texts = ['laptop'];
    const longArray = ['laptop', 'extra', 'surplus']; // length 3, texts.length 1
    axios.post.mockResolvedValue(makeAxiosResponse(JSON.stringify(longArray)));

    const result = await translateBatch(texts);
    expect(result).toBe(texts);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// catch branch — JSON.parse throws invalid JSON
// ══════════════════════════════════════════════════════════════════════════════

describe('translateBatch — catch branch khi JSON.parse thất bại', () => {
  it('gọi logger.warn và trả về texts nguyên khi content không phải JSON hợp lệ', async () => {
    const texts = ['sản phẩm'];
    axios.post.mockResolvedValue(makeAxiosResponse('THIS IS NOT JSON'));

    const result = await translateBatch(texts);

    expect(result).toBe(texts);
    expect(logger.warn).toHaveBeenCalledWith(
      'translateBatch thất bại, giữ nguyên giá trị gốc:',
      expect.any(String),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// catch branch — axios.post throws (network / timeout error)
// ══════════════════════════════════════════════════════════════════════════════

describe('translateBatch — catch branch khi axios.post throw', () => {
  it('gọi logger.warn và trả về texts nguyên khi network lỗi', async () => {
    const texts = ['điện thoại thông minh'];
    const networkError = new Error('Network Error');
    axios.post.mockRejectedValue(networkError);

    const result = await translateBatch(texts);

    expect(result).toBe(texts);
    expect(logger.warn).toHaveBeenCalledWith(
      'translateBatch thất bại, giữ nguyên giá trị gốc:',
      networkError.message,
    );
  });

  it('gọi logger.warn và trả về texts nguyên khi request timeout', async () => {
    const texts = ['tai nghe'];
    const timeoutError = new Error('timeout of 30000ms exceeded');
    axios.post.mockRejectedValue(timeoutError);

    const result = await translateBatch(texts);

    expect(result).toBe(texts);
    expect(logger.warn).toHaveBeenCalledWith(
      'translateBatch thất bại, giữ nguyên giá trị gốc:',
      timeoutError.message,
    );
  });
});
