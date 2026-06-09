/**
 * demo-rag-pipeline.js — Demo toàn bộ 7 bước RAG Pipeline cho hội đồng.
 *
 * Chạy:
 *   node scripts/demo-rag-pipeline.js "ip17pm vs oppo reno15 5g"
 *   node scripts/demo-rag-pipeline.js "laptop tầm 20 triệu" --down   (chỉ LLM DOWN)
 *   node scripts/demo-rag-pipeline.js "ip17 giá bao nhiêu"  --up     (chỉ LLM UP)
 *   node scripts/demo-rag-pipeline.js "ip17 giá bao nhiêu"  --both   (mặc định)
 *
 * Không cần web UI. Kết nối trực tiếp với DB + vector store + LLM.
 */
require('dotenv').config();
// Ẩn log INFO/DEBUG của server khi load module — chỉ giữ ERROR nếu có vấn đề
process.env.LOG_LEVEL = 'error';
require('module-alias/register');

const { validateMessage, expandAbbreviations, classifyIntent, isPromptInjection } = require('@modules/ai/services/core/ai-policy');
const vectorStoreService = require('@services/vector-store/vector-store');

// ── Helpers hiển thị ─────────────────────────────────────────────────────────

const args   = process.argv.slice(2);

// Tắt màu khi output không phải terminal (redirect, pipe, CI)
const USE_COLOR = process.stdout.isTTY && !args.includes('--no-color');
const C = USE_COLOR ? {
  reset: '\x1b[0m',  bold: '\x1b[1m',  dim: '\x1b[2m',
  cyan:  '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m',
  red:   '\x1b[31m', gray:  '\x1b[90m', blue:   '\x1b[94m', magenta: '\x1b[35m',
  white: '\x1b[97m', teal:  '\x1b[96m', // bright cyan cho header
} : Object.fromEntries(['reset','bold','dim','cyan','green','yellow','red','gray','blue','magenta','white','teal'].map(k=>[k,'']));

const W = Math.min(Math.max(process.stdout.columns || 80, 70), 110); // tự adapt theo terminal, giới hạn 70-110

const divider   = (ch='-') => C.gray + ch.repeat(W) + C.reset;
const dividerHi = (ch='=') => C.blue + C.bold + ch.repeat(W) + C.reset;

/** Header bước: [n/7]  Bước N: TÊN BƯỚC */
const step = (n, label) => {
  const tag   = `[${n}/7]`;
  const title = `  Bước ${n}: ${label}`;
  const pad   = W - tag.length - title.length;
  return `\n${divider()}\n${C.bold}${C.white}${tag}${C.reset}${C.bold}${title}${' '.repeat(Math.max(0, pad))}${C.reset}\n${divider()}`;
};

/** Box nội dung cho sub-path */
const box = (title, lines, color = C.cyan) => {
  const inner = W - 4;
  const top   = `${color}${C.bold}+-- ${title} ${'-'.repeat(Math.max(0, inner - title.length))}+${C.reset}`;
  const mid   = lines.map(l => `${color}|${C.reset}  ${l}`);
  const bot   = `${color}+${'-'.repeat(W - 2)}+${C.reset}`;
  return [top, ...mid, bot].join('\n');
};

/** Key-value row — cột key cố định 22 ký tự */
const kv = (k, v) =>
  `  ${C.dim}${k.padEnd(22)}${C.reset}${v}`;

/** Status icons */
const ok   = (msg) => `  ${C.green}✅  ${C.reset}${msg}`;
const warn = (msg) => `  ${C.yellow}⚠️  ${C.reset}${msg}`;
const fail = (msg) => `  ${C.red}❌  ${C.reset}${msg}`;
const sub  = (msg) => `  ${C.gray}  ->  ${C.reset}${msg}`;
const item = (i, msg) => `       ${C.gray}${String(i).padStart(2)}.${C.reset} ${msg}`;

function fmtPrice(p) {
  return p ? Number(p).toLocaleString('vi-VN') + ' đ' : 'N/A';
}
function fmtScore(s) {
  return s != null ? s.toFixed(4) : '?';
}

// ── Args ─────────────────────────────────────────────────────────────────────

const query      = args.find(a => !a.startsWith('--')) || 'ip17 pro giá bao nhiêu';
const modeArg    = args.find(a => a.startsWith('--') && !a.startsWith('--session-id') && a !== '--watch' && a !== '--compact')?.replace('--', '') || 'both';
const sessionArg = args.find(a => a.startsWith('--session-id='))?.split('=')[1] || null;
const watchMode  = args.includes('--watch');
const compact    = args.includes('--compact');

// ── Main ─────────────────────────────────────────────────────────────────────

