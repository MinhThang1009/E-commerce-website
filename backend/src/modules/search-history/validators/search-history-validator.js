const { z } = require('zod');
const saveSearchSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(1, 'searchHistory.keywordRequired')
    .max(200, 'searchHistory.keywordTooLong'),
  resultsCount: z
    .number()
    .int()
    .min(0, 'searchHistory.resultsCountNegative')
    .max(9999999, 'searchHistory.resultsCountTooLarge')
    .optional(),
  sessionId: z
    .string()
    .min(1, 'searchHistory.sessionIdRequired')
    .max(128, 'searchHistory.sessionIdTooLong')
    .optional(),
});
const deleteSearchParamSchema = z.object({
  id: z.coerce.number().int().positive({ message: 'searchHistory.idInvalid' }),
});

const getHistoryQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1, 'searchHistory.limitTooSmall')
    .max(100, 'searchHistory.limitTooLarge')
    .default(10),
});

module.exports = { saveSearchSchema, deleteSearchParamSchema, getHistoryQuerySchema };
