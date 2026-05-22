const { z } = require('zod');
const createDiscountCodeSchema = z.object({
  code: z.string().min(2, 'Mã phải từ 2-50 ký tự').max(50),
  type: z.enum(['percent', 'fixed'], { message: 'Loại giảm giá không hợp lệ' }),
  value: z.number().min(0, 'Giá trị giảm giá phải lớn hơn hoặc bằng 0'),
  minOrderAmount: z.number().min(0).optional(),
  maxDiscountAmount: z.number().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  usageLimit: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
});
const updateDiscountCodeSchema = createDiscountCodeSchema.partial();
const applyDiscountCodeSchema = z.object({
  code: z.string().min(1, 'Mã giảm giá là bắt buộc'),
  orderAmount: z.number().min(0, 'Số tiền đơn hàng không hợp lệ'),
});
module.exports = { createDiscountCodeSchema, updateDiscountCodeSchema, applyDiscountCodeSchema };
