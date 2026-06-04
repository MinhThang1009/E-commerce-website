/**
 * Mutation-kill tests cho admin-analytics-service.js (baseline 47.96%).
 *
 * 8 hàm analytics: order-status, top-products, revenue-by-category (raw SQL),
 * user-growth, payment-methods, low-stock, export-report, chatbot-stats.
 * Mock repository → assert CHÍNH XÁC arg (attributes Sequelize.fn, where, group,
 * order, raw, limit) + transform/CSV/threshold/fallback. Sequelize.fn giữ thật.
 */

process.env.NODE_ENV = 'test';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@modules/admin/repositories/sequelize-admin-repository', () => {
  const { Op, Sequelize } = require('sequelize');
  const query = jest.fn();
  return {
    getSequelize: () => ({ query }),
    getOp: () => Op,
    getSequelizeFns: () => Sequelize,
    getModels: () => ({
      Product: { __m: 'Product' },
      ProductImage: { __m: 'ProductImage' },
      ProductVariant: { __m: 'ProductVariant' },
      User: { __m: 'User' },
      Order: { __m: 'Order' },
      ChatMessage: { __m: 'ChatMessage' },
    }),
    aggregateOrders: jest.fn(),
    aggregateOrderItems: jest.fn(),
    aggregateUsers: jest.fn(),
    findProductsList: jest.fn(),
    countChatMessages: jest.fn(),
    aggregateChatMessagesAdv: jest.fn(),
    findOneChatMessage: jest.fn(),
    __query: query,
  };
});

const { Op, Sequelize } = require('sequelize');
const repo = require('@modules/admin/repositories/sequelize-admin-repository');
const service = require('@modules/admin/services/admin-analytics-service');

const { Product, ProductImage, ProductVariant, User, Order } = repo.getModels();
const query = repo.__query;

function invoke(handler, req) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: undefined,
      payload: undefined,
      body: undefined,
      headers,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(k, v) {
        headers[k.toLowerCase()] = v;
      },
      json(b) {
        this.payload = b;
        resolve({ res: this });
        return this;
      },
      send(b) {
        this.body = b;
        resolve({ res: this });
        return this;
      },
    };
    const next = (err) => resolve({ err });
    handler(req, res, next);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  repo.aggregateOrders.mockResolvedValue([]);
  repo.aggregateOrderItems.mockResolvedValue([]);
  repo.aggregateUsers.mockResolvedValue([]);
  repo.findProductsList.mockResolvedValue([]);
  repo.countChatMessages.mockResolvedValue(0);
  repo.aggregateChatMessagesAdv.mockResolvedValue([]);
  repo.findOneChatMessage.mockResolvedValue(null);
  query.mockResolvedValue([[]]);
});

// ─── getOrderStatusAnalytics ────────────────────────────────────────────────

describe('getOrderStatusAnalytics', () => {
  test('aggregateOrders attributes/group/raw + where rỗng khi không startDate', async () => {
    await invoke(service.getOrderStatusAnalytics, { query: {} });
    const args = repo.aggregateOrders.mock.calls[0][0];
    expect(args.attributes).toEqual([
      'status',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
    ]);
    expect(args.group).toEqual(['status']);
    expect(args.raw).toBe(true);
    expect(args.where).toEqual({});
  });

  test('startDate → where.createdAt Op.gte', async () => {
    await invoke(service.getOrderStatusAnalytics, { query: { startDate: '2026-01-01' } });
    expect(repo.aggregateOrders.mock.calls[0][0].where.createdAt[Op.gte]).toEqual(
      new Date('2026-01-01'),
    );
  });

  test('map status/count + label tiếng Việt; unknown → fallback row.status', async () => {
    repo.aggregateOrders.mockResolvedValueOnce([
      { status: 'pending', count: '4' },
      { status: 'delivered', count: '9' },
      { status: 'weird', count: '1' },
    ]);
    const { res } = await invoke(service.getOrderStatusAnalytics, { query: {} });
    expect(res.payload.data).toEqual([
      { status: 'pending', count: 4, label: 'Chờ xử lý' },
      { status: 'delivered', count: 9, label: 'Đã giao' },
      { status: 'weird', count: 1, label: 'weird' },
    ]);
  });

  test('label đủ 5 trạng thái đúng tiếng Việt', async () => {
    repo.aggregateOrders.mockResolvedValueOnce([
      { status: 'processing', count: '1' },
      { status: 'shipped', count: '1' },
      { status: 'cancelled', count: '1' },
    ]);
    const { res } = await invoke(service.getOrderStatusAnalytics, { query: {} });
    expect(res.payload.data.map((d) => d.label)).toEqual(['Đang xử lý', 'Đang giao', 'Đã hủy']);
  });
});

