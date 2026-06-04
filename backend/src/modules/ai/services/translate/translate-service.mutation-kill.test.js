/**
 * translate-service.mutation-kill.test.js
 *
 * Bổ sung cho translate-service.test.js (100% branch nhưng mutation chỉ 58%).
 * Mục tiêu: kill mutant bằng cách assert OUTCOME thật — không chỉ chạy nhánh:
 *   - Request shape OpenRouter (URL, model, role, headers, timeout)
 *   - Tên ngôn ngữ đầy đủ trong prompt (langName map + fallback code)
 *   - HTTP-Referer từ FRONTEND_URL (default vs override)
 *   - Content-guard / optional-chaining: thiếu content → trả texts KHÔNG log warn
 *     (mutant bỏ ?. → throw → rơi vào catch → log warn → khác outcome)
 *   - Error status `status || err.code` trong log
 *   - Regex markdown-fence (json optional, đa dòng, không khoảng trắng)
 *   - Request shape MyMemory (URL, params q+langpair, timeout)
 */

process.env.NODE_ENV = 'test';

jest.mock('axios');
jest.mock('@utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const axios = require('axios');
const logger = require('@utils/logger');
const { translateBatch } = require('./translate-service');

function okResponse(content) {
  return { data: { choices: [{ message: { content } }] } };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OPENROUTER_API_KEY = 'sk-real-key';
  delete process.env.FRONTEND_URL;
  delete process.env.TRANSLATE_MODEL;
  // MyMemory fallback mặc định fail → trả nguyên texts, không nhiễu assert
  axios.get = jest.fn().mockRejectedValue(new Error('network'));
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.FRONTEND_URL;
  delete process.env.TRANSLATE_MODEL;
});

// ══════════════════════════════════════════════════════════════════════════════
// OpenRouter request shape — URL / model / role / headers / config
// ══════════════════════════════════════════════════════════════════════════════

