const { Banner } = require('../models');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');
const { getRedisClient } = require('../config/redis');

const CACHE_TTL_BANNERS = 60 * 60; // 1 giờ

/**
 * Lấy tất cả banner
 */
const getAllBanners = catchAsync(async (req, res) => {
  const { position, isActive } = req.query;
  const where = {};

  if (position) where.position = position;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  // Cache chỉ cho public active banners (không có filter phức tạp)
  const isActiveOnlyQuery = isActive === 'true' && !position;
  const cacheKey = isActiveOnlyQuery ? 'banners:active' : null;

  if (cacheKey) {
    const redis = await getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }
  }

  const banners = await Banner.findAll({
    where,
    order: [['priority', 'DESC'], ['createdAt', 'DESC']],
  });

  const payload = { status: 'success', results: banners.length, data: banners };

  if (cacheKey) {
    const redis = await getRedisClient();
    await redis.setEx(cacheKey, CACHE_TTL_BANNERS, JSON.stringify(payload));
  }

  res.status(200).json(payload);
});

/**
 * Lấy một banner theo ID
 */
const getBannerById = catchAsync(async (req, res) => {
  const banner = await Banner.findByPk(req.params.id);

  if (!banner) {
    throw new AppError('Không tìm thấy banner', 404);
  }

  res.status(200).json({
    status: 'success',
    data: banner,
  });
});

/**
 * Tạo banner mới
 */
const createBanner = catchAsync(async (req, res) => {
  const banner = await Banner.create(req.body);
  const redis = await getRedisClient();
  await redis.del('banners:active');
  res.status(201).json({
    status: 'success',
    data: banner,
  });
});

/**
 * Cập nhật banner
 */
const updateBanner = catchAsync(async (req, res) => {
  const banner = await Banner.findByPk(req.params.id);

  if (!banner) {
    throw new AppError('Không tìm thấy banner', 404);
  }

  await banner.update(req.body);
  const redis = await getRedisClient();
  await redis.del('banners:active');

  res.status(200).json({
    status: 'success',
    data: banner,
  });
});

/**
 * Xóa banner
 */
const deleteBanner = catchAsync(async (req, res) => {
  const banner = await Banner.findByPk(req.params.id);

  if (!banner) {
    throw new AppError('Không tìm thấy banner', 404);
  }

  await banner.destroy();
  const redis = await getRedisClient();
  await redis.del('banners:active');

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

module.exports = {
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
};
