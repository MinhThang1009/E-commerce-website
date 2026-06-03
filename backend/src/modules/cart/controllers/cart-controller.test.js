// Unit tests cho CartController — phủ các nhánh còn thiếu:
//   - getCart: success + error (line 15)
//   - getCartCount: success + error (line 25)
//   - addToCart: success với setSessionCookie callback (lines 30-36) + error (line 31)
//   - clearCart: success (line 78) + error
//   - syncCart: success (line 89) + error
//   - mergeCart: success với clearSessionCookie callback (lines 93-102) + error
//   - validateCart: success (line 112) + error

const CartController = require('./cart-controller');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(overrides = {}) {
  return {
    user: { id: 1, role: 'user' },
    cookies: {},
    body: {},
    params: {},
    ...overrides,
  };
}

function makeService() {
  return {
    getCart: jest.fn(),
    getCartCount: jest.fn(),
    addToCart: jest.fn(),
    updateCartItem: jest.fn(),
    removeCartItem: jest.fn(),
    clearCart: jest.fn(),
    syncCart: jest.fn(),
    mergeCart: jest.fn(),
    validateCart: jest.fn(),
  };
}

describe('CartController', () => {
  let controller;
  let cartService;

  beforeEach(() => {
    cartService = makeService();
    controller = new CartController({ cartService });
  });

  // ────────────────────────────────────────────────────────────
  // getCart
  // ────────────────────────────────────────────────────────────

  describe('getCart', () => {
    test('trả về 200 với data giỏ hàng (line 14)', async () => {
      const cartData = { items: [], total: 0 };
      cartService.getCart.mockResolvedValue({ data: cartData });

      const req = makeReq({ cookies: { sessionId: 'sess-abc' } });
      const res = makeRes();
      const next = jest.fn();

      await controller.getCart(req, res, next);

      expect(cartService.getCart).toHaveBeenCalledWith({
        user: req.user,
        cookieSessionId: 'sess-abc',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: cartData });
    });

    test('service throw → gọi next(err) (line 15)', async () => {
      const err = new Error('DB lỗi');
      cartService.getCart.mockRejectedValue(err);

      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();

      await controller.getCart(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });

    test('dùng cookieSessionId=undefined khi req.cookies không có sessionId', async () => {
      cartService.getCart.mockResolvedValue({ data: {} });

      const req = makeReq({ cookies: {} });
      const res = makeRes();
      const next = jest.fn();

      await controller.getCart(req, res, next);

      expect(cartService.getCart).toHaveBeenCalledWith(
        expect.objectContaining({ cookieSessionId: undefined }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // getCartCount
  // ────────────────────────────────────────────────────────────

  describe('getCartCount', () => {
    test('trả về 200 với count (line 24)', async () => {
      cartService.getCartCount.mockResolvedValue({ count: 5 });

      const req = makeReq({ cookies: { sessionId: 'sess-1' } });
      const res = makeRes();
      const next = jest.fn();

      await controller.getCartCount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { count: 5 } });
    });

    test('service throw → gọi next(err) (line 25)', async () => {
      const err = new Error('Lỗi count');
      cartService.getCartCount.mockRejectedValue(err);

      await controller.getCartCount(makeReq(), makeRes(), (e) => {
        expect(e).toBe(err);
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // addToCart
  // ────────────────────────────────────────────────────────────

  describe('addToCart', () => {
    test('trả về 200 và set cookie sessionId khi service gọi setSessionCookie (lines 30-36)', async () => {
      cartService.addToCart.mockImplementation(async ({ setSessionCookie }) => {
        setSessionCookie('new-session-id-123');
        return { data: { items: [] } };
      });

      const req = makeReq({ body: { productId: 1, quantity: 1 } });
      const res = makeRes();
      const next = jest.fn();

      await controller.addToCart(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'sessionId',
        'new-session-id-123',
        expect.objectContaining({
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          sameSite: 'strict',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { items: [] } });
    });

    test('thành công khi service không gọi setSessionCookie (guest user không cần set lại cookie)', async () => {
      cartService.addToCart.mockResolvedValue({ data: { items: [{ id: 1 }] } });

      const req = makeReq({
        body: { productId: 2, quantity: 2 },
        cookies: { sessionId: 'existing' },
      });
      const res = makeRes();
      const next = jest.fn();

      await controller.addToCart(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    });

    test('service throw → gọi next(err) (line 31)', async () => {
      const err = new Error('Hết hàng');
      cartService.addToCart.mockRejectedValue(err);

      const req = makeReq({ body: { productId: 1, quantity: 10 } });
      const res = makeRes();
      const next = jest.fn();

      await controller.addToCart(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });

    test('truyền đúng cookieSessionId và body vào service', async () => {
      cartService.addToCart.mockResolvedValue({ data: {} });

      const req = makeReq({
        body: { productId: 5, variantId: 3, quantity: 2 },
        cookies: { sessionId: 'cookie-123' },
      });
      const res = makeRes();
      const next = jest.fn();

      await controller.addToCart(req, res, next);

      expect(cartService.addToCart).toHaveBeenCalledWith(
        expect.objectContaining({
          user: req.user,
          cookieSessionId: 'cookie-123',
          body: req.body,
          setSessionCookie: expect.any(Function),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // clearCart
  // ────────────────────────────────────────────────────────────

  describe('clearCart', () => {
    test('trả về 200 với message và data (line 78)', async () => {
      cartService.clearCart.mockResolvedValue({ message: 'Đã xóa giỏ hàng', data: null });

      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();

      await controller.clearCart(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Đã xóa giỏ hàng',
        data: null,
      });
    });

    test('service throw → gọi next(err)', async () => {
      const err = new Error('Lỗi xóa giỏ');
      cartService.clearCart.mockRejectedValue(err);

      await controller.clearCart(makeReq(), makeRes(), (e) => {
        expect(e).toBe(err);
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // syncCart
  // ────────────────────────────────────────────────────────────

  describe('syncCart', () => {
    test('trả về 200 với data đã sync (line 89)', async () => {
      const syncedData = { items: [{ id: 1 }, { id: 2 }], total: 200000 };
      cartService.syncCart.mockResolvedValue({ data: syncedData });

      const req = makeReq({
        body: { items: [{ productId: 1, quantity: 1 }] },
        cookies: { sessionId: 'sess-sync' },
      });
      const res = makeRes();
      const next = jest.fn();

      await controller.syncCart(req, res, next);

      expect(cartService.syncCart).toHaveBeenCalledWith({
        user: req.user,
        cookieSessionId: 'sess-sync',
        items: [{ productId: 1, quantity: 1 }],
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: syncedData });
    });

    test('service throw → gọi next(err) (line 89)', async () => {
      const err = new Error('Sync thất bại');
      cartService.syncCart.mockRejectedValue(err);

      await controller.syncCart(makeReq(), makeRes(), (e) => {
        expect(e).toBe(err);
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // mergeCart
  // ────────────────────────────────────────────────────────────

  describe('mergeCart', () => {
    test('gọi res.clearCookie khi service gọi clearSessionCookie (lines 93-102)', async () => {
      cartService.mergeCart.mockImplementation(async ({ clearSessionCookie }) => {
        clearSessionCookie();
        return { data: { merged: true } };
      });

      const req = makeReq({ cookies: { sessionId: 'old-sess' } });
      const res = makeRes();
      const next = jest.fn();

      await controller.mergeCart(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith('sessionId');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { merged: true } });
    });

    test('trả về 200 khi service không gọi clearSessionCookie', async () => {
      cartService.mergeCart.mockResolvedValue({ data: {} });

      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();

      await controller.mergeCart(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('service throw → gọi next(err) (line 93)', async () => {
      const err = new Error('Merge thất bại');
      cartService.mergeCart.mockRejectedValue(err);

      await controller.mergeCart(makeReq(), makeRes(), (e) => {
        expect(e).toBe(err);
      });
    });

    test('truyền đúng cookieSessionId vào service', async () => {
      cartService.mergeCart.mockResolvedValue({ data: {} });

      const req = makeReq({ cookies: { sessionId: 'cookie-merge' } });
      const res = makeRes();
      const next = jest.fn();

      await controller.mergeCart(req, res, next);

      expect(cartService.mergeCart).toHaveBeenCalledWith(
        expect.objectContaining({
          cookieSessionId: 'cookie-merge',
          clearSessionCookie: expect.any(Function),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // validateCart
  // ────────────────────────────────────────────────────────────

  describe('validateCart', () => {
    test('trả về 200 với data validation (line 112)', async () => {
      const validationData = { isValid: true, issues: [] };
      cartService.validateCart.mockResolvedValue(validationData);

      const req = makeReq({ cookies: { sessionId: 'sess-v' } });
      const res = makeRes();
      const next = jest.fn();

      await controller.validateCart(req, res, next);

      expect(cartService.validateCart).toHaveBeenCalledWith({
        user: req.user,
        cookieSessionId: 'sess-v',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: validationData });
    });

    test('service throw → gọi next(err) (line 112)', async () => {
      const err = new Error('Validation lỗi');
      cartService.validateCart.mockRejectedValue(err);

      await controller.validateCart(makeReq(), makeRes(), (e) => {
        expect(e).toBe(err);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════
  // MUTATION-KILL bổ sung — assert: (1) service nhận đúng cookieSessionId
  // (kill guard req.cookies && req.cookies.sessionId), (2) cookie undefined
  // (kill mutant && → true vì req.cookies=undefined gây throw), (3) next ĐƯỢC
  // GỌI khi error (kill catch block → {}), (4) updateCartItem/removeCartItem
  // (chưa có test ở trên), (5) response body chính xác (kill ObjectLiteral/String).
  // ════════════════════════════════════════════════════════════════
  describe('mutation-kill: cookieSessionId + next() được gọi + response shape', () => {
    test('getCartCount: truyền đúng cookieSessionId từ cookie', async () => {
      cartService.getCartCount.mockResolvedValue({ count: 3 });
      const req = makeReq({ cookies: { sessionId: 'sess-gc' } });
      await controller.getCartCount(req, makeRes(), jest.fn());

      expect(cartService.getCartCount).toHaveBeenCalledWith({
        user: req.user,
        cookieSessionId: 'sess-gc',
      });
    });

    test('getCartCount: req.cookies undefined → cookieSessionId undefined (không throw)', async () => {
      cartService.getCartCount.mockResolvedValue({ count: 0 });
      const req = makeReq({ cookies: undefined });
      const next = jest.fn();
      await controller.getCartCount(req, makeRes(), next);

      // mutant && → req.cookies || ... sẽ throw vì undefined.sessionId; ở đây next KHÔNG được gọi với error
      expect(next).not.toHaveBeenCalled();
      expect(cartService.getCartCount).toHaveBeenCalledWith(
        expect.objectContaining({ cookieSessionId: undefined }),
      );
    });

    test('getCartCount: error → next ĐƯỢC GỌI với err (kill catch block)', async () => {
      const err = new Error('count lỗi');
      cartService.getCartCount.mockRejectedValue(err);
      const next = jest.fn();
      await controller.getCartCount(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalledWith(err);
    });

    test('updateCartItem: truyền user/cookieSessionId/itemId/quantity + response 200', async () => {
      const data = { items: [{ id: 1 }] };
      cartService.updateCartItem.mockResolvedValue({ data });
      const req = makeReq({
        cookies: { sessionId: 'sess-u' },
        params: { id: '42' },
        body: { quantity: 3 },
      });
      const res = makeRes();
      await controller.updateCartItem(req, res, jest.fn());

      expect(cartService.updateCartItem).toHaveBeenCalledWith({
        user: req.user,
        cookieSessionId: 'sess-u',
        itemId: '42',
        quantity: 3,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data });
    });

    test('updateCartItem: req.cookies undefined → cookieSessionId undefined', async () => {
      cartService.updateCartItem.mockResolvedValue({ data: {} });
      const req = makeReq({ cookies: undefined, params: { id: '1' }, body: { quantity: 1 } });
      const next = jest.fn();
      await controller.updateCartItem(req, makeRes(), next);

      expect(next).not.toHaveBeenCalled();
      expect(cartService.updateCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ cookieSessionId: undefined }),
      );
    });

    test('updateCartItem: error → next(err)', async () => {
      const err = new Error('update lỗi');
      cartService.updateCartItem.mockRejectedValue(err);
      const next = jest.fn();
      await controller.updateCartItem(
        makeReq({ params: { id: '1' }, body: { quantity: 1 } }),
        makeRes(),
        next,
      );

      expect(next).toHaveBeenCalledWith(err);
    });

    test('removeCartItem: truyền user/cookieSessionId/itemId + response 200', async () => {
      const data = { items: [] };
      cartService.removeCartItem.mockResolvedValue({ data });
      const req = makeReq({ cookies: { sessionId: 'sess-r' }, params: { id: '7' } });
      const res = makeRes();
      await controller.removeCartItem(req, res, jest.fn());

      expect(cartService.removeCartItem).toHaveBeenCalledWith({
        user: req.user,
        cookieSessionId: 'sess-r',
        itemId: '7',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data });
    });

    test('removeCartItem: req.cookies undefined → cookieSessionId undefined', async () => {
      cartService.removeCartItem.mockResolvedValue({ data: {} });
      const req = makeReq({ cookies: undefined, params: { id: '1' } });
      const next = jest.fn();
      await controller.removeCartItem(req, makeRes(), next);

      expect(next).not.toHaveBeenCalled();
      expect(cartService.removeCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ cookieSessionId: undefined }),
      );
    });

    test('removeCartItem: error → next(err)', async () => {
      const err = new Error('remove lỗi');
      cartService.removeCartItem.mockRejectedValue(err);
      const next = jest.fn();
      await controller.removeCartItem(makeReq({ params: { id: '1' } }), makeRes(), next);

      expect(next).toHaveBeenCalledWith(err);
    });

    test('clearCart: truyền đúng arg {user, cookieSessionId} (kill ObjectLiteral L89)', async () => {
      cartService.clearCart.mockResolvedValue({ message: 'cart.cleared', data: null });
      const req = makeReq({ cookies: { sessionId: 'sess-c' } });
      await controller.clearCart(req, makeRes(), jest.fn());

      expect(cartService.clearCart).toHaveBeenCalledWith({
        user: req.user,
        cookieSessionId: 'sess-c',
      });
    });

    test('clearCart: error → next ĐƯỢC GỌI với err (kill catch block)', async () => {
      const err = new Error('clear lỗi');
      cartService.clearCart.mockRejectedValue(err);
      const next = jest.fn();
      await controller.clearCart(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalledWith(err);
    });

    test('syncCart: error → next ĐƯỢC GỌI với err', async () => {
      const err = new Error('sync lỗi');
      cartService.syncCart.mockRejectedValue(err);
      const next = jest.fn();
      await controller.syncCart(makeReq({ body: { items: [] } }), makeRes(), next);

      expect(next).toHaveBeenCalledWith(err);
    });

    test('mergeCart: error → next ĐƯỢC GỌI với err', async () => {
      const err = new Error('merge lỗi');
      cartService.mergeCart.mockRejectedValue(err);
      const next = jest.fn();
      await controller.mergeCart(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalledWith(err);
    });

    test('validateCart: error → next ĐƯỢC GỌI với err', async () => {
      const err = new Error('validate lỗi');
      cartService.validateCart.mockRejectedValue(err);
      const next = jest.fn();
      await controller.validateCart(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
