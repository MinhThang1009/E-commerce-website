/**
 * @file ragPipeline.test.js
 * @description Unit tests cho RAGPipeline — orchestration Retrieve-Augment-Generate.
 * Không gọi mạng/DB — tất cả dependencies đều bị mock.
 */

const RAGPipeline = require('./rag-pipeline');
const { AppError } = require('@shared/errors');

// Mock logger để tránh log noise khi test
jest.mock('@utils/logger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChatbotService(overrides = {}) {
  return {
    handleMessage: jest.fn().mockResolvedValue({ response: 'ok', products: [] }),
    rewriteQuery: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeVectorStore(overrides = {}) {
  return {
    hybridSearch: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeProduct(id) {
  return { score: 0.9, metadata: { id, name: `Product ${id}` } };
}

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('RAGPipeline constructor', () => {
  test('throw khi thiếu chatbotService', () => {
    expect(() => new RAGPipeline({})).toThrow('RAGPipeline: chatbotService bắt buộc');
  });

  test('tạo thành công với chatbotService', () => {
    const pipeline = new RAGPipeline({ chatbotService: makeChatbotService() });
    expect(pipeline).toBeInstanceOf(RAGPipeline);
  });

  test('vectorStore mặc định là null', () => {
    const pipeline = new RAGPipeline({ chatbotService: makeChatbotService() });
    expect(pipeline.vectorStore).toBeNull();
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe('RAGPipeline.run() — validation', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new RAGPipeline({ chatbotService: makeChatbotService() });
  });

  test('throw AppError 400 khi message rỗng', async () => {
    await expect(pipeline.run({ message: '' })).rejects.toThrow(AppError);
    await expect(pipeline.run({ message: '' })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('throw AppError 400 khi message chỉ có khoảng trắng', async () => {
    await expect(pipeline.run({ message: '   ' })).rejects.toThrow(AppError);
  });

  test('throw AppError 400 khi message quá dài (>2000 ký tự)', async () => {
    const longMessage = 'a'.repeat(2001);
    await expect(pipeline.run({ message: longMessage })).rejects.toThrow(AppError);
  });

  test('throw AppError 400 khi message null', async () => {
    await expect(pipeline.run({ message: null })).rejects.toThrow(AppError);
  });
});

// ─── Off-topic path ───────────────────────────────────────────────────────────

describe('RAGPipeline.run() — off-topic', () => {
  test('off-topic → gọi handleMessage với preClassifiedIntent off_topic, bỏ qua retrieval', async () => {
    const llm = makeChatbotService();
    const vs = makeVectorStore();
    const pipeline = new RAGPipeline({ chatbotService: llm, vectorStore: vs });

    await pipeline.run({ message: 'thời tiết hôm nay thế nào', userId: 1 });

    expect(llm.handleMessage).toHaveBeenCalledWith(
      'thời tiết hôm nay thế nào',
      1,
      undefined,
      expect.objectContaining({ preClassifiedIntent: 'off_topic' }),
    );
    // Không được gọi vectorStore
    expect(vs.hybridSearch).not.toHaveBeenCalled();
  });
});

// ─── No vectorStore ────────────────────────────────────────────────────────────

describe('RAGPipeline.run() — không có vectorStore', () => {
  test('gọi handleMessage với classifyIntent, không có retrievedProducts', async () => {
    const llm = makeChatbotService();
    const pipeline = new RAGPipeline({ chatbotService: llm });

    await pipeline.run({ message: 'iPhone 15 giá bao nhiêu', sessionId: 'sess-1' });

    expect(llm.handleMessage).toHaveBeenCalledWith(
      'iPhone 15 giá bao nhiêu',
      undefined,
      'sess-1',
      expect.not.objectContaining({ retrievedProducts: expect.anything() }),
    );
  });

  test('intent product_search được classify đúng cho query có tên sản phẩm', async () => {
    const llm = makeChatbotService();
    const pipeline = new RAGPipeline({ chatbotService: llm });

    await pipeline.run({ message: 'macbook air m3' });

    expect(llm.handleMessage).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({ preClassifiedIntent: 'product_search' }),
    );
  });
});

// ─── VectorStore — happy path ─────────────────────────────────────────────────

describe('RAGPipeline.run() — vectorStore', () => {
  test('LLM rewrite null → dùng initial results', async () => {
    const products = [makeProduct(1), makeProduct(2)];
    const llm = makeChatbotService({ rewriteQuery: jest.fn().mockResolvedValue(null) });
    const vs = makeVectorStore({ hybridSearch: jest.fn().mockResolvedValue(products) });
    const pipeline = new RAGPipeline({ chatbotService: llm, vectorStore: vs });

    await pipeline.run({ message: 'điện thoại Samsung' });

    expect(vs.hybridSearch).toHaveBeenCalledTimes(1);
    expect(llm.handleMessage).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({
        retrievedProducts: expect.arrayContaining([expect.objectContaining({ id: 1 })]),
      }),
    );
  });

  test('LLM rewrite giống query (case-insensitive) → dùng initial results', async () => {
    const products = [makeProduct(3)];
    const query = 'Samsung Galaxy';
    const llm = makeChatbotService({ rewriteQuery: jest.fn().mockResolvedValue('samsung galaxy') });
    const vs = makeVectorStore({ hybridSearch: jest.fn().mockResolvedValue(products) });
    const pipeline = new RAGPipeline({ chatbotService: llm, vectorStore: vs });

    await pipeline.run({ message: query });

    expect(vs.hybridSearch).toHaveBeenCalledTimes(1);
    expect(llm.handleMessage).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({ retrievedProducts: [expect.objectContaining({ id: 3 })] }),
    );
  });

  test('LLM rewrite khác → refined search có kết quả → dùng refined', async () => {
    const initialProducts = [makeProduct(1)];
    const refinedProducts = [makeProduct(5), makeProduct(6)];
    // query không chứa abbreviation → normalizedQuery giữ nguyên, rewrite thật sự khác
    const llm = makeChatbotService({
      rewriteQuery: jest.fn().mockResolvedValue('Dell Gaming Laptop RTX 4060'),
    });
    const vs = makeVectorStore({
      hybridSearch: jest
        .fn()
        .mockResolvedValueOnce(initialProducts)
        .mockResolvedValueOnce(refinedProducts),
    });
    const pipeline = new RAGPipeline({ chatbotService: llm, vectorStore: vs });

    await pipeline.run({ message: 'laptop gaming dell' });

    expect(vs.hybridSearch).toHaveBeenCalledTimes(2);
    expect(llm.handleMessage).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({
        retrievedProducts: expect.arrayContaining([expect.objectContaining({ id: 5 })]),
        llmRewrittenQuery: 'Dell Gaming Laptop RTX 4060',
      }),
    );
  });

  test('LLM rewrite khác → refined search rỗng → fallback về initial results', async () => {
    const initialProducts = [makeProduct(7)];
    const llm = makeChatbotService({
      rewriteQuery: jest.fn().mockResolvedValue('iPhone 15 Ultra'),
    });
    const vs = makeVectorStore({
      hybridSearch: jest
        .fn()
        .mockResolvedValueOnce(initialProducts) // initial
        .mockResolvedValueOnce([]), // refined rỗng
    });
    const pipeline = new RAGPipeline({ chatbotService: llm, vectorStore: vs });

    await pipeline.run({ message: 'ip 15 ultra' });

    expect(llm.handleMessage).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({
        retrievedProducts: [expect.objectContaining({ id: 7 })],
      }),
    );
  });

  test('LLM rewrite khác → refined search throw → dùng initial results', async () => {
    const initialProducts = [makeProduct(8)];
    // rewrite phải khác normalizedQuery sau expandAbbreviations
    const llm = makeChatbotService({
      rewriteQuery: jest.fn().mockResolvedValue('Gaming Laptop RTX 4060 High Performance'),
    });
    const vs = makeVectorStore({
      hybridSearch: jest
        .fn()
        .mockResolvedValueOnce(initialProducts)
        .mockRejectedValueOnce(new Error('refined search thất bại')),
    });
    const pipeline = new RAGPipeline({ chatbotService: llm, vectorStore: vs });

    await pipeline.run({ message: 'tìm laptop gaming' });

    expect(llm.handleMessage).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({
        retrievedProducts: [expect.objectContaining({ id: 8 })],
      }),
    );
  });

  test('LLM _llmRewrite throw → rewrite = null → dùng initial results', async () => {
    const products = [makeProduct(10)];
    const llm = makeChatbotService({
      rewriteQuery: jest.fn().mockRejectedValue(new Error('LLM timeout')),
    });
    const vs = makeVectorStore({ hybridSearch: jest.fn().mockResolvedValue(products) });
    const pipeline = new RAGPipeline({ chatbotService: llm, vectorStore: vs });

    await pipeline.run({ message: 'MacBook Pro' });

    expect(vs.hybridSearch).toHaveBeenCalledTimes(1);
    expect(llm.handleMessage).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({ retrievedProducts: [expect.objectContaining({ id: 10 })] }),
    );
  });
});

// ─── VectorStore — fallback low-threshold ─────────────────────────────────────

describe('RAGPipeline.run() — fallback khi retrievedProducts rỗng', () => {
  test('initial rỗng, rewrite null → fallback hybridSearch(normalizedQuery, 3, 0)', async () => {
    const lowResults = [{ score: 0.1, metadata: { id: 99, name: 'low conf' } }];
    const llm = makeChatbotService({ rewriteQuery: jest.fn().mockResolvedValue(null) });
    const vs = makeVectorStore({
      hybridSearch: jest
        .fn()
        .mockResolvedValueOnce([]) // initial rỗng
        .mockResolvedValueOnce(lowResults), // fallback
    });
    const pipeline = new RAGPipeline({ chatbotService: llm, vectorStore: vs });

    await pipeline.run({ message: 'điện thoại' });

    expect(vs.hybridSearch).toHaveBeenNthCalledWith(2, expect.any(String), 3, 0);
    expect(llm.handleMessage).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({
        retrievedProducts: [expect.objectContaining({ lowConfidence: true })],
      }),
    );
  });

  test('initial rỗng với rewrittenQuery → fallback dùng rewrittenQuery', async () => {
    const lowResults = [{ score: 0.05, metadata: { id: 88 } }];
    const rewriteResult = 'Laptop Dell XPS 15 Gaming';
    // query không có abbreviation để rewrite thật sự khác normalizedQuery
    const llm = makeChatbotService({ rewriteQuery: jest.fn().mockResolvedValue(rewriteResult) });
    const vs = makeVectorStore({
      hybridSearch: jest
        .fn()
        .mockResolvedValueOnce([]) // initial rỗng
        .mockResolvedValueOnce([]) // refined rỗng
        .mockResolvedValueOnce(lowResults), // fallback
    });
    const pipeline = new RAGPipeline({ chatbotService: llm, vectorStore: vs });

    await pipeline.run({ message: 'laptop dell xps' });

    expect(vs.hybridSearch).toHaveBeenNthCalledWith(3, rewriteResult, 3, 0);
  });

  test('fallback throw → retrievedProducts = []', async () => {
    const llm = makeChatbotService({ rewriteQuery: jest.fn().mockResolvedValue(null) });
    const vs = makeVectorStore({
      hybridSearch: jest
        .fn()
        .mockResolvedValueOnce([]) // initial rỗng
        .mockRejectedValueOnce(new Error('fallback thất bại')), // fallback throw
    });
    const pipeline = new RAGPipeline({ chatbotService: llm, vectorStore: vs });

    await pipeline.run({ message: 'điện thoại rẻ' });

    expect(llm.handleMessage).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined,
      expect.objectContaining({ retrievedProducts: [] }),
    );
  });
});