// ─── getTopProductsAnalytics ────────────────────────────────────────────────

describe('getTopProductsAnalytics', () => {
  test('default metric revenue → order theo literal revenue DESC; limit mặc định 5', async () => {
    await invoke(service.getTopProductsAnalytics, { query: {} });
    const args = repo.aggregateOrderItems.mock.calls[0][0];
    expect(args.order).toEqual([[Sequelize.literal('revenue'), 'DESC']]);
    expect(args.limit).toBe(5);
    expect(args.subQuery).toBe(false);
    expect(args.group).toEqual(['productId', 'Product.id']);
  });

  test('metric khác revenue → order theo literal soldCount', async () => {
    await invoke(service.getTopProductsAnalytics, { query: { metric: 'sold' } });
    expect(repo.aggregateOrderItems.mock.calls[0][0].order).toEqual([
      [Sequelize.literal('soldCount'), 'DESC'],
    ]);
  });

  test('limit cap 20; limit hợp lệ giữ nguyên', async () => {
    await invoke(service.getTopProductsAnalytics, { query: { limit: '50' } });
    expect(repo.aggregateOrderItems.mock.calls[0][0].limit).toBe(20);
    jest.clearAllMocks();
    repo.aggregateOrderItems.mockResolvedValue([]);
    await invoke(service.getTopProductsAnalytics, { query: { limit: '8' } });
    expect(repo.aggregateOrderItems.mock.calls[0][0].limit).toBe(8);
  });

  test('attributes + include (Order paid, Product, ProductImage) đầy đủ', async () => {
    await invoke(service.getTopProductsAnalytics, { query: {} });
    const args = repo.aggregateOrderItems.mock.calls[0][0];
    expect(args.attributes).toEqual([
      'productId',
      [Sequelize.fn('SUM', Sequelize.col('OrderItem.subtotal')), 'revenue'],
      [Sequelize.fn('SUM', Sequelize.col('OrderItem.quantity')), 'soldCount'],
    ]);
    expect(args.include).toEqual([
      { model: Order, attributes: [], where: { paymentStatus: 'paid' } },
      {
        model: Product,
        attributes: ['id', 'nameVi', 'nameEn'],
        include: [{ model: ProductImage, as: 'productImages', attributes: ['imageUrl'], limit: 1 }],
      },
    ]);
  });

  test('map name/thumbnail/revenue/soldCount + fallback', async () => {
    repo.aggregateOrderItems.mockResolvedValueOnce([
      {
        productId: 7,
        Product: { toJSON: () => ({ nameVi: 'SP', productImages: [{ imageUrl: 't.jpg' }] }) },
        getDataValue: (k) => (k === 'revenue' ? '500.5' : '3'),
      },
      {
        productId: 8,
        Product: { toJSON: () => ({ nameEn: 'EN' }) },
        getDataValue: () => null,
      },
    ]);
    const { res } = await invoke(service.getTopProductsAnalytics, { query: {} });
    expect(res.payload.data).toEqual([
      { productId: 7, name: 'SP', thumbnail: 't.jpg', revenue: 500.5, soldCount: 3 },
      { productId: 8, name: 'EN', thumbnail: null, revenue: 0, soldCount: 0 },
    ]);
  });
});

