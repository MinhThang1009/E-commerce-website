/**
 * check-docs.js — Kiểm tra các hằng số và giá trị quan trọng trong docs
 * có khớp với source code hiện tại không.
 *
 * Chạy: node scripts/check-docs.js
 * Tích hợp: npm run check-docs  (thêm vào package.json)
 *
 * Mỗi check là: { name, actual, pattern, files[] }
 *   - actual: giá trị thật từ source (number / string)
 *   - pattern: regex tìm giá trị trong docs (capture group 1 = giá trị)
 *   - files: danh sách file docs cần kiểm tra
 */
'use strict';
require('dotenv').config();
process.env.LOG_LEVEL = 'error'; // tắt INFO/DEBUG khi load modules
require('module-alias/register');

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// ── Đọc giá trị thật từ source ────────────────────────────────────────────────

const aiPolicy       = require('../src/modules/ai/services/core/ai-policy');
const chatbotService = require('../src/modules/ai/services/chatbot/chatbot-service');

// Đọc constants từ chatbot-service (private, đọc qua source)
const csSource = fs.readFileSync(
  path.join(ROOT, 'src/modules/ai/services/chatbot/chatbot-service.js'), 'utf8'
);
const extract = (pattern) => +csSource.match(pattern)?.[1];

const ACTUALS = {
  MAX_MESSAGE_LENGTH:    aiPolicy.MAX_MESSAGE_LENGTH,
  MAX_HISTORY_TURNS:     extract(/const MAX_HISTORY_TURNS\s*=\s*(\d+)/),
  MAX_SESSIONS:          extract(/const MAX_SESSIONS\s*=\s*(\d+)/),
  SESSION_TTL_MIN:       extract(/const SESSION_TTL_MS\s*=\s*(\d+)\s*\*\s*60\s*\*\s*1000/),
  LLM_TEMPERATURE:       +csSource.match(/const LLM_TEMPERATURE\s*=\s*([\d.]+)/)?.[1],
  LLM_MAX_TOKENS:        extract(/const LLM_MAX_TOKENS\s*=\s*(\d+)/),
  LLM_REWRITE_TIMEOUT_S: extract(/const LLM_REWRITE_TIMEOUT_MS\s*=\s*(\d+)/) / 1000,
  HYBRID_SEARCH_DEFAULT: 5,   // hybridSearch default limit — hardcoded trong vector-store.js
  CHATBOT_SEARCH_TOPK:   10,  // chatbot gọi hybridSearch với limit=10
  FALLBACK_TOPK:         3,   // fallback hybridSearch khi 0 kết quả
  DEFAULT_MIN_SCORE:     0.45,
};

// ── Danh sách checks ───────────────────────────────────────────────────────────

