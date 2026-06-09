require('module-alias/register');
const sequelize = require('@config/sequelize');
const { Feedback, User } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let author;

beforeAll(async () => {
  await sequelize.authenticate();
  author = await User.create({
    firstName: '__INT_Content',
    lastName: 'Author',
    email: `__int_content_${TS}@t.com`,
    password: 'Content123!',
    role: 'admin',
  });
});

afterAll(async () => {
  await Feedback.destroy({ where: { email: { [Op.like]: `__int_fb_${TS}%` } }, force: true }).catch(
    () => {},
  );
  if (author) await author.destroy({ force: true }).catch(() => {});
});

describe('Content Integration — Feedback CRUD', () => {
  test('Tạo feedback với đầy đủ fields', async () => {
    const fb = await Feedback.create({
      name: '__INT Feedback',
      email: `__int_fb_${TS}@t.com`,
      subject: 'Test subject',
      content: 'Test feedback content',
    });
    expect(fb.id).toBeDefined();
    expect(fb.name).toBe('__INT Feedback');
    expect(fb.subject).toBe('Test subject');
  });

  test('Đọc feedback vừa tạo', async () => {
    const fb = await Feedback.findOne({ where: { email: `__int_fb_${TS}@t.com` } });
    expect(fb).not.toBeNull();
    expect(fb.subject).toBe('Test subject');
  });

  test('Tạo feedback chỉ với required fields', async () => {
    const fb = await Feedback.create({
      name: '__INT Minimal',
      email: `__int_fb_${TS}_minimal@t.com`,
      subject: 'Minimal',
      content: 'Required only',
    });
    expect(fb.id).toBeDefined();
    expect(fb.content).toBe('Required only');
  });

  test('Tạo feedback thiếu required field → throw', async () => {
    await expect(Feedback.create({ name: '__INT Missing' })).rejects.toThrow();
  });

  test('Đếm feedback theo email pattern', async () => {
    const count = await Feedback.count({ where: { email: { [Op.like]: `__int_fb_${TS}%` } } });
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Xóa feedback', async () => {
    const deleted = await Feedback.destroy({
      where: { email: `__int_fb_${TS}_minimal@t.com` },
      force: true,
    });
    expect(deleted).toBe(1);
  });
});
