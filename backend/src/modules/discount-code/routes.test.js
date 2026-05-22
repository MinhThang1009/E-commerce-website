'use strict';
/**
 * Test /api/discount-codes (customer) và /api/admin/discount-codes (admin CRUD).
 */

jest.mock('@models', () => ({
  DiscountCode: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  },
}));
jest.mock('@utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  adminAuthenticate: (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  optionalAuthenticate: (req, res, next) => next(),
}));
jest.mock('@middlewares/rate-limiter', () => ({
  apiLimiter: (r, s, n) => n(),
  authLimiter: (r, s, n) => n(),
  chatbotLimiter: (r, s, n) => n(),
  otpLimiter: (r, s, n) => n(),
}));
jest.mock('@middlewares/validate-request', () => ({
  validateRequest: () => (r, s, n) => n(),
  validate: () => (r, s, n) => n(),
}));
jest.mock('@middlewares/authorize', () => ({
  authorize: () => (r, s, n) => n(),
}));
jest.mock('@middlewares/admin-auth', () => ({
  adminAuthenticate: (r, s, n) => {
    r.user = { id: 1, role: 'admin' };
    n();
  },
}));

const express = require('express');
const supertest = require('supertest');
const discountCodeRoutes = require('./routes');
const adminRoutes = require('@modules/admin/routes');
const { DiscountCode } = require('@models');

// App cho customer routes
const app = express();
app.use(express.json());
app.use('/api/discount-codes', discountCodeRoutes);
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});
const request = supertest(app);

// App riêng cho admin routes
const adminApp = express();
adminApp.use(express.json());
adminApp.use('/api/admin', adminRoutes);
adminApp.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});
const adminRequest = supertest(adminApp);

// Helper tạo discount code mock
function makeCode(overrides = {}) {
  return {
    id: 1,
    code: 'SAVE10',
    type: 'percent',
    value: '10.00',
    minOrderAmount: '100000',
    maxDiscountAmount: null,
    usageLimit: null,
    usedCount: 0,
    isActive: true,
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

describe('POST /api/discount-codes/apply', () => {
  beforeEach(() => {
    DiscountCode.findOne.mockReset();
  });

  test('400 khi code không tồn tại', async () => {
    DiscountCode.findOne.mockResolvedValue(null);
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'INVALID', orderAmount: 500000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/không hợp lệ/);
  });

  test('400 khi code chưa đến ngày áp dụng', async () => {
    const future = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    DiscountCode.findOne.mockResolvedValue(makeCode({ startDate: future }));
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'SAVE10', orderAmount: 500000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/chưa đến/);
  });

  test('400 khi code đã hết hạn', async () => {
    const past = new Date(Date.now() - 86400000).toISOString(); // yesterday
    DiscountCode.findOne.mockResolvedValue(makeCode({ endDate: past }));
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'SAVE10', orderAmount: 500000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hết hạn/);
  });

  test('400 khi code vượt giới hạn sử dụng', async () => {
    DiscountCode.findOne.mockResolvedValue(makeCode({ usageLimit: 10, usedCount: 10 }));
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'SAVE10', orderAmount: 500000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/giới hạn/);
  });

  test('400 khi đơn hàng dưới giá tối thiểu', async () => {
    DiscountCode.findOne.mockResolvedValue(makeCode({ minOrderAmount: '500000' }));
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'SAVE10', orderAmount: 200000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tối thiểu/);
  });

  test('200 — discount type percent tính đúng', async () => {
    DiscountCode.findOne.mockResolvedValue(makeCode({ type: 'percent', value: '10.00' }));
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'SAVE10', orderAmount: 1000000 });
    expect(res.status).toBe(200);
    expect(res.body.data.discountAmount).toBe(100000); // 10% of 1,000,000
  });

  test('200 — discount type percent + maxDiscountAmount cap', async () => {
    DiscountCode.findOne.mockResolvedValue(
      makeCode({ type: 'percent', value: '30.00', maxDiscountAmount: '50000' }),
    );
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'SAVE30', orderAmount: 1000000 });
    expect(res.status).toBe(200);
    expect(res.body.data.discountAmount).toBe(50000); // capped at 50,000
  });

  test('200 — discount type fixed tính đúng', async () => {
    DiscountCode.findOne.mockResolvedValue(makeCode({ type: 'fixed', value: '50000' }));
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'FLAT50', orderAmount: 500000 });
    expect(res.status).toBe(200);
    expect(res.body.data.discountAmount).toBe(50000);
  });

  test('200 — discount không vượt quá orderAmount', async () => {
    DiscountCode.findOne.mockResolvedValue(makeCode({ type: 'fixed', value: '999999' }));
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'BIG', orderAmount: 100000 });
    expect(res.status).toBe(200);
    expect(res.body.data.discountAmount).toBe(100000); // capped at orderAmount
  });

  test('200 — response chứa đủ fields', async () => {
    DiscountCode.findOne.mockResolvedValue(makeCode({ id: 99, code: 'SAVE10' }));
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'SAVE10', orderAmount: 500000 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      discountCodeId: 99,
      code: 'SAVE10',
      discountAmount: expect.any(Number),
    });
  });

  test('200 — code hợp lệ khi usageLimit chưa đạt', async () => {
    DiscountCode.findOne.mockResolvedValue(makeCode({ usageLimit: 100, usedCount: 5 }));
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'SAVE10', orderAmount: 500000 });
    expect(res.status).toBe(200);
  });

  test('200 — code không có startDate/endDate luôn hợp lệ về ngày', async () => {
    DiscountCode.findOne.mockResolvedValue(makeCode({ startDate: null, endDate: null }));
    const res = await request
      .post('/api/discount-codes/apply')
      .send({ code: 'SAVE10', orderAmount: 500000 });
    expect(res.status).toBe(200);
  });
});

