const { z } = require('zod');
const cartItemSchema = z.object({
  productId: z.number().int().positive({ message: 'validation.invalidProductId' }),
  variantId: z.number().int().nullable().optional(),
  quantity: z
    .number()
    .int({ message: 'validation.integerRequired' })
    .min(1, { message: 'validation.minQuantity' })
    .default(1),
  name: z.string().optional(),
  price: z.number().optional(),
  image: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});
const addToCartSchema = cartItemSchema;
const updateCartItemSchema = z.object({
  quantity: z
    .number()
    .int({ message: 'validation.integerRequired' })
    .min(1, { message: 'validation.minQuantity' }),
});
const syncCartSchema = z.object({ items: z.array(cartItemSchema) });
module.exports = { addToCartSchema, updateCartItemSchema, syncCartSchema };
