/**
 * @file translate-service.js
 * @layer Service
 * @module ai
 * @description Dịch mảng strings VI → EN — dùng OpenRouter (GPT) + MyMemory fallback.
 */
const axios = require('axios');
const logger = require('@utils/logger');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Model được dùng cho translation — có thể override qua env TRANSLATE_MODEL
// Model ID trên OpenRouter — set qua env TRANSLATE_MODEL để dễ thay đổi
const TRANSLATE_MODEL = process.env.TRANSLATE_MODEL || 'openai/gpt-4.5';

/**
 * Dịch mảng strings từ ngôn ngữ nguồn sang đích.
 * Provider: OpenRouter GPT → MyMemory (free, không cần key) làm fallback.
 * @param {string[]} texts - Mảng strings cần dịch
 * @param {string} [from='vi'] - Ngôn ngữ nguồn
 * @param {string} [to='en'] - Ngôn ngữ đích
 */
async function translateBatch(texts, from = 'vi', to = 'en') {
  if (!texts || texts.length === 0) return texts;

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (apiKey && apiKey !== 'demo-key') {
    const result = await translateWithOpenRouter(texts, from, to, apiKey);
    // Nếu OpenRouter thành công (ít nhất 1 item thực sự được dịch)
    if (result.some((r, i) => r !== texts[i])) return result;
  }

  // Fallback: MyMemory API (free, không cần API key)
  logger.debug('[TranslateService] OpenRouter không khả dụng — dùng MyMemory free API');
  return translateWithMyMemory(texts, from, to);
}

async function translateWithOpenRouter(texts, from, to, apiKey) {
  const langName = { vi: 'Vietnamese', en: 'English', ja: 'Japanese', ko: 'Korean' };
  const fromName = langName[from] || from;
  const toName = langName[to] || to;

  const prompt = `Translate each item from ${fromName} to ${toName}. Return ONLY a JSON array of strings in the same order. Rules:
- Keep technical specs, numbers, units, model names, and brand names unchanged
- Keep abbreviations (GB, MHz, GHz, W, mm, Wh, etc.) unchanged
- If item is already in ${toName} or is a number/code, return it unchanged
Items: ${JSON.stringify(texts)}`;

  try {
    const res = await axios.post(
      OPENROUTER_URL,
      {
        model: TRANSLATE_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 3000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'TechStore Translate',
        },
        timeout: 30000,
      },
    );

    const content = res.data.choices?.[0]?.message?.content;
    if (!content) return texts;

    // Thử parse JSON từ response
    // GPT có thể trả JSON trực tiếp hoặc bọc trong markdown ```json```
    let parsed;
    try {
      const mdMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      parsed = JSON.parse(mdMatch ? mdMatch[1] : content);
    } catch {
      return texts;
    }

    const result = Array.isArray(parsed)
      ? parsed
      : (parsed.translations ?? parsed.result ?? parsed.items ?? null);

    if (Array.isArray(result) && result.length === texts.length) {
      return result.map((v, i) => (typeof v === 'string' && v.trim() ? v : texts[i]));
    }
    return texts;
  } catch (err) {
    const status = err.response?.status;
    logger.warn(`[TranslateService] OpenRouter lỗi (${status || err.code}):`, err.message);
    return texts;
  }
}

/**
 * Fallback: MyMemory API — free, không cần API key.
 * Giới hạn: 500 words/day per IP (không cần key).
 */
async function translateWithMyMemory(texts, from = 'vi', to = 'en') {
  const results = [];
  for (const text of texts) {
    try {
      const res = await axios.get('https://api.mymemory.translated.net/get', {
        params: { q: text, langpair: `${from}|${to}` },
        timeout: 10000,
      });
      const translated = res.data?.responseData?.translatedText;
      if (translated && !translated.includes('PLEASE SELECT') && translated !== text) {
        results.push(translated);
      } else {
        results.push(text);
      }
    } catch {
      results.push(text);
    }
    // Delay nhỏ để tránh rate limit
    await new Promise((r) => setTimeout(r, 200));
  }
  return results;
}

module.exports = { translateBatch };
