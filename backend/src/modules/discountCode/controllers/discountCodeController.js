/**
 * @file discountCodeController.js
 * @layer Controller
 * @module discountCode
 * @description Xử lý HTTP request/response cho discountCode
 */
const { catchAsync } = require('../../../utils/catchAsync');
const discountCodeService = require('../services/discountCodeService');

// Admin: Lấy danh sách mã giảm giá với phân trang và tìm kiếm
const getAllDiscountCodes = catchAsync(async (req, res) => {
  const data = await discountCodeService.getAllDiscountCodes(req.query);
  res.status(200).json({ status: 'success', data });
});

// Admin: Lấy chi tiết một mã giảm giá theo ID
const getDiscountCodeById = catchAsync(async (req, res) => {
  const discountCode = await discountCodeService.getDiscountCodeById(req.params.id);
  res.status(200).json({ status: 'success', data: { discountCode } });
});

// Admin: Tạo mã giảm giá mới
const createDiscountCode = catchAsync(async (req, res) => {
  const discountCode = await discountCodeService.createDiscountCode(req.body, req.user);
  res
    .status(201)
    .json({ status: 'success', message: 'Tạo mã giảm giá thành công', data: { discountCode } });
});

// Admin: Cập nhật mã giảm giá
const updateDiscountCode = catchAsync(async (req, res) => {
  const discountCode = await discountCodeService.updateDiscountCode(
    req.params.id,
    req.body,
    req.user,
  );
  res
    .status(200)
    .json({
      status: 'success',
      message: 'Cập nhật mã giảm giá thành công',
      data: { discountCode },
    });
});

// Admin: Xóa mã giảm giá
const deleteDiscountCode = catchAsync(async (req, res) => {
  await discountCodeService.deleteDiscountCode(req.params.id, req.user);
  res.status(200).json({ status: 'success', message: 'Xóa mã giảm giá thành công' });
});

// Customer: Kiểm tra và tính toán số tiền được giảm khi áp dụng mã
const applyDiscountCode = catchAsync(async (req, res) => {
  const { code, orderAmount } = req.body;
  const data = await discountCodeService.applyDiscountCode(code, orderAmount);
  res.status(200).json({ status: 'success', message: 'Áp dụng mã giảm giá thành công', data });
});

module.exports = {
  getAllDiscountCodes,
  getDiscountCodeById,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  applyDiscountCode,
};
