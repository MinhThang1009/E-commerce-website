require('module-alias/register');
const sequelize = require('@config/sequelize');
const { Banner, News, Feedback, User } = require('@models');
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
  // Dùng soft delete cho paranoid models (Banner, News)
  await Banner.destroy({ where: { titleVi: { [Op.like]: `__INT_Banner_${TS}%` } } }).catch(
    () => {},
  );
  await News.destroy({ where: { slug: { [Op.like]: `int-news-${TS}%` } } }).catch(() => {});
  // Non-paranoid models: hard delete OK
  await Feedback.destroy({ where: { email: { [Op.like]: `__int_fb_${TS}%` } }, force: true }).catch(
    () => {},
  );
  if (author) await author.destroy({ force: true }).catch(() => {});
});

describe('Content Integration — Banner', () => {
  test('Tạo banner active', async () => {
    const b = await Banner.create({
      titleVi: `__INT_Banner_${TS}_A`,
      imageUrl: '/img/test.jpg',
      isActive: true,
    });
    expect(b.id).toBeDefined();
    expect(b.isActive).toBe(true);
  });

  test('Tạo banner inactive', async () => {
    const b = await Banner.create({
      titleVi: `__INT_Banner_${TS}_I`,
      imageUrl: '/img/test2.jpg',
      isActive: false,
    });
    expect(b.isActive).toBe(false);
  });

  test('Filter banners active', async () => {
    const active = await Banner.findAll({
      where: { titleVi: { [Op.like]: `__INT_Banner_${TS}%` }, isActive: true },
    });
    expect(active.length).toBe(1);
  });
});

describe('Content Integration — News', () => {
  test('Tạo bài viết published', async () => {
    const n = await News.create({
      title: `__INT News ${TS}`,
      slug: `int-news-${TS}-pub`,
      content: 'Content test',
      isPublished: true,
      userId: author.id,
    });
    expect(n.isPublished).toBe(true);
  });

  test('Tạo bài viết draft', async () => {
    const n = await News.create({
      title: `__INT News Draft ${TS}`,
      slug: `int-news-${TS}-draft`,
      content: 'Draft',
      isPublished: false,
      userId: author.id,
    });
    expect(n.isPublished).toBe(false);
  });

  test('Filter published news', async () => {
    const published = await News.findAll({
      where: { slug: { [Op.like]: `int-news-${TS}%` }, isPublished: true },
    });
    expect(published.length).toBe(1);
  });
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