describe('OpenRouter request shape', () => {
  it('gọi đúng URL, model mặc định, role user, body đầy đủ và headers chuẩn', async () => {
    axios.post.mockResolvedValue(okResponse('["hello"]'));
    await translateBatch(['xin chào']);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = axios.post.mock.calls[0];

    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(body.model).toBe('deepseek/deepseek-v4-flash:free');
    expect(body.messages).toEqual([{ role: 'user', content: expect.any(String) }]);
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(3000);

    expect(config.timeout).toBe(30000);
    expect(config.headers.Authorization).toBe('Bearer sk-real-key');
    expect(config.headers['Content-Type']).toBe('application/json');
    expect(config.headers['HTTP-Referer']).toBe('http://localhost:5173');
    expect(config.headers['X-Title']).toBe('TechStore Translate');
  });

  it('dùng FRONTEND_URL từ env cho HTTP-Referer khi được set', async () => {
    process.env.FRONTEND_URL = 'https://shop.example.com';
    axios.post.mockResolvedValue(okResponse('["hello"]'));
    await translateBatch(['xin chào']);
    expect(axios.post.mock.calls[0][2].headers['HTTP-Referer']).toBe('https://shop.example.com');
  });

  it('dùng TRANSLATE_MODEL từ env khi được set (override default)', async () => {
    jest.resetModules();
    process.env.TRANSLATE_MODEL = 'custom/model-x';
    process.env.OPENROUTER_API_KEY = 'sk-real-key';
    const axios2 = require('axios');
    axios2.post = jest.fn().mockResolvedValue(okResponse('["hello"]'));
    axios2.get = jest.fn().mockRejectedValue(new Error('net'));
    const { translateBatch: tb } = require('./translate-service');

    await tb(['xin chào']);
    expect(axios2.post.mock.calls[0][1].model).toBe('custom/model-x');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// langName map — prompt phải chứa tên ngôn ngữ đầy đủ
// ══════════════════════════════════════════════════════════════════════════════

describe('langName trong prompt', () => {
  function promptOf() {
    return axios.post.mock.calls[0][1].messages[0].content;
  }

  it('vi→en mặc định → prompt chứa "from Vietnamese to English"', async () => {
    axios.post.mockResolvedValue(okResponse('["hello"]'));
    await translateBatch(['xin chào']);
    expect(promptOf()).toContain('from Vietnamese to English');
  });

  it('ja→ko → prompt chứa "from Japanese to Korean"', async () => {
    axios.post.mockResolvedValue(okResponse('["x"]'));
    await translateBatch(['x'], 'ja', 'ko');
    expect(promptOf()).toContain('from Japanese to Korean');
  });

  it('ngôn ngữ ngoài bảng (fr→de) → dùng code gốc "from fr to de"', async () => {
    axios.post.mockResolvedValue(okResponse('["x"]'));
    await translateBatch(['x'], 'fr', 'de');
    expect(promptOf()).toContain('from fr to de');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Content guard + optional chaining — thiếu content → texts, KHÔNG log warn
// (mutant bỏ ?. hoặc bỏ `if(!content)` → throw → catch → logger.warn)
// ══════════════════════════════════════════════════════════════════════════════

describe('content thiếu → trả texts mà không log warn', () => {
  it('response không có choices', async () => {
    axios.post.mockResolvedValue({ data: {} });
    const texts = ['a'];
    expect(await translateBatch(texts)).toEqual(texts);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('choices rỗng', async () => {
    axios.post.mockResolvedValue({ data: { choices: [] } });
    const texts = ['a'];
    expect(await translateBatch(texts)).toEqual(texts);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('choices[0] không có message', async () => {
    axios.post.mockResolvedValue({ data: { choices: [{}] } });
    const texts = ['a'];
    expect(await translateBatch(texts)).toEqual(texts);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('content === null (kill bỏ guard `if (!content)`)', async () => {
    axios.post.mockResolvedValue(okResponse(null));
    const texts = ['a'];
    expect(await translateBatch(texts)).toEqual(texts);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Inner catch (JSON.parse fail) → trả texts mà KHÔNG log warn
// (mutant biến catch-block thành {} → parsed undefined → throw ở outer → log warn)
// ══════════════════════════════════════════════════════════════════════════════

describe('JSON.parse fail (không phải fence) → texts, không log warn', () => {
  it('content rác không parse được', async () => {
    axios.post.mockResolvedValue(okResponse('not json at all'));
    const texts = ['a'];
    expect(await translateBatch(texts)).toEqual(texts);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Error status trong log warn — `${status || err.code}`
// ══════════════════════════════════════════════════════════════════════════════

describe('log warn kèm status/code khi OpenRouter lỗi', () => {
  it('lỗi có response.status → log chứa status', async () => {
    axios.post.mockRejectedValue({ response: { status: 503 }, message: 'Service Unavailable' });
    await translateBatch(['a']);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('503'), 'Service Unavailable');
  });

  it('lỗi không có response → log chứa err.code (kill status || code)', async () => {
    axios.post.mockRejectedValue({ code: 'ECONNREFUSED', message: 'connect failed' });
    await translateBatch(['a']);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED'),
      'connect failed',
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Regex markdown-fence
// ══════════════════════════════════════════════════════════════════════════════

describe('regex strip markdown fence', () => {
  it('fence KHÔNG nhãn json vẫn parse được (json là optional)', async () => {
    axios.post.mockResolvedValue(okResponse('```\n["hello"]\n```'));
    expect(await translateBatch(['xin chào'])).toEqual(['hello']);
  });

  it('JSON nhiều dòng bên trong fence json ([\\s\\S] phải khớp xuống dòng)', async () => {
    axios.post.mockResolvedValue(okResponse('```json\n[\n  "a",\n  "b"\n]\n```'));
    expect(await translateBatch(['x', 'y'])).toEqual(['a', 'b']);
  });

  it('fence json không khoảng trắng sau nhãn (\\s* cho phép 0 khoảng trắng)', async () => {
    axios.post.mockResolvedValue(okResponse('```json["hi"]```'));
    expect(await translateBatch(['xin chào'])).toEqual(['hi']);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MyMemory fallback — request shape + debug log
// ══════════════════════════════════════════════════════════════════════════════

describe('MyMemory fallback', () => {
  it('log debug khi không có OPENROUTER_API_KEY (fallback MyMemory)', async () => {
    delete process.env.OPENROUTER_API_KEY;
    await translateBatch(['xin chào']);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('MyMemory'));
  });

  it('gọi đúng URL + params (q, langpair) + timeout', async () => {
    delete process.env.OPENROUTER_API_KEY;
    axios.get.mockResolvedValue({ data: { responseData: { translatedText: 'Hello' } } });
    const result = await translateBatch(['xin chào'], 'vi', 'en');

    const [url, config] = axios.get.mock.calls[0];
    expect(url).toBe('https://api.mymemory.translated.net/get');
    expect(config.params).toEqual({ q: 'xin chào', langpair: 'vi|en' });
    expect(config.timeout).toBe(10000);
    expect(result).toEqual(['Hello']);
  });
});
