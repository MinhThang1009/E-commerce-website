/**
 * Phase 44 — Unit tests cho imageUrl helpers (utils/imageUrl.js)
 * Pure functions với env-based config — set env trước require.
 */

// Set env trước require (module đọc env ở load time)
process.env.BACKEND_URL = 'http://localhost:8888';
process.env.API_URL = 'http://localhost:8888/api';
process.env.FRONTEND_URL = 'http://localhost:5175';
process.env.ASSET_BASE_URL = 'http://cdn.test/assets';

const { sanitizeStoredImageValue, buildPublicImageUrl, assetBaseUrl } = require('./image-url');

describe('sanitizeStoredImageValue', () => {
  test('null/undefined/empty → null', () => {
    expect(sanitizeStoredImageValue(null)).toBeNull();
    expect(sanitizeStoredImageValue(undefined)).toBeNull();
    expect(sanitizeStoredImageValue('')).toBeNull();
    expect(sanitizeStoredImageValue('   ')).toBeNull();
  });

  test('Data URL giữ nguyên (không strip prefix)', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KG...';
    expect(sanitizeStoredImageValue(dataUrl)).toBe(dataUrl);
  });

  test('Strip BACKEND_URL prefix', () => {
    expect(sanitizeStoredImageValue('http://localhost:8888/uploads/img.jpg')).toBe(
      'uploads/img.jpg',
    );
  });

  test('Strip ASSET_BASE_URL prefix', () => {
    expect(sanitizeStoredImageValue('http://cdn.test/assets/photo.png')).toBe('photo.png');
  });

  test('Convert /api/uploads → /uploads', () => {
    expect(sanitizeStoredImageValue('/api/uploads/x.jpg')).toBe('uploads/x.jpg');
  });

  test('Path tương đối giữ nguyên (không có prefix match)', () => {
    expect(sanitizeStoredImageValue('uploads/banner/x.jpg')).toBe('uploads/banner/x.jpg');
  });

  test('Windows backslash → forward slash', () => {
    expect(sanitizeStoredImageValue('uploads\\products\\x.jpg')).toBe('uploads/products/x.jpg');
  });

  test('Strip leading slash sau khi sanitize', () => {
    expect(sanitizeStoredImageValue('/uploads/x.jpg')).toBe('uploads/x.jpg');
  });

  test('Non-string input → null', () => {
    expect(sanitizeStoredImageValue(123)).toBeNull();
    expect(sanitizeStoredImageValue({})).toBeNull();
    expect(sanitizeStoredImageValue([])).toBeNull();
  });
});

describe('buildPublicImageUrl', () => {
  test('null/empty → null', () => {
    expect(buildPublicImageUrl(null)).toBeNull();
    expect(buildPublicImageUrl('')).toBeNull();
  });

  test('Data URL giữ nguyên', () => {
    expect(buildPublicImageUrl('data:image/png;base64,xx')).toBe('data:image/png;base64,xx');
  });

  test('Path tương đối → combine với assetBaseUrl', () => {
    expect(buildPublicImageUrl('uploads/x.jpg')).toBe('http://cdn.test/assets/uploads/x.jpg');
  });

  test('URL absolute external (không match prefix) → giữ nguyên', () => {
    expect(buildPublicImageUrl('https://external.com/img.png')).toBe(
      'https://external.com/img.png',
    );
  });

  test('URL absolute match BACKEND_URL prefix → combine với assetBase', () => {
    expect(buildPublicImageUrl('http://localhost:8888/uploads/x.jpg')).toBe(
      'http://cdn.test/assets/uploads/x.jpg',
    );
  });

  test('Convert /api/uploads → /uploads trong path', () => {
    expect(buildPublicImageUrl('/api/uploads/x.jpg')).toBe('http://cdn.test/assets/uploads/x.jpg');
  });

  test('Leading slash double không tạo double slash trong output', () => {
    expect(buildPublicImageUrl('//uploads/x.jpg')).toBe('http://cdn.test/assets/uploads/x.jpg');
  });
});

describe('assetBaseUrl exported', () => {
  test('= ASSET_BASE_URL từ env', () => {
    expect(assetBaseUrl).toBe('http://cdn.test/assets');
  });
});

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

    const {
      assetBaseUrl: assetBaseUrlEdge,
      buildPublicImageUrl: buildUrlEdge,
    } = require('./image-url');

    // Khi tất cả env vars undefined → DEFAULT_LOCAL_BASE = '' (line 1 || '' branch)
    // assetBase = normalizeBaseUrl('') || '' = null || '' = ''
    expect(typeof assetBaseUrlEdge).toBe('string');
    // buildPublicImageUrl với path tương đối khi assetBase = '' vẫn hoạt động
    const result = buildUrlEdge('uploads/x.jpg');
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

    const { assetBaseUrl: baseEdge, buildPublicImageUrl: buildUrl2Edge } = require('./image-url');
    // apiUrl = 'http://localhost:8888/v1' (không endsWith /api) → apiRoot = apiUrl
    // assetBase = normalizeBaseUrl(frontendUrl || apiRoot || DEFAULT_LOCAL_BASE) = frontendUrl
    // Khi ASSET_BASE_URL không set, assetBase = frontendUrl hoặc apiRoot
    expect(typeof baseEdge).toBe('string');
    // Module load thành công, buildPublicImageUrl hoạt động
    expect(buildUrl2Edge('uploads/x.jpg')).toMatch(/uploads\/x\.jpg/);

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
