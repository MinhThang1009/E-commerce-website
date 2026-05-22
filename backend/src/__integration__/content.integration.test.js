require('module-alias/register');
const sequelize = require('@config/sequelize');
const { Feedback, User } = require('@models');

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

describe('Content Integration — Feedback', () => {
  test('Tạo feedback', async () => {
    const fb = await Feedback.create({
      name: '__INT Feedback',
      email: `__int_fb_${TS}@t.com`,
      subject: 'Test subject',
      content: 'Test feedback content',
      rating: 5,
    });
    expect(fb.id).toBeDefined();
  });
});
