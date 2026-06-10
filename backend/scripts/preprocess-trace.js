/**
 * preprocess-trace.js — Trace preprocessing steps của chatbot pipeline.
 * Chạy: node preprocess-trace.js "<query>"
 * Output: JSON với các bước tiền xử lý trước khi retrieval/generation.
 *
 * Từ 2026-06: bước ③ classify có 2 tầng — embedding classifier (primary) + regex
 * (fallback). Script hiển thị KẾT QUẢ CẢ 2 TẦNG; tầng embedding cần JINA/HF API key,
 * không có key → chỉ hiện tầng regex (đúng như production fallback).
 */
require('dotenv').config();
require('module-alias/register');

const {
  validateMessage,
  expandAbbreviations,
  classifyIntent,
  isOffTopic,
  isPromptInjection,
} = require('@modules/ai/services/core/ai-policy');

const query = process.argv[2] || '';

// Bước 1: Validate
const validation = validateMessage(query);

// Bước 2: Normalize
const normalized = expandAbbreviations(query);
const changed = normalized !== query;

// Bước 3: Security gates — tầng regex (sync)
const injection = isPromptInjection(query);
const offTopic = isOffTopic(normalized);
const intentRegex = classifyIntent(normalized);

// Bước 4: Version number extraction (simulate keyword fallback logic — sync với keyword-fallback.js)
const queryForVersionExtract = normalized
  .toLowerCase()
  .replace(
    /\b\d+(?:[.,]\d+)?\s*[-–]\s*\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|million|thousand|nghìn|ngàn|ngan\b|k\b|đ(?!\p{L})|vnd|đồng)(?!\p{L})/giu,
    ' ',
  )
  .replace(
    /\b\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|million|thousand|nghìn|ngàn|ngan\b|k\b|đ(?!\p{L})|vnd|đồng)(?!\p{L})/giu,
    ' ',
  )
  .replace(/\b(?:tầm|tâm|khoảng|dưới|trên|budget|around|under|over|about)\s*\d+(?:[.,]\d+)?\b/giu, ' ')
  .replace(/\b\d+\s*(?:gb|tb|mb|mah|hz|mp|w\b|mm|cm|inch)\b/gi, ' ');
const standaloneNums = queryForVersionExtract.match(/\b\d{2,}\b/g) || [];
const embeddedNums = [...queryForVersionExtract.matchAll(/[a-zA-Z]+(\d{2,})\b/g)].map((m) => m[1]);
const versionNums = [...new Set([...standaloneNums, ...embeddedNums])];

// Bước 5: Price range detection — đồng bộ keyword-fallback.js:
// capturing unit, k/nghìn/ngàn = ×1.000, tr/triệu/million = ×1.000.000
const PRICE_UNIT = '(tr(?:iệu)?|triệu|million|m\\b|k\\b|nghìn|nghin\\b|ngàn|ngan\\b|thousand)';
const NUM = '(\\d+(?:[.,]\\d+)?)';
const toVnd = (numStr, unit) =>
  parseFloat(numStr.replace(',', '.')) *
  (/^(?:k|nghìn|nghin|ngàn|ngan|thousand)$/.test(unit) ? 1e3 : 1e6);
const rangeMatch = normalized.toLowerCase().match(new RegExp(`${NUM}\\s*(?:[-–]|đến|tới)\\s*${NUM}\\s*${PRICE_UNIT}`, 'i'));
const maxMatch   = normalized.toLowerCase().match(new RegExp(`(?:dưới|under|below|tối\\s*đa|max)\\s*${NUM}\\s*${PRICE_UNIT}`, 'i'));
const approxMatch= normalized.toLowerCase().match(new RegExp(`(?:tầm|tâm|khoảng|around|budget|about)\\s*${NUM}\\s*${PRICE_UNIT}`, 'i'));
const minMatch   = normalized.toLowerCase().match(new RegExp(`(?:trên|over|above|tối\\s*thiểu|min)\\s*${NUM}\\s*${PRICE_UNIT}`, 'i'));

