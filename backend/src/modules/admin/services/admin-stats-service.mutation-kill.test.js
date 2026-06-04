/**
 * Mutation-kill tests cho admin-stats-service.js (baseline 24.15%).
 *
 * Service xây dựng nhiều query Sequelize aggregate (where/group/order/attributes).
 * Mock repository để assert CHÍNH XÁC arg từng call (status/paymentStatus/createdAt
 * range, group, raw, limit) + dùng fake timers cố định "today" để kiểm tra date math
 * (startOfMonth / startOfLastMonth / endOfLastMonth) và công thức growth/aov.
 * Sequelize.fn giữ thật để kiểm tra dateFormat qua .args.
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
  return {
    getOp: () => Op,
    getSequelizeFns: () => Sequelize,
    getModels: () => ({ Product: { __m: 'Product' }, ProductImage: { __m: 'ProductImage' } }),
    countUsers: jest.fn(),
    countProducts: jest.fn(),
    countOrders: jest.fn(),
    sumOrderTotal: jest.fn(),
    aggregateOrderItems: jest.fn(),
    aggregateOrders: jest.fn(),
    aggregateUsers: jest.fn(),
  };
});

const { Op, Sequelize } = require('sequelize');
const logger = require('@utils/logger');
const repo = require('@modules/admin/repositories/sequelize-admin-repository');
const service = require('@modules/admin/services/admin-stats-service');

const { Product, ProductImage } = repo.getModels();

function invoke(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: undefined,
      payload: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.payload = body;
        resolve({ res: this });
        return this;
      },
    };
    const next = (err) => resolve({ err });
    handler(req, res, next);
  });
}

const PAYMENT_NOT_IN = { [Op.notIn]: ['refunded', 'failed'] };

beforeEach(() => {
  jest.clearAllMocks();
  repo.aggregateOrderItems.mockResolvedValue([]);
  repo.aggregateOrders.mockResolvedValue([]);
  repo.aggregateUsers.mockResolvedValue([]);
});

// ─── getDashboardStats ──────────────────────────────────────────────────────

describe('getDashboardStats', () => {
  // Cố định today = 2026-06-15 → startOfMonth=2026-06-01, lastMonth: 2026-05-01..2026-05-31
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:00:00Z'));
    // Thứ tự call: countUsers[total,monthly,lastMonth], countProducts[total,lowStock],
    // countOrders[total,monthly,lastMonth,delivered,cancelled], sumOrderTotal[total,monthly,lastMonth]
    repo.countUsers.mockResolvedValueOnce(100).mockResolvedValueOnce(10).mockResolvedValueOnce(8);
    repo.countProducts.mockResolvedValueOnce(200).mockResolvedValueOnce(7);
    repo.countOrders
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(3);
    repo.sumOrderTotal
      .mockResolvedValueOnce(1000000)
      .mockResolvedValueOnce(100000)
      .mockResolvedValueOnce(80000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('overview cơ bản + aov = totalRevenue/deliveredOrders', async () => {
    const { res } = await invoke(service.getDashboardStats, { query: {} });
    expect(res.statusCode).toBe(200);
    expect(res.payload.data.overview).toMatchObject({
      totalUsers: 100,
      totalProducts: 200,
      totalOrders: 50,
      totalRevenue: 1000000,
      aov: 25000, // 1000000 / 40
      cancelledOrdersMonth: 3,
      lowStockCount: 7,
    });
  });

  test('growth tính đúng theo tháng trước (25%)', async () => {
    const { res } = await invoke(service.getDashboardStats, { query: {} });
    expect(res.payload.data.growth).toEqual({ users: 25, orders: 25, revenue: 25 });
    expect(res.payload.data.monthly).toEqual({ users: 10, orders: 5, revenue: 100000 });
  });

  test('countUsers(total) where = {role:customer}; lowStock = stockQuantity Op.lte 10', async () => {
    await invoke(service.getDashboardStats, { query: {} });
    expect(repo.countUsers.mock.calls[0][0]).toEqual({ role: 'customer' });
    expect(repo.countProducts.mock.calls[1][0]).toEqual({ stockQuantity: { [Op.lte]: 10 } });
  });

  test('sumOrderTotal(total) where = {status:delivered, paymentStatus notIn refunded/failed}', async () => {
    await invoke(service.getDashboardStats, { query: {} });
    expect(repo.sumOrderTotal.mock.calls[0][0]).toEqual({
      status: 'delivered',
      paymentStatus: PAYMENT_NOT_IN,
    });
  });

  test('monthly where args đầy đủ (orders + revenue) với createdAt gte startOfMonth', async () => {
    await invoke(service.getDashboardStats, { query: {} });
    expect(repo.countOrders.mock.calls[1][0]).toEqual({
      createdAt: { [Op.gte]: new Date(2026, 5, 1) },
    });
    expect(repo.sumOrderTotal.mock.calls[1][0]).toEqual({
      status: 'delivered',
      paymentStatus: PAYMENT_NOT_IN,
      createdAt: { [Op.gte]: new Date(2026, 5, 1) },
    });
  });

  test('lastMonth where args đầy đủ (orders + revenue) với createdAt gte/lte', async () => {
    await invoke(service.getDashboardStats, { query: {} });
    const range = { [Op.gte]: new Date(2026, 4, 1), [Op.lte]: new Date(2026, 5, 0) };
    expect(repo.countOrders.mock.calls[2][0]).toEqual({ createdAt: range });
    expect(repo.sumOrderTotal.mock.calls[2][0]).toEqual({
      status: 'delivered',
      paymentStatus: PAYMENT_NOT_IN,
      createdAt: range,
    });
  });

  test('6 log dashboard có thông điệp đúng', async () => {
    await invoke(service.getDashboardStats, { query: {} });
    expect(logger.info).toHaveBeenCalledWith('[DASHBOARD] Lấy totalUsers:', 100);
    expect(logger.info).toHaveBeenCalledWith('[DASHBOARD] Lấy totalProducts:', 200);
    expect(logger.info).toHaveBeenCalledWith('[DASHBOARD] Lấy totalOrders:', 50);
    expect(logger.info).toHaveBeenCalledWith('[DASHBOARD] Lấy totalRevenue:', 1000000);
    expect(logger.info).toHaveBeenCalledWith('[DASHBOARD] Đang lấy topProducts...');
    expect(logger.info).toHaveBeenCalledWith('[DASHBOARD] Lấy topProducts xong:', 0);
  });

  test('deliveredOrders where status delivered; cancelledOrdersMonth status cancelled', async () => {
    await invoke(service.getDashboardStats, { query: {} });
    expect(repo.countOrders.mock.calls[3][0]).toEqual({
      status: 'delivered',
      paymentStatus: PAYMENT_NOT_IN,
    });
    expect(repo.countOrders.mock.calls[4][0]).toMatchObject({ status: 'cancelled' });
    expect(repo.countOrders.mock.calls[4][0].createdAt[Op.gte]).toEqual(new Date(2026, 5, 1));
  });

  test('date math: monthly gte = startOfMonth (2026-06-01)', async () => {
    await invoke(service.getDashboardStats, { query: {} });
    expect(repo.countUsers.mock.calls[1][0]).toEqual({
      role: 'customer',
      createdAt: { [Op.gte]: new Date(2026, 5, 1) },
    });
  });

  test('date math: lastMonth gte=2026-05-01, lte=2026-05-31 (getMonth()-1 và day 0)', async () => {
    await invoke(service.getDashboardStats, { query: {} });
    const lastMonthArg = repo.countUsers.mock.calls[2][0];
    expect(lastMonthArg.role).toBe('customer'); // kill L51 'customer' → ''
    expect(lastMonthArg.createdAt[Op.gte]).toEqual(new Date(2026, 4, 1));
    expect(lastMonthArg.createdAt[Op.lte]).toEqual(new Date(2026, 5, 0));
  });

  test('aggregateOrderItems: attributes/include/group/order/limit đầy đủ', async () => {
    await invoke(service.getDashboardStats, { query: {} });
    const args = repo.aggregateOrderItems.mock.calls[0][0];
    expect(args.attributes).toEqual([
      'productId',
      [Sequelize.fn('SUM', Sequelize.col('OrderItem.quantity')), 'totalSold'],
      [Sequelize.fn('SUM', Sequelize.col('OrderItem.subtotal')), 'totalRevenue'],
    ]);
    expect(args.include).toEqual([
      {
        model: Product,
        attributes: ['nameVi', 'nameEn', 'basePrice'],
        include: [{ model: ProductImage, as: 'productImages', attributes: ['imageUrl'], limit: 1 }],
      },
    ]);
    expect(args.group).toEqual(['productId', 'Product.id']);
    expect(args.order).toEqual([
      [Sequelize.fn('SUM', Sequelize.col('OrderItem.quantity')), 'DESC'],
    ]);
    expect(args.limit).toBe(5);
  });

  test('aggregateOrders(status counts): attributes COUNT, group [status], raw true', async () => {
    await invoke(service.getDashboardStats, { query: {} });
    const args = repo.aggregateOrders.mock.calls[0][0];
    expect(args.attributes).toEqual([
      'status',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
    ]);
    expect(args.group).toEqual(['status']);
    expect(args.raw).toBe(true);
  });

  test('ordersByStatus: merge counts vào default 5 trạng thái', async () => {
    repo.aggregateOrders.mockReset();
    repo.aggregateOrders.mockResolvedValueOnce([
      { status: 'pending', count: '3' },
      { status: 'delivered', count: '40' },
    ]);
    const { res } = await invoke(service.getDashboardStats, { query: {} });
    expect(res.payload.data.overview.ordersByStatus).toEqual({
      pending: 3,
      processing: 0,
      shipped: 0,
      delivered: 40,
      cancelled: 0,
    });
  });

  test('topProducts map: images/price/name + parse totalSold/totalRevenue', async () => {
    repo.aggregateOrderItems.mockReset();
    repo.aggregateOrderItems.mockResolvedValueOnce([
      {
        Product: {
          toJSON: () => ({ nameVi: 'SP', basePrice: 500, productImages: [{ imageUrl: 'x.jpg' }] }),
        },
        getDataValue: (k) => (k === 'totalSold' ? '12' : '6000.5'),
      },
    ]);
    const { res } = await invoke(service.getDashboardStats, { query: {} });
    expect(res.payload.data.topProducts).toEqual([
      {
        product: {
          nameVi: 'SP',
          basePrice: 500,
          productImages: [{ imageUrl: 'x.jpg' }],
          images: ['x.jpg'],
          price: 500,
          name: 'SP',
        },
        totalSold: 12,
        totalRevenue: 6000.5,
      },
    ]);
  });

  test('topProducts: name fallback nameEn khi không nameVi', async () => {
    repo.aggregateOrderItems.mockReset();
    repo.aggregateOrderItems.mockResolvedValueOnce([
      {
        Product: { toJSON: () => ({ nameEn: 'EN only' }) },
        getDataValue: () => '1',
      },
    ]);
    const { res } = await invoke(service.getDashboardStats, { query: {} });
    expect(res.payload.data.topProducts[0].product.name).toBe('EN only');
  });

  test('topProducts lỗi → fallback [] + logger.error', async () => {
    repo.aggregateOrderItems.mockReset();
    repo.aggregateOrderItems.mockRejectedValueOnce(new Error('agg fail'));
    const { res } = await invoke(service.getDashboardStats, { query: {} });
    expect(res.payload.data.topProducts).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith('[DASHBOARD] LỖI khi lấy topProducts:', 'agg fail');
  });

  test('lastMonth = 0 → growth = 0 (tránh chia 0)', async () => {
    repo.countUsers.mockReset();
    repo.countProducts.mockReset();
    repo.countOrders.mockReset();
    repo.sumOrderTotal.mockReset();
    repo.countUsers.mockResolvedValue(0);
    repo.countProducts.mockResolvedValue(0);
    repo.countOrders.mockResolvedValue(0);
    repo.sumOrderTotal.mockResolvedValue(0);
    const { res } = await invoke(service.getDashboardStats, { query: {} });
    expect(res.payload.data.growth).toEqual({ users: 0, orders: 0, revenue: 0 });
    expect(res.payload.data.overview.aov).toBe(0); // deliveredOrders = 0
  });

  test('logger.info được gọi với thông điệp khởi đầu', async () => {
    await invoke(service.getDashboardStats, { query: {} });
    expect(logger.info).toHaveBeenCalledWith('[CONTROLLER] getDashboardStats started');
  });
});

// ─── getDetailedStats ───────────────────────────────────────────────────────

describe('getDetailedStats', () => {
  test('thiếu startDate hoặc endDate → 400 đúng message', async () => {
    const { err } = await invoke(service.getDetailedStats, { query: { startDate: '2026-01-01' } });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Vui lòng cung cấp ngày bắt đầu và ngày kết thúc');
  });

  const cases = [
    ['hour', '%Y-%m-%d %H:00:00'],
    ['day', '%Y-%m-%d'],
    ['week', '%Y-%u'],
    ['month', '%Y-%m'],
    ['unknown', '%Y-%m-%d'], // default
  ];
  test.each(cases)('groupBy=%s → dateFormat %s', async (groupBy, fmt) => {
    await invoke(service.getDetailedStats, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31', groupBy },
    });
    const groupFn = repo.aggregateOrders.mock.calls[0][0].group[0];
    expect(groupFn.args[1]).toBe(fmt);
  });

  test('groupBy mặc định day khi không truyền', async () => {
    await invoke(service.getDetailedStats, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    expect(repo.aggregateOrders.mock.calls[0][0].group[0].args[1]).toBe('%Y-%m-%d');
  });

  test('aggregateOrders: attributes/where/group/order đầy đủ (day format)', async () => {
    await invoke(service.getDetailedStats, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31', groupBy: 'day' },
    });
    const args = repo.aggregateOrders.mock.calls[0][0];
    const periodFn = Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d');
    expect(args.attributes).toEqual([
      [periodFn, 'period'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'orderCount'],
      [Sequelize.fn('SUM', Sequelize.col('total')), 'revenue'],
    ]);
    expect(args.group).toEqual([periodFn]);
    expect(args.order).toEqual([[periodFn, 'ASC']]);
    const [start, end] = args.where.createdAt[Op.between];
    expect(start).toEqual(new Date('2026-01-01'));
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
    expect(args.where.status).toEqual({ [Op.notIn]: ['cancelled'] });
    expect(args.where.paymentStatus).toEqual({ [Op.notIn]: ['refunded', 'failed'] });
  });

  test('aggregateUsers: attributes/where/group/order đầy đủ (day format)', async () => {
    await invoke(service.getDetailedStats, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31', groupBy: 'day' },
    });
    const args = repo.aggregateUsers.mock.calls[0][0];
    const periodFn = Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), '%Y-%m-%d');
    expect(args.attributes).toEqual([
      [periodFn, 'period'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'newUsers'],
    ]);
    expect(args.group).toEqual([periodFn]);
    expect(args.order).toEqual([[periodFn, 'ASC']]);
    expect(args.where.role).toBe('customer');
    expect(args.where.createdAt[Op.between][0]).toEqual(new Date('2026-01-01'));
  });

  test('response map orders/users từ getDataValue', async () => {
    repo.aggregateOrders.mockReset();
    repo.aggregateOrders.mockResolvedValueOnce([
      {
        getDataValue: (k) => ({ period: '2026-01-01', orderCount: '5', revenue: '999.5' })[k],
      },
    ]);
    repo.aggregateUsers.mockReset();
    repo.aggregateUsers.mockResolvedValueOnce([
      { getDataValue: (k) => ({ period: '2026-01-01', newUsers: '3' })[k] },
    ]);
    const { res } = await invoke(service.getDetailedStats, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    expect(res.payload.data.orders).toEqual([
      { period: '2026-01-01', orderCount: 5, revenue: 999.5 },
    ]);
    expect(res.payload.data.users).toEqual([{ period: '2026-01-01', newUsers: 3 }]);
  });

  test('revenue null → parseFloat(... || 0) = 0', async () => {
    repo.aggregateOrders.mockReset();
    repo.aggregateOrders.mockResolvedValueOnce([
      { getDataValue: (k) => ({ period: 'p', orderCount: '2', revenue: null })[k] },
    ]);
    const { res } = await invoke(service.getDetailedStats, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    expect(res.payload.data.orders[0].revenue).toBe(0);
  });
});
