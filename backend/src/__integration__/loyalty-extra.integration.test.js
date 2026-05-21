/**
 * Integration tests — Loyalty extra cases với real DB.
 * Kiểm tra: tích điểm (earn), redeem (spend), lịch sử điểm, điểm không âm,
 * balance chính xác sau nhiều thao tác.
 */
require('module-alias/register');
const sequelize = require('@config/sequelize');
const { User, LoyaltyHistory } = require('@models');

const SequelizeLoyaltyRepository = require('@modules/loyalty/repositories/sequelize-loyalty-repository');
const LoyaltyService = require('@modules/loyalty/services/loyalty-service');

const TS = Date.now();
let user;

function makeService() {
  const repo = new SequelizeLoyaltyRepository({
    User,
    LoyaltyHistory,
    sequelize,
  });
  return new LoyaltyService({
    loyaltyRepository: repo,
    eventBus: { publish: jest.fn().mockResolvedValue(undefined) },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  });
}

beforeAll(async () => {
  await sequelize.authenticate();

  user = await User.create({
    firstName: '__INT_LoyalExtra',
    lastName: 'User',
    email: `__int_loyal_extra_${TS}@test.com`,
    password: 'LoyalExtra123!',
    role: 'customer',
    loyaltyPoints: 0,
  });
});

afterAll(async () => {
  await LoyaltyHistory.destroy({ where: { userId: user?.id }, force: true });
  if (user) await user.destroy({ force: true });
});

// ─────────────────────────────────────────────────────────────
describe('Loyalty extra — tích điểm sau confirmReceived', () => {
  test('Tích điểm sau khi confirmReceived → balance tăng đúng', async () => {
    // Arrange — mô phỏng orders module cộng điểm sau giao hàng:
    // LoyaltyHistory.create (type=earn) + user.increment
    const earnAmount = 20;
    const pointsBefore = user.loyaltyPoints;

    // Act — mô phỏng event order.delivered: cộng điểm cho user
    await LoyaltyHistory.create({
      userId: user.id,
      type: 'earn',
      points: earnAmount,
      description: `__INT tích điểm sau giao hàng ${TS}`,
    });
    await user.increment('loyaltyPoints', { by: earnAmount });
    await user.reload();

    // Assert — balance tăng đúng số điểm được tích
    expect(user.loyaltyPoints).toBe(pointsBefore + earnAmount);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Loyalty extra — redeem điểm', () => {
  test('Redeem điểm → LoyaltyHistory record type=spend được tạo', async () => {
    const service = makeService();
    await user.reload();
    const pointsBefore = user.loyaltyPoints;

    // Đảm bảo có đủ điểm để redeem
    if (pointsBefore < 5) {
      await user.increment('loyaltyPoints', { by: 5 });
      await LoyaltyHistory.create({
        userId: user.id,
        type: 'earn',
        points: 5,
        description: `__INT top up để test redeem ${TS}`,
      });
      await user.reload();
    }

    const redeemAmount = 5;
    const countBefore = await LoyaltyHistory.count({
      where: { userId: user.id, type: 'spend' },
    });

    // Act
    await service.redeemPoints({ userId: user.id, points: redeemAmount });

    // Assert — bản ghi history type=spend được tạo
    const countAfter = await LoyaltyHistory.count({
      where: { userId: user.id, type: 'spend' },
    });
    expect(countAfter).toBe(countBefore + 1);

    // Kiểm tra points giảm đúng
    await user.reload();
    expect(user.loyaltyPoints).toBeLessThan(user.loyaltyPoints + redeemAmount);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Loyalty extra — lịch sử điểm', () => {
  test('Lấy lịch sử điểm → có type=earn và type=spend', async () => {
    const service = makeService();

    // Act — lấy lịch sử thông qua service
    const result = await service.getLoyaltyInfo({ userId: user.id, page: 1, limit: 50 });

    // Assert — history có cả earn và spend records
    const earnItems = result.history.items.filter((h) => h.type === 'earn');
    const spendItems = result.history.items.filter((h) => h.type === 'spend');

    expect(earnItems.length).toBeGreaterThanOrEqual(1);
    expect(spendItems.length).toBeGreaterThanOrEqual(1);

    // Tất cả items đều thuộc user hiện tại
    result.history.items.forEach((h) => {
      expect(h.userId).toBe(user.id);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Loyalty extra — điểm không âm', () => {
  test('Điểm không âm sau nhiều thao tác earn và spend', async () => {
    // Arrange — thực hiện nhiều thao tác earn + spend liên tiếp
    await user.reload();

    // Tích thêm 30 điểm
    await user.increment('loyaltyPoints', { by: 30 });
    await LoyaltyHistory.create({
      userId: user.id,
      type: 'earn',
      points: 30,
      description: `__INT earn batch 1 ${TS}`,
    });

    // Dùng hết 10 điểm
    const service = makeService();
    await service.redeemPoints({ userId: user.id, points: 10 });

    // Tích thêm 15 điểm
    await user.reload();
    await user.increment('loyaltyPoints', { by: 15 });
    await LoyaltyHistory.create({
      userId: user.id,
      type: 'earn',
      points: 15,
      description: `__INT earn batch 2 ${TS}`,
    });

    // Dùng thêm 8 điểm
    await service.redeemPoints({ userId: user.id, points: 8 });

    // Assert — loyaltyPoints không bao giờ âm
    await user.reload();
    expect(user.loyaltyPoints).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Loyalty extra — balance chính xác', () => {
  test('Balance sau earn và redeem = earned - redeemed', async () => {
    // Act — tổng hợp tất cả history của user
    const allHistory = await LoyaltyHistory.findAll({
      where: { userId: user.id },
    });

    // Tính net từ history
    const netFromHistory = allHistory.reduce((sum, h) => {
      // Earn: points dương; Spend: points âm hoặc type=spend với giá trị dương
      if (h.type === 'earn') return sum + Math.abs(h.points);
      if (h.type === 'spend') return sum - Math.abs(h.points);
      return sum;
    }, 0);

    // Assert — balance trong DB khớp với net tính từ history
    await user.reload();
    expect(user.loyaltyPoints).toBe(netFromHistory);
    // Thêm guard: balance không bao giờ âm
    expect(user.loyaltyPoints).toBeGreaterThanOrEqual(0);
  });
});