// ============================================================
// Admin CRUD — GET /api/admin/discount-codes
// ============================================================

describe('GET /api/admin/discount-codes', () => {
  beforeEach(() => {
    DiscountCode.findAndCountAll.mockReset();
  });

  test('200 — trả về danh sách với pagination', async () => {
    DiscountCode.findAndCountAll.mockResolvedValue({
      count: 25,
      rows: [makeCode({ id: 1 }), makeCode({ id: 2 })],
    });

    const res = await adminRequest.get('/api/admin/discount-codes?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.pagination.totalItems).toBe(25);
    expect(res.body.data.discountCodes).toHaveLength(2);
  });

  test('200 — filter theo search', async () => {
    DiscountCode.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [makeCode({ code: 'SAVE50' })],
    });

    const res = await adminRequest.get('/api/admin/discount-codes?search=SAVE50');
    expect(res.status).toBe(200);
    // findAndCountAll phải được gọi với where có code filter
    expect(DiscountCode.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ code: expect.objectContaining({}) }),
      }),
    );
  });

  test('200 — filter theo isActive=true', async () => {
    DiscountCode.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const res = await adminRequest.get('/api/admin/discount-codes?isActive=true');
    expect(res.status).toBe(200);
    expect(DiscountCode.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  test('200 — không filter isActive khi không truyền param', async () => {
    DiscountCode.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await adminRequest.get('/api/admin/discount-codes');
    const callArgs = DiscountCode.findAndCountAll.mock.calls[0][0];
    expect(callArgs.where.isActive).toBeUndefined();
  });

  test('200 — pagination tính đúng totalPages', async () => {
    DiscountCode.findAndCountAll.mockResolvedValue({ count: 27, rows: [] });

    const res = await adminRequest.get('/api/admin/discount-codes?page=2&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data.pagination.currentPage).toBe(2);
    expect(res.body.data.pagination.totalPages).toBe(3);
  });
});

// ============================================================
// Admin CRUD — GET /api/admin/discount-codes/:id
// ============================================================

describe('GET /api/admin/discount-codes/:id', () => {
  beforeEach(() => {
    DiscountCode.findByPk.mockReset();
  });

  test('200 — trả về discount code khi tìm thấy', async () => {
    DiscountCode.findByPk.mockResolvedValue(makeCode({ id: 5, code: 'XMAS20' }));

    const res = await adminRequest.get('/api/admin/discount-codes/5');
    expect(res.status).toBe(200);
    expect(res.body.data.discountCode.code).toBe('XMAS20');
  });

  test('404 khi không tìm thấy', async () => {
    DiscountCode.findByPk.mockResolvedValue(null);

    const res = await adminRequest.get('/api/admin/discount-codes/999');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/không tìm thấy/i);
  });
});

// ============================================================
// Admin CRUD — POST /api/admin/discount-codes
// ============================================================

describe('POST /api/admin/discount-codes', () => {
  beforeEach(() => {
    DiscountCode.findOne.mockReset();
    DiscountCode.create.mockReset();
  });

  test('201 — tạo mã mới thành công', async () => {
    DiscountCode.findOne.mockResolvedValue(null); // không trùng
    const created = makeCode({ id: 10, code: 'NEW10' });
    DiscountCode.create.mockResolvedValue(created);

    const res = await adminRequest.post('/api/admin/discount-codes').send({
      code: 'NEW10',
      type: 'percent',
      value: 10,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.discountCode.code).toBe('NEW10');
    expect(res.body.message).toMatch(/thành công/i);
  });

  test('400 khi code đã tồn tại', async () => {
    DiscountCode.findOne.mockResolvedValue(makeCode({ code: 'SAVE10' }));

    const res = await adminRequest.post('/api/admin/discount-codes').send({
      code: 'SAVE10',
      type: 'percent',
      value: 10,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/đã tồn tại/);
  });

  test('201 — isActive mặc định là true khi không truyền', async () => {
    DiscountCode.findOne.mockResolvedValue(null);
    DiscountCode.create.mockResolvedValue(makeCode({ code: 'DEF', isActive: true }));

    await adminRequest
      .post('/api/admin/discount-codes')
      .send({ code: 'DEF', type: 'fixed', value: 50000 });

    expect(DiscountCode.create).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });

  test('201 — minOrderAmount mặc định 0 khi không truyền', async () => {
    DiscountCode.findOne.mockResolvedValue(null);
    DiscountCode.create.mockResolvedValue(makeCode({ code: 'MIN0' }));

    await adminRequest
      .post('/api/admin/discount-codes')
      .send({ code: 'MIN0', type: 'fixed', value: 10000 });

    expect(DiscountCode.create).toHaveBeenCalledWith(
      expect.objectContaining({ minOrderAmount: 0 }),
    );
  });

  test('201 — isActive=false được set khi truyền tường minh (line 101 true branch)', async () => {
    // isActive !== undefined → true branch → dùng giá trị được truyền (false)
    DiscountCode.findOne.mockResolvedValue(null);
    DiscountCode.create.mockResolvedValue(makeCode({ code: 'INACTIVE', isActive: false }));

    await adminRequest.post('/api/admin/discount-codes').send({
      code: 'INACTIVE',
      type: 'fixed',
      value: 10000,
      isActive: false,
    });

    expect(DiscountCode.create).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
  });

  test('201 — minOrderAmount được dùng khi được truyền (line 96 truthy branch)', async () => {
    // minOrderAmount || 0: khi minOrderAmount được truyền → truthy branch
    DiscountCode.findOne.mockResolvedValue(null);
    DiscountCode.create.mockResolvedValue(makeCode({ code: 'MINAMT' }));

    await adminRequest.post('/api/admin/discount-codes').send({
      code: 'MINAMT',
      type: 'fixed',
      value: 5000,
      minOrderAmount: 50000,
    });

    expect(DiscountCode.create).toHaveBeenCalledWith(
      expect.objectContaining({ minOrderAmount: 50000 }),
    );
  });
});

// ============================================================
// Admin CRUD — PUT /api/admin/discount-codes/:id
// ============================================================

describe('PUT /api/admin/discount-codes/:id', () => {
  beforeEach(() => {
    DiscountCode.findByPk.mockReset();
    DiscountCode.findOne.mockReset();
  });

  test('200 — cập nhật thành công', async () => {
    const existing = {
      ...makeCode({ id: 3, code: 'OLD10' }),
      update: jest.fn().mockResolvedValue(),
    };
    DiscountCode.findByPk.mockResolvedValue(existing);

    const res = await adminRequest.put('/api/admin/discount-codes/3').send({ value: 20 });

    expect(res.status).toBe(200);
    expect(existing.update).toHaveBeenCalled();
    expect(res.body.message).toMatch(/thành công/i);
  });

  test('404 khi không tìm thấy', async () => {
    DiscountCode.findByPk.mockResolvedValue(null);

    const res = await adminRequest.put('/api/admin/discount-codes/999').send({ value: 20 });
    expect(res.status).toBe(404);
  });

  test('400 khi đổi code sang code đã tồn tại', async () => {
    const existing = { ...makeCode({ id: 4, code: 'CURRENT' }), update: jest.fn() };
    DiscountCode.findByPk.mockResolvedValue(existing);
    DiscountCode.findOne.mockResolvedValue(makeCode({ code: 'TAKEN' }));

    const res = await adminRequest.put('/api/admin/discount-codes/4').send({ code: 'TAKEN' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/đã tồn tại/);
  });

  test('200 — đổi code sang code giống code hiện tại → không check duplicate', async () => {
    const existing = {
      ...makeCode({ id: 5, code: 'SAME' }),
      update: jest.fn().mockResolvedValue(),
    };
    DiscountCode.findByPk.mockResolvedValue(existing);

    const res = await adminRequest
      .put('/api/admin/discount-codes/5')
      .send({ code: 'SAME', value: 15 });

    expect(res.status).toBe(200);
    expect(DiscountCode.findOne).not.toHaveBeenCalled();
  });
});

// ============================================================
// Admin CRUD — PUT /api/admin/discount-codes/:id — branch tests bổ sung
// ============================================================

describe('PUT /api/admin/discount-codes/:id — branch coverage bổ sung', () => {
  beforeEach(() => {
    DiscountCode.findByPk.mockReset();
    DiscountCode.findOne.mockReset();
  });

  test('200 — đổi code mới không trùng → findOne trả null, tiếp tục update (line 140 false branch)', async () => {
    // Covers: if (code && code !== discountCode.code) → true
    // then:   if (existingCode)                       → false (line 140 false branch)
    const existing = {
      ...makeCode({ id: 20, code: 'OLD_CODE' }),
      update: jest.fn().mockResolvedValue(),
    };
    DiscountCode.findByPk.mockResolvedValue(existing);
    DiscountCode.findOne.mockResolvedValue(null); // không trùng code mới

    const res = await adminRequest.put('/api/admin/discount-codes/20').send({
      code: 'NEW_UNIQUE_CODE',
    });

    expect(res.status).toBe(200);
    expect(DiscountCode.findOne).toHaveBeenCalledWith({ where: { code: 'NEW_UNIQUE_CODE' } });
    expect(existing.update).toHaveBeenCalled();
  });

  test('200 — value=undefined → dùng discountCode.value hiện tại (line 151 false branch)', async () => {
    // value không được truyền trong body → undefined → `value !== undefined` false
    // → discountCode.value được giữ nguyên
    const existing = {
      ...makeCode({ id: 21, code: 'KEEP_VAL', value: '25.00' }),
      update: jest.fn().mockResolvedValue(),
    };
    DiscountCode.findByPk.mockResolvedValue(existing);

    const res = await adminRequest.put('/api/admin/discount-codes/21').send({
      type: 'percent', // chỉ update type, không update value
    });

    expect(res.status).toBe(200);
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ value: '25.00' }), // dùng value cũ
    );
  });

  test('200 — minOrderAmount=undefined → dùng discountCode.minOrderAmount hiện tại (line 151 false branch)', async () => {
    const existing = {
      ...makeCode({ id: 22, code: 'KEEP_MIN', minOrderAmount: '200000' }),
      update: jest.fn().mockResolvedValue(),
    };
    DiscountCode.findByPk.mockResolvedValue(existing);

    const res = await adminRequest.put('/api/admin/discount-codes/22').send({
      description: 'updated description only',
    });

    expect(res.status).toBe(200);
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ minOrderAmount: '200000' }),
    );
  });

  test('200 — maxDiscountAmount=undefined → dùng maxDiscountAmount hiện tại (line 152 false branch)', async () => {
    const existing = {
      ...makeCode({ id: 23, code: 'KEEP_MAX', maxDiscountAmount: '100000' }),
      update: jest.fn().mockResolvedValue(),
    };
    DiscountCode.findByPk.mockResolvedValue(existing);

    const res = await adminRequest.put('/api/admin/discount-codes/23').send({
      value: 15,
    });

    expect(res.status).toBe(200);
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ maxDiscountAmount: '100000' }),
    );
  });

  test('200 — usageLimit=undefined → dùng usageLimit hiện tại (line 155 false branch)', async () => {
    const existing = {
      ...makeCode({ id: 24, code: 'KEEP_LIMIT', usageLimit: 50 }),
      update: jest.fn().mockResolvedValue(),
    };
    DiscountCode.findByPk.mockResolvedValue(existing);

    const res = await adminRequest.put('/api/admin/discount-codes/24').send({
      description: 'keep usage limit',
    });

    expect(res.status).toBe(200);
    expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({ usageLimit: 50 }));
  });

  test('200 — minOrderAmount được cung cấp → dùng giá trị mới (line 151 true branch)', async () => {
    // minOrderAmount !== undefined → true → dùng giá trị mới được truyền vào
    const existing = {
      ...makeCode({ id: 25, code: 'UPD_MIN', minOrderAmount: '100000' }),
      update: jest.fn().mockResolvedValue(),
    };
    DiscountCode.findByPk.mockResolvedValue(existing);

    const res = await adminRequest.put('/api/admin/discount-codes/25').send({
      minOrderAmount: 200000,
    });

    expect(res.status).toBe(200);
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ minOrderAmount: 200000 }),
    );
  });

  test('200 — maxDiscountAmount được cung cấp → dùng giá trị mới (line 152 true branch)', async () => {
    // maxDiscountAmount !== undefined → true → dùng giá trị mới
    const existing = {
      ...makeCode({ id: 26, code: 'UPD_MAX', maxDiscountAmount: null }),
      update: jest.fn().mockResolvedValue(),
    };
    DiscountCode.findByPk.mockResolvedValue(existing);

    const res = await adminRequest.put('/api/admin/discount-codes/26').send({
      maxDiscountAmount: 50000,
    });

    expect(res.status).toBe(200);
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ maxDiscountAmount: 50000 }),
    );
  });

  test('200 — usageLimit được cung cấp → dùng giá trị mới (line 155 true branch)', async () => {
    // usageLimit !== undefined → true → dùng giá trị mới
    const existing = {
      ...makeCode({ id: 27, code: 'UPD_LIMIT', usageLimit: null }),
      update: jest.fn().mockResolvedValue(),
    };
    DiscountCode.findByPk.mockResolvedValue(existing);

    const res = await adminRequest.put('/api/admin/discount-codes/27').send({
      usageLimit: 100,
    });

    expect(res.status).toBe(200);
    expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({ usageLimit: 100 }));
  });
});

// ============================================================
// Admin CRUD — DELETE /api/admin/discount-codes/:id
// ============================================================

describe('DELETE /api/admin/discount-codes/:id', () => {
  beforeEach(() => {
    DiscountCode.findByPk.mockReset();
  });

  test('200 — xóa thành công', async () => {
    const existing = {
      ...makeCode({ id: 7, code: 'DEL10' }),
      destroy: jest.fn().mockResolvedValue(),
    };
    DiscountCode.findByPk.mockResolvedValue(existing);

    const res = await adminRequest.delete('/api/admin/discount-codes/7');

    expect(res.status).toBe(200);
    expect(existing.destroy).toHaveBeenCalled();
    expect(res.body.message).toMatch(/thành công/i);
  });

  test('404 khi không tìm thấy', async () => {
    DiscountCode.findByPk.mockResolvedValue(null);

    const res = await adminRequest.delete('/api/admin/discount-codes/999');
    expect(res.status).toBe(404);
  });
});
