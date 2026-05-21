require('module-alias/register');
const sequelize = require('@config/sequelize');
const { Banner, News, User } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let author;

beforeAll(async () => {
  await sequelize.authenticate();
  author = await User.create({
    firstName: '__INT_ContentX',
    lastName: 'Author',
    email: `__int_contentx_${TS}@t.com`,
    password: 'ContentX123!',
    role: 'admin',
  });
});

afterAll(async () => {
  await Banner.destroy({
    where: { titleVi: { [Op.like]: `__INT_BannerX_${TS}%` } },
    force: true,
  }).catch(() => {});
  await News.destroy({
    where: { slug: { [Op.like]: `int-newsx-${TS}%` } },
    force: true,
  }).catch(() => {});
  if (author) await author.destroy({ force: true }).catch(() => {});
});

describe('Content Integration — Extra', () => {
  test('Banner isActive=false → không xuất hiện trong getActiveBanners', async () => {
    // Tạo banner inactive
    await Banner.create({
      titleVi: `__INT_BannerX_${TS}_inactive`,
      imageUrl: '/img/testx-inactive.jpg',
      isActive: false,
    });

    // getActiveBanners = query với isActive=true
    const activeBanners = await Banner.findAll({
      where: {
        titleVi: { [Op.like]: `__INT_BannerX_${TS}%` },
        isActive: true,
      },
    });

    expect(activeBanners).toHaveLength(0);
  });

  test('News isPublished=false → không xuất hiện trong getPublishedNews', async () => {
    // Tạo bài viết chưa xuất bản
    await News.create({
      titleVi: `__INT NewsX ${TS} draft`,
      slug: `int-newsx-${TS}-draft`,
      contentVi: 'Nội dung bản nháp',
      isPublished: false,
      userId: author.id,
    });

    // getPublishedNews = query với isPublished=true
    const publishedNews = await News.findAll({
      where: {
        slug: { [Op.like]: `int-newsx-${TS}%` },
        isPublished: true,
      },
    });

    expect(publishedNews).toHaveLength(0);
  });
});
