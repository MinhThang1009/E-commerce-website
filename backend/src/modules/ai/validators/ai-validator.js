const { z } = require('zod');
const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Tin nhắn không được để trống').max(500, 'Tin nhắn quá dài'),
  sessionId: z.string().nullable().optional(),
  userId: z.number().int().optional(),
});
module.exports = { chatMessageSchema };
