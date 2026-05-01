const { Banner } = require('../models');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Get all banners
 */
const getAllBanners = catchAsync(async (req, res) => {
  const { position, isActive } = req.query;
  const where = {};

  if (position) where.position = position;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const banners = await Banner.findAll({
    where,
    order: [['priority', 'DESC'], ['createdAt', 'DESC']],
  });

  res.status(200).json({
    status: 'success',
    results: banners.length,
    data: banners,
  });
});

/**
 * Get single banner by ID
 */
const getBannerById = catchAsync(async (req, res) => {
  const banner = await Banner.findByPk(req.params.id);

  if (!banner) {
    throw new AppError('Banner not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: banner,
  });
});

/**
 * Create new banner
 */
const createBanner = catchAsync(async (req, res) => {
  const banner = await Banner.create(req.body);

  res.status(201).json({
    status: 'success',
    data: banner,
  });
});

/**
 * Update banner
 */
const updateBanner = catchAsync(async (req, res) => {
  const banner = await Banner.findByPk(req.params.id);

  if (!banner) {
    throw new AppError('Banner not found', 404);
  }

  await banner.update(req.body);

  res.status(200).json({
    status: 'success',
    data: banner,
  });
});

/**
 * Delete banner
 */
const deleteBanner = catchAsync(async (req, res) => {
  const banner = await Banner.findByPk(req.params.id);

  if (!banner) {
    throw new AppError('Banner not found', 404);
  }

  await banner.destroy();

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
