const { z } = require('zod');
const saveSearchSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(1, 'Từ khóa tìm kiếm không được để trống')
    .max(500, 'Từ khóa tìm kiếm không được vượt quá 500 ký tự'),
  sessionId: z.string().optional(),
});
module.exports = { saveSearchSchema };
