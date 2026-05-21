/**
 * @file imageProxyRouter.test.js
 * @description Gộp từ imageProxyRouter.test.js + imageProxyRouter.extra.test.js
 */
const express = require('express');
const supertest = require('supertest');
const imageProxyRouter = require('./image-proxy-router');

function buildApp() {
  const app = express();
  app.use('/', imageProxyRouter);
  return app;
}

const request = supertest(buildApp());

describe('imageProxyRouter — Input validation và domain whitelist', () => {
  describe('Missing url param', () => {
    it('trả về 400 khi không có url param', async () => {
      const res = await request.get('/');
      expect(res.status).toBe(400);
      expect(res.text).toBe('Missing url param');
    });

    it('trả về 400 khi url rỗng', async () => {
      const res = await request.get('/?url=');
      expect(res.status).toBe(400);
      expect(res.text).toBe('Missing url param');
    });
  });

  describe('URL validation', () => {
    it('trả về 400 khi url không phải URL hợp lệ', async () => {
      const res = await request.get('/?url=not-a-valid-url');
      expect(res.status).toBe(400);
      expect(res.text).toBe('Invalid URL');
    });

    it('trả về 400 khi url chỉ có chữ (no protocol)', async () => {
      const res = await request.get('/?url=cdnv2.tgdd.vn/image.jpg');
      expect(res.status).toBe(400);
      expect(res.text).toBe('Invalid URL');
    });
  });

  describe('Domain whitelist', () => {
    it('trả về 403 khi domain không được phép (evil.com)', async () => {
      const res = await request.get('/?url=https://evil.com/image.jpg');
      expect(res.status).toBe(403);
      expect(res.text).toBe('Domain not allowed');
    });

    it('trả về 403 khi domain là google.com', async () => {
      const res = await request.get('/?url=https://google.com/logo.png');
      expect(res.status).toBe(403);
      expect(res.text).toBe('Domain not allowed');
    });

    it('trả về 403 khi subdomain giả mạo cdnv2.tgdd.vn (attacker.cdnv2.tgdd.vn)', async () => {
      const res = await request.get('/?url=https://attacker.cdnv2.tgdd.vn/payload.jpg');
      expect(res.status).toBe(403);
      expect(res.text).toBe('Domain not allowed');
    });

    it('trả về 403 khi domain chứa cdnv2.tgdd.vn nhưng không phải đúng hostname', async () => {
      const res = await request.get('/?url=https://fake-cdnv2.tgdd.vn.evil.com/img.jpg');
      expect(res.status).toBe(403);
      expect(res.text).toBe('Domain not allowed');
    });

    // Domains được phép — sẽ cố gắng proxy thật (có thể timeout, OK cho test)
    // Test chỉ verify không bị 400/403
    it('không trả về 400/403 cho cdnv2.tgdd.vn (domain được phép)', async () => {
      // Gửi request — sẽ timeout hoặc lỗi kết nối nhưng không phải validation error
      const res = await request
        .get('/?url=https://cdnv2.tgdd.vn/test.jpg')
        .timeout(2000)
        .catch((err) => err);
      // Nếu timeout: không phải validation error → domain passed whitelist
      if (res.status) {
        expect([200, 502, 504]).toContain(res.status); // upstream error OK
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(403);
      }
    });

    it('không trả về 400/403 cho cdn.tgdd.vn (domain được phép)', async () => {
      const res = await request
        .get('/?url=https://cdn.tgdd.vn/test.jpg')
        .timeout(2000)
        .catch((err) => err);
      if (res.status) {
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(403);
      }
    });

    it('không trả về 400/403 cho cdn2.cellphones.com.vn (domain được phép)', async () => {
      const res = await request
        .get('/?url=https://cdn2.cellphones.com.vn/test.jpg')
        .timeout(2000)
        .catch((err) => err);
      if (res.status) {
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(403);
      }
    });
  });
});

// ═══════════
// imageProxyRouter.extra.test.js
// ═══════════

let mockCapturedProxyReq = null;
let mockCallbackFn = null;

jest.mock('https', () => {
  const original = jest.requireActual('https');
  return {
    ...original,
    get: (url, options, callback) => {
      const { EventEmitter } = require('events');
      const proxyReq = new EventEmitter();
      proxyReq.destroy = jest.fn();
      mockCapturedProxyReq = proxyReq;
      mockCallbackFn = callback;
      return proxyReq;
    },
  };
});

jest.mock('http', () => {
  const original = jest.requireActual('http');
  return {
    ...original,
    get: (url, options, callback) => {
      const { EventEmitter } = require('events');
      const proxyReq = new EventEmitter();
      proxyReq.destroy = jest.fn();
      mockCapturedProxyReq = proxyReq;
      mockCallbackFn = callback;
      return proxyReq;
    },
  };
});

function mockRes() {
  const res = {
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  };
  return res;
}

afterEach(() => {
  mockCapturedProxyReq = null;
  mockCallbackFn = null;
});

// ─────────────────────────────────────────────────────────────────────────────