// ─── getRevenueByCategoryAnalytics (raw SQL) ────────────────────────────────

describe('getRevenueByCategoryAnalytics', () => {
  test('không date → query KHÔNG có dateFilter, replacements rỗng', async () => {
    await invoke(service.getRevenueByCategoryAnalytics, { query: {} });
    const [sql, opts] = query.mock.calls[0];
    expect(sql).not.toContain('BETWEEN :startDate');
    expect(opts.replacements).toEqual({});
    expect(sql).toContain("o.payment_status = 'paid'");
    // Kill L108 dateFilter='' → garbage: sau 'paid' phải là khoảng trắng rồi GROUP BY (không chèn text lạ)
    expect(sql).toMatch(/paid'\s+GROUP BY/);
  });

  test('chỉ startDate (thiếu endDate) → KHÔNG dateFilter (kill && → ||)', async () => {
    await invoke(service.getRevenueByCategoryAnalytics, { query: { startDate: '2026-01-01' } });
    const [sql, opts] = query.mock.calls[0];
    expect(sql).not.toContain('BETWEEN :startDate');
    expect(opts.replacements).toEqual({});
  });

  test('status success trong response', async () => {
    const { res } = await invoke(service.getRevenueByCategoryAnalytics, { query: {} });
    expect(res.payload.status).toBe('success');
  });

  test('có date → dateFilter + replacements (endDate cộng 23:59:59)', async () => {
    await invoke(service.getRevenueByCategoryAnalytics, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    const [sql, opts] = query.mock.calls[0];
    expect(sql).toContain('AND o.created_at BETWEEN :startDate AND :endDate');
    expect(opts.replacements).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-31 23:59:59',
    });
  });

  test('map categoryId/categoryName/revenue/orderItemCount', async () => {
    query.mockResolvedValueOnce([
      [{ categoryId: 1, categoryName: 'Điện thoại', revenue: '999.5', orderItemCount: '7' }],
    ]);
    const { res } = await invoke(service.getRevenueByCategoryAnalytics, { query: {} });
    expect(res.payload.data).toEqual([
      { categoryId: 1, categoryName: 'Điện thoại', revenue: 999.5, orderItemCount: 7 },
    ]);
  });
});

// ─── getUserGrowthAnalytics ─────────────────────────────────────────────────

describe('getUserGrowthAnalytics', () => {
  test('thiếu date → 400 đúng message', async () => {
    const { err } = await invoke(service.getUserGrowthAnalytics, {
      query: { startDate: '2026-01-01' },
    });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Vui lòng cung cấp startDate và endDate');
  });

  test.each([
    ['week', '%Y-%u'],
    ['month', '%Y-%m'],
    ['day', '%Y-%m-%d'],
    ['xxx', '%Y-%m-%d'],
  ])('groupBy=%s → dateFormat %s', async (groupBy, fmt) => {
    await invoke(service.getUserGrowthAnalytics, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31', groupBy },
    });
    expect(repo.aggregateUsers.mock.calls[0][0].group[0].args[1]).toBe(fmt);
  });

  test('aggregateUsers attributes/where/group/order/raw đầy đủ', async () => {
    await invoke(service.getUserGrowthAnalytics, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31', groupBy: 'day' },
    });
    const args = repo.aggregateUsers.mock.calls[0][0];
    const periodFn = Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d');
    expect(args.attributes).toEqual([
      [periodFn, 'date'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'newUsers'],
    ]);
    expect(args.group).toEqual([periodFn]);
    expect(args.order).toEqual([[periodFn, 'ASC']]);
    expect(args.raw).toBe(true);
    expect(args.where.role).toBe('customer');
    const [start, end] = args.where.createdAt[Op.between];
    expect(start).toEqual(new Date('2026-01-01'));
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
  });

  test('map date/newUsers parseInt', async () => {
    repo.aggregateUsers.mockResolvedValueOnce([{ date: '2026-01-01', newUsers: '12' }]);
    const { res } = await invoke(service.getUserGrowthAnalytics, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    expect(res.payload.data).toEqual([{ date: '2026-01-01', newUsers: 12 }]);
  });
});

