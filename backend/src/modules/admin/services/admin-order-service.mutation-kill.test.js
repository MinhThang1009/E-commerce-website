/**
 * Mutation-kill tests cho admin-order-service.js (baseline 42.76%).
 *
 * Giết survivor: query building (where/include/order/distinct), defaults,
 * transform đơn hàng (productImages?.map || [], price=basePrice), guard +
 * message của deleteReview/adminCancelOrder, và delegate sang _ordersService.
 *
 * Mock repository module để assert chính xác arg service truyền vào (include
 * shape, where, order). Gọi service trực tiếp (catchAsync) với mock req/res/next.
 */

process.env.NODE_ENV = 'test';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@modules/admin/repositories/sequelize-admin-repository', () => {
  const { Op } = require('sequelize');
  return {
    getOp: () => Op,
    getModels: () => ({
      Product: { __m: 'Product' },
      ProductImage: { __m: 'ProductImage' },
      User: { __m: 'User' },
      OrderItem: { __m: 'OrderItem' },
    }),
    findReviews: jest.fn(),
    findReviewById: jest.fn(),
    findOrders: jest.fn(),
    findOrderById: jest.fn(),
  };
});

const { Op } = require('sequelize');
const logger = require('@utils/logger');
const repo = require('@modules/admin/repositories/sequelize-admin-repository');
const service = require('@modules/admin/services/admin-order-service');

const { Product, ProductImage, User, OrderItem } = repo.getModels();

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

const ordersServiceMock = { updateOrderStatus: jest.fn() };
service.setOrdersService(ordersServiceMock);

beforeEach(() => {
  jest.clearAllMocks();
  repo.findReviews.mockResolvedValue({ count: 0, rows: [] });
  repo.findOrders.mockResolvedValue({ count: 0, rows: [] });
  ordersServiceMock.updateOrderStatus.mockResolvedValue(undefined);
});

// ─── getAllReviews ──────────────────────────────────────────────────────────

describe('getAllReviews', () => {
  test('query rỗng → where {}, include đúng shape, order [[createdAt, DESC]]', async () => {
    await invoke(service.getAllReviews, { query: {}, user: { id: 1, role: 'admin' } });

    const args = repo.findReviews.mock.calls[0][0];
    expect(args.where).toEqual({});
    expect(args.order).toEqual([['createdAt', 'DESC']]);
    expect(args.include).toEqual([
      { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'avatar'] },
      { model: Product, attributes: ['id', 'nameVi', 'nameEn', 'slug'] },
    ]);
  });

  test('productId + rating → where.productId, where.rating ép số (parseInt)', async () => {
    await invoke(service.getAllReviews, {
      query: { productId: '42', rating: '5' },
      user: { id: 1, role: 'admin' },
    });
    const args = repo.findReviews.mock.calls[0][0];
    expect(args.where.productId).toBe('42');
    expect(args.where.rating).toBe(5); // số, không phải '5'
  });

  test('sortBy/sortOrder custom → order áp dụng + toUpperCase', async () => {
    await invoke(service.getAllReviews, {
      query: { sortBy: 'rating', sortOrder: 'asc' },
      user: { id: 1, role: 'admin' },
    });
    expect(repo.findReviews.mock.calls[0][0].order).toEqual([['rating', 'ASC']]);
  });

  test('pagination + limit cap 100', async () => {
    repo.findReviews.mockResolvedValueOnce({ count: 30, rows: [{ id: 1 }] });
    const { res } = await invoke(service.getAllReviews, {
      query: { page: '2', limit: '500' },
      user: { id: 1, role: 'admin' },
    });
    const args = repo.findReviews.mock.calls[0][0];
    expect(args.limit).toBe(100);
    expect(args.offset).toBe(100);
    expect(res.payload.data.pagination).toEqual({
      currentPage: 2,
      totalPages: 1,
      totalItems: 30,
      itemsPerPage: 100,
    });
    expect(res.payload.data.reviews).toEqual([{ id: 1 }]);
  });
});

// ─── deleteReview ───────────────────────────────────────────────────────────

describe('deleteReview', () => {
  test('không tìm thấy → 404 đúng message', async () => {
    repo.findReviewById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.deleteReview, {
      params: { id: '9' },
      user: { id: 1, role: 'admin' },
    });
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Không tìm thấy đánh giá');
  });

  test('tìm thấy → destroy + 200 message "Xóa đánh giá thành công"', async () => {
    const review = { destroy: jest.fn().mockResolvedValue(undefined) };
    repo.findReviewById.mockResolvedValueOnce(review);
    const { res } = await invoke(service.deleteReview, {
      params: { id: '9' },
      user: { id: 1, role: 'admin' },
    });
    expect(review.destroy).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ status: 'success', message: 'Xóa đánh giá thành công' });
  });
});

