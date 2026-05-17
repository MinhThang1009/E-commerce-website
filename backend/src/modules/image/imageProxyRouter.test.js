/**
 * @file imageProxyRouter.test.js
 * @layer Test
 * @module image
 * @description Tests cho image proxy router — kiểm tra domain whitelist và input validation
 *
 * Strategy: Test request handling logic trực tiếp (không mock http/https native modules
 * vì gây xung đột với Express). Tập trung vào validation và domain whitelist.
 */

const express = require('express');
const supertest = require('supertest');
const imageProxyRouter = require('./imageProxyRouter');

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
      const res = await request.get('/?url=https://cdnv2.tgdd.vn/test.jpg').timeout(2000).catch(err => err);
      // Nếu timeout: không phải validation error → domain passed whitelist
      if (res.status) {
        expect([200, 502, 504]).toContain(res.status); // upstream error OK
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(403);
      }
    });

    it('không trả về 400/403 cho cdn.tgdd.vn (domain được phép)', async () => {
      const res = await request.get('/?url=https://cdn.tgdd.vn/test.jpg').timeout(2000).catch(err => err);
      if (res.status) {
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(403);
      }
    });

    it('không trả về 400/403 cho cdn2.cellphones.com.vn (domain được phép)', async () => {
      const res = await request.get('/?url=https://cdn2.cellphones.com.vn/test.jpg').timeout(2000).catch(err => err);
      if (res.status) {
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(403);
      }
    });
  });
});
