// Unit tests cho InventoryController
// Chiến lược: mock inventoryService hoàn toàn, kiểm tra response shape + status code + error forwarding

const InventoryController = require('./inventory-controller');

// ---------- Helpers ----------

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  return res;
}

function makeReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 1 },
    ...overrides,
  };
}

// ---------- Setup ----------

let inventoryService;
let controller;

beforeEach(() => {
  inventoryService = {
    restockProduct: jest.fn(),
    getInventoryLogs: jest.fn(),
  };
  controller = new InventoryController({ inventoryService });
});

// ============================================================
// restockProduct
// ============================================================

describe('InventoryController.restockProduct', () => {
  it('trả 200 với data khi service thành công', async () => {
    const serviceResult = { newStock: 30, productId: 1, variantId: null };
    inventoryService.restockProduct.mockResolvedValue(serviceResult);

    const req = makeReq({
      params: { productId: '1' },
      body: { quantity: 20, note: 'nhập hàng mới' },
      user: { id: 5 },
    });
    const res = makeRes();
    const next = jest.fn();

    await controller.restockProduct(req, res, next);

    expect(inventoryService.restockProduct).toHaveBeenCalledWith({
      productId: '1',
      variantId: undefined,
      quantity: 20,
      note: 'nhập hàng mới',
      adminId: 5,
    });
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ data: serviceResult });
    expect(next).not.toHaveBeenCalled();
  });

  it('truyền variantId từ body khi có', async () => {
    inventoryService.restockProduct.mockResolvedValue({ newStock: 15 });

    const req = makeReq({
      params: { productId: '2' },
      body: { variantId: 7, quantity: 10 },
      user: { id: 3 },
    });

    await controller.restockProduct(req, makeRes(), jest.fn());

    expect(inventoryService.restockProduct).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: 7, productId: '2', adminId: 3 })
    );
  });

  it('gọi next(err) khi service ném lỗi 400', async () => {
    const err = Object.assign(new Error('quantity không hợp lệ'), { statusCode: 400 });
    inventoryService.restockProduct.mockRejectedValue(err);

    const next = jest.fn();
    await controller.restockProduct(makeReq({ params: { productId: '1' }, body: { quantity: 0 } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('gọi next(err) khi service ném lỗi 404 (product không tồn tại)', async () => {
    const err = Object.assign(new Error('Không tìm thấy sản phẩm'), { statusCode: 404 });
    inventoryService.restockProduct.mockRejectedValue(err);

    const next = jest.fn();
    await controller.restockProduct(
      makeReq({ params: { productId: '99' }, body: { quantity: 5 } }),
      makeRes(),
      next
    );

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ============================================================
// getInventoryLogs
// ============================================================

describe('InventoryController.getInventoryLogs', () => {
  it('trả 200 với { status: success, ...result } khi service thành công', async () => {
    const serviceResult = {
      count: 2,
      rows: [
        { id: 1, changeType: 'restock', changeAmount: 20 },
        { id: 2, changeType: 'sale', changeAmount: -1 },
      ],
      page: 1,
      limit: 20,
    };
    inventoryService.getInventoryLogs.mockResolvedValue(serviceResult);

    const req = makeReq({ query: { page: '1', limit: '20' } });
    const res = makeRes();
    const next = jest.fn();

    await controller.getInventoryLogs(req, res, next);

    expect(inventoryService.getInventoryLogs).toHaveBeenCalledWith({ page: '1', limit: '20' });
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ status: 'success', ...serviceResult });
    expect(next).not.toHaveBeenCalled();
  });

  it('trả status success với count=0 khi không có log', async () => {
    inventoryService.getInventoryLogs.mockResolvedValue({ count: 0, rows: [] });

    const req = makeReq({ query: {} });
    const res = makeRes();

    await controller.getInventoryLogs(req, res, jest.fn());

    expect(res._body.status).toBe('success');
    expect(res._body.count).toBe(0);
    expect(res._body.rows).toEqual([]);
  });

  it('forward query params (productId, changeType) nguyên vẹn tới service', async () => {
    inventoryService.getInventoryLogs.mockResolvedValue({ count: 0, rows: [] });

    const req = makeReq({ query: { productId: '5', changeType: 'restock', limit: '10' } });
    await controller.getInventoryLogs(req, makeRes(), jest.fn());

    expect(inventoryService.getInventoryLogs).toHaveBeenCalledWith({
      productId: '5',
      changeType: 'restock',
      limit: '10',
    });
  });

  it('gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('DB lỗi');
    inventoryService.getInventoryLogs.mockRejectedValue(err);

    const next = jest.fn();
    await controller.getInventoryLogs(makeReq({ query: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
