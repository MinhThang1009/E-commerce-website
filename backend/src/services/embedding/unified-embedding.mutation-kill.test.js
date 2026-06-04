/**
 * unified-embedding.mutation-kill.test.js
 *
 * Bổ sung baseline mutation 71%. Kill mutant:
 *   - jina/hfInstruct/hfBase: url, request body (task/prefix), headers, timeout, emb extraction, dim check
 *   - _buildProviders: jina/hf/both/none
 *   - _logInit, activeName, isAvailable
 *   - generateEmbedding: 0 provider throw, success, fallback chain (warn+debug), all-fail throw
 */

const mockPost = jest.fn();
jest.mock('axios', () => ({ post: (...a) => mockPost(...a) }));
jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('@utils/logger');
const DIM = 1024;
const vec = (n = DIM) => Array(n).fill(0.1);
const jinaResp = (v) => ({ data: { data: [{ embedding: v }] } });
const hfResp = (v) => ({ data: [v] }); // resp.data[0] = vector

const KEYS = ['JINA_API_KEY', 'HF_API_KEY'];

function freshSvc(env = {}) {
  let mod;
  jest.isolateModules(() => {
    KEYS.forEach((k) => delete process.env[k]);
    Object.assign(process.env, env);
    mod = require('./unified-embedding');
  });
  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => KEYS.forEach((k) => delete process.env[k]));

// ══════════════════════════════════════════════════════════════════════════════
// _buildProviders + activeName + isAvailable + _logInit
// ══════════════════════════════════════════════════════════════════════════════

