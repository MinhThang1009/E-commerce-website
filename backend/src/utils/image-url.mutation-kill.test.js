/**
 * image-url.mutation-kill.test.js
 *
 * Kill mutant image-url (env-dependent consts → isolateModules + set env):
 *   - assetBaseUrl: API_URL kết thúc /api → strip → API_ROOT làm base
 *   - sanitizeStoredImageValue: trimToNull, dataUrl, /api/uploads→/uploads, strip prefix, strip leading slash
 *   - buildPublicImageUrl: dataUrl, http-prefix-match → combine ASSET_BASE, http-other → giữ nguyên, relative → combine
 */

const ENV = ['API_URL', 'BACKEND_URL', 'FRONTEND_URL', 'ASSET_BASE_URL', 'CDN_BASE_URL'];

function freshIU(env = {}) {
  let mod;
  jest.isolateModules(() => {
    ENV.forEach((k) => delete process.env[k]);
    Object.assign(process.env, env);
    mod = require('./image-url');
  });
  return mod;
}

afterEach(() => ENV.forEach((k) => delete process.env[k]));

const BASE_ENV = {
  API_URL: 'http://api.x/api',
  BACKEND_URL: 'http://be.x',
  FRONTEND_URL: 'http://fe.x',
};

describe('assetBaseUrl', () => {
  it('API_URL kết thúc "/api" → strip thành API_ROOT làm asset base', () => {
    expect(freshIU(BASE_ENV).assetBaseUrl).toBe('http://api.x');
  });
});

describe('sanitizeStoredImageValue', () => {
  it('http + /api/uploads → strip prefix + chuẩn hóa /uploads, bỏ leading slash', () => {
    expect(freshIU(BASE_ENV).sanitizeStoredImageValue('http://api.x/api/uploads/p.jpg')).toBe(
      'uploads/p.jpg',
    );
  });

  it('path tuyệt đối → bỏ leading slash', () => {
    expect(freshIU(BASE_ENV).sanitizeStoredImageValue('/uploads/a.jpg')).toBe('uploads/a.jpg');
  });

  it('data URL → giữ nguyên', () => {
    const iu = freshIU(BASE_ENV);
    expect(iu.sanitizeStoredImageValue('data:image/png;base64,XX')).toBe(
      'data:image/png;base64,XX',
    );
  });

  it('không phải string → null', () => {
    expect(freshIU(BASE_ENV).sanitizeStoredImageValue(123)).toBeNull();
  });

  it('chuỗi rỗng → null', () => {
    expect(freshIU(BASE_ENV).sanitizeStoredImageValue('   ')).toBeNull();
  });
});

describe('buildPublicImageUrl', () => {
  it('path tương đối → ghép ASSET_BASE', () => {
    expect(freshIU(BASE_ENV).buildPublicImageUrl('uploads/p.jpg')).toBe(
      'http://api.x/uploads/p.jpg',
    );
  });

  it('http khớp prefix nội bộ → thay bằng ASSET_BASE', () => {
    expect(freshIU(BASE_ENV).buildPublicImageUrl('http://be.x/uploads/x.jpg')).toBe(
      'http://api.x/uploads/x.jpg',
    );
  });

  it('http ngoài (không khớp prefix) → giữ nguyên', () => {
    expect(freshIU(BASE_ENV).buildPublicImageUrl('http://other.com/x.jpg')).toBe(
      'http://other.com/x.jpg',
    );
  });

  it('data URL → giữ nguyên', () => {
    expect(freshIU(BASE_ENV).buildPublicImageUrl('data:abc')).toBe('data:abc');
  });

  it('null/rỗng → null', () => {
    expect(freshIU(BASE_ENV).buildPublicImageUrl('')).toBeNull();
  });

  it('ASSET_BASE_URL ưu tiên cao nhất', () => {
    const iu = freshIU({ ...BASE_ENV, ASSET_BASE_URL: 'http://cdn.x' });
    expect(iu.assetBaseUrl).toBe('http://cdn.x');
    expect(iu.buildPublicImageUrl('uploads/p.jpg')).toBe('http://cdn.x/uploads/p.jpg');
  });
});
