const { z } = require('zod');
const redeemPointsSchema = z.object({
  points: z.number().int('Số điểm phải là số nguyên').positive('Số điểm phải là số dương'),
});
module.exports = { redeemPointsSchema };