// ─── getAllOrders ───────────────────────────────────────────────────────────

describe('getAllOrders — where + include + transform', () => {
  test('query rỗng → where {}, distinct true, order, include deep shape đúng', async () => {
    await invoke(service.getAllOrders, { query: {}, user: { id: 1, role: 'admin' } });

    const args = repo.findOrders.mock.calls[0][0];
    expect(args.where).toEqual({});
    expect(args.distinct).toBe(true);
    expect(args.order).toEqual([['createdAt', 'DESC']]);
    expect(args.include).toEqual([
      { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
      {
        model: OrderItem,
        as: 'items',
        include: [
          {
            model: Product,
            attributes: ['id', 'nameVi', 'nameEn', 'basePrice'],
            include: [
              {
                model: ProductImage,
                as: 'productImages',
                attributes: ['imageUrl'],
                limit: 1,
              },
            ],
          },
        ],
      },
    ]);
  });

  test('status filter → where.status', async () => {
    await invoke(service.getAllOrders, {
      query: { status: 'pending' },
      user: { id: 1, role: 'admin' },
    });
    expect(repo.findOrders.mock.calls[0][0].where.status).toBe('pending');
  });

  test('limit=500 → cap 100, offset=(page-1)*limit, totalPages=ceil, status success', async () => {
    repo.findOrders.mockResolvedValueOnce({ count: 30, rows: [] });
    const { res } = await invoke(service.getAllOrders, {
      query: { page: '3', limit: '500' },
      user: { id: 1, role: 'admin' },
    });
    const args = repo.findOrders.mock.calls[0][0];
    // Kill L103 Math.min→max + ||→&& ; L105 (page-1)*limit ( *→/ , -→+ )
    expect(args.limit).toBe(100);
    expect(args.offset).toBe(200);
    // Kill L181 status 'success' → '' ; L186 count/limit → count*limit
    expect(res.payload.status).toBe('success');
    expect(res.payload.data.pagination.totalPages).toBe(1);
    expect(res.payload.data.pagination.totalItems).toBe(30);
  });

  test('không truyền limit → mặc định 20 (kill ||→&& khi NaN)', async () => {
    await invoke(service.getAllOrders, { query: {}, user: { id: 1, role: 'admin' } });
    expect(repo.findOrders.mock.calls[0][0].limit).toBe(20);
  });

  test('limit=50 (<100) → giữ 50 (kill Math.min→max và ||→&&)', async () => {
    await invoke(service.getAllOrders, {
      query: { limit: '50' },
      user: { id: 1, role: 'admin' },
    });
    expect(repo.findOrders.mock.calls[0][0].limit).toBe(50);
  });

  test('startDate+endDate → where.createdAt Op.between với endDate cuối ngày 23:59:59.999', async () => {
    await invoke(service.getAllOrders, {
      query: { startDate: '2026-01-01', endDate: '2026-01-31' },
      user: { id: 1, role: 'admin' },
    });
    const between = repo.findOrders.mock.calls[0][0].where.createdAt[Op.between];
    expect(between[0]).toEqual(new Date('2026-01-01'));
    const end = between[1];
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  test('chỉ startDate (thiếu endDate) → KHÔNG set createdAt (kill && → ||)', async () => {
    await invoke(service.getAllOrders, {
      query: { startDate: '2026-01-01' },
      user: { id: 1, role: 'admin' },
    });
    expect(repo.findOrders.mock.calls[0][0].where.createdAt).toBeUndefined();
  });

  test('search → where[Op.or] number like %search%', async () => {
    await invoke(service.getAllOrders, {
      query: { search: 'ORD123' },
      user: { id: 1, role: 'admin' },
    });
    expect(repo.findOrders.mock.calls[0][0].where[Op.or]).toEqual([
      { number: { [Op.like]: '%ORD123%' } },
    ]);
  });

  test('transform: productImages → images[], price = basePrice', async () => {
    repo.findOrders.mockResolvedValueOnce({
      count: 1,
      rows: [
        {
          toJSON: () => ({
            id: 7,
            items: [
              {
                Product: {
                  basePrice: 12345,
                  productImages: [{ imageUrl: 'a.jpg' }, { imageUrl: 'b.jpg' }],
                },
              },
            ],
          }),
        },
      ],
    });
    const { res } = await invoke(service.getAllOrders, {
      query: {},
      user: { id: 1, role: 'admin' },
    });
    const p = res.payload.data.orders[0].items[0].Product;
    expect(p.images).toEqual(['a.jpg', 'b.jpg']);
    expect(p.price).toBe(12345);
  });

  test('transform: Product không có productImages → images = [] (kill ?. và || [])', async () => {
    repo.findOrders.mockResolvedValueOnce({
      count: 1,
      rows: [{ toJSON: () => ({ id: 8, items: [{ Product: { basePrice: 100 } }] }) }],
    });
    const { res } = await invoke(service.getAllOrders, {
      query: {},
      user: { id: 1, role: 'admin' },
    });
    expect(res.payload.data.orders[0].items[0].Product.images).toEqual([]);
  });

  test('transform: item không có Product → giữ nguyên item (kill if item.Product)', async () => {
    repo.findOrders.mockResolvedValueOnce({
      count: 1,
      rows: [{ toJSON: () => ({ id: 9, items: [{ note: 'no product' }] }) }],
    });
    const { res } = await invoke(service.getAllOrders, {
      query: {},
      user: { id: 1, role: 'admin' },
    });
    expect(res.payload.data.orders[0].items[0]).toEqual({ note: 'no product' });
  });

  test('logger.info được gọi với thông điệp lấy + xong', async () => {
    repo.findOrders.mockResolvedValueOnce({ count: 0, rows: [] });
    await invoke(service.getAllOrders, { query: {}, user: { id: 1, role: 'admin' } });
    expect(logger.info).toHaveBeenCalledWith('[ADMIN] Đang lấy danh sách đơn hàng...');
    expect(logger.info).toHaveBeenCalledWith('[ADMIN] Lấy đơn hàng xong:', 0);
  });

  test('findOrders lỗi → logger.error + rethrow (next có err)', async () => {
    repo.findOrders.mockRejectedValueOnce(new Error('DB down'));
    const { err } = await invoke(service.getAllOrders, {
      query: {},
      user: { id: 1, role: 'admin' },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('DB down');
    expect(logger.error).toHaveBeenCalledWith('[ADMIN] LỖI khi lấy danh sách đơn hàng:', 'DB down');
  });
});

// ─── updateOrderStatus ──────────────────────────────────────────────────────

describe('updateOrderStatus — delegate', () => {
  test('gọi _ordersService.updateOrderStatus với đủ field, trả order sau cập nhật', async () => {
    repo.findOrderById.mockResolvedValueOnce({ id: 3, status: 'shipped' });
    const { res } = await invoke(service.updateOrderStatus, {
      params: { id: '3' },
      body: { status: 'shipped', paymentStatus: 'paid', note: 'giao' },
      user: { id: 1, role: 'admin' },
    });
    expect(ordersServiceMock.updateOrderStatus).toHaveBeenCalledWith({
      id: '3',
      status: 'shipped',
      paymentStatus: 'paid',
      note: 'giao',
    });
    expect(repo.findOrderById).toHaveBeenCalledWith('3');
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      status: 'success',
      data: { order: { id: 3, status: 'shipped' } },
    });
  });
});

// ─── adminCancelOrder ───────────────────────────────────────────────────────

describe('adminCancelOrder', () => {
  test('không tìm thấy → 404 "Không tìm thấy đơn hàng"', async () => {
    repo.findOrderById.mockResolvedValueOnce(null);
    const { err } = await invoke(service.adminCancelOrder, {
      params: { id: '5' },
      user: { id: 1, role: 'admin' },
    });
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Không tìm thấy đơn hàng');
  });

  test('đơn đã cancelled → 400 "Đơn hàng đã bị hủy trước đó"', async () => {
    repo.findOrderById.mockResolvedValueOnce({ id: 5, status: 'cancelled' });
    const { err } = await invoke(service.adminCancelOrder, {
      params: { id: '5' },
      user: { id: 1, role: 'admin' },
    });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Đơn hàng đã bị hủy trước đó');
    expect(ordersServiceMock.updateOrderStatus).not.toHaveBeenCalled();
  });

  test('hợp lệ → delegate cancel + 200 message + data orderId số', async () => {
    repo.findOrderById.mockResolvedValueOnce({ id: 5, status: 'pending' });
    const { res } = await invoke(service.adminCancelOrder, {
      params: { id: '5' },
      user: { id: 1, role: 'admin' },
    });
    expect(ordersServiceMock.updateOrderStatus).toHaveBeenCalledWith({
      id: '5',
      status: 'cancelled',
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      status: 'success',
      message: 'Đã hủy đơn hàng thành công',
      data: { orderId: 5, status: 'cancelled' },
    });
  });
});
