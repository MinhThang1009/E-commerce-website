/**
 * Phase 44 — Unit tests cho imageUrl helpers (utils/imageUrl.js)
 * Pure functions với env-based config — set env trước require.
 */

// Set env trước require (module đọc env ở load time)
process.env.BACKEND_URL = 'http://localhost:8888';
process.env.API_URL = 'http://localhost:8888/api';
process.env.FRONTEND_URL = 'http://localhost:5175';
process.env.ASSET_BASE_URL = 'http://cdn.test/assets';

const {
  sanitizeStoredImageValue,
  sanitizeImageCollection,
  buildPublicImageUrl,
  buildPublicImageCollection,
  assetBaseUrl,
} = require('./imageUrl');

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
    expect(sanitizeStoredImageValue('http://localhost:8888/uploads/img.jpg'))
      .toBe('uploads/img.jpg');
  });

  test('Strip ASSET_BASE_URL prefix', () => {
    expect(sanitizeStoredImageValue('http://cdn.test/assets/photo.png'))
      .toBe('photo.png');
  });

  test('Convert /api/uploads → /uploads', () => {
    expect(sanitizeStoredImageValue('/api/uploads/x.jpg'))
      .toBe('uploads/x.jpg');
  });

  test('Path tương đối giữ nguyên (không có prefix match)', () => {
    expect(sanitizeStoredImageValue('uploads/banner/x.jpg'))
      .toBe('uploads/banner/x.jpg');
  });

  test('Windows backslash → forward slash', () => {
    expect(sanitizeStoredImageValue('uploads\\products\\x.jpg'))
      .toBe('uploads/products/x.jpg');
  });

  test('Strip leading slash sau khi sanitize', () => {
    expect(sanitizeStoredImageValue('/uploads/x.jpg'))
      .toBe('uploads/x.jpg');
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
    expect(buildPublicImageUrl('uploads/x.jpg'))
      .toBe('http://cdn.test/assets/uploads/x.jpg');
  });

  test('URL absolute external (không match prefix) → giữ nguyên', () => {
    expect(buildPublicImageUrl('https://external.com/img.png'))
      .toBe('https://external.com/img.png');
  });

  test('URL absolute match BACKEND_URL prefix → combine với assetBase', () => {
    expect(buildPublicImageUrl('http://localhost:8888/uploads/x.jpg'))
      .toBe('http://cdn.test/assets/uploads/x.jpg');
  });

  test('Convert /api/uploads → /uploads trong path', () => {
    expect(buildPublicImageUrl('/api/uploads/x.jpg'))
      .toBe('http://cdn.test/assets/uploads/x.jpg');
  });

  test('Leading slash double không tạo double slash trong output', () => {
    expect(buildPublicImageUrl('//uploads/x.jpg'))
      .toBe('http://cdn.test/assets/uploads/x.jpg');
  });
});

describe('sanitizeImageCollection', () => {
  test('Mảng strings → sanitize từng element', () => {
    expect(sanitizeImageCollection([
      '/uploads/a.jpg',
      'http://localhost:8888/uploads/b.jpg',
      null,
      '',
    ])).toEqual(['uploads/a.jpg', 'uploads/b.jpg']);
  });

  test('JSON string array → parse + sanitize', () => {
    expect(sanitizeImageCollection('["uploads/a.jpg","uploads/b.jpg"]'))
      .toEqual(['uploads/a.jpg', 'uploads/b.jpg']);
  });

  test('CSV/newline string → split + sanitize', () => {
    expect(sanitizeImageCollection('uploads/a.jpg, uploads/b.jpg\nuploads/c.jpg'))
      .toEqual(['uploads/a.jpg', 'uploads/b.jpg', 'uploads/c.jpg']);
  });

  test('null/undefined/empty → []', () => {
    expect(sanitizeImageCollection(null)).toEqual([]);
    expect(sanitizeImageCollection(undefined)).toEqual([]);
    expect(sanitizeImageCollection('')).toEqual([]);
    expect(sanitizeImageCollection([])).toEqual([]);
  });

  test('Filter falsy result sau sanitize', () => {
    expect(sanitizeImageCollection(['', '/uploads/x.jpg', null]))
      .toEqual(['uploads/x.jpg']);
  });
});

describe('buildPublicImageCollection', () => {
  test('Mảng path → mảng URL public', () => {
    expect(buildPublicImageCollection(['uploads/a.jpg', 'uploads/b.jpg']))
      .toEqual([
        'http://cdn.test/assets/uploads/a.jpg',
        'http://cdn.test/assets/uploads/b.jpg',
      ]);
  });

  test('Filter null/empty', () => {
    expect(buildPublicImageCollection([null, '', 'uploads/x.jpg']))
      .toEqual(['http://cdn.test/assets/uploads/x.jpg']);
  });

  test('JSON string input → parse + map', () => {
    expect(buildPublicImageCollection('["uploads/x.jpg"]'))
      .toEqual(['http://cdn.test/assets/uploads/x.jpg']);
  });
});

describe('assetBaseUrl exported', () => {
  test('= ASSET_BASE_URL từ env', () => {
    expect(assetBaseUrl).toBe('http://cdn.test/assets');
  });
});

// ─── coerceToArray — non-string, non-array, truthy value (line 128) ───────────
// Covers line 128: `return []` khi value là truthy nhưng không phải string/array

describe('sanitizeImageCollection — input không phải string/array', () => {
  test('số (number) → trả về [] (covers coerceToArray line 128)', () => {
    // coerceToArray(42): truthy, không phải array, không phải string → return []
    expect(sanitizeImageCollection(42)).toEqual([]);
  });

  test('object thuần → trả về []', () => {
    expect(sanitizeImageCollection({ url: 'uploads/x.jpg' })).toEqual([]);
  });

  test('true (boolean) → trả về []', () => {
    expect(sanitizeImageCollection(true)).toEqual([]);
  });
});
