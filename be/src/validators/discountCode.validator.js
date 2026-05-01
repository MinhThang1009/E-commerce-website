const { body, param, query } = require('express-validator');

const createDiscountCodeValidation = [
  body('code')
    .notEmpty().withMessage('Mã giảm giá là bắt buộc')
    .isLength({ min: 2, max: 50 }).withMessage('Mã phải từ 2-50 ký tự'),
    
  body('type')
    .isIn(['percent', 'fixed']).withMessage('Loại giảm giá không hợp lệ (phải là percent hoặc fixed)'),
    
  body('value')
    .isFloat({ min: 0 }).withMessage('Giá trị giảm giá phải lớn hơn hoặc bằng 0'),
    
  body('minOrderAmount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Số tiền tối thiểu phải lớn hơn hoặc bằng 0'),
    
  body('maxDiscountAmount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Số tiền giảm tối đa phải lớn hơn hoặc bằng 0'),
    
  body('startDate')
    .optional()
    .isISO8601().withMessage('Ngày bắt đầu không hợp lệ'),
    
  body('endDate')
    .optional()
    .isISO8601().withMessage('Ngày kết thúc không hợp lệ'),
    
  body('usageLimit')
    .optional()
    .isInt({ min: 1 }).withMessage('Giới hạn lượt dùng phải lớn hơn 0'),
    
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive phải là true/false'),
];

const updateDiscountCodeValidation = [
  param('id').isUUID().withMessage('ID không hợp lệ'),
  ...createDiscountCodeValidation.map(v => v.optional()),
];

const applyDiscountCodeValidation = [
  body('code')
    .notEmpty().withMessage('Mã giảm giá là bắt buộc'),
  body('orderAmount')
    .isFloat({ min: 0 }).withMessage('Số tiền đơn hàng không hợp lệ'),
];

module.exports = {
  createDiscountCodeValidation,
  updateDiscountCodeValidation,
  applyDiscountCodeValidation,
};
