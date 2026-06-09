const ReviewsRepo = require('./sequelize-reviews-repository');

describe('SequelizeReviewsRepository — branch coverage', () => {
  test('runInTransaction gọi sequelize.transaction', async () => {
    const txMock = jest.fn(async (cb) => cb('tx'));
    const repo = new ReviewsRepo({
      Review: { sequelize: { transaction: txMock } },
      Product: {},
      Order: {},
    });
    const result = await repo.runInTransaction((t) => t);
    expect(txMock).toHaveBeenCalled();
    expect(result).toBe('tx');
  });
});
