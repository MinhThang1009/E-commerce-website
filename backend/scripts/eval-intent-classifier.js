/**
 * @file eval-intent-classifier.js
 * @description Eval gate cho nâng cấp intent classification (2026-06):
 *   so accuracy REGEX (classifyIntent) vs PIPELINE 2 TẦNG (embedding primary + regex fallback)
 *   trên bộ labeled queries scripts/eval-intent-dataset.json.
 *
 * GATE: chỉ bật INTENT_CLASSIFIER=embedding làm mặc định khi pipeline ≥ regex
 * trên TỪNG intent (không chỉ tổng). Intent nào thua → thêm examples/chỉnh
 * INTENT_THRESHOLDS cho intent đó rồi chạy lại.
 *
 * Cần JINA_API_KEY hoặc HF_API_KEY (embedding thật). Example embeddings được
 * cache ở data/intent-example-embeddings.json — chạy lại không tốn call init.
 *
 * Usage:  node scripts/eval-intent-classifier.js [--verbose]
 * Exit:   0 = gate PASS, 1 = gate FAIL, 2 = không chạy được (thiếu API key...)
 */
require('dotenv').config();
require('module-alias/register');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { expandAbbreviations, classifyIntent } = require('@modules/ai/services/core/ai-policy');
const classifier = require('@modules/ai/services/chatbot/intent/embedding-intent-classifier');
const unifiedEmbedding = require('@services/embedding/unified-embedding');
const dataset = require('./eval-intent-dataset.json');

const VERBOSE = process.argv.includes('--verbose');
const INTENTS = ['product_search', 'pricing', 'order_inquiry', 'policy', 'general', 'off_topic'];

// Flatten groups[intent] → [{id, query, expected}] (nhãn = key nhóm)
const CASES = INTENTS.flatMap((intent) =>
  (dataset.groups[intent] || []).map((c) => ({ ...c, expected: intent })),
);

// Cache embedding của query xuống đĩa — vòng calibrate (chỉnh examples/threshold rồi
// chạy lại) không tốn lại 173 API calls. Key theo salt provider.
// PIN vào provider primary (không fallback): bài học run 2 — Jina timeout giữa run,
// vector e5 lọt vào cache trong khi examples là Jina → score rác toàn bộ.
const QUERY_CACHE_PATH = path.join(__dirname, '..', 'data', 'eval-query-embeddings.json');
let queryCache = {};
try {
  queryCache = JSON.parse(fs.readFileSync(QUERY_CACHE_PATH, 'utf8'));
} catch {
  /* cache miss */
}
async function embedQueryCached(unifiedEmbedding, text, salt) {
  const key = crypto
    .createHash('sha256')
    .update(salt + '|' + text)
    .digest('hex');
  if (queryCache[key]) return queryCache[key];
  const { vector } = await unifiedEmbedding.generateEmbeddingWithMeta(text, 'query', {
    pin: unifiedEmbedding.activeName,
  });
  queryCache[key] = vector;
  return vector;
}

function pct(hit, total) {
  return total === 0 ? '—' : `${((hit / total) * 100).toFixed(0)}% (${hit}/${total})`;
}