// ─── getPaymentMethodsAnalytics ─────────────────────────────────────────────

describe('getPaymentMethodsAnalytics', () => {
  test('aggregateOrders attributes/where/group/raw đầy đủ', async () => {
    await invoke(service.getPaymentMethodsAnalytics, { query: {} });
    const args = repo.aggregateOrders.mock.calls[0][0];
    expect(args.attributes).toEqual([
      'paymentMethod',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      [Sequelize.fn('SUM', Sequelize.col('total')), 'revenue'],
    ]);
    expect(args.where).toEqual({ paymentStatus: 'paid' });
    expect(args.group).toEqual(['payment_method']);
    expect(args.raw).toBe(true);
  });

  test('map method fallback unknown + parse', async () => {
    repo.aggregateOrders.mockResolvedValueOnce([
      { paymentMethod: 'momo', count: '5', revenue: '100.5' },
      { paymentMethod: null, count: '2', revenue: null },
    ]);
    const { res } = await invoke(service.getPaymentMethodsAnalytics, { query: {} });
    expect(res.payload.data).toEqual([
      { method: 'momo', count: 5, revenue: 100.5 },
      { method: 'unknown', count: 2, revenue: 0 },
    ]);
  });
});

// ─── getLowStockAnalytics ───────────────────────────────────────────────────

describe('getLowStockAnalytics', () => {
  test('threshold mặc định 10 khi không truyền; parse khi có', async () => {
    repo.findProductsList.mockResolvedValue([
      { toJSON: () => ({ id: 1, nameVi: 'A', stockQuantity: 15 }) },
      { toJSON: () => ({ id: 2, nameVi: 'B', stockQuantity: 5 }) },
    ]);
    let res = (await invoke(service.getLowStockAnalytics, { query: {} })).res;
    expect(res.payload.data.map((p) => p.id)).toEqual([2]); // chỉ stock<=10

    jest.clearAllMocks();
    repo.findProductsList.mockResolvedValue([
      { toJSON: () => ({ id: 1, nameVi: 'A', stockQuantity: 15 }) },
      { toJSON: () => ({ id: 2, nameVi: 'B', stockQuantity: 5 }) },
    ]);
    res = (await invoke(service.getLowStockAnalytics, { query: { threshold: '20' } })).res;
    expect(res.payload.data.map((p) => p.id)).toEqual([2, 1]); // <=20, sort asc
  });

  test('threshold không hợp lệ (NaN) → fallback 10', async () => {
    repo.findProductsList.mockResolvedValue([
      { toJSON: () => ({ id: 1, nameVi: 'A', stockQuantity: 12 }) },
    ]);
    const { res } = await invoke(service.getLowStockAnalytics, { query: { threshold: 'abc' } });
    expect(res.payload.data).toEqual([]); // 12 > 10
  });

  test('findProductsList include ProductImage + ProductVariant', async () => {
    await invoke(service.getLowStockAnalytics, { query: {} });
    const args = repo.findProductsList.mock.calls[0][0];
    expect(args.attributes).toEqual(['id', 'nameVi', 'nameEn', 'stockQuantity', 'slug']);
    expect(args.include).toEqual([
      { model: ProductImage, as: 'productImages', attributes: ['imageUrl'], limit: 1 },
      { model: ProductVariant, as: 'variants', attributes: ['sku', 'stockQuantity'] },
    ]);
  });

  test('stock từ variants (tổng) khi có variant; sku/thumbnail/name', async () => {
    repo.findProductsList.mockResolvedValue([
      {
        toJSON: () => ({
          id: 5,
          nameVi: 'SP',
          stockQuantity: 100,
          variants: [
            { sku: 'V1', stockQuantity: 2 },
            { sku: 'V2', stockQuantity: 3 },
          ],
          productImages: [{ imageUrl: 'i.jpg' }],
        }),
      },
    ]);
    const { res } = await invoke(service.getLowStockAnalytics, { query: {} });
    expect(res.payload.data[0]).toEqual({
      id: 5,
      name: 'SP',
      sku: 'V1',
      stockQuantity: 5, // 2+3 từ variants, KHÔNG dùng stockQuantity gốc 100
      thumbnail: 'i.jpg',
    });
  });

  test('stock từ product khi KHÔNG có variant', async () => {
    repo.findProductsList.mockResolvedValue([
      { toJSON: () => ({ id: 6, nameVi: 'X', stockQuantity: 4, variants: [] }) },
    ]);
    const { res } = await invoke(service.getLowStockAnalytics, { query: {} });
    expect(res.payload.data[0].stockQuantity).toBe(4);
    expect(res.payload.data[0].sku).toBe('');
    expect(res.payload.data[0].thumbnail).toBeNull();
  });

  test('sắp xếp tăng dần + slice 20', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      toJSON: () => ({ id: i, nameVi: 'P' + i, stockQuantity: 25 - i }),
    }));
    repo.findProductsList.mockResolvedValue(many);
    const { res } = await invoke(service.getLowStockAnalytics, { query: { threshold: '100' } });
    expect(res.payload.data).toHaveLength(20);
    expect(res.payload.data[0].stockQuantity).toBe(1); // nhỏ nhất trước
  });
});

