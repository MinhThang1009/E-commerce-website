'use strict';
/**
 * Mutation-kill tests cho admin-import-controller.js.
 *
 * Giết survivor baseline (60.98%): multer fileFilter (ext/mime/message),
 * nội dung CSV template (header + example row), và nhánh format của export.
 *
 * Dùng app express TỐI THIỂU chỉ gắn 3 route import → tránh load cả admin router
 * (kéo theo hàng loạt model/controller khác). importService được mock để assert
 * hành vi controller một cách tất định.
 */

process.env.NODE_ENV = 'test';

jest.mock('@modules/admin/services/product-import-service', () => ({
  importProducts: jest.fn(),
  exportProducts: jest.fn(),
}));

const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('@middlewares/error-handler');
const { CSV_HEADERS } = require('@modules/admin/utils/csv-parser');
const importService = require('@modules/admin/services/product-import-service');
const controller = require('@modules/admin/controllers/admin-import-controller');

const app = express();
app.use((req, _res, next) => {
  req.user = { id: 1, role: 'admin' };
  next();
});
app.get('/products/import-template', controller.getImportTemplate);
app.post('/products/import', controller.uploadImportFile, controller.importProducts);
app.get('/products/export', controller.exportProducts);
app.use(errorHandler);

const request = supertest(app);

// Giá trị example row đúng như source (16 cột) — bất kỳ string nào bị đổi "" sẽ lệch.
const EXPECTED_EXAMPLE_ROW = [
  'iPhone 17 Pro Max',
  '',
  'Smartphone cao cấp mới nhất của Apple',
  '36990000',
  'dien-thoai',
  'Apple',
  'active',
  '50',
  'IPH17PM-256-BLK',
  '0.228',
  '/uploads/products/iphone17-pro-max.jpg',
  'Apple A19 Pro',
  '8GB',
  '256GB',
  '6.9" Super Retina XDR',
  '4685 mAh',
].join(',');

beforeEach(() => {
  jest.clearAllMocks();
  importService.importProducts.mockResolvedValue({ created: 0, errors: [] });
  importService.exportProducts.mockResolvedValue('col1,col2\n');
});

// ─── getImportTemplate ──────────────────────────────────────────────────────

describe('getImportTemplate — nội dung CSV template', () => {
  test('body = header + example row chính xác (kill mọi string literal template)', async () => {
    const res = await request.get('/products/import-template');
    expect(res.status).toBe(200);
    // Kill L30-46 (16 string), L46 join(','), L50 CSV_HEADERS.join(',')
    expect(res.text).toBe(`${CSV_HEADERS.join(',')}\n${EXPECTED_EXAMPLE_ROW}\n`);
  });

  test('header CSV nối bằng dấu phẩy (kill join "," → "")', async () => {
    const res = await request.get('/products/import-template');
    const firstLine = res.text.split('\n')[0];
    expect(firstLine).toBe(CSV_HEADERS.join(','));
    expect(firstLine).toContain(',');
  });

  test('Content-Type text/csv + Content-Disposition filename template', async () => {
    const res = await request.get('/products/import-template');
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/product-import-template\.csv/);
  });
});

// ─── fileFilter (multer) ────────────────────────────────────────────────────

const attach = (filename, contentType) =>
  request
    .post('/products/import')
    .attach('file', Buffer.from('name,base_price,category_slug\nA,1,c\n'), {
      filename,
      contentType,
    });

describe('importUpload.fileFilter — chấp nhận/từ chối theo ext + mime', () => {
  test('ext .csv → chấp nhận (vào controller, 200)', async () => {
    const res = await attach('p.csv', 'text/csv');
    expect(res.status).toBe(200);
  });

  test('ext .json → chấp nhận (kill ".json" → "")', async () => {
    // mime cố tình KHÔNG hợp lệ để cô lập nhánh ext .json
    const res = await attach('p.json', 'image/png');
    expect(res.status).toBe(200);
  });

  test('ext .csv + mime sai → vẫn chấp nhận (kill ".csv" → "")', async () => {
    const res = await attach('p.csv', 'image/png');
    expect(res.status).toBe(200);
  });

  test('ext HOA .CSV + mime sai → chấp nhận (kill toLowerCase → bỏ)', async () => {
    const res = await attach('P.CSV', 'image/png');
    expect(res.status).toBe(200);
  });

  test('ext .txt + mime text/csv → chấp nhận qua nhánh mime', async () => {
    const res = await attach('p.txt', 'text/csv');
    expect(res.status).toBe(200);
  });

  test('ext .txt + mime application/json → chấp nhận', async () => {
    const res = await attach('p.txt', 'application/json');
    expect(res.status).toBe(200);
  });

  test('ext .txt + mime text/plain → chấp nhận', async () => {
    const res = await attach('p.txt', 'text/plain');
    expect(res.status).toBe(200);
  });

  test('ext .txt + mime application/octet-stream → chấp nhận', async () => {
    const res = await attach('p.txt', 'application/octet-stream');
    expect(res.status).toBe(200);
  });

  test('ext .txt + mime image/png → TỪ CHỐI 400 đúng message', async () => {
    const res = await attach('p.png', 'image/png');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Chỉ chấp nhận file CSV hoặc JSON');
  });
});

// ─── importProducts ─────────────────────────────────────────────────────────

describe('importProducts — nhánh kết quả', () => {
  test('không có file → 400 đúng message', async () => {
    const res = await request.post('/products/import');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Vui lòng upload file CSV hoặc JSON');
  });

  test('allFailed → 422 status error + message + errors', async () => {
    importService.importProducts.mockResolvedValueOnce({
      allFailed: true,
      errors: [{ row: 1, error: 'x' }],
    });
    const res = await attach('p.csv', 'text/csv');
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      status: 'error',
      message: 'Tất cả dòng đều không hợp lệ — không có gì được import',
      errors: [{ row: 1, error: 'x' }],
    });
  });

  test('thành công → 200 status success + data = result', async () => {
    importService.importProducts.mockResolvedValueOnce({ created: 3, errors: [] });
    const res = await attach('p.csv', 'text/csv');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success', data: { created: 3, errors: [] } });
    expect(importService.importProducts).toHaveBeenCalledWith({
      file: expect.any(Object),
      adminId: 1,
    });
  });
});

// ─── exportProducts ─────────────────────────────────────────────────────────

describe('exportProducts — nhánh format', () => {
  test('?format=json → exportProducts("json"), trả JSON + Content-Type application/json', async () => {
    importService.exportProducts.mockResolvedValueOnce([{ id: 1 }]);
    const res = await request.get('/products/export?format=json');
    expect(res.status).toBe(200);
    expect(importService.exportProducts).toHaveBeenCalledWith('json');
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual([{ id: 1 }]);
  });

  test('không format → mặc định csv: exportProducts("csv") + Content-Type text/csv', async () => {
    importService.exportProducts.mockResolvedValueOnce('a,b\n1,2\n');
    const res = await request.get('/products/export');
    expect(res.status).toBe(200);
    expect(importService.exportProducts).toHaveBeenCalledWith('csv');
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toBe('a,b\n1,2\n');
  });

  test('?format=xml (khác json) → fallback csv (kill ternary === json)', async () => {
    await request.get('/products/export?format=xml');
    expect(importService.exportProducts).toHaveBeenCalledWith('csv');
  });
});
