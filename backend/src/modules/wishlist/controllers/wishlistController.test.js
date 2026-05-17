const WishlistController = require('./wishlistController');

describe('WishlistController', () => {
  let wishlistService;
  let controller;
  let res;
  let next;

  beforeEach(() => {
    wishlistService = {
      getWishlist: jest.fn(),
      addToWishlist: jest.fn(),
      removeFromWishlist: jest.fn(),
      checkWishlist: jest.fn(),
      clearWishlist: jest.fn(),
    };
    controller = new WishlistController({ wishlistService });

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // -------- getWishlist --------

  describe('getWishlist', () => {
    test('trả về 200 với danh sách products', async () => {
      const products = [{ id: 1 }, { id: 2 }];
      wishlistService.getWishlist.mockResolvedValue({ products });

      const req = { user: { id: 5 } };
      await controller.getWishlist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: products });
    });

    test('truyền đúng userId vào service', async () => {
      wishlistService.getWishlist.mockResolvedValue({ products: [] });

      const req = { user: { id: 99 } };
      await controller.getWishlist(req, res, next);

      expect(wishlistService.getWishlist).toHaveBeenCalledWith({ userId: 99 });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('db fail');
      wishlistService.getWishlist.mockRejectedValue(err);

      await controller.getWishlist({ user: { id: 1 } }, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // -------- addToWishlist --------

  describe('addToWishlist', () => {
    test('sản phẩm mới thêm → trả về 201', async () => {
      wishlistService.addToWishlist.mockResolvedValue({
        message: 'Đã thêm', alreadyExists: false,
      });

      const req = { user: { id: 1 }, body: { productId: 5 } };
      await controller.addToWishlist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('sản phẩm đã tồn tại → trả về 200', async () => {
      wishlistService.addToWishlist.mockResolvedValue({
        message: 'Đã có', alreadyExists: true,
      });

      const req = { user: { id: 1 }, body: { productId: 5 } };
      await controller.addToWishlist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'Đã có' });
    });

    test('truyền đúng userId + productId vào service', async () => {
      wishlistService.addToWishlist.mockResolvedValue({ message: 'ok', alreadyExists: false });

      const req = { user: { id: 3 }, body: { productId: 7 } };
      await controller.addToWishlist(req, res, next);

      expect(wishlistService.addToWishlist).toHaveBeenCalledWith({ userId: 3, productId: 7 });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('not found');
      wishlistService.addToWishlist.mockRejectedValue(err);

      await controller.addToWishlist({ user: { id: 1 }, body: { productId: 99 } }, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- removeFromWishlist --------

  describe('removeFromWishlist', () => {
    test('trả về 200 với message khi xóa thành công', async () => {
      wishlistService.removeFromWishlist.mockResolvedValue({ message: 'Đã xóa' });

      const req = { user: { id: 1 }, params: { productId: '5' } };
      await controller.removeFromWishlist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'Đã xóa' });
    });

    test('truyền productId từ params vào service', async () => {
      wishlistService.removeFromWishlist.mockResolvedValue({ message: 'ok' });

      const req = { user: { id: 2 }, params: { productId: '10' } };
      await controller.removeFromWishlist(req, res, next);

      expect(wishlistService.removeFromWishlist).toHaveBeenCalledWith({ userId: 2, productId: '10' });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('not in wishlist');
      wishlistService.removeFromWishlist.mockRejectedValue(err);

      await controller.removeFromWishlist({ user: { id: 1 }, params: { productId: '99' } }, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- checkWishlist --------

  describe('checkWishlist', () => {
    test('trả về 200 với inWishlist=true', async () => {
      wishlistService.checkWishlist.mockResolvedValue({ inWishlist: true });

      const req = { user: { id: 1 }, params: { productId: '5' } };
      await controller.checkWishlist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: { inWishlist: true },
      });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('db error');
      wishlistService.checkWishlist.mockRejectedValue(err);

      await controller.checkWishlist({ user: { id: 1 }, params: { productId: '5' } }, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- clearWishlist --------

  describe('clearWishlist', () => {
    test('trả về 200 với message sau khi xóa tất cả', async () => {
      wishlistService.clearWishlist.mockResolvedValue({ message: 'Đã xóa tất cả' });

      const req = { user: { id: 1 } };
      await controller.clearWishlist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'Đã xóa tất cả' });
    });

    test('truyền đúng userId vào service', async () => {
      wishlistService.clearWishlist.mockResolvedValue({ message: 'ok' });

      const req = { user: { id: 77 } };
      await controller.clearWishlist(req, res, next);

      expect(wishlistService.clearWishlist).toHaveBeenCalledWith({ userId: 77 });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('oops');
      wishlistService.clearWishlist.mockRejectedValue(err);

      await controller.clearWishlist({ user: { id: 1 } }, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
