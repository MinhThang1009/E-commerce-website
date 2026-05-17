/**
 * @file translateService.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 */
const axios = require('axios');
const logger = require('../../../utils/logger');

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.0-flash-001';

/**
 * Dịch mảng strings từ VI → EN trong 1 API call.
 * Trả về mảng cùng độ dài — giữ nguyên item gốc nếu dịch thất bại.
 */
async function translateBatch(texts) {
  if (!texts || texts.length === 0) return texts;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'demo-key') return texts;

  const prompt = `Translate each item from Vietnamese to English. Return ONLY a JSON array of strings in the same order. Keep technical specs, numbers, units, model names, and brand names unchanged. Items:\n${JSON.stringify(texts)}`;

  try {
    const res = await axios.post(
      API_URL,
      {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5175',
          'X-Title': 'TechStore Translate',
        },
        timeout: 30000,
      },
    );

    const content = res.data.choices?.[0]?.message?.content;
    if (!content) return texts;

    const parsed = JSON.parse(content);
    // Model có thể trả về array trực tiếp hoặc object bọc ngoài
    const result = Array.isArray(parsed)
      ? parsed
      : (parsed.translations ?? parsed.result ?? parsed.items ?? texts);

    return Array.isArray(result) && result.length === texts.length ? result : texts;
  } catch (err) {
    logger.warn('translateBatch thất bại, giữ nguyên giá trị gốc:', err.message);
    return texts;
  }
}

module.exports = { translateBatch };