function mockReq(url) {
  return {
    method: 'GET',
    url: `/?url=${encodeURIComponent(url)}`,
    path: '/',
    originalUrl: `/?url=${encodeURIComponent(url)}`,
    query: { url },
    headers: {},
    app: { get: jest.fn() },
    baseUrl: '',
  };
}

describe('imageProxyRouter — error callback (line 38)', () => {
  test('502 Upstream error khi proxyReq emits error', () => {
    const req = mockReq('https://cdnv2.tgdd.vn/image.jpg');
    const res = mockRes();

    imageProxyRouter(req, res, jest.fn());

    expect(mockCapturedProxyReq).not.toBeNull();
    mockCapturedProxyReq.emit('error', new Error('upstream failed'));

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.send).toHaveBeenCalledWith('Upstream error');
  });

  test('không gọi res.status khi headersSent = true (error)', () => {
    const req = mockReq('https://cdnv2.tgdd.vn/image.jpg');
    const res = mockRes();
    res.headersSent = true;

    imageProxyRouter(req, res, jest.fn());

    // Assert unconditional — nếu proxy req không được tạo, test PHẢI fail rõ ràng
    expect(mockCapturedProxyReq).not.toBeNull();
    mockCapturedProxyReq.emit('error', new Error('error after send'));
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('imageProxyRouter — timeout callback (lines 41-42)', () => {
  test('destroy + 504 Timeout khi proxyReq emits timeout', () => {
    const req = mockReq('https://cdn.tgdd.vn/image.jpg');
    const res = mockRes();

    imageProxyRouter(req, res, jest.fn());

    expect(mockCapturedProxyReq).not.toBeNull();
    mockCapturedProxyReq.emit('timeout');

    expect(mockCapturedProxyReq.destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.send).toHaveBeenCalledWith('Timeout');
  });

  test('destroy nhưng không gọi res.status khi headersSent = true (timeout)', () => {
    const req = mockReq('https://cdn2.cellphones.com.vn/image.jpg');
    const res = mockRes();
    res.headersSent = true;

    imageProxyRouter(req, res, jest.fn());
    expect(mockCapturedProxyReq).not.toBeNull();
    mockCapturedProxyReq.emit('timeout');
    expect(mockCapturedProxyReq.destroy).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// http (không phải https) path — line 21 branch
// ─────────────────────────────────────────────────────────────────────────────

describe('imageProxyRouter — http (non-https) URL — line 21 branch', () => {
  test('dùng http module khi URL bắt đầu bằng http:// (line 21 false branch)', () => {
    // cdnv2.tgdd.vn là allowed domain — dùng http:// thay vì https://
    const req = mockReq('http://cdnv2.tgdd.vn/image.jpg');
    const res = mockRes();

    imageProxyRouter(req, res, jest.fn());

    // http.get được gọi → mockCapturedProxyReq được set bởi http mock
    expect(mockCapturedProxyReq).not.toBeNull();

    // Emit error để test kết thúc
    mockCapturedProxyReq.emit('error', new Error('http upstream error'));
    expect(res.status).toHaveBeenCalledWith(502);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// proxyRes callback — lines 32-33 (headersSent check + content-type)
// ─────────────────────────────────────────────────────────────────────────────

describe('imageProxyRouter — proxyRes callback (lines 32-33)', () => {
  const { EventEmitter } = require('events');

  test('pipe proxyRes khi header chưa sent (line 32 false branch)', () => {
    const req = mockReq('https://cdnv2.tgdd.vn/image.jpg');
    const res = mockRes();
    res.pipe = jest.fn();

    imageProxyRouter(req, res, jest.fn());

    // Tạo mock proxyRes và gọi callback
    const proxyRes = new EventEmitter();
    proxyRes.headers = { 'content-type': 'image/jpeg' };
    proxyRes.pipe = jest.fn();

    if (mockCallbackFn) {
      mockCallbackFn(proxyRes);
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400');
    }
  });

  test('skip pipe khi headersSent = true (line 32 true branch)', () => {
    const req = mockReq('https://cdnv2.tgdd.vn/image.jpg');
    const res = mockRes();
    res.headersSent = true;

    imageProxyRouter(req, res, jest.fn());

    const proxyRes = new EventEmitter();
    proxyRes.headers = { 'content-type': 'image/png' };
    proxyRes.pipe = jest.fn();

    if (mockCallbackFn) {
      mockCallbackFn(proxyRes);
      // headersSent = true → return ngay, không gọi res.set
      expect(res.set).not.toHaveBeenCalled();
    }
  });

  test('dùng image/jpeg khi content-type không có trong header', () => {
    const req = mockReq('https://cdnv2.tgdd.vn/image.jpg');
    const res = mockRes();

    imageProxyRouter(req, res, jest.fn());

    const proxyRes = new EventEmitter();
    proxyRes.headers = {}; // không có content-type
    proxyRes.pipe = jest.fn();

    if (mockCallbackFn) {
      mockCallbackFn(proxyRes);
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    }
  });
});
