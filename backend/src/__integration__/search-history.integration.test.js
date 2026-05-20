require('module-alias/register');
const sequelize = require('@config/sequelize');
const { User, SearchHistory } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user;

beforeAll(async () => {
  await sequelize.authenticate();
  user = await User.create({
    firstName: '__INT_Search',
    lastName: 'User',
    email: `__int_search_${TS}@t.com`,
    password: 'Search123!',
    role: 'customer',
  });
});

afterAll(async () => {
  await SearchHistory.destroy({ where: { userId: user?.id }, force: true });
  if (user) await user.destroy({ force: true });
});

describe('SearchHistory Integration', () => {
  test('Lưu tìm kiếm', async () => {
    await SearchHistory.create({ userId: user.id, keyword: 'iphone 15', resultsCount: 5 });
    const h = await SearchHistory.findOne({ where: { userId: user.id, keyword: 'iphone 15' } });
    expect(h).not.toBeNull();
    expect(h.resultsCount).toBe(5);
  });

  test('Lưu nhiều tìm kiếm', async () => {
    const keywords = ['laptop gaming', 'samsung galaxy', 'airpods pro'];
    for (const kw of keywords) {
      await SearchHistory.create({ userId: user.id, keyword: kw, resultsCount: 10 });
    }
    const all = await SearchHistory.findAll({ where: { userId: user.id } });
    expect(all.length).toBe(4);
  });

  test('Lấy lịch sử sắp xếp mới nhất trước', async () => {
    const history = await SearchHistory.findAll({
      where: { userId: user.id },
      order: [['createdAt', 'DESC']],
      limit: 3,
    });
    expect(history.length).toBe(3);
  });

  test('Xóa một mục', async () => {
    const first = await SearchHistory.findOne({
      where: { userId: user.id },
      order: [['id', 'ASC']],
    });
    await first.destroy({ force: true });
    const remaining = await SearchHistory.count({ where: { userId: user.id } });
    expect(remaining).toBe(3);
  });

  test('Clear all history của user', async () => {
    await SearchHistory.destroy({ where: { userId: user.id }, force: true });
    const count = await SearchHistory.count({ where: { userId: user.id } });
    expect(count).toBe(0);
  });
});