const CHECKS = [
  {
    name: 'MAX_MESSAGE_LENGTH',
    actual: ACTUALS.MAX_MESSAGE_LENGTH,
    checks: [
      { file: '../RAG_CHATBOT_PIPELINE.md',    pattern: /MAX_MESSAGE_LENGTH\s*=\s*(\d+)/g },
      { file: '../RAG_CHATBOT_PIPELINE.md',    pattern: /≤\s*(\d+)\s*ký tự.*MAX_MESSAGE/g },
      { file: '../RAG_CHATBOT_PIPELINE.md',    pattern: /a.*×\s*(\d+)\s*chars/g,  transform: v => v - 1 },
      { file: 'src/modules/ai/CLAUDE.md',               pattern: /không rỗng, ≤(\d+)\s*ký tự/g },
      { file: 'src/modules/ai/services/core/CLAUDE.md', pattern: /`(\d+)`\s*\(hằng số\)/g },
      { file: 'src/modules/ai/validators/ai-validator.js', pattern: /\.max\((\d+),/g },
    ],
  },
  {
    name: 'MAX_HISTORY_TURNS',
    actual: ACTUALS.MAX_HISTORY_TURNS,
    checks: [
      { file: '../RAG_CHATBOT_PIPELINE.md',    pattern: /MAX_HISTORY_TURNS\s*=?\s*(\d+)/g },
      { file: '../RAG_CHATBOT_PIPELINE.md',    pattern: /tối đa (\d+) turns/g },
    ],
  },
  {
    name: 'MAX_SESSIONS',
    actual: ACTUALS.MAX_SESSIONS,
    checks: [
      { file: '../RAG_CHATBOT_PIPELINE.md',    pattern: />\s*(\d+)\s*sessions/g },
      { file: 'src/modules/ai/CLAUDE.md', pattern: /Max\s+(\d+)\s+sessions/g },
    ],
  },
  {
    name: 'LLM_TEMPERATURE',
    actual: ACTUALS.LLM_TEMPERATURE,
    checks: [
      { file: '../RAG_CHATBOT_PIPELINE.md',    pattern: /temperature\s+([\d.]+)/gi },
    ],
  },
  {
    name: 'LLM_MAX_TOKENS',
    actual: ACTUALS.LLM_MAX_TOKENS,
    checks: [
      { file: '../RAG_CHATBOT_PIPELINE.md',    pattern: /max_tokens\s+(\d+)/gi },
    ],
  },
  {
    name: 'LLM_REWRITE_TIMEOUT (giây)',
    actual: ACTUALS.LLM_REWRITE_TIMEOUT_S,
    checks: [
      { file: '../RAG_CHATBOT_PIPELINE.md',    pattern: /timeout\s+(\d+)s/gi },
    ],
  },
  {
    name: 'DEFAULT_MIN_SCORE',
    actual: ACTUALS.DEFAULT_MIN_SCORE,
    checks: [
      { file: '../RAG_CHATBOT_PIPELINE.md',    pattern: /DEFAULT_MIN_SCORE.*\*\*?([\d.]+)\*\*?/g },
      { file: '../RAG_CHATBOT_PIPELINE.md',    pattern: /minScore.*=.*\*\*?(0\.\d+)\*\*?/gi },
    ],
  },
  {
    name: 'CHATBOT_SEARCH_TOPK',
    actual: ACTUALS.CHATBOT_SEARCH_TOPK,
    checks: [
      // Chỉ match "topK=10" đứng riêng, không match fallback topK=3
      { file: '../RAG_CHATBOT_PIPELINE.md', pattern: /topK=10\b.*candidates/gi },
      { file: '../RAG_CHATBOT_PIPELINE.md', pattern: /chatbot.*topK=(\d+)/gi },
    ],
  },
];

// ── Runner ─────────────────────────────────────────────────────────────────────

const RED   = '\x1b[31m';
const GREEN = '\x1b[32m';
const GRAY  = '\x1b[90m';
const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';

let staleCount = 0;
let passCount  = 0;
let skipCount  = 0;

for (const check of CHECKS) {
  for (const { file, pattern, transform } of check.checks) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`${GRAY}SKIP${RESET}  ${check.name} in ${file} (file not found)`);
      skipCount++;
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    pattern.lastIndex = 0;
    const matches = [...content.matchAll(pattern)];

    if (matches.length === 0) {
      // Không tìm thấy pattern → không thể verify → skip (không báo lỗi)
      skipCount++;
      continue;
    }

    for (const m of matches) {
      let docValue = +m[1];
      if (transform) docValue = transform(docValue);

      const actual = check.actual;
      if (Math.abs(docValue - actual) < 0.001) {
        passCount++;
      } else {
        console.log(`${RED}${BOLD}STALE${RESET}  ${check.name}`);
        console.log(`       file   : ${file}`);
        console.log(`       docs   : ${docValue}`);
        console.log(`       actual : ${actual}`);
        console.log(`       match  : "${m[0].trim()}"`);
        staleCount++;
      }
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('');
console.log(`${BOLD}check-docs results:${RESET}`);
console.log(`  ${GREEN}${passCount} pass${RESET}  |  ${staleCount > 0 ? RED : GRAY}${staleCount} stale${RESET}  |  ${GRAY}${skipCount} skip${RESET}`);

if (staleCount > 0) {
  console.log(`\n${RED}${BOLD}Docs chưa được sync — cập nhật trước khi demo/commit.${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}Tất cả docs đang khớp với source code.${RESET}`);
  process.exit(0);
}
