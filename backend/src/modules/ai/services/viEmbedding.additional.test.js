// Additional tests cho VietnameseEmbeddingService (src/services/ai/viEmbedding.js)
// Mock: axios, logger — không gọi HuggingFace API thật
// Phủ: isAvailable, generateEmbedding (happy path, retry, dim mismatch, exhausted retries)

// ─── Setup trước khi require module ──────────────────────────────────────────

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  post: (...args) => mockAxiosPost(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function make1024Vector() {
  return Array.from({ length: 1024 }, (_, i) => i * 0.001);
}

// ════════════════════════════════════════════════════════════════════════════
// isAvailable
// ════════════════════════════════════════════════════════════════════════════

describe('VietnameseEmbeddingService.isAvailable', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.mock('axios', () => ({ post: jest.fn() }));
  });

  test('trả true khi HF_API_KEY được cấu hình', () => {
    process.env.HF_API_KEY = 'hf-test-key-abc123';
    const service = require('./viEmbedding');
    expect(service.isAvailable()).toBe(true);
    delete process.env.HF_API_KEY;
  });

  test('trả false khi HF_API_KEY không được cấu hình', () => {
    delete process.env.HF_API_KEY;
    const service = require('./viEmbedding');
    expect(service.isAvailable()).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// generateEmbedding — guard và happy path
// ════════════════════════════════════════════════════════════════════════════

describe('VietnameseEmbeddingService.generateEmbedding', () => {
  let service;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    mockAxiosPost.mockReset();
    jest.mock('axios', () => ({ post: (...args) => mockAxiosPost(...args) }));
  });

  test('ném lỗi khi HF_API_KEY chưa được cấu hình', async () => {
    delete process.env.HF_API_KEY;
    service = require('./viEmbedding');

    await expect(service.generateEmbedding('xin chào')).rejects.toThrow(
      'HF_API_KEY chưa được cấu hình',
    );
  });

  test('trả embedding đúng 1024 dims — response dạng flat array', async () => {
    process.env.HF_API_KEY = 'hf-valid-key';
    service = require('./viEmbedding');

    const embedding = make1024Vector();
    mockAxiosPost.mockResolvedValue({ data: embedding });

    const result = await service.generateEmbedding('xin chào');

    expect(result).toHaveLength(1024);
    expect(result[0]).toBeCloseTo(0);
    delete process.env.HF_API_KEY;
  });

  test('trả embedding đúng 1024 dims — response dạng nested array (response.data[0])', async () => {
    process.env.HF_API_KEY = 'hf-valid-key-2';
    service = require('./viEmbedding');

    const embedding = make1024Vector();
    // multilingual-e5-large đôi khi trả [[...]] thay vì [...]
    mockAxiosPost.mockResolvedValue({ data: [embedding] });

    const result = await service.generateEmbedding('sản phẩm');

    expect(result).toHaveLength(1024);
    delete process.env.HF_API_KEY;
  });

  test('gọi axios.post với đúng URL và Authorization header', async () => {
    process.env.HF_API_KEY = 'hf-test-header';
    service = require('./viEmbedding');

    const embedding = make1024Vector();
    mockAxiosPost.mockResolvedValue({ data: embedding });

    await service.generateEmbedding('kiểm tra header');

    expect(mockAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('multilingual-e5-large'),
      { inputs: 'query: kiểm tra header' },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer hf-test-header',
        }),
        timeout: 30000,
      }),
    );
    delete process.env.HF_API_KEY;
  });
});

// ════════════════════════════════════════════════════════════════════════════
// generateEmbedding — lỗi và retry logic
// ════════════════════════════════════════════════════════════════════════════

describe('VietnameseEmbeddingService.generateEmbedding — retry và error', () => {
  let service;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    mockAxiosPost.mockReset();
    jest.mock('axios', () => ({ post: (...args) => mockAxiosPost(...args) }));
    process.env.HF_API_KEY = 'hf-retry-key';
    service = require('./viEmbedding');
    logger = require('../../../utils/logger');
  });

  afterEach(() => {
    delete process.env.HF_API_KEY;
  });

  test('retry sau lần thất bại đầu — thành công ở lần 2', async () => {
    const embedding = make1024Vector();
    mockAxiosPost
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce({ data: embedding });

    const result = await service.generateEmbedding('retry test');

    expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1024);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('lần 1'));
  });

  test('retry 2 lần thất bại — thành công ở lần 3 (lần cuối)', async () => {
    const embedding = make1024Vector();
    mockAxiosPost
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce({ data: embedding });

    const result = await service.generateEmbedding('third attempt');

    expect(mockAxiosPost).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(1024);
  });

  test('ném lỗi sau tất cả 3 lần thất bại — log error', async () => {
    mockAxiosPost.mockRejectedValue(new Error('persistent failure'));

    await expect(service.generateEmbedding('always fail')).rejects.toThrow('persistent failure');

    expect(mockAxiosPost).toHaveBeenCalledTimes(3);
    // logger.error('❌ VI embedding thất bại sau', 3, 'lần thử:', errorMsg) — 4 separate args
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('VI embedding thất bại sau'),
      3,
      'lần thử:',
      'persistent failure',
    );
  });

  test('ném lỗi khi embedding dimension không khớp (bít dim sai)', async () => {
    const wrongDimEmbedding = Array.from({ length: 512 }, (_, i) => i * 0.001);
    mockAxiosPost.mockResolvedValue({ data: wrongDimEmbedding });

    await expect(service.generateEmbedding('wrong dim')).rejects.toThrow(
      /Invalid embedding.*expected 1024 dims.*got 512/i,
    );
  });

  test('ném lỗi khi response.data là null (null access)', async () => {
    mockAxiosPost.mockResolvedValue({ data: null });

    // response.data[0] throws TypeError khi data=null — bất kỳ lỗi nào đều acceptable
    await expect(service.generateEmbedding('null response')).rejects.toThrow();
  });

  test('ném lỗi khi embedding là mảng rỗng', async () => {
    mockAxiosPost.mockResolvedValue({ data: [] });

    await expect(service.generateEmbedding('empty array')).rejects.toThrow(/Invalid embedding/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Khởi tạo module — logger calls theo API key
// ════════════════════════════════════════════════════════════════════════════

describe('VietnameseEmbeddingService — khởi tạo', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.mock('axios', () => ({ post: jest.fn() }));
  });

  afterEach(() => {
    delete process.env.HF_API_KEY;
  });

  test('log info khi HF_API_KEY được cấu hình', () => {
    process.env.HF_API_KEY = 'hf-real-key';
    const logger = require('../../../utils/logger');
    require('./viEmbedding');
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Vietnamese Embedding Service'),
    );
  });

  test('log warn khi HF_API_KEY không được cấu hình', () => {
    delete process.env.HF_API_KEY;
    const logger = require('../../../utils/logger');
    require('./viEmbedding');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('HF_API_KEY chưa được cấu hình'),
    );
  });
});