let priceFilter = null;
if (rangeMatch)       priceFilter = { type: 'range', min: toVnd(rangeMatch[1], rangeMatch[3]), max: toVnd(rangeMatch[2], rangeMatch[3]) };
else if (maxMatch)    priceFilter = { type: 'max',   max: toVnd(maxMatch[1], maxMatch[2]) };
else if (approxMatch) priceFilter = { type: 'approx', center: toVnd(approxMatch[1], approxMatch[2]), min: toVnd(approxMatch[1], approxMatch[2])*0.8, max: toVnd(approxMatch[1], approxMatch[2])*1.2 };
else if (minMatch)    priceFilter = { type: 'min',   min: toVnd(minMatch[1], minMatch[2]) };

// Bước 6: Pronoun detection
const PRONOUN_RE = /(?:^|\s)[\p{L}\p{N}]*(?:đó|này|kia)(?=[\s,?.!]|$)|(?:^|\s)nó(?=[\s,?.!]|$)|so sánh|cả hai|2 cái|hai cái/iu;
const pronounDetected = PRONOUN_RE.test(query);

// Bước 7: Negation detection (sync với keyword-fallback.js — hay/hoặc là connective trong list)
const negMatch = query.toLowerCase().match(
  /(?:không\s+(?:muốn|thích|dùng)|tránh|avoid|don't\s+want|not\s+interested\s+in)\s+([\p{L}\p{N}\s,/]+?)(?=\s+(?:gì|được|cũng|mà|nhưng|,|$)|\s*$)/iu
);
const NEGATION_CONNECTIVES = new Set(['hay', 'hoặc', 'hoac', 'and']);
const negationTerms = negMatch
  ? negMatch[1].toLowerCase().split(/[\s,/]+/).filter(w => w.length > 2 && !NEGATION_CONNECTIVES.has(w))
  : [];

(async () => {
  // Bước 3b: tầng embedding classifier (primary trong production) — best effort.
  // PIN provider primary cho cả examples lẫn query (đồng bộ chatbot-service):
  // vector 2 model khác nhau không so sánh được
  let intentEmbedding = null;
  const unified = require('@services/embedding/unified-embedding');
  if (validation.valid && !injection && unified.isAvailable()) {
    try {
      const classifier = require('@modules/ai/services/chatbot/intent/embedding-intent-classifier');
      const pin = unified.activeName;
      await classifier.initialize(
        async (t) => (await unified.generateEmbeddingWithMeta(t, 'query', { pin })).vector,
        { cacheSalt: pin, provider: pin, cache: true },
      );
      const { vector: vec } = await unified.generateEmbeddingWithMeta(normalized, 'query', {
        pin,
      });
      const r = classifier.classifyWithScore(vec);
      if (r) {
        const threshold =
          classifier.INTENT_THRESHOLDS[r.intent] ?? classifier.SIMILARITY_THRESHOLD;
        intentEmbedding = {
          intent: r.intent,
          score: +r.score.toFixed(3),
          threshold,
          used: r.score >= threshold, // false → production rơi về tầng regex
        };
      }
    } catch (err) {
      intentEmbedding = { error: err.message };
    }
  }

  // Intent cuối = embedding nếu đủ confidence, ngược lại regex (đúng _classifyIntent production)
  const intent = intentEmbedding?.used ? intentEmbedding.intent : intentRegex;

  // Determine pipeline path
  let pipelinePath;
  if (!validation.valid)           pipelinePath = 'VALIDATE_ERROR';
  else if (injection)              pipelinePath = 'INJECTION_BLOCK';
  else if (intent === 'off_topic') pipelinePath = 'OFFTOPIC_BLOCK';
  else                             pipelinePath = 'RAG_PIPELINE';

  console.log(JSON.stringify({
    original: query,
    validation: validation.valid ? 'ok' : validation.reason,
    normalized: changed ? normalized : '(unchanged)',
    abbrevChanged: changed,
    intent,
    intentRegex,
    intentEmbedding: intentEmbedding ?? '(không có API key / bị skip)',
    injection,
    offTopic,
    pipelinePath,
    versionNumbers: versionNums,
    priceFilter,
    pronounDetected,
    negationExclude: negationTerms,
  }));
})();
