const { DiscountCode } = require('../models');
const { Op } = require('sequelize');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Admin: Lấy danh sách mã giảm giá
 */
const getAllDiscountCodes = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    isActive,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
  } = req.query;

  const offset = (page - 1) * limit;
  const whereClause = {};

  if (search) {
    whereClause.code = { [Op.like]: `%${search}%` };
  }

  if (isActive !== undefined) {
    whereClause.isActive = isActive === 'true';
  }

  const { count, rows: discountCodes } = await DiscountCode.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

  res.status(200).json({
    status: 'success',
    data: {
      discountCodes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit),
      },
    },
  });
});

/**
 * Admin: Lấy chi tiết mã giảm giá
 */
const getDiscountCodeById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const discountCode = await DiscountCode.findByPk(id);

  if (!discountCode) {
    throw new AppError('Không tìm thấy mã giảm giá', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { discountCode },
  });
});

/**
 * Admin: Tạo mã giảm giá mới
 */
const createDiscountCode = catchAsync(async (req, res) => {
  const {
    code,
    type,
    value,
    minOrderAmount,
    maxDiscountAmount,
    startDate,
    endDate,
    usageLimit,
    isActive,
    description,
  } = req.body;

  // Kiểm tra trùng mã
  const existingCode = await DiscountCode.findOne({ where: { code } });
  if (existingCode) {
    throw new AppError('Mã giảm giá đã tồn tại', 400);
  }

  const discountCode = await DiscountCode.create({
    code,
    type,
    value,
    minOrderAmount: minOrderAmount || 0,
    maxDiscountAmount,
    startDate,
    endDate,
    usageLimit,
    isActive: isActive !== undefined ? isActive : true,
    description,
  });

  res.status(201).json({
    status: 'success',
    message: 'Tạo mã giảm giá thành công',
    data: { discountCode },
  });
});

/**
 * Admin: Cập nhật mã giảm giá
 */
const updateDiscountCode = catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    code,
    type,
    value,
    minOrderAmount,
    maxDiscountAmount,
    startDate,
    endDate,
    usageLimit,
    isActive,
    description,
  } = req.body;

  const discountCode = await DiscountCode.findByPk(id);
  if (!discountCode) {
    throw new AppError('Không tìm thấy mã giảm giá', 404);
  }

  if (code && code !== discountCode.code) {
    const existingCode = await DiscountCode.findOne({ where: { code } });
    if (existingCode) {
      throw new AppError('Mã giảm giá đã tồn tại', 400);
    }
  }

  await discountCode.update({
    code: code || discountCode.code,
    type: type || discountCode.type,
    value: value !== undefined ? value : discountCode.value,
    minOrderAmount: minOrderAmount !== undefined ? minOrderAmount : discountCode.minOrderAmount,
    maxDiscountAmount: maxDiscountAmount !== undefined ? maxDiscountAmount : discountCode.maxDiscountAmount,
    startDate: startDate || discountCode.startDate,
    endDate: endDate || discountCode.endDate,
    usageLimit: usageLimit !== undefined ? usageLimit : discountCode.usageLimit,
    isActive: isActive !== undefined ? isActive : discountCode.isActive,
    description: description || discountCode.description,
  });

  res.status(200).json({
    status: 'success',
    message: 'Cập nhật mã giảm giá thành công',
    data: { discountCode },
  });
});

/**
 * Admin: Xóa mã giảm giá
 */
const deleteDiscountCode = catchAsync(async (req, res) => {
  const { id } = req.params;

  const discountCode = await DiscountCode.findByPk(id);
  if (!discountCode) {
    throw new AppError('Không tìm thấy mã giảm giá', 404);
  }

  await discountCode.destroy();

  res.status(200).json({
    status: 'success',
    message: 'Xóa mã giảm giá thành công',
  });
});

/**
 * Customer: Áp dụng mã giảm giá (Dự đoán số tiền)
 */
const applyDiscountCode = catchAsync(async (req, res) => {
  const { code, orderAmount } = req.body;

  const discountCode = await DiscountCode.findOne({ where: { code, isActive: true } });
  if (!discountCode) {
    throw new AppError('Mã giảm giá không hợp lệ hoặc đã hết hạn', 400);
  }

  const now = new Date();
  if (discountCode.startDate && now < new Date(discountCode.startDate)) {
    throw new AppError('Mã giảm giá chưa đến thời gian áp dụng', 400);
  }

  if (discountCode.endDate && now > new Date(discountCode.endDate)) {
    throw new AppError('Mã giảm giá đã hết hạn', 400);
  }

  if (discountCode.usageLimit !== null && discountCode.usedCount >= discountCode.usageLimit) {
    throw new AppError('Mã giảm giá đã đạt giới hạn lượt sử dụng', 400);
  }

  if (orderAmount < parseFloat(discountCode.minOrderAmount)) {
    throw new AppError(`Đơn hàng phải tối thiểu ${discountCode.minOrderAmount} để sử dụng mã này`, 400);
  }

  let discountAmount = 0;
  const value = parseFloat(discountCode.value);
  
  if (discountCode.type === 'percent') {
    discountAmount = (orderAmount * value) / 100;
    if (discountCode.maxDiscountAmount && discountAmount > parseFloat(discountCode.maxDiscountAmount)) {
      discountAmount = parseFloat(discountCode.maxDiscountAmount);
    }
  } else {
    discountAmount = value;
  }

  if (discountAmount > orderAmount) {
    discountAmount = orderAmount;
  }

  res.status(200).json({
    status: 'success',
    message: 'Áp dụng mã giảm giá thành công',
    data: {
      discountAmount,
      discountCodeId: discountCode.id,
      code: discountCode.code,
    },
  });
});

module.exports = {
  getAllDiscountCodes,
  getDiscountCodeById,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  applyDiscountCode,
};