describe('providers build', () => {
  it('JINA only → 1 provider Jina v3', () => {
    const s = freshSvc({ JINA_API_KEY: 'jk' });
    expect(s.providers.map((p) => p.name)).toEqual(['Jina v3']);
    expect(s.activeName).toBe('Jina v3');
    expect(s.isAvailable()).toBe(true);
  });

  it('HF only → 2 provider (instruct + base)', () => {
    const s = freshSvc({ HF_API_KEY: 'hk' });
    expect(s.providers.map((p) => p.name)).toEqual([
      'multilingual-e5-large-instruct',
      'multilingual-e5-large',
    ]);
  });

  it('cả hai → 3 provider đúng thứ tự', () => {
    const s = freshSvc({ JINA_API_KEY: 'jk', HF_API_KEY: 'hk' });
    expect(s.providers.map((p) => p.name)).toEqual([
      'Jina v3',
      'multilingual-e5-large-instruct',
      'multilingual-e5-large',
    ]);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Jina v3'));
  });

  it('không có key → 0 provider + warn + activeName "none" + isAvailable false', () => {
    const s = freshSvc({});
    expect(s.providers).toEqual([]);
    expect(s.activeName).toBe('none');
    expect(s.isAvailable()).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('không có provider'));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// jinaEmbed (qua generateEmbedding với JINA_API_KEY)
// ══════════════════════════════════════════════════════════════════════════════

describe('jinaEmbed', () => {
  it('passage → task retrieval.passage, body/headers/timeout đúng', async () => {
    const s = freshSvc({ JINA_API_KEY: 'jk' });
    mockPost.mockResolvedValue(jinaResp(vec()));
    const out = await s.generateEmbedding('iPhone', 'passage');
    expect(out).toHaveLength(DIM);

    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe('https://api.jina.ai/v1/embeddings');
    expect(body).toEqual({
      model: 'jina-embeddings-v3',
      input: ['iPhone'],
      task: 'retrieval.passage',
    });
    expect(config.headers.Authorization).toBe('Bearer jk');
    expect(config.headers['Content-Type']).toBe('application/json');
    expect(config.timeout).toBe(30000);
  });

  it('query → task retrieval.query', async () => {
    const s = freshSvc({ JINA_API_KEY: 'jk' });
    mockPost.mockResolvedValue(jinaResp(vec()));
    await s.generateEmbedding('hỏi', 'query');
    expect(mockPost.mock.calls[0][1].task).toBe('retrieval.query');
  });

  it('type mặc định = query', async () => {
    const s = freshSvc({ JINA_API_KEY: 'jk' });
    mockPost.mockResolvedValue(jinaResp(vec()));
    await s.generateEmbedding('hỏi');
    expect(mockPost.mock.calls[0][1].task).toBe('retrieval.query');
  });

  it('vector sai chiều → throw (provider duy nhất → generateEmbedding throw)', async () => {
    const s = freshSvc({ JINA_API_KEY: 'jk' });
    mockPost.mockResolvedValue(jinaResp(vec(512)));
    await expect(s.generateEmbedding('x')).rejects.toThrow(/Jina.*512/);
  });

  it('embedding thiếu → throw', async () => {
    const s = freshSvc({ JINA_API_KEY: 'jk' });
    mockPost.mockResolvedValue({ data: { data: [{}] } });
    await expect(s.generateEmbedding('x')).rejects.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// hfInstructEmbed + hfBaseEmbed (qua HF_API_KEY)
// ══════════════════════════════════════════════════════════════════════════════

describe('hfInstructEmbed', () => {
  it('passage → prefix "passage: ", url instruct', async () => {
    const s = freshSvc({ HF_API_KEY: 'hk' });
    mockPost.mockResolvedValue(hfResp(vec()));
    await s.generateEmbedding('iPhone', 'passage');
    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe(
      'https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large-instruct',
    );
    expect(body).toEqual({ inputs: 'passage: iPhone' });
    expect(config.headers.Authorization).toBe('Bearer hk');
    expect(config.timeout).toBe(30000);
  });

  it('query → prefix instruction dài (Instruct: ... Query: )', async () => {
    const s = freshSvc({ HF_API_KEY: 'hk' });
    mockPost.mockResolvedValue(hfResp(vec()));
    await s.generateEmbedding('hỏi', 'query');
    expect(mockPost.mock.calls[0][1].inputs).toBe(
      'Instruct: Given a product search query, retrieve relevant Vietnamese e-commerce products\nQuery: hỏi',
    );
  });

  it('emb dạng resp.data (không bọc array) vẫn nhận', async () => {
    const s = freshSvc({ HF_API_KEY: 'hk' });
    mockPost.mockResolvedValue({ data: vec() }); // không phải [vec]
    const out = await s.generateEmbedding('x', 'passage');
    expect(out).toHaveLength(DIM);
  });
});

describe('hfBaseEmbed (fallback từ instruct)', () => {
  it('instruct lỗi → base với prefix "query: "', async () => {
    const s = freshSvc({ HF_API_KEY: 'hk' });
    mockPost
      .mockRejectedValueOnce(new Error('instruct overloaded')) // instruct fail
      .mockResolvedValueOnce(hfResp(vec())); // base ok
    await s.generateEmbedding('hỏi', 'query');
    const baseCall = mockPost.mock.calls[1];
    expect(baseCall[0]).toBe(
      'https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large',
    );
    expect(baseCall[1].inputs).toBe('query: hỏi');
  });

  it('base passage → prefix "passage: "', async () => {
    const s = freshSvc({ HF_API_KEY: 'hk' });
    mockPost.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(hfResp(vec()));
    await s.generateEmbedding('iPhone', 'passage');
    expect(mockPost.mock.calls[1][1].inputs).toBe('passage: iPhone');
  });

  it('base request có headers Authorization + Content-Type + timeout 30000', async () => {
    const s = freshSvc({ HF_API_KEY: 'hk' });
    mockPost.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(hfResp(vec()));
    await s.generateEmbedding('iPhone', 'passage');
    const config = mockPost.mock.calls[1][2];
    expect(config.headers.Authorization).toBe('Bearer hk');
    expect(config.headers['Content-Type']).toBe('application/json');
    expect(config.timeout).toBe(30000);
  });
});

describe('HF dim-mismatch error messages', () => {
  it('instruct sai chiều → warn chứa "e5-instruct: sai chiều 512"', async () => {
    const s = freshSvc({ HF_API_KEY: 'hk' });
    mockPost
      .mockResolvedValueOnce(hfResp(vec(512))) // instruct sai chiều → throw nội bộ
      .mockResolvedValueOnce(hfResp(vec())); // base ok
    await s.generateEmbedding('x', 'passage');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('e5-instruct: sai chiều 512'));
  });

  it('base sai chiều (cả 2 fail) → throw "e5-base: sai chiều 512"', async () => {
    const s = freshSvc({ HF_API_KEY: 'hk' });
    mockPost.mockResolvedValue(hfResp(vec(512)));
    await expect(s.generateEmbedding('x', 'passage')).rejects.toThrow(/e5-base: sai chiều 512/);
  });
});

describe('_logInit fallback chain', () => {
  it('info log liệt kê fallback "instruct → base" sau primary', () => {
    freshSvc({ JINA_API_KEY: 'jk', HF_API_KEY: 'hk' });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('multilingual-e5-large-instruct → multilingual-e5-large'),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// generateEmbedding — fallback chain
// ══════════════════════════════════════════════════════════════════════════════

describe('generateEmbedding fallback', () => {
  it('0 provider → throw', async () => {
    const s = freshSvc({});
    await expect(s.generateEmbedding('x')).rejects.toThrow(/Chưa cấu hình provider/);
  });

  it('provider 0 thành công → KHÔNG log fallback', async () => {
    const s = freshSvc({ JINA_API_KEY: 'jk', HF_API_KEY: 'hk' });
    mockPost.mockResolvedValue(jinaResp(vec()));
    await s.generateEmbedding('x');
    expect(logger.debug).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('provider 0 lỗi → warn + provider 1 thành công + debug "dùng fallback"', async () => {
    const s = freshSvc({ JINA_API_KEY: 'jk', HF_API_KEY: 'hk' });
    mockPost.mockRejectedValueOnce(new Error('jina 429')).mockResolvedValueOnce(hfResp(vec()));
    const out = await s.generateEmbedding('x');
    expect(out).toHaveLength(DIM);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Jina v3'));
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('fallback'));
  });

  it('tất cả provider lỗi → log error + throw lỗi cuối', async () => {
    const s = freshSvc({ JINA_API_KEY: 'jk', HF_API_KEY: 'hk' });
    mockPost.mockRejectedValue(new Error('all down'));
    await expect(s.generateEmbedding('x')).rejects.toThrow('all down');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('tất cả providers'));
    expect(mockPost).toHaveBeenCalledTimes(3);
  });
});
