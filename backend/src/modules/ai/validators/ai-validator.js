const { z } = require('zod');
const chatMessageSchema = z.object({
  message: z.string().min(1, 'Tin nhắn không được để trống').max(2000, 'Tin nhắn quá dài'),
  sessionId: z.string().optional(),
  userId: z.number().int().optional(),
});
module.exports = { chatMessageSchema };
