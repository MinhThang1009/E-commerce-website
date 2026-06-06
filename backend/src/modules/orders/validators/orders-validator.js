/**
 * @file orders-validator.js
 * @layer Validator
 * @module orders
 */
const { z } = require('zod');

const idSchema = z.union([z.number().int(), z.string()]);
const reqStr = (msg) => z.string({ message: msg }).min(1, msg);

const createOrderSchema = z.object({
  shippingFirstName: reqStr('Tên người nhận không được để trống'),
  shippingLastName: reqStr('Họ người nhận không được để trống'),
  shippingCompany: z.string().optional(),
  shippingAddress1: reqStr('Địa chỉ giao hàng không được để trống'),
  shippingAddress2: z.string().optional(),
  shippingCity: reqStr('Thành phố giao hàng không được để trống'),
  shippingState: z.string().optional(),
  shippingZip: z.string().optional(),
  shippingCountry: z.string().optional(),
  shippingPhone: z.string().optional(),
  billingFirstName: reqStr('Tên người thanh toán không được để trống'),
  billingLastName: reqStr('Họ người thanh toán không được để trống'),
  billingCompany: z.string().optional(),
  billingAddress1: reqStr('Địa chỉ thanh toán không được để trống'),
  billingAddress2: z.string().optional(),
  billingCity: reqStr('Thành phố thanh toán không được để trống'),
  billingState: z.string().optional(),
  billingZip: z.string().optional(),
  billingCountry: z.string().optional(),
  billingPhone: z.string().optional(),
  paymentMethod: z.enum(['cod', 'bank_transfer', 'installment', 'momo', 'vnpay'], {
    message: 'validation.invalidPaymentMethod',
  }),
  notes: z.string().optional(),
  discountCode: z.string().optional(),
  shippingCost: z.number().min(0).optional(), // Phí ship do FE tính theo khoảng cách km
  items: z
    .array(
      z.object({
        productId: idSchema,
        variantId: idSchema.nullable().optional(),
        quantity: z.number().int().min(1),
      }),
    )
    .optional(),
  // status bị xóa: backend luôn tạo với status='pending', không nhận từ client
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled'], {
    message: 'Trạng thái đơn hàng không hợp lệ',
  }),
});

module.exports = { createOrderSchema, updateOrderStatusSchema };
