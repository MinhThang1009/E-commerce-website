/**
 * Tests cho UnifiedEmbeddingService — fallback chain Jina → e5-instruct → e5-base.
 */
jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({ post: (...args) => mockAxiosPost(...args) }));

const EXPECTED_DIM = 1024;
const makeVector = (dim = EXPECTED_DIM) => Array(dim).fill(0.1);

// ── Helpers ──────────────────────────────────────────────────────────────────
function loadService({ jina, hf } = {}) {
  jest.resetModules();
  process.env.JINA_API_KEY = jina || '';
  process.env.HF_API_KEY = hf || '';

  jest.mock('@utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));
  jest.mock('axios', () => ({ post: (...args) => mockAxiosPost(...args) }));

  return require('./unified-embedding');
}

// ── Constructor / _buildProviders ─────────────────────────────────────────────
describe('UnifiedEmbeddingService — khởi tạo', () => {
  afterEach(() => jest.resetModules());

  it('không có key → providers rỗng, warn log', () => {
    const svc = loadService();
    expect(svc.isAvailable()).toBe(false);
    expect(svc.activeName).toBe('none');
  });

  it('chỉ JINA_API_KEY → 1 provider Jina', () => {
    const svc = loadService({ jina: 'jina-key' });
    expect(svc.isAvailable()).toBe(true);
    expect(svc.activeName).toBe('Jina v3');
  });

  it('chỉ HF_API_KEY → 2 providers HF (instruct + base)', () => {
    const svc = loadService({ hf: 'hf-key' });
    expect(svc.isAvailable()).toBe(true);
    expect(svc.activeName).toBe('multilingual-e5-large-instruct');
  });

  it('cả 2 key → 3 providers, primary là Jina', () => {
    const svc = loadService({ jina: 'j', hf: 'h' });
    expect(svc.activeName).toBe('Jina v3');
  });
});

// ── generateEmbedding — no providers ─────────────────────────────────────────
describe('generateEmbedding — không có provider', () => {
  it('throw khi không có key', async () => {
    const svc = loadService();
    await expect(svc.generateEmbedding('text')).rejects.toThrow('Chưa cấu hình provider');
  });
});

// ── jinaEmbed ─────────────────────────────────────────────────────────────────
describe('jinaEmbed — Jina v3 provider', () => {
  let svc;
  beforeEach(() => {
    mockAxiosPost.mockReset();
    svc = loadService({ jina: 'jina-key' });
  });

  it('passage type → task=retrieval.passage', async () => {
    mockAxiosPost.mockResolvedValue({ data: { data: [{ embedding: makeVector() }] } });
    await svc.generateEmbedding('text', 'passage');
    expect(mockAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('jina'),
      expect.objectContaining({ model: 'jina-embeddings-v3' }),
      expect.any(Object),
    );
    const body = mockAxiosPost.mock.calls[0][1];
    expect(body.task).toBe('retrieval.passage');
  });

  it('query type → task=retrieval.query', async () => {
    mockAxiosPost.mockResolvedValue({ data: { data: [{ embedding: makeVector() }] } });
    await svc.generateEmbedding('text', 'query');
    const body = mockAxiosPost.mock.calls[0][1];
    expect(body.task).toBe('retrieval.query');
  });

  it('trả về vector đúng chiều', async () => {
    const vec = makeVector();
    mockAxiosPost.mockResolvedValue({ data: { data: [{ embedding: vec }] } });
    const result = await svc.generateEmbedding('text');
    expect(result).toEqual(vec);
  });

  it('Jina trả vector sai chiều → throw', async () => {
    mockAxiosPost.mockResolvedValue({ data: { data: [{ embedding: Array(512).fill(0) }] } });
    await expect(svc.generateEmbedding('text')).rejects.toThrow('sai chiều');
  });

  it('Jina trả response rỗng → throw', async () => {
    mockAxiosPost.mockResolvedValue({ data: { data: [] } });
    await expect(svc.generateEmbedding('text')).rejects.toThrow('sai chiều');
  });
});

// ── hfInstructEmbed ───────────────────────────────────────────────────────────
describe('hfInstructEmbed — e5-large-instruct provider', () => {
  let svc;
  beforeEach(() => {
    mockAxiosPost.mockReset();
    svc = loadService({ hf: 'hf-key' });
  });

  it('passage type → prefix "passage: "', async () => {
    const vec = makeVector();
    mockAxiosPost.mockResolvedValue({ data: [vec] });
    await svc.generateEmbedding('hello', 'passage');
    const body = mockAxiosPost.mock.calls[0][1];
    expect(body.inputs).toMatch(/^passage: /);
  });

  it('query type → prefix Instruct...Query', async () => {
    const vec = makeVector();
    mockAxiosPost.mockResolvedValue({ data: [vec] });
    await svc.generateEmbedding('hello', 'query');
    const body = mockAxiosPost.mock.calls[0][1];
    expect(body.inputs).toMatch(/^Instruct:/);
  });

  it('response dạng data (không wrap trong array) → vẫn OK', async () => {
    const vec = makeVector();
    mockAxiosPost.mockResolvedValue({ data: vec });
    const result = await svc.generateEmbedding('text', 'passage');
    expect(result).toEqual(vec);
  });

  it('e5-instruct trả sai chiều → throw', async () => {
    mockAxiosPost.mockResolvedValue({ data: [Array(256).fill(0)] });
    await expect(svc.generateEmbedding('text')).rejects.toThrow('sai chiều');
  });
});

// ── hfBaseEmbed ───────────────────────────────────────────────────────────────
describe('hfBaseEmbed — e5-large fallback', () => {
  let svc;
  beforeEach(() => {
    mockAxiosPost.mockReset();
    svc = loadService({ hf: 'hf-key' });
    // Làm cho e5-instruct fail để trigger e5-base
    mockAxiosPost
      .mockRejectedValueOnce(new Error('instruct timeout'))
      .mockResolvedValue({ data: [makeVector()] });
  });

  it('passage type → prefix "passage: "', async () => {
    await svc.generateEmbedding('text', 'passage');
    const secondCall = mockAxiosPost.mock.calls[1][1];
    expect(secondCall.inputs).toMatch(/^passage: /);
  });

  it('query type → prefix "query: "', async () => {
    mockAxiosPost
      .mockReset()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue({ data: [makeVector()] });
    await svc.generateEmbedding('text', 'query');
    const secondCall = mockAxiosPost.mock.calls[1][1];
    expect(secondCall.inputs).toMatch(/^query: /);
  });
});

// ── Fallback chain ────────────────────────────────────────────────────────────
describe('generateEmbedding — fallback chain', () => {
  beforeEach(() => mockAxiosPost.mockReset());

  it('primary fail → dùng fallback HF instruct', async () => {
    const svc = loadService({ jina: 'j', hf: 'h' });
    const vec = makeVector();
    mockAxiosPost.mockRejectedValueOnce(new Error('Jina down')).mockResolvedValue({ data: [vec] });
    const result = await svc.generateEmbedding('text');
    expect(result).toEqual(vec);
    expect(mockAxiosPost).toHaveBeenCalledTimes(2);
  });

  it('Jina + instruct fail → dùng e5-base', async () => {
    const svc = loadService({ jina: 'j', hf: 'h' });
    const vec = makeVector();
    mockAxiosPost
      .mockRejectedValueOnce(new Error('Jina down'))
      .mockRejectedValueOnce(new Error('instruct down'))
      .mockResolvedValue({ data: [vec] });
    const result = await svc.generateEmbedding('text');
    expect(result).toEqual(vec);
    expect(mockAxiosPost).toHaveBeenCalledTimes(3);
  });

  it('tất cả providers fail → throw lỗi cuối', async () => {
    const svc = loadService({ jina: 'j', hf: 'h' });
    mockAxiosPost.mockRejectedValue(new Error('all down'));
    await expect(svc.generateEmbedding('text')).rejects.toThrow('all down');
    expect(mockAxiosPost).toHaveBeenCalledTimes(3);
  });

  it('chỉ HF key — instruct fail → base thành công', async () => {
    const svc = loadService({ hf: 'h' });
    const vec = makeVector();
    mockAxiosPost
      .mockRejectedValueOnce(new Error('instruct fail'))
      .mockResolvedValue({ data: [vec] });
    const result = await svc.generateEmbedding('text');
    expect(result).toEqual(vec);
  });

  it('e5-base trả flat array (data[0] không phải array) → dùng resp.data trực tiếp', async () => {
    // resp.data = flat vector (không wrap trong array) → Array.isArray(resp.data[0]) = false
    // cover nhánh false của line 55: emb = resp.data
    const svc = loadService({ hf: 'h' });
    const vec = makeVector();
    mockAxiosPost
      .mockRejectedValueOnce(new Error('instruct fail'))
      .mockResolvedValue({ data: vec }); // flat array, data[0] là number
    const result = await svc.generateEmbedding('text');
    expect(result).toEqual(vec);
  });

  it('primary thành công → không gọi fallback', async () => {
    const svc = loadService({ jina: 'j', hf: 'h' });
    mockAxiosPost.mockResolvedValue({ data: { data: [{ embedding: makeVector() }] } });
    await svc.generateEmbedding('text');
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });
});

// ── isAvailable / activeName ──────────────────────────────────────────────────
describe('isAvailable() và activeName', () => {
  it('không key → isAvailable false', () => {
    expect(loadService().isAvailable()).toBe(false);
  });
  it('có key → isAvailable true', () => {
    expect(loadService({ jina: 'k' }).isAvailable()).toBe(true);
  });
  it('activeName khi không có provider → "none"', () => {
    expect(loadService().activeName).toBe('none');
  });
});

// ── generateEmbeddingWithMeta — provider metadata + pin ───────────────────────
describe('generateEmbeddingWithMeta', () => {
  beforeEach(() => mockAxiosPost.mockReset());

  it('trả {vector, provider} — provider là model đã tạo vector', async () => {
    const svc = loadService({ jina: 'j' });
    const vec = makeVector();
    mockAxiosPost.mockResolvedValue({ data: { data: [{ embedding: vec }] } });
    const result = await svc.generateEmbeddingWithMeta('text', 'query');
    expect(result).toEqual({ vector: vec, provider: 'Jina v3' });
  });

  it('primary fail → fallback, provider phản ánh model THẬT đã dùng', async () => {
    const svc = loadService({ jina: 'j', hf: 'h' });
    const vec = makeVector();
    mockAxiosPost.mockRejectedValueOnce(new Error('jina down')).mockResolvedValue({ data: [vec] });
    const result = await svc.generateEmbeddingWithMeta('text', 'query');
    expect(result.provider).toBe('multilingual-e5-large-instruct');
    expect(result.vector).toEqual(vec);
  });

  it('pin = provider cụ thể → KHÔNG fallback khi provider đó fail', async () => {
    const svc = loadService({ jina: 'j', hf: 'h' });
    mockAxiosPost.mockRejectedValue(new Error('jina down'));
    await expect(
      svc.generateEmbeddingWithMeta('text', 'query', { pin: 'Jina v3' }),
    ).rejects.toThrow('jina down');
    expect(mockAxiosPost).toHaveBeenCalledTimes(1); // không thử e5
  });

  it('pin thành công → chỉ gọi đúng provider được pin', async () => {
    const svc = loadService({ jina: 'j', hf: 'h' });
    const vec = makeVector();
    mockAxiosPost.mockResolvedValue({ data: [vec] }); // e5-instruct format
    const result = await svc.generateEmbeddingWithMeta('text', 'query', {
      pin: 'multilingual-e5-large-instruct',
    });
    expect(result.provider).toBe('multilingual-e5-large-instruct');
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    // Gọi đúng URL e5-instruct, không phải Jina
    expect(mockAxiosPost.mock.calls[0][0]).toContain('e5-large-instruct');
  });

  it('pin provider không được cấu hình → throw với tên provider', async () => {
    const svc = loadService({ hf: 'h' }); // không có Jina
    await expect(
      svc.generateEmbeddingWithMeta('text', 'query', { pin: 'Jina v3' }),
    ).rejects.toThrow('Provider embedding "Jina v3" không được cấu hình');
  });

  it('generateEmbedding (legacy) delegate qua WithMeta — trả vector thuần', async () => {
    const svc = loadService({ jina: 'j' });
    const vec = makeVector();
    mockAxiosPost.mockResolvedValue({ data: { data: [{ embedding: vec }] } });
    await expect(svc.generateEmbedding('text', 'query')).resolves.toEqual(vec);
  });

  it('gọi 1 tham số → type mặc định "query" (Jina task=retrieval.query)', async () => {
    const svc = loadService({ jina: 'j' });
    mockAxiosPost.mockResolvedValue({ data: { data: [{ embedding: makeVector() }] } });
    const result = await svc.generateEmbeddingWithMeta('text');
    expect(result.provider).toBe('Jina v3');
    expect(mockAxiosPost.mock.calls[0][1].task).toBe('retrieval.query');
  });
});
