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
