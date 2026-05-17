const ReviewsController = require('./reviewsController');

describe('ReviewsController', () => {
  let reviewsService;
  let controller;
  let req;
  let res;
  let next;

  beforeEach(() => {
    reviewsService = {
      createReview: jest.fn(),
      updateReview: jest.fn(),
      deleteReview: jest.fn(),
      getProductReviews: jest.fn(),
      getUserReviews: jest.fn(),
      getAllReviews: jest.fn(),
      verifyReview: jest.fn(),
      markReviewHelpful: jest.fn(),
    };
    controller = new ReviewsController({ reviewsService });

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // -------- createReview --------

  describe('createReview', () => {
    beforeEach(() => {
      req = {
        user: { id: 7 },
        body: { productId: 1, rating: 5, title: 'Tốt', comment: 'Rất tốt', images: [] },
      };
    });

    test('trả về 201 và review khi service thành công', async () => {
      const fakeReview = { id: 10, rating: 5, title: 'Tốt' };
      reviewsService.createReview.mockResolvedValue({ review: fakeReview });

      await controller.createReview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: fakeReview });
    });

    test('truyền đúng userId từ req.user.id vào service', async () => {
      reviewsService.createReview.mockResolvedValue({ review: {} });

      await controller.createReview(req, res, next);

      expect(reviewsService.createReview).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7, productId: 1, rating: 5 })
      );
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('service lỗi');
      reviewsService.createReview.mockRejectedValue(err);

      await controller.createReview(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // -------- updateReview --------

  describe('updateReview', () => {
    beforeEach(() => {
      req = {
        user: { id: 7 },
        params: { id: '42' },
        body: { rating: 4, comment: 'Updated' },
      };
    });

    test('trả về 200 và review đã cập nhật', async () => {
      const updatedReview = { id: 42, rating: 4 };
      reviewsService.updateReview.mockResolvedValue({ review: updatedReview });

      await controller.updateReview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: updatedReview });
    });

    test('truyền đúng userId + reviewId + patch vào service', async () => {
      reviewsService.updateReview.mockResolvedValue({ review: {} });

      await controller.updateReview(req, res, next);

      expect(reviewsService.updateReview).toHaveBeenCalledWith({
        userId: 7,
        reviewId: '42',
        patch: req.body,
      });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('not found');
      reviewsService.updateReview.mockRejectedValue(err);

      await controller.updateReview(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- deleteReview --------

  describe('deleteReview', () => {
    beforeEach(() => {
      req = { user: { id: 7 }, params: { id: '42' } };
    });

    test('trả về 200 với message khi xóa thành công', async () => {
      reviewsService.deleteReview.mockResolvedValue({ message: 'Xóa đánh giá thành công' });

      await controller.deleteReview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Xóa đánh giá thành công',
      });
    });

    test('truyền đúng userId + reviewId vào service', async () => {
      reviewsService.deleteReview.mockResolvedValue({ message: 'ok' });

      await controller.deleteReview(req, res, next);

      expect(reviewsService.deleteReview).toHaveBeenCalledWith({ userId: 7, reviewId: '42' });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('403');
      reviewsService.deleteReview.mockRejectedValue(err);

      await controller.deleteReview(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- getProductReviews --------

  describe('getProductReviews', () => {
    beforeEach(() => {
      req = {
        params: { productId: '5' },
        query: { page: '2', limit: '5', sort: 'highest_rating' },
      };
    });

    test('trả về 200 với data từ service', async () => {
      const data = { total: 10, pages: 2, currentPage: 2, reviews: [] };
      reviewsService.getProductReviews.mockResolvedValue(data);

      await controller.getProductReviews(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data });
    });

    test('merge productId từ params với query params khi gọi service', async () => {
      reviewsService.getProductReviews.mockResolvedValue({});

      await controller.getProductReviews(req, res, next);

      expect(reviewsService.getProductReviews).toHaveBeenCalledWith(
        expect.objectContaining({ productId: '5', page: '2', sort: 'highest_rating' })
      );
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('product not found');
      reviewsService.getProductReviews.mockRejectedValue(err);

      await controller.getProductReviews(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- getUserReviews --------

  describe('getUserReviews', () => {
    beforeEach(() => {
      req = { user: { id: 7 }, query: { page: '1', limit: '10' } };
    });

    test('trả về 200 với danh sách review của user', async () => {
      const data = { total: 3, pages: 1, currentPage: 1, reviews: [{ id: 1 }] };
      reviewsService.getUserReviews.mockResolvedValue(data);

      await controller.getUserReviews(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data });
    });

    test('truyền userId từ req.user.id', async () => {
      reviewsService.getUserReviews.mockResolvedValue({});

      await controller.getUserReviews(req, res, next);

      expect(reviewsService.getUserReviews).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7 })
      );
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('oops');
      reviewsService.getUserReviews.mockRejectedValue(err);

      await controller.getUserReviews(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- getAllReviews --------

  describe('getAllReviews', () => {
    beforeEach(() => {
      req = { query: { verified: 'true', page: '1' } };
    });

    test('trả về 200 với tất cả reviews', async () => {
      const data = { total: 50, pages: 5, currentPage: 1, reviews: [] };
      reviewsService.getAllReviews.mockResolvedValue(data);

      await controller.getAllReviews(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data });
    });

    test('truyền query params vào service', async () => {
      reviewsService.getAllReviews.mockResolvedValue({});

      await controller.getAllReviews(req, res, next);

      expect(reviewsService.getAllReviews).toHaveBeenCalledWith(
        expect.objectContaining({ verified: 'true', page: '1' })
      );
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('db error');
      reviewsService.getAllReviews.mockRejectedValue(err);

      await controller.getAllReviews(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- verifyReview --------

  describe('verifyReview', () => {
    beforeEach(() => {
      req = { params: { id: '99' }, body: { isVerified: true } };
    });

    test('trả về 200 với message và data khi xác nhận thành công', async () => {
      reviewsService.verifyReview.mockResolvedValue({
        message: 'Đánh giá đã được xác nhận',
        data: { id: 99, isVerified: true },
      });

      await controller.verifyReview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Đánh giá đã được xác nhận',
        data: { id: 99, isVerified: true },
      });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('not found');
      reviewsService.verifyReview.mockRejectedValue(err);

      await controller.verifyReview(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- markReviewHelpful --------

  describe('markReviewHelpful', () => {
    beforeEach(() => {
      req = { user: { id: 3 }, params: { id: '55' }, body: { helpful: true } };
    });

    test('trả về 200 với message và data khi helpful=true', async () => {
      reviewsService.markReviewHelpful.mockResolvedValue({
        message: 'Đã đánh dấu đánh giá là hữu ích',
        data: { id: 55, likes: 5, dislikes: 1 },
      });

      await controller.markReviewHelpful(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Đã đánh dấu đánh giá là hữu ích',
        data: { id: 55, likes: 5, dislikes: 1 },
      });
    });

    test('truyền đúng userId + reviewId + helpful vào service', async () => {
      reviewsService.markReviewHelpful.mockResolvedValue({ message: 'ok', data: {} });

      await controller.markReviewHelpful(req, res, next);

      expect(reviewsService.markReviewHelpful).toHaveBeenCalledWith({
        userId: 3,
        reviewId: '55',
        helpful: true,
      });
    });

    test('trả về đúng message khi helpful=false', async () => {
      req.body.helpful = false;
      reviewsService.markReviewHelpful.mockResolvedValue({
        message: 'Đã đánh dấu đánh giá là không hữu ích',
        data: { id: 55, likes: 4, dislikes: 2 },
      });

      await controller.markReviewHelpful(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Đã đánh dấu đánh giá là không hữu ích' })
      );
    });

    test('gọi next(err) khi user vote cho review của chính mình (service throw)', async () => {
      const err = new Error('Bạn không thể đánh giá đánh giá của chính mình');
      reviewsService.markReviewHelpful.mockRejectedValue(err);

      await controller.markReviewHelpful(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
