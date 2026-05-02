const { Banner } = require('../models');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Lấy tất cả banner
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