async function main() {
  if (!unifiedEmbedding.isAvailable()) {
    console.error('✗ Thiếu JINA_API_KEY/HF_API_KEY — không thể eval embedding classifier.');
    process.exit(2);
  }
  // Salt = tên provider primary — đồng bộ với runtime (chatbot-service cũng salt theo
  // activeName) để cache examples dùng chung được giữa eval và server
  const providerFingerprint = unifiedEmbedding.activeName;

  console.log(`Embedding examples bằng [${providerFingerprint}] (cache hit nếu đã chạy trước)...`);
  await classifier.initialize(
    async (t) =>
      (await unifiedEmbedding.generateEmbeddingWithMeta(t, 'query', { pin: providerFingerprint }))
        .vector,
    { cacheSalt: providerFingerprint, provider: providerFingerprint, cache: true },
  );

  const stats = {};
  for (const intent of INTENTS) stats[intent] = { total: 0, regexHit: 0, pipelineHit: 0 };
  const mismatches = [];

  for (const c of CASES) {
    const normalized = expandAbbreviations(c.query);
    const regexIntent = classifyIntent(normalized);

    // Pipeline 2 tầng giống production (_classifyIntent): embedding → threshold → fallback regex
    let pipelineIntent = regexIntent;
    let score = null;
    try {
      const vector = await embedQueryCached(unifiedEmbedding, normalized, providerFingerprint);
      const result = classifier.classifyWithScore(vector);
      if (result) {
        score = result.score;
        const threshold =
          classifier.INTENT_THRESHOLDS[result.intent] ?? classifier.SIMILARITY_THRESHOLD;
        if (result.score >= threshold) pipelineIntent = result.intent;
      }
    } catch (err) {
      console.error(`  ⚠ embed fail cho "${c.query}": ${err.message} → dùng regex`);
    }

    const s = stats[c.expected];
    s.total++;
    if (regexIntent === c.expected) s.regexHit++;
    if (pipelineIntent === c.expected) s.pipelineHit++;
    if (pipelineIntent !== c.expected || regexIntent !== c.expected) {
      mismatches.push({ ...c, regexIntent, pipelineIntent, score });
    }
    if (VERBOSE) {
      const mark = pipelineIntent === c.expected ? '✓' : '✗';
      console.log(
        `${mark} [${c.id}] "${c.query}" → expected=${c.expected} regex=${regexIntent} pipeline=${pipelineIntent}${score != null ? ` (score=${score.toFixed(3)})` : ''}`,
      );
    }
  }

  // Lưu cache query embeddings cho vòng calibrate sau
  try {
    fs.mkdirSync(path.dirname(QUERY_CACHE_PATH), { recursive: true });
    fs.writeFileSync(QUERY_CACHE_PATH, JSON.stringify(queryCache), 'utf8');
  } catch {
    /* cache là tối ưu, bỏ qua lỗi ghi */
  }

  console.log('\n══ Accuracy per-intent ═══════════════════════════════════');
  console.log('Intent           | Regex          | Pipeline (2 tầng)');
  console.log('-----------------|----------------|------------------');
  let gatePass = true;
  let totalAll = 0,
    regexAll = 0,
    pipelineAll = 0;
  for (const intent of INTENTS) {
    const s = stats[intent];
    totalAll += s.total;
    regexAll += s.regexHit;
    pipelineAll += s.pipelineHit;
    const verdict = s.pipelineHit >= s.regexHit ? '' : '  ← THUA regex (gate fail)';
    if (s.pipelineHit < s.regexHit) gatePass = false;
    console.log(
      `${intent.padEnd(16)} | ${pct(s.regexHit, s.total).padEnd(14)} | ${pct(s.pipelineHit, s.total)}${verdict}`,
    );
  }
  console.log('-----------------|----------------|------------------');
  console.log(
    `${'TỔNG'.padEnd(16)} | ${pct(regexAll, totalAll).padEnd(14)} | ${pct(pipelineAll, totalAll)}`,
  );

  if (mismatches.length > 0) {
    console.log('\n══ Mismatches (pipeline sai hoặc regex sai) ══════════════');
    for (const m of mismatches) {
      console.log(
        `[${m.id}] "${m.query}"\n   expected=${m.expected}  regex=${m.regexIntent}  pipeline=${m.pipelineIntent}${m.score != null ? `  embScore=${m.score.toFixed(3)}` : ''}`,
      );
    }
  }

  console.log(
    gatePass
      ? '\n✓ GATE PASS — pipeline ≥ regex trên mọi intent. Có thể bật INTENT_CLASSIFIER=embedding mặc định.'
      : '\n✗ GATE FAIL — chỉnh INTENT_EXAMPLES/INTENT_THRESHOLDS cho intent thua rồi chạy lại.',
  );
  process.exit(gatePass ? 0 : 1);
}

main().catch((err) => {
  console.error('✗ Eval lỗi:', err.message);
  process.exit(2);
});
