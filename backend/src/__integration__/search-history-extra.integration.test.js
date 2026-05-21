/**
 * Integration tests bổ sung — SearchHistory service + model.
 *
 * Bổ sung 5 test cho search-history.integration.test.js:
 *   1. Lưu keyword → record trong DB
 *   2. Lấy lịch sử theo userId → đúng user
 *   3. Tìm kiếm trùng lặp trong 1 giờ → dedup không tạo mới
 *   4. Xóa 1 từ khóa → không ảnh hưởng từ khác
 *   5. Xóa tất cả → lịch sử rỗng
 */
require('module-alias/register');
const sequelize = require('@config/sequelize');
const { User, SearchHistory } = require('@models');
const searchHistoryService = require('@modules/search-history/services/search-history-service');
const { Op } = require('sequelize');

const TS = Date.now();
let primaryUser, otherUser;

beforeAll(async () => {
  await sequelize.authenticate();

  primaryUser = await User.create({
    firstName: '__INT_SHExtra',
    lastName: 'User',
    email: `__int_sh_extra_${TS}@t.com`,
    password: 'Search123!',
    role: 'customer',
  });

  otherUser = await User.create({
    firstName: '__INT_SHOther',
    lastName: 'User',
    email: `__int_sh_other_${TS}@t.com`,
    password: 'Search123!',
    role: 'customer',
  });
});

afterAll(async () => {
  await SearchHistory.destroy({
    where: { userId: { [Op.in]: [primaryUser?.id, otherUser?.id].filter(Boolean) } },
    force: true,
  });
  if (primaryUser) await primaryUser.destroy({ force: true });
  if (otherUser) await otherUser.destroy({ force: true });
});

describe('SearchHistory Integration — bộ bổ sung', () => {
  test('Lưu từ khóa tìm kiếm → record tồn tại trong DB', async () => {
    // Arrange
    const keyword = `__INT_kw_save_${TS}`;

    // Act
    const result = await searchHistoryService.saveSearch({
      keyword,
      resultsCount: 7,
      userId: primaryUser.id,
    });

    // Assert
    expect(result.created).toBe(true);
    const record = await SearchHistory.findOne({
      where: { userId: primaryUser.id, keyword },
    });
    expect(record).not.toBeNull();
    expect(record.resultsCount).toBe(7);
  });

  test('Lấy lịch sử theo userId → chỉ trả về đúng user, không lẫn user khác', async () => {
    // Arrange — tạo keyword cho otherUser để kiểm tra isolation
    const keywordOther = `__INT_kw_other_${TS}`;
    await SearchHistory.create({
      userId: otherUser.id,
      keyword: keywordOther,
      resultsCount: 3,
    });

    // Act
    const history = await searchHistoryService.getHistory({ userId: primaryUser.id, limit: 50 });

    // Assert — kết quả chỉ thuộc về primaryUser
    const userIds = history.map((h) => h.userId);
    expect(userIds.every((id) => id === primaryUser.id)).toBe(true);

    // Keyword của otherUser không được xuất hiện trong history của primaryUser
    const keywords = history.map((h) => h.keyword);
    expect(keywords).not.toContain(keywordOther);
  });

  test('Tìm kiếm trùng lặp trong 1 giờ → dedup: không tạo record mới', async () => {
    // Arrange — keyword đã tồn tại từ test "Lưu từ khóa"
    const keyword = `__INT_kw_save_${TS}`;
    const countBefore = await SearchHistory.count({
      where: { userId: primaryUser.id, keyword },
    });

    // Act — gọi lại saveSearch với cùng keyword trong vòng 1 giờ
    const result = await searchHistoryService.saveSearch({
      keyword,
      resultsCount: 99,
      userId: primaryUser.id,
    });

    // Assert — service trả về created=false (dedup)
    expect(result.created).toBe(false);

    // DB không tăng thêm record
    const countAfter = await SearchHistory.count({
      where: { userId: primaryUser.id, keyword },
    });
    expect(countAfter).toBe(countBefore);
  });

  test('Xóa 1 từ khóa → các từ khóa khác không bị ảnh hưởng', async () => {
    // Arrange — tạo 2 keyword riêng biệt
    const kwKeep = `__INT_kw_keep_${TS}`;
    const kwDelete = `__INT_kw_del_${TS}`;
    await SearchHistory.create({ userId: primaryUser.id, keyword: kwKeep, resultsCount: 1 });
    const toDelete = await SearchHistory.create({
      userId: primaryUser.id,
      keyword: kwDelete,
      resultsCount: 1,
    });

    // Act
    await searchHistoryService.deleteOne({ id: toDelete.id, userId: primaryUser.id });

    // Assert — kwDelete bị xóa
    const deleted = await SearchHistory.findByPk(toDelete.id);
    expect(deleted).toBeNull();

    // kwKeep vẫn còn
    const kept = await SearchHistory.findOne({
      where: { userId: primaryUser.id, keyword: kwKeep },
    });
    expect(kept).not.toBeNull();
  });

  test('Xóa tất cả lịch sử → lịch sử rỗng cho user đó', async () => {
    // Arrange — đảm bảo có ít nhất 1 record
    const count = await SearchHistory.count({ where: { userId: primaryUser.id } });
    expect(count).toBeGreaterThan(0);

    // Act
    await searchHistoryService.clearAll({ userId: primaryUser.id });

    // Assert — không còn record nào
    const countAfter = await SearchHistory.count({ where: { userId: primaryUser.id } });
    expect(countAfter).toBe(0);

    // otherUser không bị ảnh hưởng
    const otherCount = await SearchHistory.count({ where: { userId: otherUser.id } });
    expect(otherCount).toBeGreaterThan(0);
  });
});
