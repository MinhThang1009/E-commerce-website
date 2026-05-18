const LoyaltyService = require('./loyalty-service');

describe('LoyaltyService', () => {
  let loyaltyRepository;
  let service;
  let mockTransaction;

  beforeEach(() => {
    mockTransaction = { LOCK: { UPDATE: 'FOR UPDATE' } };
    loyaltyRepository = {
      findUserPointsById: jest.fn(),
      decrementPoints: jest.fn().mockResolvedValue(),
      findHistory: jest.fn(),
      createHistoryRecord: jest.fn().mockResolvedValue(),
      runInTransactionWithLock: jest.fn((work) => work(mockTransaction)),
    };
    service = new LoyaltyService({
      loyaltyRepository,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  describe('getLoyaltyInfo', () => {
    test('user không tồn tại → 404', async () => {
      loyaltyRepository.findUserPointsById.mockResolvedValue(null);
      await expect(
        service.getLoyaltyInfo({ userId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('trả points + lịch sử pagination', async () => {
      loyaltyRepository.findUserPointsById.mockResolvedValue({ id: 1, loyaltyPoints: 500 });
      loyaltyRepository.findHistory.mockResolvedValue({
        count: 25, rows: [{ id: 1 }],
      });

      const result = await service.getLoyaltyInfo({ userId: 1, page: 2, limit: 10 });

      expect(result.points).toBe(500);
      expect(result.history.total).toBe(25);
      expect(result.history.pages).toBe(3);
      expect(result.history.currentPage).toBe(2);
      expect(loyaltyRepository.findHistory).toHaveBeenCalledWith(1, { limit: 10, offset: 10 });
    });
  });

  describe('redeemPoints', () => {
    test('user không tồn tại → 404', async () => {
      loyaltyRepository.findUserPointsById.mockResolvedValue(null);
      await expect(
        service.redeemPoints({ userId: 1, points: 100 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('điểm không đủ → 400', async () => {
      loyaltyRepository.findUserPointsById.mockResolvedValue({
        loyaltyPoints: 50,
        reload: jest.fn(),
      });
      await expect(
        service.redeemPoints({ userId: 1, points: 100 })
      ).rejects.toMatchObject({ statusCode: 400, message: 'loyalty.insufficientPoints' });
    });

    test('hợp lệ → decrement points + ghi history + return remaining', async () => {
      const user = {
        loyaltyPoints: 500,
        reload: jest.fn(function () {
          this.loyaltyPoints = 400;
          return Promise.resolve(this);
        }),
      };
      loyaltyRepository.findUserPointsById.mockResolvedValue(user);

      const result = await service.redeemPoints({ userId: 1, points: 100 });

      expect(loyaltyRepository.decrementPoints).toHaveBeenCalledWith(user, 100, expect.any(Object));
      expect(loyaltyRepository.createHistoryRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1, points: -100, type: 'spend',
        }),
        expect.any(Object)
      );
      expect(result.data.pointsRedeemed).toBe(100);
      expect(result.data.remainingPoints).toBe(400);
    });

    test('SELECT FOR UPDATE lock được pass vào findUserPointsById', async () => {
      const user = {
        loyaltyPoints: 500,
        reload: jest.fn().mockResolvedValue(),
      };
      loyaltyRepository.findUserPointsById.mockResolvedValue(user);

      await service.redeemPoints({ userId: 1, points: 100 });

      expect(loyaltyRepository.findUserPointsById).toHaveBeenCalledWith(1, expect.objectContaining({
        lock: 'FOR UPDATE',
        transaction: mockTransaction,
      }));
    });
  });
});
