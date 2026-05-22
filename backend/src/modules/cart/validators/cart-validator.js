const { z } = require('zod');
const cartItemSchema = z.object({
  productId: z.number().int().positive('ID sản phẩm không hợp lệ'),
  variantId: z.number().int().nullable().optional(),
  quantity: z
    .number()
    .int('Số lượng phải là số nguyên')
    .min(1, 'Số lượng phải lớn hơn 0')
    .default(1),
  name: z.string().optional(),
  price: z.number().optional(),
  image: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});
const addToCartSchema = cartItemSchema;
const updateCartItemSchema = z.object({
  quantity: z.number().int('Số lượng phải là số nguyên').min(1, 'Số lượng phải lớn hơn 0'),
});
const syncCartSchema = z.object({ items: z.array(cartItemSchema) });
module.exports = { addToCartSchema, updateCartItemSchema, syncCartSchema };
