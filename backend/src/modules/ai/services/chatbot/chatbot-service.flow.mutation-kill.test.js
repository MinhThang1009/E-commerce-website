/**
 * chatbot-service.flow.mutation-kill.test.js
 *
 * Kill mutant cụm flow (đẩy chatbot-service cao hơn):
 *   - handleMessage happy-path đầy đủ: retrieve → augment → persist (aiMeta) → session update
 *   - _retrieveProducts rewrite-refine (LLM rewrite KHÁC → hybridSearch lần 2 với query mới)
 *   - _retrieveProducts refined-throws → fallback initialResults
 *   - _enrichQueryFromHistory extractTopProduct: price-strip / ":" strip / bullet "•"
 */

const mockHybridSearch = jest.fn();
const mockBulkCreate = jest.fn().mockResolvedValue([]);

jest.mock('@models', () => ({
  Product: { findAll: jest.fn().mockResolvedValue([]) },
  Category: { findAll: jest.fn().mockResolvedValue([]) },
  Brand: { findAll: jest.fn().mockResolvedValue([]) },
  ChatMessage: {
    bulkCreate: (...a) => mockBulkCreate(...a),
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  ProductImage: {},
  ProductVariant: {},
  sequelize: {},
  Op: { in: 'in' },
}));

jest.mock('@services/vector-store/vector-store', () => ({
  items: [],
  loadPromise: Promise.resolve(),
  hybridSearch: (...a) => mockHybridSearch(...a),
  detectLanguage: jest.fn((t) => (/[àáâãèéêìíòóôõùúýăđơưẠ-ỹ]/i.test(t) ? 'vi' : 'en')),
}));

jest.mock('axios');
jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const axios = require('axios');
let svc;
beforeAll(() => {
  svc = require('./chatbot-service');
  svc.initialize(require('@models'));
});

beforeEach(() => {
  jest.clearAllMocks();
  svc.conversationHistory.clear();
  svc.providers = [{ key: 'k', url: 'http://u/chat/completions', model: 'm' }];
  mockHybridSearch.mockResolvedValue([]);
  mockBulkCreate.mockResolvedValue([]);
});

const llm = (content) => ({ data: { choices: [{ message: { content } }] } });

// ══════════════════════════════════════════════════════════════════════════════
// handleMessage happy-path đầy đủ
// ══════════════════════════════════════════════════════════════════════════════

describe('handleMessage happy-path', () => {
  it('retrieve→augment→persist→session: trả response LLM + persist metadata + session 2 msg', async () => {
    // axios call 1 = rewriteQuery (đổi query → refine), call 2 = augmentAndGenerate
    axios.post.mockResolvedValueOnce(llm('iPhone 16 Pro Max')).mockResolvedValue(
      llm(
        JSON.stringify({
          response: 'Đây là máy',
          matchedProducts: ['iPhone 16'],
          suggestions: ['s1'],
          intent: 'pricing',
        }),
      ),
    );
    mockHybridSearch.mockResolvedValue([
      { metadata: { id: 1, name: 'iPhone 16', price: 1, inStock: true }, score: 0.9 },
    ]);

    const out = await svc.handleMessage('ip16 gia', 'u1', 'sess1');

    expect(out.response).toBe('Đây là máy');
    expect(out.intent).toBe('pricing');
    expect(out.products).toHaveLength(1);

    // persist: assistant row kèm metadata {products, suggestions}
    await Promise.resolve();
    expect(mockBulkCreate).toHaveBeenCalled();
    const rows = mockBulkCreate.mock.calls[0][0];
    expect(rows[0].role).toBe('user');
    expect(rows[1].role).toBe('assistant');
    expect(rows[1].metadata).toBe(
      JSON.stringify({ products: out.products, suggestions: out.suggestions }),
    );

    // session memory cập nhật: user + assistant message
    const session = svc.conversationHistory.get('sess1');
    expect(session.messages).toHaveLength(2);
    expect(session.messages[0].role).toBe('user');
    expect(session.messages[1]).toEqual({ role: 'assistant', content: 'Đây là máy' });
  });

  it('không có sessionId → KHÔNG cập nhật session memory', async () => {
    axios.post
      .mockResolvedValueOnce(llm('rewrite'))
      .mockResolvedValue(llm(JSON.stringify({ response: 'r', matchedProducts: [] })));
    await svc.handleMessage('câu hỏi', null, null);
    expect(svc.conversationHistory.size).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// _retrieveProducts rewrite-refine
// ══════════════════════════════════════════════════════════════════════════════

describe('_retrieveProducts rewrite-refine', () => {
  it('LLM rewrite KHÁC normalizedQuery → hybridSearch lần 2 với query đã rewrite', async () => {
    axios.post.mockResolvedValue(llm('iPhone 16 Pro Max')); // rewriteQuery trả khác
    mockHybridSearch
      .mockResolvedValueOnce([{ metadata: { id: 1, name: 'A' }, score: 0.5 }]) // initial
      .mockResolvedValueOnce([{ metadata: { id: 2, name: 'B' }, score: 0.8 }]); // refined

    const out = await svc._retrieveProducts('iphone', 'iphone');
    expect(mockHybridSearch).toHaveBeenCalledTimes(2);
    // dùng kết quả refined (id 2)
    expect(out.products).toEqual([{ id: 2, name: 'B', score: 0.8 }]);
    expect(out.finalQuery).toBe('iPhone 16 Pro Max');
    // hybridSearch lần 2 dùng query rewrite
    expect(mockHybridSearch.mock.calls[1][0]).toContain('iPhone 16 Pro Max');
  });

  it('refined hybridSearch rỗng → giữ initialResults', async () => {
    axios.post.mockResolvedValue(llm('iPhone 16 Pro Max'));
    mockHybridSearch
      .mockResolvedValueOnce([{ metadata: { id: 1, name: 'A' }, score: 0.5 }]) // initial
      .mockResolvedValueOnce([]); // refined rỗng → fallback initial
    const out = await svc._retrieveProducts('iphone', 'iphone');
    expect(out.products).toEqual([{ id: 1, name: 'A', score: 0.5 }]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// _enrichQueryFromHistory extractTopProduct formats
// ══════════════════════════════════════════════════════════════════════════════

describe('_enrichQueryFromHistory extract formats', () => {
  it('format LLM "- Tên: giá từ ..." → strip giá + phần sau ":"', () => {
    const h = [{ role: 'assistant', content: '- iPhone 17: giá từ 24.990.000đ chính hãng' }];
    expect(svc._enrichQueryFromHistory('cái đó', h)).toBe('cái đó iPhone 17');
  });

  it('format keyword "• Tên - giá đ" → strip giá', () => {
    const h = [{ role: 'assistant', content: '• Samsung Galaxy S25 - 25.000.000 đ' }];
    expect(svc._enrichQueryFromHistory('nó thế nào', h)).toBe('nó thế nào Samsung Galaxy S25');
  });

  it('lấy 2 assistant message gần nhất, mỗi cái 1 sản phẩm đầu', () => {
    const h = [
      { role: 'assistant', content: '• iPhone 16 - 30tr' },
      { role: 'user', content: 'hỏi tiếp' },
      { role: 'assistant', content: '• MacBook Air - 25tr' },
    ];
    expect(svc._enrichQueryFromHistory('so sánh', h)).toBe('so sánh iPhone 16 MacBook Air');
  });
});
