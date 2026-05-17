/**
 * Unit tests cho EmbeddingService (src/services/ai/embedding.js)
 *
 * Mock: axios (HTTP calls)
 * Phủ: generateEmbedding (cache hit/miss, no-API-key guard, retry, error),
 *       generateBatchEmbeddings, cache key normalization
 *
 * Retry logic dùng setTimeout — test bằng cách override sleep thành no-op
 * thay vì jest.useFakeTimers() để tránh race condition với async/await.
 */

// ── Setup ────────────────────────────────────────────────────────────────────

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  post: (...args) => mockAxiosPost(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeEmbedding(size = 5) {
  return Array.from({ length: size }, (_, i) => i * 0.1);
}

function makeApiResponse(embedding) {
  return { data: { data: [{ embedding }] } };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('EmbeddingService — initialize()', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    jest.mock('axios', () => ({ post: jest.fn() }));
  });

  it('có OPENROUTER_API_KEY thật → logger.info được gọi', () => {
    process.env.OPENROUTER_API_KEY = 'real-key-abc123';
    const mockLogger = require('../../utils/logger');
    require('./embedding');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Embedding Service')
    );
    delete process.env.OPENROUTER_API_KEY;
  });

  it('API key là "demo-key" → logger.warn được gọi', () => {
    process.env.OPENROUTER_API_KEY = 'demo-key';
    const mockLogger = require('../../utils/logger');
    require('./embedding');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('OpenRouter API key')
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateEmbedding() — API key guards', () => {
  let service;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    jest.mock('axios', () => ({ post: jest.fn() }));
    process.env.OPENROUTER_API_KEY = 'valid-test-key';
    service = require('./embedding');
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  it('apiKey = null → throw Error về cấu hình', async () => {
    service.apiKey = null;
    await expect(service.generateEmbedding('hello')).rejects.toThrow(/API key/);
  });

  it('apiKey = "demo-key" → throw Error', async () => {
    service.apiKey = 'demo-key';
    await expect(service.generateEmbedding('hello')).rejects.toThrow(/API key/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateEmbedding() — happy path + cache', () => {
  let service;
  let axiosMod;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    // Không mock axios qua jest.mock — dùng require để có thể spy
    const mockPost = jest.fn();
    jest.mock('axios', () => ({ post: mockPost }));

    process.env.OPENROUTER_API_KEY = 'valid-test-key';
    service = require('./embedding');
    axiosMod = require('axios');
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  it('API trả về embedding hợp lệ → trả về embedding', async () => {
    const embedding = makeEmbedding(1536);
    axiosMod.post.mockResolvedValue(makeApiResponse(embedding));

    const result = await service.generateEmbedding('test text');

    expect(result).toEqual(embedding);
    expect(axiosMod.post).toHaveBeenCalledTimes(1);
  });

  it('gọi với cùng text 2 lần → lần 2 dùng cache, KHÔNG gọi API lần 2', async () => {
    const embedding = makeEmbedding(1536);
    axiosMod.post.mockResolvedValue(makeApiResponse(embedding));

    await service.generateEmbedding('cached text');
    await service.generateEmbedding('cached text');

    expect(axiosMod.post).toHaveBeenCalledTimes(1);
  });

  it('cache key không phân biệt hoa-thường và trim whitespace', async () => {
    const embedding = makeEmbedding(1536);
    axiosMod.post.mockResolvedValue(makeApiResponse(embedding));

    await service.generateEmbedding('Hello World');
    await service.generateEmbedding('  hello world  ');

    expect(axiosMod.post).toHaveBeenCalledTimes(1);
  });

  it('text khác nhau → mỗi text gọi API riêng', async () => {
    const emb1 = makeEmbedding(1536);
    const emb2 = makeEmbedding(1536).map(x => x + 0.1);
    axiosMod.post
      .mockResolvedValueOnce(makeApiResponse(emb1))
      .mockResolvedValueOnce(makeApiResponse(emb2));

    const r1 = await service.generateEmbedding('text A');
    const r2 = await service.generateEmbedding('text B');

    expect(axiosMod.post).toHaveBeenCalledTimes(2);
    expect(r1).not.toEqual(r2);
  });

  it('gọi API với Authorization header đúng format', async () => {
    axiosMod.post.mockResolvedValue(makeApiResponse(makeEmbedding(1536)));

    await service.generateEmbedding('auth check');

    expect(axiosMod.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: expect.any(String), input: 'auth check' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-test-key',
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateEmbedding() — retry logic (no-op sleep)', () => {
  let service;
  let axiosMod;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    const mockPost = jest.fn();
    jest.mock('axios', () => ({ post: mockPost }));

    process.env.OPENROUTER_API_KEY = 'retry-test-key';
    service = require('./embedding');
    axiosMod = require('axios');

    // Override Promise-based sleep to resolve immediately
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('thất bại lần 1, thành công lần 2 → trả về kết quả', async () => {
    const embedding = makeEmbedding(1536);
    axiosMod.post
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce(makeApiResponse(embedding));

    const result = await service.generateEmbedding('retry test');

    expect(result).toEqual(embedding);
    expect(axiosMod.post).toHaveBeenCalledTimes(2);
  });

  it('thất bại 3 lần liên tiếp → throw lỗi', async () => {
    axiosMod.post.mockRejectedValue(new Error('persistent failure'));

    await expect(service.generateEmbedding('always fails')).rejects.toThrow('persistent failure');
    expect(axiosMod.post).toHaveBeenCalledTimes(3);
  });

  it('API trả về embedding null → retry rồi throw', async () => {
    axiosMod.post.mockResolvedValue({ data: { data: [{ embedding: null }] } });

    await expect(service.generateEmbedding('bad response')).rejects.toThrow();
    expect(axiosMod.post).toHaveBeenCalledTimes(3);
  });

  it('response format sai (không có data.data) → retry rồi throw', async () => {
    axiosMod.post.mockResolvedValue({ data: {} });

    await expect(service.generateEmbedding('malformed')).rejects.toThrow();
    expect(axiosMod.post).toHaveBeenCalledTimes(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateBatchEmbeddings()', () => {
  let service;
  let axiosMod;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    const mockPost = jest.fn();
    jest.mock('axios', () => ({ post: mockPost }));

    process.env.OPENROUTER_API_KEY = 'batch-test-key';
    service = require('./embedding');
    axiosMod = require('axios');
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  it('không có API key → throw', async () => {
    service.apiKey = null;
    await expect(service.generateBatchEmbeddings(['a', 'b'])).rejects.toThrow(/API key/);
  });

  it('API key là demo-key → throw', async () => {
    service.apiKey = 'demo-key';
    await expect(service.generateBatchEmbeddings(['a'])).rejects.toThrow(/API key/);
  });

  it('trả về mảng embedding cho từng text', async () => {
    const embeddings = [makeEmbedding(3), makeEmbedding(3).map(x => x + 0.5)];
    axiosMod.post.mockResolvedValue({
      data: { data: [{ embedding: embeddings[0] }, { embedding: embeddings[1] }] },
    });

    const result = await service.generateBatchEmbeddings(['text A', 'text B']);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(embeddings[0]);
    expect(result[1]).toEqual(embeddings[1]);
  });

  it('batch gọi axios với input là mảng text', async () => {
    axiosMod.post.mockResolvedValue({
      data: { data: [{ embedding: makeEmbedding(3) }] },
    });

    await service.generateBatchEmbeddings(['hello']);

    expect(axiosMod.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ input: ['hello'] }),
      expect.any(Object)
    );
  });

  it('timeout batch là 60000ms', async () => {
    axiosMod.post.mockResolvedValue({
      data: { data: [{ embedding: makeEmbedding(3) }] },
    });

    await service.generateBatchEmbeddings(['x']);

    expect(axiosMod.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ timeout: 60000 })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateBatchEmbeddings() — retry (no-op sleep)', () => {
  let service;
  let axiosMod;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    const mockPost = jest.fn();
    jest.mock('axios', () => ({ post: mockPost }));

    process.env.OPENROUTER_API_KEY = 'batch-retry-key';
    service = require('./embedding');
    axiosMod = require('axios');

    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('thất bại 3 lần → throw', async () => {
    axiosMod.post.mockRejectedValue(new Error('batch always fails'));

    await expect(service.generateBatchEmbeddings(['a', 'b'])).rejects.toThrow('batch always fails');
    expect(axiosMod.post).toHaveBeenCalledTimes(3);
  });

  it('thất bại lần 1, thành công lần 2', async () => {
    const embeddings = [makeEmbedding(3)];
    axiosMod.post
      .mockRejectedValueOnce(new Error('transient error'))
      .mockResolvedValueOnce({ data: { data: [{ embedding: embeddings[0] }] } });

    const result = await service.generateBatchEmbeddings(['retry batch']);

    expect(result).toHaveLength(1);
    expect(axiosMod.post).toHaveBeenCalledTimes(2);
  });
});

// ─── Cache FIFO eviction — line 26-27 ────────────────────────────────────────
// Covers lines 26-27: xóa entry cũ nhất khi cache đạt CACHE_MAX_SIZE (500)

describe('generateEmbedding() — cache FIFO eviction khi đầy (lines 26-27)', () => {
  let service;
  let axiosMod;
  const CACHE_MAX_SIZE = 500;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    const mockPost = jest.fn();
    jest.mock('axios', () => ({ post: mockPost }));

    process.env.OPENROUTER_API_KEY = 'valid-test-key';
    service = require('./embedding');
    axiosMod = require('axios');
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  it('khi cache đạt max size → entry cũ nhất bị xóa để nhường chỗ entry mới (FIFO)', async () => {
    const embedding = makeEmbedding(5);
    // Mock axios trả về luôn mà không cần retry
    axiosMod.post.mockResolvedValue(makeApiResponse(embedding));

    // Điền cache tới CACHE_MAX_SIZE bằng cách generate 500 unique texts
    for (let i = 0; i < CACHE_MAX_SIZE; i++) {
      await service.generateEmbedding(`unique-text-${i}`);
    }

    // Lần này là entry thứ 501 → phải trigger FIFO eviction (lines 26-27)
    // "unique-text-0" là entry đầu tiên → sẽ bị xóa
    await service.generateEmbedding('new-entry-triggers-eviction');

    // Gọi lại "unique-text-0" → phải gọi API lại (không còn trong cache)
    axiosMod.post.mockClear();
    await service.generateEmbedding('unique-text-0');
    expect(axiosMod.post).toHaveBeenCalledTimes(1); // phải gọi lại vì đã bị evict
  }, 30000); // timeout 30s cho 500 iterations
});
