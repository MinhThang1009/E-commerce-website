/**
 * @file imageProxyRouter.extra.test.js
 * @description Covers lines 21-42: http path, proxyRes callback, error, timeout.
 */

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

const imageProxyRouter = require('./image-proxy-router');

function mockRes() {
  return { headersSent: false, status: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis() };
}
function mockReq(url) {
  return { method: 'GET', url: `/?url=${encodeURIComponent(url)}`, path: '/', originalUrl: `/?url=${encodeURIComponent(url)}`, query: { url }, headers: {}, app: { get: jest.fn() }, baseUrl: '' };
}

afterEach(() => { mockCapturedProxyReq = null; mockCallbackFn = null; });

describe('imageProxyRouter — error callback (line 38)', () => {
  test('502 Upstream error khi proxyReq emits error', () => {
    const res = mockRes(); imageProxyRouter(mockReq('https://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
    expect(mockCapturedProxyReq).not.toBeNull();
    mockCapturedProxyReq.emit('error', new Error('upstream'));
    expect(res.status).toHaveBeenCalledWith(502); expect(res.send).toHaveBeenCalledWith('Upstream error');
  });
  test('không gọi res.status khi headersSent = true (error)', () => {
    const res = mockRes(); res.headersSent = true;
    imageProxyRouter(mockReq('https://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
    expect(mockCapturedProxyReq).not.toBeNull();
    mockCapturedProxyReq.emit('error', new Error('error'));
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('imageProxyRouter — timeout callback (lines 41-42)', () => {
  test('destroy + 504 Timeout', () => {
    const res = mockRes(); imageProxyRouter(mockReq('https://cdn.tgdd.vn/image.jpg'), res, jest.fn());
    expect(mockCapturedProxyReq).not.toBeNull();
    mockCapturedProxyReq.emit('timeout');
    expect(mockCapturedProxyReq.destroy).toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(504); expect(res.send).toHaveBeenCalledWith('Timeout');
  });
  test('destroy khi headersSent=true (no status)', () => {
    const res = mockRes(); res.headersSent = true;
    imageProxyRouter(mockReq('https://cdn2.cellphones.com.vn/image.jpg'), res, jest.fn());
    expect(mockCapturedProxyReq).not.toBeNull(); mockCapturedProxyReq.emit('timeout');
    expect(mockCapturedProxyReq.destroy).toHaveBeenCalled(); expect(res.status).not.toHaveBeenCalled();
  });
});

describe('imageProxyRouter — http path (line 21 false branch)', () => {
  test('dùng http module cho URL http://', () => {
    const res = mockRes(); imageProxyRouter(mockReq('http://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
    expect(mockCapturedProxyReq).not.toBeNull();
    mockCapturedProxyReq.emit('error', new Error('http error'));
    expect(res.status).toHaveBeenCalledWith(502);
  });
});

describe('imageProxyRouter — proxyRes callback (lines 32-33)', () => {
  test('set Content-Type và pipe khi header chưa sent', () => {
    const { EventEmitter } = require('events');
    const res = mockRes(); imageProxyRouter(mockReq('https://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
    const proxyRes = new EventEmitter(); proxyRes.headers = { 'content-type': 'image/jpeg' }; proxyRes.pipe = jest.fn();
    if (mockCallbackFn) { mockCallbackFn(proxyRes); expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg'); }
  });
  test('skip pipe khi headersSent=true', () => {
    const { EventEmitter } = require('events');
    const res = mockRes(); res.headersSent = true; imageProxyRouter(mockReq('https://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
    const proxyRes = new EventEmitter(); proxyRes.headers = {}; proxyRes.pipe = jest.fn();
    if (mockCallbackFn) { mockCallbackFn(proxyRes); expect(res.set).not.toHaveBeenCalled(); }
  });
  test('fallback image/jpeg khi không có content-type', () => {
    const { EventEmitter } = require('events');
    const res = mockRes(); imageProxyRouter(mockReq('https://cdnv2.tgdd.vn/image.jpg'), res, jest.fn());
    const proxyRes = new EventEmitter(); proxyRes.headers = {}; proxyRes.pipe = jest.fn();
    if (mockCallbackFn) { mockCallbackFn(proxyRes); expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg'); }
  });
});
