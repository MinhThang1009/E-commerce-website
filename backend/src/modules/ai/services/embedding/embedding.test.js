/**
 * @file embedding.test.js
 * @description Gộp từ embedding.test.js + embedding.extra.test.js
 */
// ── Setup ────────────────────────────────────────────────────────────────────

jest.mock('@utils/logger', () => ({
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
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    jest.mock('axios', () => ({ post: jest.fn() }));
  });

  it('có OPENROUTER_API_KEY thật → logger.info được gọi', () => {
    process.env.OPENROUTER_API_KEY = 'real-key-abc123';
    const mockLogger = require('@utils/logger');
    require('./embedding');
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Embedding Service'));
    delete process.env.OPENROUTER_API_KEY;
  });

  it('API key là "demo-key" → logger.warn được gọi', () => {
    process.env.OPENROUTER_API_KEY = 'demo-key';
    const mockLogger = require('@utils/logger');
    require('./embedding');
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('OpenRouter API key'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateEmbedding() — API key guards', () => {
  let service;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
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
describe('generateEmbedding() — happy path', () => {
  let service;
  let axiosMod;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
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

  it('text khác nhau → mỗi text gọi API riêng', async () => {
    const emb1 = makeEmbedding(1536);
    const emb2 = makeEmbedding(1536).map((x) => x + 0.1);
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
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateEmbedding() — retry logic (no-op sleep)', () => {
  let service;
  let axiosMod;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    const mockPost = jest.fn();
    jest.mock('axios', () => ({ post: mockPost }));

    process.env.OPENROUTER_API_KEY = 'retry-test-key';
    service = require('./embedding');
    axiosMod = require('axios');

    // Override Promise-based sleep to resolve immediately
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
      fn();
      return 0;
    });
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
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
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
    const embeddings = [makeEmbedding(3), makeEmbedding(3).map((x) => x + 0.5)];
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
      expect.any(Object),
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
      expect.objectContaining({ timeout: 60000 }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateBatchEmbeddings() — retry (no-op sleep)', () => {
  let service;
  let axiosMod;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    const mockPost = jest.fn();
    jest.mock('axios', () => ({ post: mockPost }));

    process.env.OPENROUTER_API_KEY = 'batch-retry-key';
    service = require('./embedding');
    axiosMod = require('axios');

    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
      fn();
      return 0;
    });
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

// ═══════════════════════════════════════════════════════════════════════════════
// Extra coverage (từ embedding.extra.test.js)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('axios', () => ({ post: jest.fn() }));

// ── Tests ─────────────────────────────────────────────────────────────────────

// ─── initialize() error catch (line 48) ──────────────────────────────────────
// logger.info throw trong initialize() → nhánh catch gọi logger.error

describe('EmbeddingService — initialize() lỗi (line 48)', () => {
  it('khi logger.info throw trong initialize → nhánh catch gọi logger.error', () => {
    jest.resetModules();

    // Dùng global variable để tránh Jest mock factory hoisting restriction
    global.__mockEmbedInitCallCount = 0;

    jest.mock('@utils/logger', () => ({
      info: jest.fn().mockImplementation(() => {
        global.__mockEmbedInitCallCount = (global.__mockEmbedInitCallCount || 0) + 1;
        if (global.__mockEmbedInitCallCount === 1) {
          throw new Error('Logger initialization failed');
        }
      }),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    jest.mock('axios', () => ({ post: jest.fn() }));

    process.env.OPENROUTER_API_KEY = 'init-error-key';

    // Khi require embedding, constructor chạy initialize() → logger.info throw → catch
    require('./embedding');
    const mockLogger = require('@utils/logger');

    // Nhánh catch trong initialize() gọi logger.error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Khởi tạo Embedding Service thất bại'),
      expect.any(String),
    );

    delete process.env.OPENROUTER_API_KEY;
    delete global.__mockEmbedInitCallCount;
  });
});