// ─── VectorStore — outer catch ────────────────────────────────────────────────

describe('RAGPipeline.run() — outer vector search catch', () => {
  test('hybridSearch throw ngay lần đầu → tiếp tục không có retrievedProducts', async () => {
    const llm = makeChatbotService();
    const vs = makeVectorStore({
      hybridSearch: jest.fn().mockRejectedValue(new Error('vector DB down')),
    });
    const pipeline = new RAGPipeline({ chatbotService: llm, vectorStore: vs });

    await pipeline.run({ message: 'MacBook Air' });

    expect(llm.handleMessage).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined,
      expect.not.objectContaining({ retrievedProducts: expect.anything() }),
    );
  });
});

// ─── Context + metadata forwarding ────────────────────────────────────────────

describe('RAGPipeline.run() — truyền context và metadata', () => {
  test('context bổ sung được merge vào handleMessage call', async () => {
    const llm = makeChatbotService();
    const pipeline = new RAGPipeline({ chatbotService: llm });

    await pipeline.run({
      message: 'tư vấn laptop',
      userId: 42,
      sessionId: 'sess-abc',
      context: { channel: 'web' },
    });

    expect(llm.handleMessage).toHaveBeenCalledWith(
      'tư vấn laptop',
      42,
      'sess-abc',
      expect.objectContaining({ channel: 'web' }),
    );
  });

  test('return giá trị từ chatbotService.handleMessage', async () => {
    const expected = { response: 'Đây là câu trả lời', products: [{ id: 1 }], intent: 'pricing' };
    const llm = makeChatbotService({ handleMessage: jest.fn().mockResolvedValue(expected) });
    const pipeline = new RAGPipeline({ chatbotService: llm });

    const result = await pipeline.run({ message: 'giá iPhone 14' });

    expect(result).toEqual(expected);
  });
});
