require('module-alias/register');
const sequelize = require('@config/sequelize');
const { User, LoyaltyHistory } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user;

beforeAll(async () => {
  await sequelize.authenticate();
  user = await User.create({
    firstName: '__INT_Loyalty',
    lastName: 'User',
    email: `__int_loyalty_${TS}@test.com`,
    password: 'Loyal123!',
    role: 'customer',
    loyaltyPoints: 0,
  });
});

afterAll(async () => {
  await LoyaltyHistory.destroy({ where: { userId: user?.id }, force: true });
  if (user) await user.destroy({ force: true });
});

describe('Loyalty Integration', () => {
  test('Tích điểm khi mua hàng', async () => {
    await LoyaltyHistory.create({
      userId: user.id,
      type: 'earn',
      points: 10,
      description: 'Mua hàng',
    });
    await user.increment('loyaltyPoints', { by: 10 });
    await user.reload();
    expect(user.loyaltyPoints).toBe(10);
  });

  test('Tích điểm lần 2 — cộng dồn', async () => {
    await LoyaltyHistory.create({
      userId: user.id,
      type: 'earn',
      points: 5,
      description: 'Mua hàng lần 2',
    });
    await user.increment('loyaltyPoints', { by: 5 });
    await user.reload();
    expect(user.loyaltyPoints).toBe(15);
  });

  test('Đổi điểm — trừ points', async () => {
    const spend = 8;
    expect(user.loyaltyPoints).toBeGreaterThanOrEqual(spend);
    await LoyaltyHistory.create({
      userId: user.id,
      type: 'spend',
      points: spend,
      description: 'Đổi điểm',
    });
    await user.decrement('loyaltyPoints', { by: spend });
    await user.reload();
    expect(user.loyaltyPoints).toBe(15 - spend);
  });

  test('Lịch sử điểm: earn và spend đều có', async () => {
    const earnItems = await LoyaltyHistory.findAll({ where: { userId: user.id, type: 'earn' } });
    const spendItems = await LoyaltyHistory.findAll({ where: { userId: user.id, type: 'spend' } });
    expect(earnItems.length).toBe(2);
    expect(spendItems.length).toBe(1);
  });

  test('Tổng earn - spend = loyaltyPoints hiện tại', async () => {
    const all = await LoyaltyHistory.findAll({ where: { userId: user.id } });
    const net = all.reduce((sum, h) => sum + (h.type === 'earn' ? h.points : -h.points), 0);
    await user.reload();
    expect(net).toBe(user.loyaltyPoints);
  });
});
