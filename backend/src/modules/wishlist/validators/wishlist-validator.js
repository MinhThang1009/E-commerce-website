const { z } = require('zod');
const addWishlistSchema = z.object({
  productId: z.number().int().positive('ID sản phẩm không hợp lệ'),
});
module.exports = { addWishlistSchema };