// ─── exportReport ───────────────────────────────────────────────────────────

describe('exportReport', () => {
  test('type không hợp lệ → 400', async () => {
    const { err } = await invoke(service.exportReport, { query: { type: 'xxx' } });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Loại báo cáo không hợp lệ. Dùng "orders" hoặc "products"');
  });

  test('orders (mặc định): aggregateOrders args + CSV header + BOM + row', async () => {
    repo.aggregateOrders.mockResolvedValueOnce([
      {
        toJSON: () => ({
          id: 1,
          number: 'ORD1',
          status: 'delivered',
          paymentStatus: 'paid',
          paymentMethod: 'momo',
          total: 500,
          createdAt: '2026-01-15T08:00:00Z',
          User: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
        }),
      },
    ]);
    const { res } = await invoke(service.exportReport, { query: {} });
    const args = repo.aggregateOrders.mock.calls[0][0];
    expect(args.attributes).toEqual([
      'id',
      'number',
      'status',
      'paymentStatus',
      'paymentMethod',
      'total',
      'createdAt',
    ]);
    expect(args.include).toEqual([{ model: User, attributes: ['firstName', 'lastName', 'email'] }]);
    expect(args.order).toEqual([['createdAt', 'DESC']]);
    expect(args.limit).toBe(5000);
    expect(args.raw).toBe(false);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.body).toContain('Order ID,Order Number,Customer,Email');
    expect(res.body).toContain('1,"ORD1","A B","a@b.com",delivered,paid,momo,500,2026-01-15');
    expect(res.body.startsWith('﻿')).toBe(true); // BOM
  });

  test('orders có date → where between', async () => {
    await invoke(service.exportReport, {
      query: { type: 'orders', startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    const where = repo.aggregateOrders.mock.calls[0][0].where;
    expect(where.createdAt[Op.between][0]).toEqual(new Date('2026-01-01'));
    expect(where.createdAt[Op.between][1].getMilliseconds()).toBe(999);
  });

  test('orders chỉ startDate (thiếu endDate) → where rỗng (kill && → ||)', async () => {
    await invoke(service.exportReport, { query: { type: 'orders', startDate: '2026-01-01' } });
    expect(repo.aggregateOrders.mock.calls[0][0].where).toEqual({});
  });

  test('orders nhiều dòng → nối bằng \\n; filename có ngày đầy đủ', async () => {
    const mk = (id) => ({
      toJSON: () => ({
        id,
        number: 'O' + id,
        status: 'delivered',
        paymentStatus: 'paid',
        paymentMethod: 'cod',
        total: 1,
        createdAt: '2026-01-15T08:00:00Z',
        User: { firstName: 'A', lastName: 'B', email: 'a@b.com' },
      }),
    });
    repo.aggregateOrders.mockResolvedValueOnce([mk(1), mk(2)]);
    const { res } = await invoke(service.exportReport, { query: {} });
    const dataRows = res.body.split('\n').filter((l) => /^\d+,/.test(l));
    expect(dataRows).toHaveLength(2); // kill L306 join('\n') → ''
    // kill L311 split('T') → '' (filename còn năm/ngày đầy đủ)
    expect(res.headers['content-disposition']).toMatch(/orders_\d{4}-\d{2}-\d{2}\.csv/);
  });

  test('orders không có User → customer/email rỗng', async () => {
    repo.aggregateOrders.mockResolvedValueOnce([
      {
        toJSON: () => ({
          id: 1,
          number: 'O1',
          status: 's',
          paymentStatus: 'p',
          paymentMethod: null,
          total: 1,
          createdAt: '2026-01-15T08:00:00Z',
          User: null,
        }),
      },
    ]);
    const { res } = await invoke(service.exportReport, { query: {} });
    expect(res.body).toContain('1,"O1","","",s,p,,1,2026-01-15');
  });

  test('products: findProductsList args + CSV + escape quote trong tên', async () => {
    repo.findProductsList.mockResolvedValueOnce([
      {
        id: 1,
        nameVi: 'Sản "phẩm"',
        sku: 'S1',
        basePrice: 100,
        stockQuantity: 9,
        status: 'active',
      },
    ]);
    const { res } = await invoke(service.exportReport, { query: { type: 'products' } });
    const args = repo.findProductsList.mock.calls[0][0];
    expect(args.attributes).toEqual([
      'id',
      'nameVi',
      'nameEn',
      'sku',
      'basePrice',
      'stockQuantity',
      'status',
    ]);
    expect(args.order).toEqual([['nameVi', 'ASC']]);
    expect(args.limit).toBe(5000);
    expect(args.raw).toBe(true);
    expect(res.body).toContain('Product ID,Name,SKU,Base Price,Stock,Status');
    expect(res.body).toContain('1,"Sản ""phẩm""","S1",100,9,active'); // quote escape ""
    expect(res.body.startsWith('﻿')).toBe(true); // kill L335 BOM
    expect(res.headers['content-disposition']).toMatch(/products_\d{4}-\d{2}-\d{2}\.csv/); // kill L333
  });

  test('products: name fallback nameEn + status fallback active', async () => {
    repo.findProductsList.mockResolvedValueOnce([
      { id: 2, nameEn: 'EN', sku: null, basePrice: 50, stockQuantity: 1, status: null },
    ]);
    const { res } = await invoke(service.exportReport, { query: { type: 'products' } });
    expect(res.body).toContain('2,"EN","",50,1,active');
  });

  test('products nhiều dòng → nối bằng \\n (kill L328 join)', async () => {
    repo.findProductsList.mockResolvedValueOnce([
      { id: 1, nameVi: 'A', sku: 'S1', basePrice: 1, stockQuantity: 1, status: 'active' },
      { id: 2, nameVi: 'B', sku: 'S2', basePrice: 2, stockQuantity: 2, status: 'active' },
    ]);
    const { res } = await invoke(service.exportReport, { query: { type: 'products' } });
    const dataRows = res.body.split('\n').filter((l) => /^\d+,/.test(l));
    expect(dataRows).toHaveLength(2);
  });
});

// ─── getChatbotStats ────────────────────────────────────────────────────────

describe('getChatbotStats', () => {
  test('countChatMessages: sessions distinct session_id + messages; where messageType', async () => {
    repo.countChatMessages
      .mockResolvedValueOnce(4) // totalSessions
      .mockResolvedValueOnce(20) // totalMessages
      .mockResolvedValueOnce(10) // totalAssistant
      .mockResolvedValueOnce(2); // fallback
    const { res } = await invoke(service.getChatbotStats, { query: {} });
    expect(repo.countChatMessages.mock.calls[0][0]).toEqual({
      distinct: true,
      col: 'session_id',
      where: { messageType: 'ai_chatbot' },
    });
    expect(repo.countChatMessages.mock.calls[1][0]).toEqual({
      where: { messageType: 'ai_chatbot' },
    });
    expect(res.payload.data.totalSessions).toBe(4);
    expect(res.payload.data.totalMessages).toBe(20);
    expect(res.payload.data.avgMessagesPerSession).toBe(5); // 20/4
    expect(res.payload.data.fallbackRate).toBe(0.2); // 2/10
  });

  test('có date → where.createdAt between (cuối ngày)', async () => {
    await invoke(service.getChatbotStats, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    const w = repo.countChatMessages.mock.calls[0][0].where;
    expect(w.createdAt[Op.between][0]).toEqual(new Date('2026-01-01'));
    expect(w.createdAt[Op.between][1].getMilliseconds()).toBe(999);
  });

  test('chỉ startDate (thiếu endDate) → KHÔNG set createdAt (kill && → ||)', async () => {
    await invoke(service.getChatbotStats, { query: { startDate: '2026-01-01' } });
    expect(repo.countChatMessages.mock.calls[0][0].where).toEqual({ messageType: 'ai_chatbot' });
  });

  test('count assistant (call 3) + fallback (call 4 với isFallback true)', async () => {
    await invoke(service.getChatbotStats, { query: {} });
    expect(repo.countChatMessages.mock.calls[2][0]).toEqual({
      where: { messageType: 'ai_chatbot', role: 'assistant' },
    });
    expect(repo.countChatMessages.mock.calls[3][0]).toEqual({
      where: { messageType: 'ai_chatbot', role: 'assistant', isFallback: true },
    });
  });

  test('avg & fallbackRate = 0 khi mẫu số 0', async () => {
    repo.countChatMessages.mockResolvedValue(0);
    const { res } = await invoke(service.getChatbotStats, { query: {} });
    expect(res.payload.data.avgMessagesPerSession).toBe(0);
    expect(res.payload.data.fallbackRate).toBe(0);
  });

  test('intentBreakdown từ aggregateChatMessagesAdv (where role user + intent not null)', async () => {
    repo.aggregateChatMessagesAdv.mockResolvedValueOnce([
      { intent: 'product_search', count: '8' },
      { intent: 'greeting', count: '3' },
    ]);
    const { res } = await invoke(service.getChatbotStats, { query: {} });
    const args = repo.aggregateChatMessagesAdv.mock.calls[0][0];
    expect(args.attributes).toEqual([
      'intent',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
    ]);
    expect(args.where).toEqual({
      messageType: 'ai_chatbot',
      role: 'user',
      intent: { [Op.not]: null },
    });
    expect(args.group).toEqual(['intent']);
    expect(args.raw).toBe(true);
    expect(res.payload.data.intentBreakdown).toEqual({ product_search: 8, greeting: 3 });
  });

  test('avgResponseTimeMs từ findOneChatMessage AVG (where role assistant + responseTimeMs not null)', async () => {
    repo.findOneChatMessage.mockResolvedValueOnce({ avgTime: '345.7' });
    const { res } = await invoke(service.getChatbotStats, { query: {} });
    const args = repo.findOneChatMessage.mock.calls[0][0];
    expect(args.attributes).toEqual([
      [Sequelize.fn('AVG', Sequelize.col('response_time_ms')), 'avgTime'],
    ]);
    expect(args.where).toEqual({
      messageType: 'ai_chatbot',
      role: 'assistant',
      responseTimeMs: { [Op.not]: null },
    });
    expect(args.raw).toBe(true);
    expect(res.payload.data.avgResponseTimeMs).toBe(345); // parseInt
  });

  test('avgResponseTimeMs = 0 khi không có record', async () => {
    repo.findOneChatMessage.mockResolvedValueOnce(null);
    const { res } = await invoke(service.getChatbotStats, { query: {} });
    expect(res.payload.data.avgResponseTimeMs).toBe(0);
  });
});
