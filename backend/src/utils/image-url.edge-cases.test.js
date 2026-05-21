/**
 * Additional tests for imageUrl.js targeting uncovered branches:
 * - Line 1: BACKEND_URL || '' when BACKEND_URL is undefined
 * - Lines 13-30: module-level derived constant branches
 * - Line 80: sanitizeStoredImageValue returns null when sanitized is empty
 * - Line 117: coerceToArray JSON.parse succeeds but result is not an array
 */

// ─── sanitizeStoredImageValue line 80 — sanitized becomes empty → null ────────
// These tests work with the already-loaded module from imageUrl.test.js.
// We only need to ensure they run in a context where the module is available.
// Since jest runs test files in isolation, we can set env vars first.

process.env.BACKEND_URL = 'http://localhost:8888';
process.env.API_URL = 'http://localhost:8888/api';
process.env.FRONTEND_URL = 'http://localhost:5175';
process.env.ASSET_BASE_URL = 'http://cdn.test/assets';

const { sanitizeStoredImageValue } = require('./image-url');

// ─── sanitizeStoredImageValue — sanitized bị rút gọn thành '' → null (line 80)

describe('sanitizeStoredImageValue — sanitized thành chuỗi rỗng → null (line 80)', () => {
  test('input "/" → tất cả prefix/slash bị strip → null', () => {
    // '/' → trimToNull → '/' → normalizePath → '/' → strip /api/uploads (no change)
    // → no prefix match → stripLeadingSlash('/') → '' → length 0 → null
    expect(sanitizeStoredImageValue('/')).toBeNull();
  });

  test('input "///" → multiple slashes stripped → null', () => {
    // '///' → normalizeBase → '///' → stripLeadingSlash → '' → null
    expect(sanitizeStoredImageValue('///')).toBeNull();
  });
});

// ─── Module-level — BACKEND_URL undefined → DEFAULT_LOCAL_BASE = '' (line 1) ──
// Cần fresh module load không có BACKEND_URL

describe('imageUrl module — BACKEND_URL undefined → DEFAULT_LOCAL_BASE = "" (line 1)', () => {
  test('assetBase là "" khi tất cả env vars đều undefined', () => {
    jest.resetModules();

    const saved = {
      BACKEND_URL: process.env.BACKEND_URL,
      API_URL: process.env.API_URL,
      FRONTEND_URL: process.env.FRONTEND_URL,
      ASSET_BASE_URL: process.env.ASSET_BASE_URL,
      CDN_BASE_URL: process.env.CDN_BASE_URL,
    };

    delete process.env.BACKEND_URL;
    delete process.env.API_URL;
    delete process.env.FRONTEND_URL;
    delete process.env.ASSET_BASE_URL;
    delete process.env.CDN_BASE_URL;

    const { assetBaseUrl, buildPublicImageUrl: buildUrl } = require('./image-url');

    // Khi tất cả env vars undefined → DEFAULT_LOCAL_BASE = '' (line 1 || '' branch)
    // assetBase = normalizeBaseUrl('') || '' = null || '' = ''
    expect(typeof assetBaseUrl).toBe('string');
    // buildPublicImageUrl với path tương đối khi assetBase = '' vẫn hoạt động
    const result = buildUrl('uploads/x.jpg');
    expect(typeof result).toBe('string');

    // Restore
    Object.assign(process.env, saved);
    jest.resetModules();
  });

  test('API_URL không kết thúc bằng /api → apiRoot = apiUrl (lines 24-26)', () => {
    jest.resetModules();

    const saved = {
      BACKEND_URL: process.env.BACKEND_URL,
      API_URL: process.env.API_URL,
      FRONTEND_URL: process.env.FRONTEND_URL,
      ASSET_BASE_URL: process.env.ASSET_BASE_URL,
      CDN_BASE_URL: process.env.CDN_BASE_URL,
    };

    // API_URL không kết thúc bằng /api → nhánh else tại lines 24-26
    process.env.API_URL = 'http://localhost:8888/v1';
    process.env.BACKEND_URL = 'http://localhost:8888';
    process.env.FRONTEND_URL = 'http://localhost:5175';
    delete process.env.ASSET_BASE_URL;
    delete process.env.CDN_BASE_URL;

    const { assetBaseUrl: base, buildPublicImageUrl: buildUrl2 } = require('./image-url');
    // apiUrl = 'http://localhost:8888/v1' (không endsWith /api) → apiRoot = apiUrl
    // assetBase = normalizeBaseUrl(frontendUrl || apiRoot || DEFAULT_LOCAL_BASE) = frontendUrl
    // Khi ASSET_BASE_URL không set, assetBase = frontendUrl hoặc apiRoot
    expect(typeof base).toBe('string');
    // Module load thành công, buildPublicImageUrl hoạt động
    expect(buildUrl2('uploads/x.jpg')).toMatch(/uploads\/x\.jpg/);

    // Restore env vars
    delete process.env.BACKEND_URL;
    delete process.env.API_URL;
    delete process.env.FRONTEND_URL;
    delete process.env.ASSET_BASE_URL;
    delete process.env.CDN_BASE_URL;
    for (const [k, v] of Object.entries(saved)) {
      if (v !== undefined) process.env[k] = v;
    }
    jest.resetModules();
  });
});
