jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
const logger = require('@utils/logger');
const ReviewsService = require('./reviews-service');

describe('ReviewsService — branch coverage', () => {
  let svc, repo;
  beforeEach(() => {
    repo = {
      findProductReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      findPendingReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      findUserReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      findAllReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      findProductById: jest.fn().mockResolvedValue({ id: 1 }),
    };
    svc = new ReviewsService({ reviewsRepository: repo, eventBus: { publish: jest.fn() }, logger });
  });

  test('getProductReviews: NaN page/limit → fallback', async () => {
    await svc.getProductReviews({ productId: 1, page: 'x', limit: 'y' });
    expect(repo.findProductReviews).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ limit: 10, offset: 0 }),
    );
  });

  test('getUserReviews: NaN page/limit → fallback', async () => {
    await svc.getUserReviews({ userId: 1, page: 'x', limit: 'y' });
    expect(repo.findUserReviews).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ limit: 10, offset: 0 }),
    );
  });

  test('getAllReviews: NaN page/limit → fallback 1/10', async () => {
    await svc.getAllReviews({ page: 'x', limit: 'y' });
    expect(repo.findAllReviews).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 0 }),
    );
  });
});