async function runPipeline(query, llmMode, providedSessionId = null) {
  const isUp    = llmMode === 'up';
  const tStart  = Date.now(); // ⏱ đo tổng thời gian pipeline

  // Build providers giống chatbot-service.js constructor
  const axios   = require('axios');
  const baseUrl = process.env.LLM_BASE_URL;
  const demoProviders = [];
  if (process.env.LLM_API_KEY && baseUrl) {
    demoProviders.push({ key: process.env.LLM_API_KEY, url: `${baseUrl}/chat/completions`, model: process.env.LLM_MODEL_1 });
  }
  if (process.env.LLM_MODEL_2) {
    demoProviders.push({
      key: process.env.LLM_API_KEY_2 || process.env.LLM_API_KEY,
      url: `${process.env.LLM_BASE_URL_2 || baseUrl}/chat/completions`,
      model: process.env.LLM_MODEL_2,
    });
  }
  if (process.env.LLM_MODEL_3) {
    demoProviders.push({
      key: process.env.LLM_API_KEY_3 || process.env.LLM_API_KEY,
      url: `${process.env.LLM_BASE_URL_3 || baseUrl}/chat/completions`,
      model: process.env.LLM_MODEL_3,
    });
  }
  const modeTag = isUp
    ? `${C.bold}${C.green}[ LLM UP  ]${C.reset}`
    : `${C.bold}${C.yellow}[ LLM DOWN ]${C.reset}`;

  const formatTag = compact
    ? `${C.dim}[compact]${C.reset}`
    : `${C.dim}[detailed]${C.reset}`;
  console.log('\n' + dividerHi('='));
  console.log(`${C.bold}  RAG PIPELINE DEMO  |  Mode: ${modeTag}  ${formatTag}${C.reset}`);
  console.log(dividerHi('='));
  console.log(kv('Query đầu vào:', `"${query}"`));

  // ── BƯỚC 1/7: VALIDATE ──────────────────────────────────────────────────────
  console.log(step(1, 'Validate Message'));
  const v = validateMessage(query);
  if (!v.valid) {
    // v.reason là i18n key (vd: 'ai.messageEmpty') — resolve để hiển thị VN text
    const { t: tDemo } = require('@utils/i18n');
    const reasonText = tDemo(v.reason, 'vi') || v.reason;
    console.log(fail(`Không hợp lệ: ${reasonText}`));
    console.log(sub('Pipeline dừng → trả HTTP 400 cho client'));
    return;
  }
  console.log(ok(`Hợp lệ`));
  console.log(kv('  Độ dài:', `${query.length} ký tự  (giới hạn: 500)`));
  console.log(kv('  Có ký tự hợp lệ:', 'Có (chữ cái / chữ số Unicode)'));

  // ── BƯỚC 2/7: EXPAND ABBREVIATIONS ──────────────────────────────────────────
  console.log(step(2, 'Expand Abbreviations  (Normalize)'));
  const normalized = expandAbbreviations(query);
  const changed = normalized !== query;
  if (changed) {
    console.log(ok('Phát hiện và mở rộng viết tắt'));
    console.log(kv('  Trước:', `"${query}"`));
    console.log(kv('  Sau:', `"${normalized}"`));
    // Chỉ hiện Trước/Sau — đủ để hội đồng thấy normalize hoạt động
  } else {
    console.log(sub('Không có viết tắt cần mở rộng — giữ nguyên query'));
  }

  // ── BƯỚC 3/7: CLASSIFY INTENT + SECURITY GATES ──────────────────────────────
  console.log(step(3, 'Classify Intent  +  Security Gates'));
  const intent    = classifyIntent(normalized);
  const injection = isPromptInjection(query);
  const offTopic  = intent === 'off_topic';

  console.log(kv('  Intent phân loại:', `${C.cyan}${C.bold}${intent}${C.reset}`));
  console.log(kv('  Prompt injection:', injection
    ? `${C.red}${C.bold}PHÁT HIỆN  ->  BLOCK${C.reset}`
    : `${C.green}Không phát hiện${C.reset}`));
  console.log(kv('  Off-topic check:', offTopic
    ? `${C.yellow}${C.bold}NGOÀI PHẠM VI  ->  BLOCK${C.reset}`
    : `${C.green}Trong phạm vi${C.reset}`));

  if (injection) {
    console.log(warn('Prompt injection → trả về phản hồi bảo vệ, kết thúc pipeline'));
    return;
  }
  if (offTopic) {
    console.log(warn('Off-topic → trả về thông báo phạm vi hỗ trợ, kết thúc pipeline'));
    return;
  }
  console.log(ok(`Đạt tất cả security gates  ->  tiếp tục vào RAG pipeline`));

  // ── BƯỚC 4/7: SESSION HISTORY ────────────────────────────────────────────────
  console.log(step(4, 'Load Session History'));
  const sessionId = providedSessionId || 'demo-' + Date.now();
  console.log(kv('  Session ID:', sessionId));

  // Fetch history thật từ server nếu có providedSessionId
  let conversationHistory = [];
  if (providedSessionId) {
    try {
      const histRes = await new Promise((resolve) => {
        const http = require('http');
        http.get(`http://localhost:8888/api/chatbot/session/${providedSessionId}/messages`, (r) => {
          let raw = '';
          r.on('data', d => raw += d);
          r.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
        }).on('error', () => resolve(null));
      });
      const dbMessages = histRes?.data?.messages || [];
      if (dbMessages.length > 0) {
        // Convert DB format → conversationHistory format cho pipeline
        conversationHistory = dbMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })).slice(-20); // MAX_HISTORY_TURNS * 2 = 10 * 2 (chatbot-service.js:304)
        const turns = Math.floor(conversationHistory.length / 2);
        console.log(kv('  Trạng thái:', `${C.green}Có lịch sử từ DB${C.reset}`));
        console.log(kv('  conversationHistory:', `${turns} turns  (${conversationHistory.length} messages)`));
        conversationHistory.slice(-4).forEach((m) => {
          const preview = (m.content || '').replace(/\n/g, ' ').substring(0, 60);
          console.log(`  ${C.gray}  ${m.role.padEnd(9)}${C.reset} "${preview}${preview.length >= 60 ? '...' : ''}"`);
        });
      } else {
        console.log(kv('  Trạng thái:', 'Session chưa có lịch sử'));
        console.log(kv('  conversationHistory:', '[]  (0 turns)'));
      }
    } catch {
      console.log(kv('  Trạng thái:', 'Session mới  (server không phản hồi)'));
      console.log(kv('  conversationHistory:', '[]  (0 turns)'));
    }
  } else {
    console.log(kv('  Trạng thái:', 'Session mới  (chưa có lịch sử)'));
    console.log(kv('  conversationHistory:', '[]  (0 turns)'));
  }
  console.log(sub('Lưu trong Map RAM  |  Tối đa 500 sessions  |  TTL 30 phút'));

  // ── BƯỚC 5a/5 ───────────────────────────────────────────────────────────────
  if (compact) {
    console.log(step(5, 'Enrich Query  +  Retrieve Products'));
  } else {
    console.log(step('5a', 'Enrich Query From History'));
  }

  const PRONOUN_RE = /(?:^|\s)[\p{L}\p{N}]*(?:đó|này|kia)(?=[\s,?.!]|$)|(?:^|\s)nó(?=[\s,?.!]|$)|so sánh|cả hai|2 cái|hai cái/iu;
  const BRAND_RE = /iphone|samsung|macbook|xiaomi|oppo|realme|apple|dell|asus|acer|casio|citizen|laptop|tablet|điện thoại|đồng hồ|máy tính|smartwatch|earphone|headphone|airpod/i;
  const hasBrand = BRAND_RE.test(normalized);
  const hasPronoun = PRONOUN_RE.test(normalized) && !hasBrand;
  const isImplicitFollowup = !hasPronoun && normalized.trim().length <= 50 && !hasBrand;
  const needsEnrich = hasPronoun || isImplicitFollowup;

  console.log(kv('  Đại từ chỉ định:', hasPronoun
    ? `${C.yellow}Có  ->  cần append context từ history${C.reset}`
    : isImplicitFollowup
      ? `${C.yellow}Implicit follow-up (query ngắn, không có brand)  ->  enrich${C.reset}`
      : `${C.green}Không  ->  giữ nguyên query${C.reset}`));

  // _enrichQueryFromHistory: replicate logic từ chatbot-service.js:362-405
  let enrichedQuery = normalized;
  if (needsEnrich && conversationHistory.length > 0) {
    const extractTopProduct = (text) => {
      if (text.startsWith('🚫') || /Cửa hàng hiện chưa có|không tìm thấy|ngoài phạm vi/i.test(text.substring(0, 80))) return null;
      // Nhận diện cả bullet "•" (keyword fallback) lẫn gạch đầu dòng "- " (LLM thật).
      // Không tìm được dòng SP → null (không enrich), tránh nhồi câu dẫn rác vào query.
      const firstItem = text.split('\n').find(l => /^\s*[•-]\s/.test(l));
      if (!firstItem) return null;
      return firstItem
        .replace(/^\s*[•-]\s*/, '')
        .replace(/\s*[-:]\s*(?:giá|từ)?\s*[\d.,]+.*$/i, '')
        .replace(/:\s.*$/, '')
        .trim();
    };
    const recentContext = conversationHistory
      .filter(m => m.role === 'assistant')
      .slice(-2)
      .map(m => extractTopProduct(m.content))
      .filter(Boolean)
      .join(' ');
    if (recentContext.trim()) {
      enrichedQuery = `${normalized} ${recentContext}`;
      console.log(sub(`_enrichQueryFromHistory: append "${recentContext.substring(0, 50)}"`));
    } else {
      console.log(sub('History có nhưng không trích được tên SP → giữ nguyên'));
    }
  } else if (needsEnrich) {
    console.log(sub('History rỗng -> không có tên SP để append'));
  }
  console.log(kv('  Enriched query:', `"${enrichedQuery}"`));
  console.log('');

  // ── BƯỚC 5b (chỉ hiện khi không compact) ────────────────────────────────────
  if (!compact) console.log(step('5b', 'Retrieve Products  (Hybrid Search)'));

  // stripNegation CHỈ cho embedding (hybridSearch). rewriteQuery + finalQuery (LLM) giữ phủ định.
  const stripNeg = (q) => q
    .replace(/(?:không\s+(?:cần|muốn|thích|dùng|phải|có)|tránh|avoid|don't\s+want)\s+[\p{L}\p{N}\s,/]+?(?=[\s,]+(?:gì|hay|hoặc|được|cũng|mà|nhưng|tầm|dưới|trên|khoảng|giá|pin|màn|nhẹ|mỏng|ram|cpu|chip|mới|tốt|rẻ|đắt|bền|under|about|around|with|for)\b|\s*$)/igu, ' ')
    .trim() || q;
  const queryForRetrieval = stripNeg(enrichedQuery);

  if (queryForRetrieval !== enrichedQuery) {
    console.log(warn('Strip mệnh đề phủ định trước khi embedding (chỉ embedding, LLM giữ gốc):'));
    console.log(kv('  Trước:', `"${enrichedQuery}"`));
    console.log(kv('  Sau:', `"${queryForRetrieval}"`));
  } else {
    console.log(kv('  Strip negation:', 'Không có mệnh đề phủ định'));
  }

  console.log('');
  console.log(`  ${C.dim}Cách tính Score  (DEFAULT_MIN_SCORE=0.45 • OVERLAP_BOOST=0.05 • KEYWORD_INJECTION_MAX_BOOST=0.05):${C.reset}`);
  console.log(`  ${C.dim}  • Conf=ok  (vector match):  score = cosine + OVERLAP_BOOST (nếu trùng cả từ khóa)${C.reset}`);
  console.log(`  ${C.dim}  • Conf=low (keyword-only):  score = DEFAULT_MIN_SCORE + (kwScore / maxKwScore) × KEYWORD_INJECTION_MAX_BOOST${C.reset}`);
  console.log('');
  console.log(sub('Promise.all( rewriteQuery(LLM)  ||  hybridSearch(topK=10) )'));

  // rewriteQuery — thử từng provider (chatbot-service.js:437-440)
  let llmRewrite = null;
  if (isUp && demoProviders.length > 0) {
    for (let pi = 0; pi < demoProviders.length; pi++) {
      const p = demoProviders[pi];
      try {
        const tRw = Date.now();
        const rwRes = await axios.post(p.url, {
          model: p.model,
          messages: [
            { role: 'system', content: 'You are a query normalizer for a tech store. Expand abbreviations and fix typos in the user\'s shopping query. Return ONLY 1 line of normalized text in the SAME language as input, NO explanation. Examples: "ip17 pro bnh" → "iPhone 17 Pro bao nhiêu", "ss s25 how much" → "Samsung S25 how much".' },
            { role: 'user', content: enrichedQuery },
          ],
          max_tokens: 80, temperature: 0,
        }, { headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' }, timeout: Number(process.env.LLM_REWRITE_TIMEOUT_MS) || 8000 });
        const rw = rwRes.data.choices?.[0]?.message?.content?.trim();
        // Tầng A — rewriteQuery (chatbot-service.js:634): so với INPUT (enrichedQuery GỐC,
        // có phủ định) case-SENSITIVE. Nếu LLM trả y hệt input → coi như "no change" → null.
        if (rw && rw !== enrichedQuery) llmRewrite = rw;
        console.log(kv('  rewriteQuery:', llmRewrite
          ? `${C.green}"${llmRewrite}"${C.reset}  ${C.gray}(${p.model})  ⏱ ${Date.now() - tRw}ms${C.reset}`
          : `${C.dim}[no change]${C.reset}  ${C.gray}(${p.model})  ⏱ ${Date.now() - tRw}ms${C.reset}`));
        break;
      } catch (e) {
        const tag = `provider ${pi + 1}/${demoProviders.length} (${p.model})`;
        if (pi + 1 < demoProviders.length)
          console.log(kv('  rewriteQuery:', `${C.yellow}[lỗi ${tag}] → thử tiếp${C.reset}`));
        else
          console.log(kv('  rewriteQuery:', `${C.yellow}[tất cả providers lỗi] → dùng query gốc${C.reset}`));
      }
    }
  } else if (isUp) {
    console.log(kv('  rewriteQuery:', `${C.yellow}[SKIP] Chưa cấu hình LLM_MODEL_1 / 2 / 3${C.reset}`));
  } else {
    // LLM DOWN: rewriteQuery dùng fuzzyExpandQuery (prefix + edit-distance vs catalog)
    // thay vì gọi LLM — mirror chatbot-service.js:590-601 (providers.length === 0).
    const { fuzzyExpandQuery } = require('@modules/ai/services/chatbot/query/fuzzy-expander');
    await vectorStoreService.loadPromise;
    const productNames = vectorStoreService.items.map(i => i.metadata?.name).filter(Boolean);
    const { expanded, changed } = fuzzyExpandQuery(enrichedQuery, productNames);
    if (changed) {
      llmRewrite = expanded;
      console.log(kv('  rewriteQuery:', `${C.green}"${expanded}"${C.reset}  ${C.gray}(fuzzyExpand: prefix + edit-distance, không gọi LLM)${C.reset}`));
    } else {
      console.log(kv('  rewriteQuery:', `${C.dim}[fuzzyExpand: no change]${C.reset}  ${C.gray}(LLM DOWN — không sửa được qua catalog)${C.reset}`));
    }
  }
  console.log(kv('  hybridSearch lần 1:', `query: "${queryForRetrieval}"  |  semantic (cosine) + keyword (BM25)  |  topK=10`));

  // hybridSearch lần 1 (chatbot-service.js:439)
  const t0 = Date.now();
  await vectorStoreService.loadPromise;
  const initialResults = await vectorStoreService.hybridSearch(queryForRetrieval, 10);
  const t1 = Date.now();

  console.log(ok(`hybridSearch lần 1 hoàn thành  ->  ${initialResults.length} kết quả  ${C.gray}⏱ ${t1 - t0}ms${C.reset}`));
  console.log('');
  console.log(`  ${C.bold}${C.dim}  #   ${'Tên sản phẩm'.padEnd(42)}  Score   Conf${C.reset}`);
  console.log(`  ${C.gray}  ${'-'.repeat(60)}${C.reset}`);
  if (initialResults.length === 0) {
    console.log(`  ${C.dim}  (không có sản phẩm nào vượt ngưỡng 0.45 — query gốc có thể lỗi chính tả; chờ lần 2 rewrite)${C.reset}`);
  }
  initialResults.forEach((r, i) => {
    const name  = (r.metadata?.name || '?').substring(0, 42).padEnd(42);
    const score = fmtScore(r.score);
    const conf  = r.lowConfidence ? `${C.yellow}low${C.reset}` : `${C.green}ok ${C.reset}`;
    console.log(`  ${C.gray}${String(i+1).padStart(3)}.${C.reset} ${name}  ${C.cyan}${score}${C.reset}  ${conf}`);
  });

  // hybridSearch lần 2 khi rewrite khác query (chatbot-service.js:513)
  // Tầng B — _retrieveProducts: chỉ lần 2 khi llmRewrite KHÁC normalizedQuery.
  // finalQuery (gửi LLM ở bước 6) = enrichedQuery GỐC khi không rewrite → giữ phủ định.
  let products;
  let finalQuery = enrichedQuery;
  if (llmRewrite && llmRewrite.toLowerCase() !== normalized.toLowerCase()) {
    finalQuery = llmRewrite;
    console.log('');
    console.log(sub(`rewriteQuery KHÁC query gốc ("${normalized}" → "${llmRewrite}") → chạy refined search (lần 2)`));
    console.log(sub('finalQuery (gửi LLM ở bước 6) = bản rewrite — GIỮ phủ định nếu có'));
    console.log(kv('  hybridSearch lần 2:', `query: "${stripNeg(llmRewrite)}"  (strip từ rewrite "${llmRewrite}")  |  topK=10`));
    const t2 = Date.now();
    const refinedResults = await vectorStoreService.hybridSearch(stripNeg(llmRewrite), 10);
    const useRefined = refinedResults.length > 0;
    console.log(ok(`hybridSearch lần 2 hoàn thành  ->  ${refinedResults.length} kết quả  ${C.gray}⏱ ${Date.now() - t2}ms${C.reset}`));
    if (refinedResults.length > 0) {
      console.log('');
      console.log(`  ${C.bold}${C.dim}  #   ${'Tên sản phẩm'.padEnd(42)}  Score   Conf${C.reset}`);
      console.log(`  ${C.gray}  ${'-'.repeat(60)}${C.reset}`);
      refinedResults.forEach((r, i) => {
        const name  = (r.metadata?.name || '?').substring(0, 42).padEnd(42);
        const score = fmtScore(r.score);
        const conf  = r.lowConfidence ? `${C.yellow}low${C.reset}` : `${C.green}ok ${C.reset}`;
        console.log(`  ${C.gray}${String(i+1).padStart(3)}.${C.reset} ${name}  ${C.cyan}${score}${C.reset}  ${conf}`);
      });
    }
    if (!useRefined) console.log(sub('Lần 2 rỗng → fallback dùng initialResults (lần 1)'));
    const results = useRefined ? refinedResults : initialResults;
    console.log('');
    console.log(sub(useRefined
      ? `Dùng kết quả lần 2 (rewrite) cho Generation  →  ${refinedResults.length} sản phẩm`
      : `Dùng kết quả lần 1 (query gốc) cho Generation  →  ${initialResults.length} sản phẩm`));
    products = results.map(r => ({ ...r.metadata, score: r.score, ...(r.lowConfidence && { lowConfidence: true }) }));
  } else {
    console.log('');
    console.log(sub(`rewriteQuery không đổi query → bỏ qua lần 2, dùng kết quả lần 1 cho Generation  →  ${initialResults.length} sản phẩm`));
    products = initialResults.map(r => ({ ...r.metadata, score: r.score, ...(r.lowConfidence && { lowConfidence: true }) }));
  }

  // K1 fallback khi 0 kết quả (chatbot-service.js:468-476)
  if (products.length === 0) {
    console.log(warn('0 kết quả trên threshold → hạ minScore=0, lấy top-3 (fallback)'));
    try {
      const t3 = Date.now();
      const lowResults = await vectorStoreService.hybridSearch(stripNeg(finalQuery), 3, 0);
      products = lowResults.map(r => ({ ...r.metadata, score: r.score, lowConfidence: true }));
      console.log(ok(`Fallback hoàn thành  ->  ${products.length} kết quả  ${C.gray}⏱ ${Date.now() - t3}ms${C.reset}`));
    } catch { products = []; }
  }

  // ── BƯỚC 6/7: GENERATION ─────────────────────────────────────────────────────
  console.log(step(6, `Generation`));

  let aiResponse;

  if (!isUp) {
    // LLM DOWN path
    const skipLines = compact
      ? [`${C.yellow}Không có LLM provider${C.reset}  ${C.gray}→ [SKIP] A-E: sanitize / buildPrompt / messages[] / HTTP POST / parseLLMOutput${C.reset}`, '']
      : [
          `${C.yellow}Không có LLM provider  ->  các sub-steps LLM bị SKIP:${C.reset}`,
          `  ${C.gray}[SKIP] A. _sanitizeMessage     (không cần khi không gọi LLM)${C.reset}`,
          `  ${C.gray}[SKIP] B. buildAugmentedPrompt (không cần khi không gọi LLM)${C.reset}`,
          `  ${C.gray}[SKIP] C. build messages[]     (không cần khi không gọi LLM)${C.reset}`,
          `  ${C.gray}[SKIP] D. LLM HTTP POST        (không có provider)${C.reset}`,
          `  ${C.gray}[SKIP] E. parseLLMOutput       (không có response để parse)${C.reset}`,
          '',
        ];
    console.log(box(`LLM DOWN  —  simpleKeywordMatch  (keyword fallback)`, [
      ...skipLines,
      `  ${C.yellow}-> Fallback: simpleKeywordMatch (8 bước nội bộ):${C.reset}`,
      `  1. Tokenize + scoring     name match +10  |  description match +5`,
      `  2. Version number filter  extract số model, loại SP sai phiên bản`,
      `  3. Brand coherence check  loại kết quả sai brand`,
      `  4. Negation filter        parse "không muốn/tránh X" -> loại`,
      `  5. Price range filter     tầm/dưới/trên X triệu -> filter theo giá`,
      `  6. Category prefix filter detect "laptop/điện thoại" -> filter loại SP`,
      `  7. Sort + dedup           sort by matchScore giảm dần, loại trùng`,
      `  8. Intent-aware response  pricing->💰  policy->📋  search->🔍  new->🌟`,
    ], C.yellow));

    const { simpleKeywordMatch } = require('@modules/ai/services/chatbot/keyword/keyword-fallback');
    console.log('');
    const tKw0 = Date.now();
    console.log(sub('Đang chạy simpleKeywordMatch...'));
    aiResponse = simpleKeywordMatch(finalQuery, products);
    console.log(ok(`Hoàn thành  ${C.gray}⏱ ${Date.now() - tKw0}ms${C.reset}`));

  } else {
    // LLM UP path
    const promptBuilder  = require('@modules/ai/services/chatbot/prompt/prompt-builder');
    const responseParser = require('@modules/ai/services/chatbot/prompt/response-parser');

    if (demoProviders.length === 0) {
      console.log(warn('Chưa cấu hình LLM_MODEL_1 / 2 / 3 → fallback simpleKeywordMatch'));
      const { simpleKeywordMatch } = require('@modules/ai/services/chatbot/keyword/keyword-fallback');
      aiResponse = simpleKeywordMatch(finalQuery, products);
    } else {
      const sanitized = finalQuery.replace(/"/g, "'").replace(/\n{2,}/g, '\n').trim().substring(0, 500);
      const augPrompt = promptBuilder.buildAugmentedPrompt(sanitized, products);
      const storeName = process.env.STORE_NAME || 'TechStore';

      // _getCatalogData: query DB trực tiếp (giống chatbot-service.js:604-608, không phụ thuộc server HTTP)
      let brandsStr = '', categoriesStr = '';
      try {
        const { Brand, Category } = require('../src/models');
        const [brands, cats] = await Promise.all([
          Brand.findAll({ attributes: ['nameVi', 'nameEn'], raw: true }),
          Category.findAll({ attributes: ['nameVi', 'nameEn'], raw: true }),
        ]);
        if (brands.length) brandsStr    = brands.map(b => b.nameVi || b.nameEn).filter(Boolean).join(', ');
        if (cats.length)   categoriesStr = cats.map(c => c.nameVi || c.nameEn).filter(Boolean).join(', ');
      } catch { /* fallback empty — giống real code khi DB lỗi */ }

      const systemContent = `Bạn là nhân viên tư vấn của ${storeName} — cửa hàng công nghệ chuyên điện thoại, máy tính bảng và laptop.
QUY TẮC BẮT BUỘC:
1. CHỈ tư vấn sản phẩm có trong DANH SÁCH SẢN PHẨM được cung cấp trong tin nhắn.
2. TUYỆT ĐỐI không bịa tên sản phẩm, giá, hoặc thông số kỹ thuật ngoài danh sách.
3. Nếu sản phẩm không có trong danh sách, nói rõ: "Cửa hàng hiện chưa có [tên sản phẩm] ạ."
4. Respond in the SAME language as the customer's message. If Vietnamese → reply Vietnamese (thân thiện: mình/em - bạn/anh/chị). If English → reply English (friendly tone).
5. Trả về đúng định dạng JSON được yêu cầu trong tin nhắn.
6. Danh mục: ${categoriesStr} — Thương hiệu: ${brandsStr}`;

      const messages  = [
        { role: 'system', content: systemContent },
        ...conversationHistory,
        { role: 'user', content: augPrompt },
      ];

      console.log(kv('  _getCatalogData:', brandsStr ? `brands: ${brandsStr.substring(0, 40)}` : `${C.dim}(empty — server không phản hồi)${C.reset}`));
      console.log(kv('  A. _sanitizeMessage(finalQuery):', `"${sanitized.substring(0, 55)}..."`));
      console.log(kv('  B. buildAugmentedPrompt:', `${augPrompt.length} ký tự  (${products.length} SP + store info)`));
      console.log(kv('  C. messages[]:', `[system(6 rules), ${conversationHistory.length} history, user+RAG_context]`));

      // Timeout per-call (axios mỗi provider) + ngân sách TỔNG (Promise.race quanh toàn bộ generation)
      // — mirror chatbot-service.js handleMessage:319-334. Env-configurable, fallback default.
      const LLM_REQUEST_TIMEOUT_MS = Number(process.env.LLM_REQUEST_TIMEOUT_MS) || 30000;
      const LLM_TOTAL_TIMEOUT_MS = Number(process.env.LLM_TOTAL_TIMEOUT_MS) || LLM_REQUEST_TIMEOUT_MS;
      const { simpleKeywordMatch } = require('@modules/ai/services/chatbot/keyword/keyword-fallback');
      console.log(kv('  Ngân sách tổng:', `LLM_TOTAL_TIMEOUT_MS=${LLM_TOTAL_TIMEOUT_MS}ms  (Promise.race bọc provider rotation)`));

      // Provider rotation loop tách thành hàm để Promise.race với budget timer
      const runGeneration = async () => {
        for (let pi = 0; pi < demoProviders.length; pi++) {
          const p = demoProviders[pi];
          console.log(kv('  D. LLM call:', `${p.model}  (provider ${pi + 1}/${demoProviders.length})  |  temp=0.3  |  max_tokens=800`));
          console.log(sub(`POST -> ${p.url}  (đang chờ...)`));
          const t2 = Date.now();
          try {
            const res = await axios.post(p.url,
              { model: p.model, messages, response_format: { type: 'json_object' }, temperature: 0.3, max_tokens: 800 },
              { headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' }, timeout: LLM_REQUEST_TIMEOUT_MS }
            );
            const raw = res.data.choices?.[0]?.message?.content || '';
            if (!raw) { console.log(warn(`Provider ${pi + 1} trả về rỗng → thử tiếp`)); continue; }
            console.log(ok(`Nhận phản hồi  (${Date.now() - t2}ms  |  ${raw.length} ký tự JSON)`));
            console.log(kv('  E. parseLLMOutput:', 'extractJSON -> map names -> dedup -> extractProductsFromText'));
            console.log(ok('Hoàn thành'));
            return responseParser.parseLLMOutput(raw, products, finalQuery);
          } catch (err) {
            const status = err.response?.status;
            // Lỗi tạm thời (429/402/500/503/network) → thử provider tiếp (chatbot-service.js:766-777)
            if (status === 429 || status === 402 || status === 500 || status === 503 || !err.response) {
              if (pi + 1 < demoProviders.length)
                console.log(warn(`Provider ${pi + 1} lỗi (${status || err.code}) → thử provider ${pi + 2}`));
              else
                console.log(warn(`Tất cả providers lỗi → fallback simpleKeywordMatch`));
              continue;
            }
            // Lỗi không phục hồi (400/401/khác) → break ngay (chatbot-service.js:779-785)
            console.log(warn(`Provider ${pi + 1} lỗi cố định (${status}) → dừng retry`));
            break;
          }
        }
        // Hết providers (lỗi hoặc 400/401 break) → fallback keyword
        return simpleKeywordMatch(finalQuery, products);
      };

      // Ngân sách tổng: generation vượt LLM_TOTAL_TIMEOUT_MS → fallback keyword (chống treo)
      let _budgetTimer;
      aiResponse = await Promise.race([
        runGeneration(),
        new Promise((resolve) => {
          _budgetTimer = setTimeout(() => {
            console.log(warn(`LLM vượt ngân sách ${LLM_TOTAL_TIMEOUT_MS}ms → fallback simpleKeywordMatch`));
            resolve(simpleKeywordMatch(finalQuery, products));
          }, LLM_TOTAL_TIMEOUT_MS);
        }),
      ]).finally(() => clearTimeout(_budgetTimer));
    }
  }

  // ── BƯỚC 7/7: PERSIST ────────────────────────────────────────────────────────
  console.log(step(7, 'Persist  —  Session Memory  +  Database'));
  console.log(kv('  7a. Session memory:', `updatedMessages = ${[...conversationHistory,{},{}].slice(-20).length} msgs  (giới hạn 20 = 10 turns)`));
  console.log(kv('     lastAccess:', new Date().toLocaleTimeString('vi-VN')));
  console.log(sub('_evictStaleSessions():  xóa TTL > 30 phút  +  LRU khi > 500 sessions'));
  console.log('');
  console.log(kv('  7b. DB persist:', 'ChatMessage.bulkCreate([userMsg, assistantMsg])  —  1 DB call'));
  console.log(sub('Fire-and-forget: .catch() chỉ log warning  ->  chatbot vẫn trả lời khi DB lỗi'));

  // ── KẾT QUẢ TRẢ VỀ ──────────────────────────────────────────────────────────
  const tTotal = Date.now() - tStart;
  console.log('\n' + dividerHi('-'));
  console.log(`${C.bold}  KẾT QUẢ TRẢ VỀ CHO FRONTEND  ${C.gray}⏱ tổng ${tTotal}ms${C.reset}`);
  console.log(dividerHi('-'));
  if (aiResponse) {
    console.log(kv('  intent:', `${C.cyan}${aiResponse.intent}${C.reset}`));
    console.log('');
    console.log(`  ${C.bold}Response đầy đủ:${C.reset}`);
    // Word-wrap tại 90 ký tự để không bị overflow terminal
    (aiResponse.response || '').split('\n').forEach(line => {
      if (line.length <= 90) { console.log(`    ${line}`); return; }
      const words = line.split(' ');
      let cur = '    ';
      for (const w of words) {
        if (cur.length + w.length > 94) { console.log(cur); cur = '    ' + w + ' '; }
        else cur += w + ' ';
      }
      if (cur.trim()) console.log(cur);
    });
    console.log('');
    console.log(kv('  products:', `${aiResponse.products?.length || 0} card(s)`));
    (aiResponse.products || []).forEach((p, i) =>
      console.log(item(i+1, `${C.bold}${p.name}${C.reset}  —  ${C.cyan}${fmtPrice(p.price)}${C.reset}`))
    );
    if (aiResponse.suggestions?.length) {
      // Mỗi suggestion trên 1 dòng, cắt ở 80 ký tự nếu quá dài
      // Mỗi suggestion 1 dòng — tránh wrap sai ký tự tiếng Việt
      aiResponse.suggestions.slice(0, 3).forEach((s, i) => {
        const label = i === 0 ? '  suggestions:' : '              ';
        const short = s.length > W - 18 ? s.substring(0, W - 21) + '...' : s;
        console.log(`  ${C.dim}${label.padEnd(20)}${C.reset}${C.gray}${i + 1}.${C.reset} ${short}`);
      });
    }
  }
  console.log(dividerHi('=') + '\n');
}

// ── Hiển thị trace từ server (dùng chung helpers với runPipeline) ────────────

function displayServerTrace(t, query, aiResponse = null) {
  const s5 = t.step5_retrieve;
  const s6 = t.step6_generate;

  // ── Header box (giống gốc) ───────────────────────────────────────────
  const hdrInner = W - 2;
  const centerLine = (text) => {
    const pad = hdrInner - text.length;
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return '|' + ' '.repeat(left) + text + ' '.repeat(right) + '|';
  };
  const hdrBorder = '+' + '='.repeat(hdrInner) + '+';
  console.log('\n' + C.bold + C.teal + hdrBorder);
  console.log(centerLine('TECHSTORE RAG CHATBOT  --  PIPELINE DEMO'));
  console.log(centerLine('Luận văn tốt nghiệp'));
  console.log(hdrBorder + C.reset);

  const isUp = (s6?.llmMode || 'up') === 'up';
  const modeStr = isUp ? 'up' : 'down';
  const modeTag = isUp
    ? `${C.bold}${C.green}[ LLM UP  ]${C.reset}`
    : `${C.bold}${C.yellow}[ LLM DOWN ]${C.reset}`;
  const formatTag = compact ? `${C.dim}[compact]${C.reset}` : `${C.dim}[detailed]${C.reset}`;

  console.log(`  Query:${' '.repeat(16)}"${query}"`);
  console.log(`  Mode:${' '.repeat(17)}${modeStr}`);

  console.log('\n' + dividerHi('='));
  console.log(`${C.bold}  RAG PIPELINE DEMO  |  Mode: ${modeTag}  ${formatTag}${C.reset}`);
  console.log(dividerHi('='));
  console.log(kv('Query đầu vào:', `"${query}"`));

  // ── Step 1: Validate ────────────────────────────────────────────────────
  console.log(step(1, 'Validate Message'));
  if (!t.step1_validate?.valid && t.step1_validate?.valid !== undefined) {
    console.log(fail(`Không hợp lệ`));
    console.log(sub('Pipeline dừng → trả HTTP 400 cho client'));
    return;
  }
  console.log(ok('Hợp lệ'));
  console.log(kv('  Độ dài:', `${t.step1_validate?.length || query.length} ký tự  (giới hạn: 500)`));
  console.log(kv('  Có ký tự hợp lệ:', 'Có (chữ cái / chữ số Unicode)'));

  // ── Step 2: Expand Abbreviations ────────────────────────────────────────
  console.log(step(2, 'Expand Abbreviations  (Normalize)'));
  if (t.step2_normalize?.changed) {
    console.log(ok('Phát hiện và mở rộng viết tắt'));
    console.log(kv('  Trước:', `"${t.step2_normalize.before}"`));
    console.log(kv('  Sau:', `"${t.step2_normalize.after}"`));
  } else {
    console.log(sub('Không có viết tắt cần mở rộng — giữ nguyên query'));
  }

  // ── Step 3: Classify Intent + Security Gates ────────────────────────────
  console.log(step(3, 'Classify Intent  +  Security Gates'));
  const s3 = t.step3_security;
  if (s3) {
    console.log(kv('  Intent phân loại:', `${C.cyan}${C.bold}${s3.intent}${C.reset}`));
    console.log(kv('  Prompt injection:', s3.injection
      ? `${C.red}${C.bold}PHÁT HIỆN  ->  BLOCK${C.reset}`
      : `${C.green}Không phát hiện${C.reset}`));
    console.log(kv('  Off-topic check:', s3.offTopic
      ? `${C.yellow}${C.bold}NGOÀI PHẠM VI  ->  BLOCK${C.reset}`
      : `${C.green}Trong phạm vi${C.reset}`));
  }
  if (t.blocked === 'injection') {
    console.log(warn('Prompt injection → trả về phản hồi bảo vệ, kết thúc pipeline'));
    return;
  }
  if (t.blocked === 'off_topic' || s3?.offTopic) {
    console.log(warn('Off-topic → trả về thông báo phạm vi hỗ trợ, kết thúc pipeline'));
    return;
  }
  console.log(ok('Đạt tất cả security gates  ->  tiếp tục vào RAG pipeline'));

  // ── Step 4: Load Session History ────────────────────────────────────────
  console.log(step(4, 'Load Session History'));
  const s4 = t.step4_history;
  if (s4) {
    console.log(kv('  Session ID:', s4.sessionId || 'N/A'));
    if (s4.turns > 0 && s4.messages?.length) {
      console.log(kv('  Trạng thái:', `${C.green}Có lịch sử từ DB${C.reset}`));
      console.log(kv('  conversationHistory:', `${s4.turns} turns  (${s4.messages.length} messages)`));
      s4.messages.forEach(m => {
        const preview = (m.content || '').replace(/\n/g, ' ').substring(0, 60);
        console.log(`  ${C.gray}  ${m.role.padEnd(9)}${C.reset} "${preview}${preview.length >= 60 ? '...' : ''}"`);
      });
    } else {
      console.log(kv('  Trạng thái:', 'Session chưa có lịch sử'));
      console.log(kv('  conversationHistory:', '[]  (0 turns)'));
    }
  }
  console.log(sub('Lưu trong Map RAM  |  Tối đa 500 sessions  |  TTL 30 phút'));

  if (!s5) return;

  // Step 5 skipped cho intent không cần search
  if (s5.skipped) {
    console.log(step(5, 'Retrieve  (SKIP)'));
    console.log(sub(s5.reason));
    console.log(sub('Không chạy Hybrid Search — chuyển thẳng sang Generation'));
    // Vẫn tiếp tục step 6, 7
  } else {

  // ── Step 5a: Enrich Query From History ──────────────────────────────────
  if (compact) {
    console.log(step(5, 'Enrich Query  +  Retrieve Products'));
  } else {
    console.log(step('5a', 'Enrich Query From History'));
  }

  const normalized = t.step2_normalize?.after || query;
  const enriched = s5.enrichedQuery || normalized;
  const enrichDiff = enriched !== normalized;

  // Dùng server trace nếu có, fallback tính local
  const enrich = t.step5_enrich || {};
  const hasPronoun = enrich.hasPronoun || false;
  const isImplicit = enrich.isImplicitFollowup || false;

  console.log(kv('  Đại từ chỉ định:', hasPronoun
    ? `${C.yellow}Có  ->  cần append context từ history${C.reset}`
    : isImplicit && s4?.turns > 0
      ? `${C.yellow}Implicit follow-up (query ngắn, không có brand)  ->  enrich${C.reset}`
      : `${C.green}Không  ->  giữ nguyên query${C.reset}`));

  if (enrichDiff) {
    const appended = enriched.replace(normalized, '').trim();
    if (appended) console.log(sub(`_enrichQueryFromHistory: append "${appended.substring(0, 50)}"`));
  } else if (isImplicit && s4?.turns > 0) {
    console.log(sub('History có nhưng không trích được tên SP → giữ nguyên'));
  }
  console.log(kv('  Enriched query:', `"${enriched}"`));
  console.log('');

  // ── Step 5b: Retrieve Products (Hybrid Search) ─────────────────────────
  if (!compact) console.log(step('5b', 'Retrieve Products  (Hybrid Search)'));

  // Strip negation
  const sn = s5.stripNegation;
  if (sn?.changed) {
    console.log(warn('Strip mệnh đề phủ định trước khi embedding (chỉ embedding, LLM giữ gốc):'));
    console.log(kv('  Trước:', `"${sn.before}"`));
    console.log(kv('  Sau:', `"${sn.after}"`));
  } else {
    console.log(kv('  Strip negation:', 'Không có mệnh đề phủ định'));
  }

  console.log('');
  console.log(`  ${C.dim}Cách tính Score  (DEFAULT_MIN_SCORE=0.45 • OVERLAP_BOOST=0.05 • KEYWORD_INJECTION_MAX_BOOST=0.05):${C.reset}`);
  console.log(`  ${C.dim}  • Conf=ok  (vector match):  score = cosine + OVERLAP_BOOST (nếu trùng cả từ khóa)${C.reset}`);
  console.log(`  ${C.dim}  • Conf=low (keyword-only):  score = DEFAULT_MIN_SCORE + (kwScore / maxKwScore) × KEYWORD_INJECTION_MAX_BOOST${C.reset}`);
  console.log('');
  console.log(sub('Promise.all( rewriteQuery(LLM)  ||  hybridSearch(topK=10) )'));

  // rewriteQuery
  const rw = s5.rewrite;
  if (rw) {
    const rwModel = s6?.providerAttempts?.[0]?.model || 'LLM';
    if (rw.result) {
      console.log(kv('  rewriteQuery:', `${C.green}"${rw.result}"${C.reset}  ${C.gray}(${rwModel})  ⏱ ${rw.timeMs}ms${C.reset}`));
    } else {
      console.log(kv('  rewriteQuery:', `${C.dim}[no change]${C.reset}  ${C.gray}(${rwModel})  ⏱ ${rw.timeMs}ms${C.reset}`));
    }
  }

  // hybridSearch lần 1
  const sr1 = s5.search1;
  if (sr1) {
    console.log(kv('  hybridSearch lần 1:', `query: "${sr1.query}"  |  semantic (cosine) + keyword (BM25)  |  topK=10`));
    console.log(ok(`hybridSearch lần 1 hoàn thành  ->  ${sr1.results.length} kết quả  ${C.gray}⏱ ${sr1.timeMs != null ? sr1.timeMs : s5.timeMs}ms${C.reset}`));
    console.log('');
    console.log(`  ${C.bold}${C.dim}  #   ${'Tên sản phẩm'.padEnd(42)}  Score   Conf${C.reset}`);
    console.log(`  ${C.gray}  ${'-'.repeat(60)}${C.reset}`);
    if (sr1.results.length === 0) {
      console.log(`  ${C.dim}  (không có sản phẩm nào vượt ngưỡng 0.45)${C.reset}`);
    }
    sr1.results.forEach((r, i) => {
      const name  = (r.name || '?').substring(0, 42).padEnd(42);
      const score = fmtScore(r.score);
      const conf  = r.lowConfidence ? `${C.yellow}low${C.reset}` : `${C.green}ok ${C.reset}`;
      console.log(`  ${C.gray}${String(i+1).padStart(3)}.${C.reset} ${name}  ${C.cyan}${score}${C.reset}  ${conf}`);
    });
  }

  // hybridSearch lần 2
  if (s5.rewriteChanged && s5.search2) {
    const sr2 = s5.search2;
    console.log('');
    console.log(sub(`rewriteQuery KHÁC query gốc ("${normalized}" → "${rw?.result}") → chạy refined search (lần 2)`));
    console.log(sub('finalQuery (gửi LLM ở bước 6) = bản rewrite — GIỮ phủ định nếu có'));
    console.log(kv('  hybridSearch lần 2:', `query: "${sr2.query}"  (strip từ rewrite "${rw?.result}")  |  topK=10`));
    console.log(ok(`hybridSearch lần 2 hoàn thành  ->  ${sr2.results.length} kết quả  ${C.gray}⏱ ${sr2.timeMs || 0}ms${C.reset}`));
    if (sr2.results.length > 0) {
      console.log('');
      console.log(`  ${C.bold}${C.dim}  #   ${'Tên sản phẩm'.padEnd(42)}  Score   Conf${C.reset}`);
      console.log(`  ${C.gray}  ${'-'.repeat(60)}${C.reset}`);
      sr2.results.forEach((r, i) => {
        const name  = (r.name || '?').substring(0, 42).padEnd(42);
        const score = fmtScore(r.score);
        const conf  = r.lowConfidence ? `${C.yellow}low${C.reset}` : `${C.green}ok ${C.reset}`;
        console.log(`  ${C.gray}${String(i+1).padStart(3)}.${C.reset} ${name}  ${C.cyan}${score}${C.reset}  ${conf}`);
      });
    }
    console.log('');
    console.log(sub(sr2.usedForFinal
      ? `Dùng kết quả lần 2 (rewrite) cho Generation  →  ${sr2.results.length} sản phẩm`
      : `Lần 2 rỗng → fallback dùng initialResults (lần 1)`));
  } else {
    console.log('');
    console.log(sub(`rewriteQuery không đổi query → bỏ qua lần 2, dùng kết quả lần 1 cho Generation  →  ${sr1?.results?.length || s5.productsFound} sản phẩm`));
  }

  if (s5.usedLowFallback) {
    console.log(warn('0 kết quả trên threshold → hạ minScore=0, lấy top-3 (fallback)'));
  }

  } // end else (step 5 not skipped)

  // ── Step 6: Generation ──────────────────────────────────────────────────
  console.log(step(6, 'Generation'));
  if (!s6) return;

  if (s6.llmMode === 'down' || (s6.usedFallback && !s6.providerAttempts?.length)) {
    // LLM DOWN path
    const skipLines = compact
      ? [`${C.yellow}Không có LLM provider${C.reset}  ${C.gray}→ [SKIP] A-E: sanitize / buildPrompt / messages[] / HTTP POST / parseLLMOutput${C.reset}`, '']
      : [
          `${C.yellow}Không có LLM provider  ->  các sub-steps LLM bị SKIP:${C.reset}`,
          `  ${C.gray}[SKIP] A. _sanitizeMessage     (không cần khi không gọi LLM)${C.reset}`,
          `  ${C.gray}[SKIP] B. buildAugmentedPrompt (không cần khi không gọi LLM)${C.reset}`,
          `  ${C.gray}[SKIP] C. build messages[]     (không cần khi không gọi LLM)${C.reset}`,
          `  ${C.gray}[SKIP] D. LLM HTTP POST        (không có provider)${C.reset}`,
          `  ${C.gray}[SKIP] E. parseLLMOutput       (không có response để parse)${C.reset}`,
          '',
        ];
    console.log(box('LLM DOWN  —  simpleKeywordMatch  (keyword fallback)', [
      ...skipLines,
      `  ${C.yellow}-> Fallback: simpleKeywordMatch (8 bước nội bộ):${C.reset}`,
      '  1. Tokenize + scoring     name match +10  |  description match +5',
      '  2. Version number filter  extract số model, loại SP sai phiên bản',
      '  3. Brand coherence check  loại kết quả sai brand',
      '  4. Negation filter        parse "không muốn/tránh X" -> loại',
      '  5. Price range filter     tầm/dưới/trên X triệu -> filter theo giá',
      '  6. Category prefix filter detect "laptop/điện thoại" -> filter loại SP',
      '  7. Sort + dedup           sort by matchScore giảm dần, loại trùng',
      '  8. Intent-aware response  pricing->💰  policy->📋  search->🔍  new->🌟',
    ], C.yellow));
    console.log('');
    console.log(sub('Đang chạy simpleKeywordMatch...'));
    console.log(ok(`Hoàn thành  ${C.gray}⏱ ${s6.timeMs}ms${C.reset}`));
  } else {
    // LLM UP path
    if (s6.brandsStr) console.log(kv('  _getCatalogData:', `brands: ${s6.brandsStr.substring(0, 40)}`));
    if (s6.sanitized) console.log(kv('  A. _sanitizeMessage(finalQuery):', `"${s6.sanitized}..."`));
    if (s6.promptLength) console.log(kv('  B. buildAugmentedPrompt:', `${s6.promptLength} ký tự  (${s6.productCount || s5.productsFound} SP + store info)`));
    console.log(kv('  C. messages[]:', `[system(6 rules), ${s6.historyMsgCount || 0} history, user+RAG_context]`));
    if (s6.totalBudgetMs) console.log(kv('  Ngân sách tổng:', `LLM_TOTAL_TIMEOUT_MS=${s6.totalBudgetMs}ms  (Promise.race bọc provider rotation)`));

    const attempts = s6.providerAttempts || [];
    for (const a of attempts) {
      console.log(kv('  D. LLM call:', `${a.model}  (provider ${a.index}/${a.total})  |  temp=0.3  |  max_tokens=800`));
      if (a.url) console.log(sub(`POST -> ${a.url}  (đang chờ...)`));
      if (a.status === 'ok') {
        console.log(ok(`Nhận phản hồi  (${a.timeMs}ms  |  ${a.rawLength} ký tự JSON)`));
        console.log(kv('  E. parseLLMOutput:', 'extractJSON -> map names -> dedup -> extractProductsFromText'));
        console.log(ok('Hoàn thành'));
      } else if (a.status === 'retry') {
        if (a.index < a.total)
          console.log(warn(`Provider ${a.index} lỗi (${a.errorCode}) → thử provider ${a.index + 1}`));
        else
          console.log(warn(`Tất cả providers lỗi → fallback simpleKeywordMatch`));
      } else if (a.status === 'break') {
        console.log(warn(`Provider ${a.index} lỗi cố định (${a.errorCode}) → dừng retry`));
      }
    }

    if (s6.usedFallback) {
      console.log(warn(`LLM vượt ngân sách ${s6.totalBudgetMs}ms → fallback simpleKeywordMatch`));
    }
  }

  // ── Step 7: Persist ─────────────────────────────────────────────────────
  console.log(step(7, 'Persist  —  Session Memory  +  Database'));
  const s7 = t.step7_persist;
  if (s7) {
    console.log(kv('  7a. Session memory:', `updatedMessages = ${s7.updatedMsgCount || '?'} msgs  (giới hạn 20 = 10 turns)`));
    console.log(kv('     lastAccess:', s7.lastAccessTime || new Date().toLocaleTimeString('vi-VN')));
    console.log(sub('_evictStaleSessions():  xóa TTL > 30 phút  +  LRU khi > 500 sessions'));
    console.log('');
    console.log(kv('  7b. DB persist:', 'ChatMessage.bulkCreate([userMsg, assistantMsg])  —  1 DB call'));
    console.log(sub('Fire-and-forget: .catch() chỉ log warning  ->  chatbot vẫn trả lời khi DB lỗi'));
  }

  // ── Result ──────────────────────────────────────────────────────────────
  if (aiResponse) {
    const tTotal = s7?.responseTimeMs || s6?.timeMs || 0;
    console.log('\n' + dividerHi('-'));
    console.log(`${C.bold}  KẾT QUẢ TRẢ VỀ CHO FRONTEND  ${C.gray}⏱ tổng ${tTotal}ms${C.reset}`);
    console.log(dividerHi('-'));
    console.log(kv('  intent:', `${C.cyan}${aiResponse.intent || s3?.intent || 'N/A'}${C.reset}`));
    console.log('');
    console.log(`  ${C.bold}Response đầy đủ:${C.reset}`);
    (aiResponse.response || '').split('\n').forEach(line => {
      if (line.length <= 90) { console.log(`    ${line}`); return; }
      const words = line.split(' ');
      let cur = '    ';
      for (const w of words) {
        if (cur.length + w.length > 94) { console.log(cur); cur = '    ' + w + ' '; }
        else cur += w + ' ';
      }
      if (cur.trim()) console.log(cur);
    });
    console.log('');
    console.log(kv('  products:', `${aiResponse.products?.length || 0} card(s)`));
    (aiResponse.products || []).forEach((p, i) =>
      console.log(item(i+1, `${C.bold}${p.name}${C.reset}  —  ${C.cyan}${fmtPrice(p.price)}${C.reset}`))
    );
    if (aiResponse.suggestions?.length) {
      aiResponse.suggestions.slice(0, 3).forEach((s, i) => {
        const label = i === 0 ? '  suggestions:' : '              ';
        const short = s.length > W - 18 ? s.substring(0, W - 21) + '...' : s;
        console.log(`  ${C.dim}${label.padEnd(20)}${C.reset}${C.gray}${i + 1}.${C.reset} ${short}`);
      });
    }
  }
  console.log(dividerHi('=') + '\n');
}

// ── HTTP song song đến server đang chạy ──────────────────────────────────────

async function callChatbotServer(query, sid, { trace = false, retries = 2 } = {}) {
  const http = require('http');
  const SERVER = `http://localhost:8888/api/chatbot/message${trace ? '?trace=true' : ''}`;
  if (!sid) sid = 'demo-http-' + Date.now();

  const attempt = () => new Promise((resolve) => {
    const payload = JSON.stringify({ message: query, sessionId: sid });
    const opts    = {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = http.request(SERVER, opts, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ ok: true, data: JSON.parse(raw) }); }
        catch { resolve({ ok: false, error: 'JSON parse failed' }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message || e.code || 'ECONNRESET' }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ ok: false, error: 'timeout (60s)' }); });
    req.write(payload);
    req.end();
  });

  for (let i = 0; i <= retries; i++) {
    const res = await attempt();
    if (res.ok || i === retries) return res;
    // Retry sau 1s khi gặp lỗi connection (ECONNRESET, ECONNREFUSED)
    if (res.error.includes('CONN') || res.error.includes('reset')) {
      await new Promise(r => setTimeout(r, 1000));
    } else {
      return res; // Lỗi khác (parse fail, timeout) → không retry
    }
  }
}

// ── Interactive input + session control ──────────────────────────────────────

function askQuery(sessionId) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const hint = `${C.gray}(lệnh: 'clear' xóa session, 'exit' thoát, 'mode:up/down/both' đổi mode)${C.reset}`;
  const sid  = `${C.gray}session: ${sessionId}${C.reset}`;
  return new Promise((resolve) => {
    process.stdout.write(`\n${hint}\n${sid}\n${C.bold}${C.cyan}> Query: ${C.reset}`);
    rl.once('line', (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

async function clearSessionOnServer(sessionId) {
  const http = require('http');
  return new Promise((resolve) => {
    const payload = JSON.stringify({ sessionId });
    const req = http.request('http://localhost:8888/api/chatbot/session/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.write(payload); req.end();
  });
}

// ── Print HTTP server response ────────────────────────────────────────────────

function printServerResponse(res) {
  console.log('\n' + C.bold + C.teal + '='.repeat(W) + C.reset);
  console.log(C.bold + C.teal + '  RESPONSE TỪ CHATBOT SERVER  (HTTP localhost:8888)' + C.reset);
  console.log(C.bold + C.teal + '='.repeat(W) + C.reset);

  if (!res.ok) {
    console.log(warn(`Server không phản hồi: ${res.error}`));
    console.log(sub('Kiểm tra "npm run dev" và thử lại'));
    return;
  }

  const d = res.data?.data || {};
  console.log(kv('  HTTP status:', res.data?.status));
  console.log(kv('  intent:', `${C.cyan}${d.intent}${C.reset}`));
  console.log('');
  // In full response không truncate
  console.log(`  ${C.bold}Response đầy đủ:${C.reset}`);
  const lines = (d.response || '').split('\n');
  lines.forEach(l => console.log(`    ${l}`));
  if (d.products?.length) {
    console.log('');
    console.log(kv('  Products:', `${d.products.length} card(s)`));
    d.products.forEach((p, i) =>
      console.log(item(i+1, `${C.bold}${p.name}${C.reset}  —  ${C.cyan}${fmtPrice(p.price)}${C.reset}`))
    );
  }
  if (d.suggestions?.length) {
    console.log('');
    console.log(kv('  Suggestions:', d.suggestions.join('  |  ')));
  }
  console.log(C.bold + C.teal + '='.repeat(W) + C.reset + '\n');
}

// ── Entry point ───────────────────────────────────────────────────────────────

(async () => {
  // Tính padding chính xác theo display width (tránh lệch do multi-byte Vietnamese)
  const BOX = W; // header đồng bộ với W (tự adapt theo terminal)
  const inner = BOX - 2; // chiều rộng bên trong (không tính 2 ký tự '|')
  const centerLine = (text) => {
    const pad = inner - text.length;
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return '|' + ' '.repeat(left) + text + ' '.repeat(right) + '|';
  };
  const border = '+' + '='.repeat(inner) + '+';
  const HEADER = [
    '',
    C.bold + C.teal + border,
    centerLine('TECHSTORE RAG CHATBOT  --  PIPELINE DEMO'),
    centerLine('Luận văn tốt nghiệp'),
    border + C.reset,
  ].join('\n');
  console.log(HEADER);

  const noHttp     = args.includes('--no-http');
  const oneShot    = !!args.find(a => !a.startsWith('--')); // có query sẵn → chạy 1 lần rồi thoát
  let   currentMode = modeArg;
  let   sessionId   = sessionArg || 'demo-' + Date.now();

  if (sessionArg) {
    console.log(kv('Session ID:', `${C.teal}${sessionId}${C.reset}  ${C.green}(sync với UI)${C.reset}`));
  }

  // Watch mode: tự theo dõi DB, trace query mới từ UI
  // Không cần --session-id — tự detect session mới nhất và follow khi UI đổi session
  if (watchMode) {
    console.log(kv('Mode:', currentMode));
    console.log(sub('Watch mode — tự follow session UI. Ctrl+C để dừng.\n'));

    const http = require('http');

    const httpGet = (url) => new Promise(resolve => {
      http.get(url, r => {
        let raw = ''; r.on('data', d => raw += d);
        r.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
      }).on('error', () => resolve(null));
    });

    // Query DB trực tiếp — không cần HTTP endpoint, không expose session ID qua API
    const { ChatMessage } = require('@models');

    let watchSessionId = sessionArg || null;
    let lastSeenId = 0;
    let terminalBusy = false;

    const initSession = async (sid) => {
      const latest = await ChatMessage.findOne({
        where: { sessionId: sid },
        attributes: ['id'],
        order: [['id', 'DESC']],
        raw: true,
      }).catch(() => null);
      lastSeenId = latest?.id ?? 0;
      watchSessionId = sid;
      const count = await ChatMessage.count({ where: { sessionId: sid } }).catch(() => 0);
      console.log(`${C.teal}${C.bold}[Watch]${C.reset} Đang theo dõi session id: ${C.dim}${sid}${C.reset} (${count} msgs hiện có)`);
    };
    // Ưu tiên session UI đăng ký qua /session/register (ghi vào data/.last-session-id)
    // Fallback: session mới nhất trong DB
    const fs = require('fs');
    const path = require('path');
    const lastSessionFile = path.join(__dirname, '..', 'data', '.last-session-id');
    const fetchLatestSession = async () => {
      try {
        const fromFile = fs.readFileSync(lastSessionFile, 'utf8').trim();
        if (fromFile) return fromFile;
      } catch { /* file chưa tồn tại */ }
      try {
        const row = await ChatMessage.findOne({
          attributes: ['sessionId'],
          order: [['createdAt', 'DESC']],
          raw: true,
        });
        return row?.sessionId ?? null;
      } catch { return null; }
    };

    if (watchSessionId) {
      await initSession(watchSessionId);
    } else {
      const detected = await fetchLatestSession();
      if (detected) {
        console.log(ok('Auto-detect session mới nhất từ DB'));
        await initSession(detected);
      } else {
        console.log(warn('Chưa có session nào trong DB. Chờ UI gửi tin nhắn đầu tiên...'));
      }
    }

    const poll = async () => {
      if (terminalBusy) return;
      const latestSid = await fetchLatestSession();
      if (latestSid && latestSid !== watchSessionId) {
        console.log(`\n${C.yellow}[Watch]${C.reset} Session UI đổi → follow session mới: ${C.dim}${latestSid}${C.reset}`);
        await initSession(latestSid);
        return;
      }

      if (!watchSessionId) {
        if (latestSid) await initSession(latestSid);
        return;
      }

      const { Op } = require('sequelize');
      const newMsgs = await ChatMessage.findAll({
        where: { sessionId: watchSessionId, id: { [Op.gt]: lastSeenId } },
        order: [['id', 'ASC']],
        attributes: ['id', 'role', 'content', 'metadata'],
        raw: true,
      }).catch(() => []);

      if (newMsgs.length > 0) {
        lastSeenId = newMsgs[newMsgs.length - 1].id;
        for (const m of newMsgs) {
          if (m.role !== 'user') continue;
          console.log(`\n${C.teal}${C.bold}[UI → Terminal]${C.reset} Query mới: "${m.content}"`);
          // Tìm assistant message ngay sau user message (chứa trace trong metadata)
          const assistant = newMsgs.find(a => a.role === 'assistant' && a.id > m.id);
          let trace = null;
          let meta = null;
          if (assistant?.metadata) {
            try {
              meta = typeof assistant.metadata === 'string' ? JSON.parse(assistant.metadata) : assistant.metadata;
              trace = meta.trace;
            } catch { /* ignore parse error */ }
          }
          if (trace) {
            displayServerTrace(trace, m.content, {
              intent: meta?.intent || trace?.step3_security?.intent || '', response: assistant.content,
              products: meta?.products || [], suggestions: meta?.suggestions || [],
            });
          } else {
            console.log(sub('Không có trace trong DB — fallback local pipeline'));
            try {
              if (currentMode === 'down' || currentMode === 'both') await runPipeline(m.content, 'down', watchSessionId);
              if (currentMode === 'up'   || currentMode === 'both') await runPipeline(m.content, 'up', watchSessionId);
            } catch (e) { console.error(`${C.red}Lỗi trace:${C.reset}`, e.message); }
          }
        }
      }
    };

    setInterval(poll, 2000);

    // Readline song song — nhận input từ terminal trong khi vẫn watch UI
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askWatch = () => {
      process.stdout.write(`\n${C.gray}(lệnh: 'exit' thoát, 'mode:up/down/both' đổi mode)${C.reset}\n${C.bold}${C.cyan}> Terminal query: ${C.reset}`);
      rl.once('line', async (input) => {
        input = input.trim();
        if (!input || input === 'exit') { rl.close(); process.exit(0); }
        if (input.startsWith('mode:')) {
          currentMode = input.split(':')[1] || currentMode;
          console.log(ok(`Mode → ${C.cyan}${currentMode}${C.reset}`));
        } else {
          const sid = watchSessionId || 'demo-' + Date.now();
          console.log(`\n${C.teal}${C.bold}[Terminal → Server]${C.reset} Gửi: "${input}"  ${C.gray}(session: ${sid.slice(0,8)}...)${C.reset}`);
          terminalBusy = true;
          try {
            const res = await callChatbotServer(input, sid, { trace: true });
            if (res.ok && res.data?.data?.trace) {
              const d = res.data.data;
              displayServerTrace(res.data.data.trace, input, {
                intent: d.intent, response: d.response, products: d.products, suggestions: d.suggestions,
              });
              console.log(sub(`${C.green}✓ UI sẽ hiển thị cùng response này${C.reset}`));
            } else if (res.ok) {
              console.log(ok('Server xử lý thành công (không có trace)'));
            } else {
              console.log(warn(`Server lỗi: ${res.error || 'unknown'}`));
              console.log(sub('Kiểm tra server đang chạy (npm run dev) và thử lại'));
            }
            // Bump lastSeenId
            const latest = await ChatMessage.findOne({
              where: { sessionId: sid }, attributes: ['id'], order: [['id', 'DESC']], raw: true,
            }).catch(() => null);
            if (latest) lastSeenId = latest.id;
          } catch (e) {
            console.error(`${C.red}Lỗi:${C.reset}`, e.message);
          }
          terminalBusy = false;
        }
        askWatch(); // loop lại
      });
    };
    askWatch();
    return; // Giữ process chạy
  }

  // Nếu có query từ arg → chạy 1 lần
  if (oneShot) {
    const inputQuery = query;
    console.log(kv('Query:', `"${inputQuery}"`));
    console.log(kv('Mode:', currentMode));
    // One-shot: chạy local pipeline, không gửi HTTP (tránh 2 LLM calls)
    // Dùng --no-http=false nếu muốn sync với server
    const httpP = (noHttp || oneShot) ? null : callChatbotServer(inputQuery, sessionId);
    try {
      if (currentMode === 'down' || currentMode === 'both') await runPipeline(inputQuery, 'down', sessionId);
      if (currentMode === 'up'   || currentMode === 'both') await runPipeline(inputQuery, 'up', sessionId);
    } catch (e) { console.error(`\n${C.red}Lỗi:${C.reset}`, e.message); }
    if (httpP) printServerResponse(await httpP);
    process.exit(0);
  }

  // Không có query → interactive loop
  console.log(kv('Mode:', currentMode));
  console.log(kv('Session ID:', sessionId));
  console.log(sub('Chạy interactive — nhập query để trace pipeline'));

  while (true) {
    const input = await askQuery(sessionId);

    if (!input || input === 'exit' || input === 'quit') {
      console.log(ok('Thoát demo.'));
      process.exit(0);
    }

    // Lệnh đổi mode
    if (input.startsWith('mode:')) {
      currentMode = input.split(':')[1]?.trim() || currentMode;
      console.log(ok(`Đã đổi mode → ${C.cyan}${currentMode}${C.reset}`));
      continue;
    }

    // Lệnh clear session
    if (input === 'clear') {
      process.stdout.write('\x1Bc'); // clear terminal
      const oldSid = sessionId;
      sessionId = 'demo-' + Date.now(); // session ID mới
      const r = await clearSessionOnServer(oldSid);
      console.log(HEADER);
      console.log(ok(`Session đã xóa  (old: ${oldSid})`));
      if (r) console.log(sub(`Server: ${r.message || JSON.stringify(r)}`));
      console.log(kv('Session mới:', sessionId));
      console.log(kv('Mode:', currentMode));
      continue;
    }

    // Chạy pipeline + HTTP song song
    console.log(kv('Query:', `"${input}"`));
    console.log(kv('Mode:', currentMode));
    const httpP = noHttp ? null : callChatbotServer(input, sessionId);
    try {
      if (currentMode === 'down' || currentMode === 'both') await runPipeline(input, 'down', sessionId);
      if (currentMode === 'up'   || currentMode === 'both') await runPipeline(input, 'up', sessionId);
    } catch (e) { console.error(`\n${C.red}Lỗi:${C.reset}`, e.message); }
    if (httpP) printServerResponse(await httpP);
  }
})();
