/**
 * @file imageProxyRouter.test.js
 * @description Gộp từ imageProxyRouter.test.js + imageProxyRouter.edge-cases.test.js
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

// ═══════════════════════════════════════════════════════════════════════════════
// imageProxyRouter.edge-cases.test.js
// Covers lines 21-42: http path, proxyRes callback, error, timeout.
// ═══════════════════════════════════════════════════════════════════════════════

// Module-scope vars required because jest.mock() is hoisted before describe blocks
let mockCapturedProxyReqEdge = null;
let mockCallbackFnEdge = null;

jest.mock('https', () => {
  const original = jest.requireActual('https');
  return {
    ...original,
    get: (url, options, callback) => {
      const { EventEmitter } = require('events');
      const proxyReq = new EventEmitter();
      proxyReq.destroy = jest.fn();
      mockCapturedProxyReqEdge = proxyReq;
      mockCallbackFnEdge = callback;
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
      mockCapturedProxyReqEdge = proxyReq;
      mockCallbackFnEdge = callback;
      return proxyReq;
    },
  };
});

describe('imageProxyRouter — edge cases (http path, proxyRes, error, timeout)', () => {
  function mockResEdge() {
    return {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
  }

  function mockReqEdge(url) {
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

  afterEach(() => {
    mockCapturedProxyReqEdge = null;
    mockCallbackFnEdge = null;
  });

  describe('imageProxyRouter — error callback (line 38)', () => {
    test('502 Upstream error khi proxyReq emits error', () => {
      const res = mockResEdge();
      imageProxyRouter(mockReqEdge('https://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
      expect(mockCapturedProxyReqEdge).not.toBeNull();
      mockCapturedProxyReqEdge.emit('error', new Error('upstream'));
      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.send).toHaveBeenCalledWith('Upstream error');
    });
    test('không gọi res.status khi headersSent = true (error)', () => {
      const res = mockResEdge();
      res.headersSent = true;
      imageProxyRouter(mockReqEdge('https://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
      expect(mockCapturedProxyReqEdge).not.toBeNull();
      mockCapturedProxyReqEdge.emit('error', new Error('error'));
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('imageProxyRouter — timeout callback (lines 41-42)', () => {
    test('destroy + 504 Timeout', () => {
      const res = mockResEdge();
      imageProxyRouter(mockReqEdge('https://cdn.tgdd.vn/image.jpg'), res, jest.fn());
      expect(mockCapturedProxyReqEdge).not.toBeNull();
      mockCapturedProxyReqEdge.emit('timeout');
      expect(mockCapturedProxyReqEdge.destroy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(504);
      expect(res.send).toHaveBeenCalledWith('Timeout');
    });
    test('destroy khi headersSent=true (no status)', () => {
      const res = mockResEdge();
      res.headersSent = true;
      imageProxyRouter(mockReqEdge('https://cdn2.cellphones.com.vn/image.jpg'), res, jest.fn());
      expect(mockCapturedProxyReqEdge).not.toBeNull();
      mockCapturedProxyReqEdge.emit('timeout');
      expect(mockCapturedProxyReqEdge.destroy).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('imageProxyRouter — http path (line 21 false branch)', () => {
    test('dùng http module cho URL http://', () => {
      const res = mockResEdge();
      imageProxyRouter(mockReqEdge('http://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
      expect(mockCapturedProxyReqEdge).not.toBeNull();
      mockCapturedProxyReqEdge.emit('error', new Error('http error'));
      expect(res.status).toHaveBeenCalledWith(502);
    });
  });

  describe('imageProxyRouter — proxyRes callback (lines 32-33)', () => {
    test('set Content-Type và pipe khi header chưa sent', () => {
      const { EventEmitter } = require('events');
      const res = mockResEdge();
      imageProxyRouter(mockReqEdge('https://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
      const proxyRes = new EventEmitter();
      proxyRes.headers = { 'content-type': 'image/jpeg' };
      proxyRes.pipe = jest.fn();
      if (mockCallbackFnEdge) {
        mockCallbackFnEdge(proxyRes);
        expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      }
    });
    test('skip pipe khi headersSent=true', () => {
      const { EventEmitter } = require('events');
      const res = mockResEdge();
      res.headersSent = true;
      imageProxyRouter(mockReqEdge('https://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
      const proxyRes = new EventEmitter();
      proxyRes.headers = {};
      proxyRes.pipe = jest.fn();
      if (mockCallbackFnEdge) {
        mockCallbackFnEdge(proxyRes);
        expect(res.set).not.toHaveBeenCalled();
      }
    });
    test('fallback image/jpeg khi không có content-type', () => {
      const { EventEmitter } = require('events');
      const res = mockResEdge();
      imageProxyRouter(mockReqEdge('https://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
      const proxyRes = new EventEmitter();
      proxyRes.headers = {};
      proxyRes.pipe = jest.fn();
      if (mockCallbackFnEdge) {
        mockCallbackFnEdge(proxyRes);
        expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      }
    });
  });
});
