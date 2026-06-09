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

// ── Compute Pipeline (pure computation, returns trace + aiResponse) ──────────

async function computePipeline(query, llmMode, providedSessionId = null) {
  const trace = {};
  const tStart = Date.now();
  const isUp = llmMode === 'up';

  const axios = require('axios');
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

  // ── STEP 1: VALIDATE ──────────────────────────────────────────────────────
  const v = validateMessage(query);
  trace.step1_validate = { valid: v.valid, length: query.length };
  if (!v.valid) {
    const { t: tDemo } = require('@utils/i18n');
    trace.step1_validate.reason = tDemo(v.reason, 'vi') || v.reason;
    return { trace, aiResponse: null };
  }

  // ── STEP 2: NORMALIZE ─────────────────────────────────────────────────────
  const normalized = expandAbbreviations(query);
  trace.step2_normalize = { changed: normalized !== query, before: query, after: normalized };

  // ── STEP 3: CLASSIFY INTENT + SECURITY ────────────────────────────────────
  const intent = classifyIntent(normalized);
  const injection = isPromptInjection(query);
  const offTopic = intent === 'off_topic';
  trace.step3_security = { intent, injection, offTopic };
  if (injection) { trace.blocked = 'injection'; return { trace, aiResponse: null }; }
  if (offTopic) { trace.blocked = 'off_topic'; return { trace, aiResponse: null }; }

  // ── STEP 4: SESSION HISTORY ───────────────────────────────────────────────
  const sessionId = providedSessionId || 'demo-' + Date.now();
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
        conversationHistory = dbMessages.map(m => ({ role: m.role, content: m.content })).slice(-20);
      }
    } catch { /* server không phản hồi */ }
  }
  const turns = Math.floor(conversationHistory.length / 2);
  trace.step4_history = {
    sessionId,
    turns,
    messages: conversationHistory.slice(-4).map(m => ({ role: m.role, content: m.content || '' })),
  };

  // ── STEP 5a: ENRICH QUERY FROM HISTORY ────────────────────────────────────
  const PRONOUN_RE = /(?:^|\s)[\p{L}\p{N}]*(?:đó|này|kia)(?=[\s,?.!]|$)|(?:^|\s)nó(?=[\s,?.!]|$)|so sánh|cả hai|2 cái|hai cái/iu;
  const BRAND_RE = /iphone|samsung|macbook|xiaomi|oppo|realme|apple|dell|asus|acer|casio|citizen|laptop|tablet|điện thoại|đồng hồ|máy tính|smartwatch|earphone|headphone|airpod/i;
  const hasBrand = BRAND_RE.test(normalized);
  const hasPronoun = PRONOUN_RE.test(normalized) && !hasBrand;
  const isImplicitFollowup = !hasPronoun && normalized.trim().length <= 50 && !hasBrand;
  const needsEnrich = hasPronoun || isImplicitFollowup;
  trace.step5_enrich = { hasPronoun, isImplicitFollowup };

  let enrichedQuery = normalized;
  if (needsEnrich && conversationHistory.length > 0) {
    const extractTopProduct = (text) => {
      if (text.startsWith('🚫') || /Cửa hàng hiện chưa có|không tìm thấy|ngoài phạm vi/i.test(text.substring(0, 80))) return null;
      const firstItem = text.split('\n').find(l => /^\s*[•-]\s/.test(l));
      if (!firstItem) return null;
      return firstItem.replace(/^\s*[•-]\s*/, '').replace(/\s*[-:]\s*(?:giá|từ)?\s*[\d.,]+.*$/i, '').replace(/:\s.*$/, '').trim();
    };
    const recentContext = conversationHistory
      .filter(m => m.role === 'assistant').slice(-2)
      .map(m => extractTopProduct(m.content)).filter(Boolean).join(' ');
    if (recentContext.trim()) enrichedQuery = `${normalized} ${recentContext}`;
  }

  // ── STEP 5b: RETRIEVE PRODUCTS ────────────────────────────────────────────
  const needsSearch = intent === 'pricing' || intent === 'product_search';
  let products = [];
  let finalQuery = enrichedQuery;

  if (!needsSearch) {
    trace.step5_retrieve = { enrichedQuery, skipped: true, reason: `Intent "${intent}" không cần Hybrid Search`, productsFound: 0 };
  } else {
    const stripNeg = (q) => q
      .replace(/(?:không\s+(?:cần|muốn|thích|dùng|phải|có)|tránh|avoid|don't\s+want)\s+[\p{L}\p{N}\s,/]+?(?=[\s,]+(?:gì|hay|hoặc|được|cũng|mà|nhưng|tầm|dưới|trên|khoảng|giá|pin|màn|nhẹ|mỏng|ram|cpu|chip|mới|tốt|rẻ|đắt|bền|under|about|around|with|for)\b|\s*$)/igu, ' ')
      .trim() || q;
    const queryForRetrieval = stripNeg(enrichedQuery);

    const s5 = { enrichedQuery };
    s5.stripNegation = { changed: queryForRetrieval !== enrichedQuery, before: enrichedQuery, after: queryForRetrieval };

    let llmRewrite = null;
    const rwTrace = { result: null, timeMs: 0 };
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
          if (rw && rw !== enrichedQuery) llmRewrite = rw;
          rwTrace.result = llmRewrite;
          rwTrace.timeMs = Date.now() - tRw;
          rwTrace.model = p.model;
          break;
        } catch {
          if (pi + 1 >= demoProviders.length) rwTrace.allFailed = true;
        }
      }
    } else if (isUp) {
      rwTrace.skipped = 'no_providers';
    } else {
      const { fuzzyExpandQuery } = require('@modules/ai/services/chatbot/query/fuzzy-expander');
      await vectorStoreService.loadPromise;
      const productNames = vectorStoreService.items.map(i => i.metadata?.name).filter(Boolean);
      const { expanded, changed } = fuzzyExpandQuery(enrichedQuery, productNames);
      if (changed) llmRewrite = expanded;
      rwTrace.result = llmRewrite;
      rwTrace.fuzzy = true;
    }
    s5.rewrite = rwTrace;

    const t0 = Date.now();
    await vectorStoreService.loadPromise;
    const initialResults = await vectorStoreService.hybridSearch(queryForRetrieval, 10);
    const t1 = Date.now();
    s5.search1 = {
      query: queryForRetrieval,
      results: initialResults.map(r => ({ name: r.metadata?.name || '?', score: r.score, lowConfidence: !!r.lowConfidence })),
      timeMs: t1 - t0,
    };

    s5.rewriteChanged = !!(llmRewrite && llmRewrite.toLowerCase() !== normalized.toLowerCase());
    if (s5.rewriteChanged) {
      finalQuery = llmRewrite;
      const t2 = Date.now();
      const refinedResults = await vectorStoreService.hybridSearch(stripNeg(llmRewrite), 10);
      const useRefined = refinedResults.length > 0;
      s5.search2 = {
        query: stripNeg(llmRewrite),
        results: refinedResults.map(r => ({ name: r.metadata?.name || '?', score: r.score, lowConfidence: !!r.lowConfidence })),
        timeMs: Date.now() - t2,
        usedForFinal: useRefined,
      };
      const results = useRefined ? refinedResults : initialResults;
      products = results.map(r => ({ ...r.metadata, score: r.score, ...(r.lowConfidence && { lowConfidence: true }) }));
    } else {
      products = initialResults.map(r => ({ ...r.metadata, score: r.score, ...(r.lowConfidence && { lowConfidence: true }) }));
    }

    if (products.length === 0) {
      s5.usedLowFallback = true;
      try {
        const lowResults = await vectorStoreService.hybridSearch(stripNeg(finalQuery), 3, 0);
        products = lowResults.map(r => ({ ...r.metadata, score: r.score, lowConfidence: true }));
      } catch { products = []; }
    }
    s5.productsFound = products.length;
    trace.step5_retrieve = s5;
  }

  // ── STEP 6: GENERATION ────────────────────────────────────────────────────
  let aiResponse;
  const s6 = { llmMode: isUp ? 'up' : 'down' };
  const tGen = Date.now();

  if (!isUp) {
    const { simpleKeywordMatch } = require('@modules/ai/services/chatbot/keyword/keyword-fallback');
    aiResponse = simpleKeywordMatch(finalQuery, products);
    s6.usedFallback = true;
    s6.timeMs = Date.now() - tGen;
  } else if (demoProviders.length === 0) {
    const { simpleKeywordMatch } = require('@modules/ai/services/chatbot/keyword/keyword-fallback');
    aiResponse = simpleKeywordMatch(finalQuery, products);
    s6.usedFallback = true;
    s6.timeMs = Date.now() - tGen;
  } else {
    const promptBuilder = require('@modules/ai/services/chatbot/prompt/prompt-builder');
    const responseParser = require('@modules/ai/services/chatbot/prompt/response-parser');
    const sanitized = finalQuery.replace(/"/g, "'").replace(/\n{2,}/g, '\n').trim().substring(0, 500);
    const augPrompt = promptBuilder.buildAugmentedPrompt(sanitized, products);
    const storeName = process.env.STORE_NAME || 'TechStore';

    let brandsStr = '', categoriesStr = '';
    try {
      const { Brand, Category } = require('../src/models');
      const [brands, cats] = await Promise.all([
        Brand.findAll({ attributes: ['nameVi', 'nameEn'], raw: true }),
        Category.findAll({ attributes: ['nameVi', 'nameEn'], raw: true }),
      ]);
      if (brands.length) brandsStr = brands.map(b => b.nameVi || b.nameEn).filter(Boolean).join(', ');
      if (cats.length) categoriesStr = cats.map(c => c.nameVi || c.nameEn).filter(Boolean).join(', ');
    } catch { /* fallback empty */ }

    const systemContent = `Bạn là nhân viên tư vấn của ${storeName} — cửa hàng công nghệ chuyên điện thoại, máy tính bảng và laptop.
QUY TẮC BẮT BUỘC:
1. CHỈ tư vấn sản phẩm có trong DANH SÁCH SẢN PHẨM được cung cấp trong tin nhắn.
2. TUYỆT ĐỐI không bịa tên sản phẩm, giá, hoặc thông số kỹ thuật ngoài danh sách.
3. Nếu sản phẩm không có trong danh sách, nói rõ: "Cửa hàng hiện chưa có [tên sản phẩm] ạ."
4. Respond in the SAME language as the customer's message. If Vietnamese → reply Vietnamese (thân thiện: mình/em - bạn/anh/chị). If English → reply English (friendly tone).
5. Trả về đúng định dạng JSON được yêu cầu trong tin nhắn.
6. Danh mục: ${categoriesStr} — Thương hiệu: ${brandsStr}`;

    const messages = [
      { role: 'system', content: systemContent },
      ...conversationHistory,
      { role: 'user', content: augPrompt },
    ];

    s6.sanitized = sanitized.substring(0, 55);
    s6.promptLength = augPrompt.length;
    s6.productCount = products.length;
    s6.historyMsgCount = conversationHistory.length;
    s6.brandsStr = brandsStr;

    const LLM_REQUEST_TIMEOUT_MS = Number(process.env.LLM_REQUEST_TIMEOUT_MS) || 30000;
    const LLM_TOTAL_TIMEOUT_MS = Number(process.env.LLM_TOTAL_TIMEOUT_MS) || LLM_REQUEST_TIMEOUT_MS;
    s6.totalBudgetMs = LLM_TOTAL_TIMEOUT_MS;
    s6.providerAttempts = [];

    const { simpleKeywordMatch } = require('@modules/ai/services/chatbot/keyword/keyword-fallback');

    const runGeneration = async () => {
      for (let pi = 0; pi < demoProviders.length; pi++) {
        const p = demoProviders[pi];
        const attempt = { model: p.model, index: pi + 1, total: demoProviders.length, url: p.url };
        const t2 = Date.now();
        try {
          const res = await axios.post(p.url,
            { model: p.model, messages, response_format: { type: 'json_object' }, temperature: 0.3, max_tokens: 800 },
            { headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' }, timeout: LLM_REQUEST_TIMEOUT_MS }
          );
          const raw = res.data.choices?.[0]?.message?.content || '';
          if (!raw) {
            attempt.status = 'retry'; attempt.timeMs = Date.now() - t2; attempt.errorCode = 'empty';
            s6.providerAttempts.push(attempt);
            continue;
          }
          attempt.status = 'ok'; attempt.timeMs = Date.now() - t2; attempt.rawLength = raw.length;
          s6.providerAttempts.push(attempt);
          return responseParser.parseLLMOutput(raw, products, finalQuery);
        } catch (err) {
          const status = err.response?.status;
          attempt.timeMs = Date.now() - t2;
          if (status === 429 || status === 402 || status === 500 || status === 503 || !err.response) {
            attempt.status = 'retry'; attempt.errorCode = status || err.code;
            s6.providerAttempts.push(attempt);
            continue;
          }
          attempt.status = 'break'; attempt.errorCode = status;
          s6.providerAttempts.push(attempt);
          break;
        }
      }
      s6.usedFallback = true;
      return simpleKeywordMatch(finalQuery, products);
    };

    let _budgetTimer;
    aiResponse = await Promise.race([
      runGeneration(),
      new Promise((resolve) => {
        _budgetTimer = setTimeout(() => {
          s6.usedFallback = true;
          resolve(simpleKeywordMatch(finalQuery, products));
        }, LLM_TOTAL_TIMEOUT_MS);
      }),
    ]).finally(() => clearTimeout(_budgetTimer));
  }
  s6.timeMs = s6.timeMs || (Date.now() - tGen);
  trace.step6_generate = s6;

  // ── STEP 7: PERSIST ───────────────────────────────────────────────────────
  trace.step7_persist = {
    updatedMsgCount: [...conversationHistory, {}, {}].slice(-20).length,
    lastAccessTime: new Date().toLocaleTimeString('vi-VN'),
    responseTimeMs: Date.now() - tStart,
  };

  return { trace, aiResponse };
}

// ── Display Pipeline (unified display from trace data) ───────────────────────

function displayPipeline(t, query, aiResponse = null, { showBanner = false } = {}) {
  const s5 = t.step5_retrieve;
  const s6 = t.step6_generate;

  // ── Header box (optional banner) ──────────────────────────────────────
  if (showBanner) {
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
    console.log(`  Query:${' '.repeat(16)}"${query}"`);
    console.log(`  Mode:${' '.repeat(17)}${isUp ? 'up' : 'down'}`);
  }

  const isUp = (s6?.llmMode || 'up') === 'up';
  const modeTag = isUp
    ? `${C.bold}${C.green}[ LLM UP  ]${C.reset}`
    : `${C.bold}${C.yellow}[ LLM DOWN ]${C.reset}`;
  const formatTag = compact ? `${C.dim}[compact]${C.reset}` : `${C.dim}[detailed]${C.reset}`;

  console.log('\n' + dividerHi('='));
  console.log(`${C.bold}  RAG PIPELINE DEMO  |  Mode: ${modeTag}  ${formatTag}${C.reset}`);
  console.log(dividerHi('='));
  console.log(kv('Query đầu vào:', `"${query}"`));

  // ── Step 1: Validate ────────────────────────────────────────────────────
  console.log(step(1, 'Validate Message'));
  if (!t.step1_validate?.valid && t.step1_validate?.valid !== undefined) {
    console.log(fail(`Không hợp lệ: ${t.step1_validate.reason || ''}`));
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
      console.log(kv('  conversationHistory:', `${s4.turns} turns  (hiện ${s4.messages.length} messages cuối)`));
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

  const enrich = t.step5_enrich || {};
  const hasPronoun = enrich.hasPronoun || false;
  const isImplicit = enrich.isImplicitFollowup || false;

  const pronounMatchFull = (enrich.enrichedQuery !== normalized ? normalized : '')
    ?.match(/\b(nó|đó|này|kia|cái đó|cái này|cái kia|so sánh|cả hai|2 cái|hai cái)\b/iu);
  const pronounWordFull = pronounMatchFull ? `"${pronounMatchFull[0]}"` : 'đại từ';
  console.log(kv('  Đại từ chỉ định:', hasPronoun
    ? `${C.yellow}Có (${pronounWordFull})  ->  cần append context từ history${C.reset}`
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

  // rewriteQuery display
  const rw = s5.rewrite;
  if (rw) {
    if (rw.fuzzy) {
      if (rw.result) {
        console.log(kv('  rewriteQuery:', `${C.green}"${rw.result}"${C.reset}  ${C.gray}(fuzzyExpand: prefix + edit-distance, không gọi LLM)${C.reset}`));
      } else {
        console.log(kv('  rewriteQuery:', `${C.dim}[fuzzyExpand: no change]${C.reset}  ${C.gray}(LLM DOWN — không sửa được qua catalog)${C.reset}`));
      }
    } else if (rw.skipped) {
      console.log(kv('  rewriteQuery:', `${C.yellow}[SKIP] Chưa cấu hình LLM_MODEL_1 / 2 / 3${C.reset}`));
    } else if (rw.allFailed) {
      console.log(kv('  rewriteQuery:', `${C.yellow}[tất cả providers lỗi] → dùng query gốc${C.reset}`));
    } else {
      const rwModel = rw.model || s6?.providerAttempts?.[0]?.model || 'LLM';
      if (rw.result) {
        console.log(kv('  rewriteQuery:', `${C.green}"${rw.result}"${C.reset}  ${C.gray}(${rwModel})  ⏱ ${rw.timeMs}ms${C.reset}`));
      } else {
        console.log(kv('  rewriteQuery:', `${C.dim}[no change]${C.reset}  ${C.gray}(${rwModel})  ⏱ ${rw.timeMs}ms${C.reset}`));
      }
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
    console.log(sub(`rewriteQuery KHÁC query gốc → chạy refined search (lần 2)`));
    console.log(sub(`  "${normalized}"  →  "${rw?.result}"`));
    console.log(sub('finalQuery (gửi LLM ở bước 6) = bản rewrite — GIỮ phủ định nếu có'));
    console.log(kv('  hybridSearch lần 2:', `query: "${sr2.query}"  |  topK=10`));
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

  // LLM timeout: provider có nhưng budget timer win trước → usedFallback=true, providerAttempts=[]
  const isTimeout = s6.usedFallback && !s6.providerAttempts?.length && s6.llmMode !== 'down';
  if (isTimeout) {
    console.log(warn(`LLM vượt ngân sách ${s6.totalBudgetMs || 30000}ms → fallback simpleKeywordMatch`));
  }

  if (s6.llmMode === 'down' || (s6.usedFallback && !s6.providerAttempts?.length)) {
    const noProviderMsg = s6.llmMode === 'down'
      ? 'Không có LLM provider'
      : `LLM timeout (${s6.totalBudgetMs || 30000}ms)`;
    const skipLines = compact
      ? [`${C.yellow}${noProviderMsg}${C.reset}  ${C.gray}→ [SKIP] A-E: sanitize / buildPrompt / messages[] / HTTP POST / parseLLMOutput${C.reset}`, '']
      : [
          `${C.yellow}${noProviderMsg}  ->  các sub-steps LLM bị SKIP:${C.reset}`,
          `  ${C.gray}[SKIP] A. _sanitizeMessage     (không cần khi không gọi LLM)${C.reset}`,
          `  ${C.gray}[SKIP] B. buildAugmentedPrompt (không cần khi không gọi LLM)${C.reset}`,
          `  ${C.gray}[SKIP] C. build messages[]     (không cần khi không gọi LLM)${C.reset}`,
          `  ${C.gray}[SKIP] D. LLM HTTP POST        (không có provider)${C.reset}`,
          `  ${C.gray}[SKIP] E. parseLLMOutput       (không có response để parse)${C.reset}`,
          '',
        ];
    const boxTitleFull = s6.llmMode === 'down' ? 'LLM DOWN  —  simpleKeywordMatch  (keyword fallback)' : 'LLM TIMEOUT  —  simpleKeywordMatch  (graceful degradation)';
    console.log(box(boxTitleFull, [
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
    if (s6.brandsStr) console.log(kv('  _getCatalogData:', `brands: ${s6.brandsStr.substring(0, 40)}`));
    if (s6.sanitized) console.log(kv('  A. _sanitizeMessage(finalQuery):', `"${s6.sanitized}..."`));
    if (s6.promptLength) console.log(kv('  B. buildAugmentedPrompt:', `${s6.promptLength} ký tự  (${s6.productCount ?? s5?.productsFound ?? 0} SP + store info)`));
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

// ── Run Pipeline (compute + display) ─────────────────────────────────────────

async function runPipeline(query, llmMode, providedSessionId = null) {
  const { trace, aiResponse } = await computePipeline(query, llmMode, providedSessionId);
  displayPipeline(trace, query, aiResponse);
}

// ── Streaming HTTP — hiện từng bước khi server gửi chunk ─────────────────────

function callChatbotServerStreaming(query, sid, onChunk) {
  const http = require('http');
  if (!sid) sid = 'demo-http-' + Date.now();
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ message: query, sessionId: sid });
    const req = http.request('http://localhost:8888/api/chatbot/message/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let buf = '';
      res.on('data', chunk => {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try { onChunk(JSON.parse(line)); } catch { /* ignore parse error */ }
        }
      });
      res.on('end', () => {
        if (buf.trim()) { try { onChunk(JSON.parse(buf)); } catch { /* ignore */ } }
        resolve();
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('stream timeout')); });
    req.write(payload);
    req.end();
  });
}

/** Hiện từng bước RAG ngay khi nhận chunk từ server streaming */
function displayStreamStep(stepId, data, accum) {
  switch (stepId) {
    case '1':
      console.log(step(1, 'Validate Message'));
      if (!data.valid) { console.log(fail(`Không hợp lệ: ${data.reason || ''}`)); console.log(sub('Pipeline dừng → trả HTTP 400 cho client')); }
      else { console.log(ok('Hợp lệ')); console.log(kv('  Độ dài:', `${data.length} ký tự  (giới hạn: 500)`)); console.log(kv('  Có ký tự hợp lệ:', 'Có (chữ cái / chữ số Unicode)')); }
      break;
    case '2':
      console.log(step(2, 'Expand Abbreviations  (Normalize)'));
      if (data.changed) { console.log(ok('Phát hiện và mở rộng viết tắt')); console.log(kv('  Trước:', `"${data.before}"`)); console.log(kv('  Sau:', `"${data.after}"`)); }
      else console.log(sub('Không có viết tắt cần mở rộng — giữ nguyên query'));
      break;
    case '3':
      console.log(step(3, 'Classify Intent  +  Security Gates'));
      console.log(kv('  Intent phân loại:', `${C.cyan}${C.bold}${data.intent}${C.reset}`));
      console.log(kv('  Prompt injection:', data.injection ? `${C.red}${C.bold}PHÁT HIỆN  ->  BLOCK${C.reset}` : `${C.green}Không phát hiện${C.reset}`));
      console.log(kv('  Off-topic check:', data.offTopic ? `${C.yellow}${C.bold}NGOÀI PHẠM VI  ->  BLOCK${C.reset}` : `${C.green}Trong phạm vi${C.reset}`));
      if (!data.injection && !data.offTopic) console.log(ok('Đạt tất cả security gates  ->  tiếp tục vào RAG pipeline'));
      break;
    case '4': {
      console.log(step(4, 'Load Session History'));
      console.log(kv('  Session ID:', data.sessionId || 'N/A'));
      if (data.turns > 0 && data.messages?.length) {
        console.log(kv('  Trạng thái:', `${C.green}Có lịch sử từ DB${C.reset}`));
        console.log(kv('  conversationHistory:', `${data.turns} turns  (hiện ${data.messages.length} messages cuối)`));
        data.messages.forEach(m => { const p = (m.content || '').replace(/\n/g, ' ').substring(0, 60); console.log(`  ${C.gray}  ${m.role.padEnd(9)}${C.reset} "${p}${p.length >= 60 ? '...' : ''}"`); });
      } else { console.log(kv('  Trạng thái:', 'Session chưa có lịch sử')); console.log(kv('  conversationHistory:', '[]  (0 turns)')); }
      console.log(sub('Lưu trong Map RAM  |  Tối đa 500 sessions  |  TTL 30 phút'));
      break;
    }
    case '5': // skipped (non-product intent)
      console.log(step(5, 'Retrieve  (SKIP)'));
      console.log(sub(data.reason));
      console.log(sub('Không chạy Hybrid Search — chuyển thẳng sang Generation'));
      break;
    case '5a': {
      console.log(compact ? step(5, 'Enrich Query  +  Retrieve Products') : step('5a', 'Enrich Query From History'));
      const norm = accum.normalized || accum.query;
      const enriched = data.enrichedQuery || norm;
      const pronounMatch = norm?.match(/\b(nó|đó|này|kia|cái đó|cái này|cái kia|so sánh|cả hai|2 cái|hai cái)\b/iu);
      const pronounWord = pronounMatch ? `"${pronounMatch[0]}"` : 'đại từ';
      console.log(kv('  Đại từ chỉ định:', data.hasPronoun
        ? `${C.yellow}Có (${pronounWord})  ->  cần append context từ history${C.reset}`
        : (data.isImplicitFollowup && accum.s4?.turns > 0
            ? `${C.yellow}Implicit follow-up (query ngắn, không có brand)  ->  enrich${C.reset}`
            : `${C.green}Không  ->  giữ nguyên query${C.reset}`)));
      if (data.enrichChanged) { const app = enriched.replace(norm, '').trim(); if (app) console.log(sub(`_enrichQueryFromHistory: append "${app.substring(0, 50)}"`)); }
      console.log(kv('  Enriched query:', `"${enriched}"`));
      console.log('');
      if (!compact) console.log(step('5b', 'Retrieve Products  (Hybrid Search)'));
      console.log(`  ${C.dim}Cách tính Score  (DEFAULT_MIN_SCORE=0.45 • OVERLAP_BOOST=0.05 • KEYWORD_INJECTION_MAX_BOOST=0.05):${C.reset}`);
      console.log(`  ${C.dim}  • Conf=ok  (vector match):  score = cosine + OVERLAP_BOOST (nếu trùng cả từ khóa)${C.reset}`);
      console.log(`  ${C.dim}  • Conf=low (keyword-only):  score = DEFAULT_MIN_SCORE + (kwScore / maxKwScore) × KEYWORD_INJECTION_MAX_BOOST${C.reset}`);
      console.log('');
      console.log(sub('Promise.all( rewriteQuery(LLM)  ||  hybridSearch(topK=10) )'));
      console.log(`  ${C.yellow}⏳  Đang chạy hybrid search + rewriteQuery...${C.reset}`);
      break;
    }
    case '5b': {
      const sn = data.stripNegation;
      if (sn?.changed) {
        console.log(warn('Strip mệnh đề phủ định trước khi embedding (chỉ embedding, LLM giữ gốc):'));
        console.log(kv('  Trước:', `"${sn.before}"`));
        console.log(kv('  Sau:', `"${sn.after}"`));
      } else {
        console.log(kv('  Strip negation:', 'Không có mệnh đề phủ định'));
      }
      console.log('');
      const rw = data.rewrite;
      if (rw) {
        if (rw.fuzzy) console.log(kv('  rewriteQuery:', rw.result ? `${C.green}"${rw.result}"${C.reset}  ${C.gray}(fuzzyExpand)${C.reset}` : `${C.dim}[fuzzyExpand: no change]${C.reset}`));
        else if (rw.result) console.log(kv('  rewriteQuery:', `${C.green}"${rw.result}"${C.reset}  ${C.gray}(${rw.model || 'LLM'})  ⏱ ${rw.timeMs}ms${C.reset}`));
        else console.log(kv('  rewriteQuery:', `${C.dim}[no change]${C.reset}  ${C.gray}(${rw.model || 'LLM'})  ⏱ ${rw.timeMs}ms${C.reset}`));
      }
      const sr1 = data.search1;
      if (sr1) {
        console.log(kv('  hybridSearch lần 1:', `query: "${sr1.query}"  |  semantic (cosine) + keyword (BM25)  |  topK=10`));
        console.log(ok(`hybridSearch lần 1 hoàn thành  ->  ${sr1.results.length} kết quả  ${C.gray}⏱ ${sr1.timeMs}ms${C.reset}`));
        console.log('');
        console.log(`  ${C.bold}${C.dim}  #   ${'Tên sản phẩm'.padEnd(42)}  Score   Conf${C.reset}`);
        console.log(`  ${C.gray}  ${'-'.repeat(60)}${C.reset}`);
        sr1.results.forEach((r, i) => { const n = (r.name || '?').substring(0, 42).padEnd(42); const cf = r.lowConfidence ? `${C.yellow}low${C.reset}` : `${C.green}ok ${C.reset}`; console.log(`  ${C.gray}${String(i+1).padStart(3)}.${C.reset} ${n}  ${C.cyan}${fmtScore(r.score)}${C.reset}  ${cf}`); });
      }
      if (data.rewriteChanged && data.search2) {
        const sr2 = data.search2;
        console.log('');
        console.log(sub('rewriteQuery KHÁC query gốc → chạy refined search (lần 2)'));
        console.log(sub(`  "${sr1?.query}"  →  "${rw?.result}"`));
        console.log(sub('finalQuery (gửi LLM ở bước 6) = bản rewrite — GIỮ phủ định nếu có'));
        console.log(kv('  hybridSearch lần 2:', `query: "${sr2.query}"  |  topK=10`));
        console.log(ok(`hybridSearch lần 2 hoàn thành  ->  ${sr2.results.length} kết quả  ${C.gray}⏱ ${sr2.timeMs || 0}ms${C.reset}`));
        if (sr2.results.length > 0) {
          console.log('');
          console.log(`  ${C.bold}${C.dim}  #   ${'Tên sản phẩm'.padEnd(42)}  Score   Conf${C.reset}`);
          console.log(`  ${C.gray}  ${'-'.repeat(60)}${C.reset}`);
          sr2.results.forEach((r, i) => { const n = (r.name || '?').substring(0, 42).padEnd(42); const cf = r.lowConfidence ? `${C.yellow}low${C.reset}` : `${C.green}ok ${C.reset}`; console.log(`  ${C.gray}${String(i+1).padStart(3)}.${C.reset} ${n}  ${C.cyan}${fmtScore(r.score)}${C.reset}  ${cf}`); });
        }
        console.log('');
        console.log(sub(sr2.usedForFinal ? `Dùng kết quả lần 2 (rewrite) cho Generation  →  ${sr2.results.length} sản phẩm` : 'Lần 2 rỗng → fallback dùng initialResults (lần 1)'));
      } else {
        console.log('');
        console.log(sub(`rewriteQuery không đổi query → bỏ qua lần 2, dùng kết quả lần 1 cho Generation  →  ${sr1?.results?.length || data.productsFound} sản phẩm`));
      }
      if (data.usedLowFallback) console.log(warn('0 kết quả trên threshold → hạ minScore=0, lấy top-3 (fallback)'));
      break;
    }
    case '6_start': {
      console.log(step(6, 'Generation'));
      const isUp6 = (data.providerCount ?? data.llmMode === 'up') > 0 || data.llmMode === 'up';
      const tag6 = isUp6 ? `${C.bold}${C.green}[ LLM UP  ]${C.reset}` : `${C.bold}${C.yellow}[ LLM DOWN ]${C.reset}`;
      console.log(`  ${C.yellow}⏳  ${tag6}  Đang gọi LLM... (có thể mất 20-35 giây)${C.reset}`);
      break;
    }
    case '6': {
      if (data.usedFallback && !data.providerAttempts?.length && data.llmMode !== 'down') {
        console.log(warn(`LLM vượt ngân sách ${data.totalBudgetMs || 30000}ms → fallback simpleKeywordMatch`));
      }
      if (data.llmMode === 'down' || (data.usedFallback && !data.providerAttempts?.length)) {
        const noProvMsg = data.llmMode === 'down' ? 'Không có LLM provider' : `LLM timeout (${data.totalBudgetMs || 30000}ms)`;
        const skipLines = compact
          ? [`${C.yellow}${noProvMsg}${C.reset}  ${C.gray}→ [SKIP] A-E: sanitize / buildPrompt / messages[] / HTTP POST / parseLLMOutput${C.reset}`, '']
          : [`${C.yellow}${noProvMsg}  ->  các sub-steps LLM bị SKIP:${C.reset}`, `  ${C.gray}[SKIP] A. _sanitizeMessage     (không cần khi không gọi LLM)${C.reset}`, `  ${C.gray}[SKIP] B. buildAugmentedPrompt (không cần khi không gọi LLM)${C.reset}`, `  ${C.gray}[SKIP] C. build messages[]     (không cần khi không gọi LLM)${C.reset}`, `  ${C.gray}[SKIP] D. LLM HTTP POST        (không có provider)${C.reset}`, `  ${C.gray}[SKIP] E. parseLLMOutput       (không có response để parse)${C.reset}`, ''];
        const boxTitle = data.llmMode === 'down' ? 'LLM DOWN  —  simpleKeywordMatch  (keyword fallback)' : 'LLM TIMEOUT  —  simpleKeywordMatch  (graceful degradation)';
        console.log(box(boxTitle, [...skipLines, `  ${C.yellow}-> Fallback: simpleKeywordMatch (8 bước nội bộ):${C.reset}`, '  1. Tokenize + scoring     name match +10  |  description match +5', '  2. Version number filter  extract số model, loại SP sai phiên bản', '  3. Brand coherence check  loại kết quả sai brand', '  4. Negation filter        parse "không muốn/tránh X" -> loại', '  5. Price range filter     tầm/dưới/trên X triệu -> filter theo giá', '  6. Category prefix filter detect "laptop/điện thoại" -> filter loại SP', '  7. Sort + dedup           sort by matchScore giảm dần, loại trùng', '  8. Intent-aware response  pricing->💰  policy->📋  search->🔍  new->🌟'], C.yellow));
        console.log('');
        console.log(sub('Đang chạy simpleKeywordMatch...'));
        console.log(ok(`Hoàn thành  ${C.gray}⏱ ${data.timeMs}ms${C.reset}`));
      } else {
        if (data.brandsStr) console.log(kv('  _getCatalogData:', `brands: ${data.brandsStr.substring(0, 40)}`));
        if (data.sanitized) console.log(kv('  A. _sanitizeMessage(finalQuery):', `"${data.sanitized}..."`));
        if (data.promptLength) console.log(kv('  B. buildAugmentedPrompt:', `${data.promptLength} ký tự  (${data.productCount ?? 0} SP + store info)`));
        console.log(kv('  C. messages[]:', `[system(6 rules), ${data.historyMsgCount || 0} history, user+RAG_context]`));
        if (data.totalBudgetMs) console.log(kv('  Ngân sách tổng:', `LLM_TOTAL_TIMEOUT_MS=${data.totalBudgetMs}ms  (Promise.race bọc provider rotation)`));
        for (const a of (data.providerAttempts || [])) {
          console.log(kv('  D. LLM call:', `${a.model}  (provider ${a.index}/${a.total})  |  temp=0.3  |  max_tokens=800`));
          if (a.url) console.log(sub(`POST -> ${a.url}  (đang chờ...)`));
          if (a.status === 'ok') { console.log(ok(`Nhận phản hồi  (${a.timeMs}ms  |  ${a.rawLength} ký tự JSON)`)); console.log(kv('  E. parseLLMOutput:', 'extractJSON -> map names -> dedup -> extractProductsFromText')); console.log(ok('Hoàn thành')); }
          else if (a.status === 'retry') console.log(warn(`Provider ${a.index} lỗi (${a.errorCode}) → ${a.index < a.total ? `thử provider ${a.index + 1}` : 'fallback simpleKeywordMatch'}`));
          else if (a.status === 'break') console.log(warn(`Provider ${a.index} lỗi cố định (${a.errorCode}) → dừng retry`));
        }
        if (data.usedFallback) console.log(warn(`LLM vượt ngân sách ${data.totalBudgetMs}ms → fallback simpleKeywordMatch`));
      }
      break;
    }
    case '7':
      console.log(step(7, 'Persist  —  Session Memory  +  Database'));
      console.log(kv('  7a. Session memory:', `updatedMessages = ${data.updatedMsgCount || '?'} msgs  (giới hạn 20 = 10 turns)`));
      console.log(kv('     lastAccess:', data.lastAccessTime || new Date().toLocaleTimeString('vi-VN')));
      console.log(sub('_evictStaleSessions():  xóa TTL > 30 phút  +  LRU khi > 500 sessions'));
      console.log('');
      console.log(kv('  7b. DB persist:', 'ChatMessage.bulkCreate([userMsg, assistantMsg])  —  1 DB call'));
      console.log(sub('Fire-and-forget: .catch() chỉ log warning  ->  chatbot vẫn trả lời khi DB lỗi'));
      break;
  }
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
    if (res.error.includes('CONN') || res.error.includes('reset')) {
      await new Promise(r => setTimeout(r, 1000));
    } else {
      return res;
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
  const BOX = W;
  const inner = BOX - 2;
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
    centerLine('Dự án công nghệ'),
    border + C.reset,
  ].join('\n');
  console.log(HEADER);

  const noHttp     = args.includes('--no-http');
  const oneShot    = !!args.find(a => !a.startsWith('--'));
  let   currentMode = modeArg;
  let   sessionId   = sessionArg || 'demo-' + Date.now();

  if (sessionArg) {
    console.log(kv('Session ID:', `${C.teal}${sessionId}${C.reset}  ${C.green}(sync với UI)${C.reset}`));
  }

  // Watch mode
  if (watchMode) {
    console.log(kv('Mode:', currentMode));
    console.log(sub('Watch mode — tự follow session UI. Ctrl+C để dừng.\n'));

    const { ChatMessage } = require('@models');
    const http = require('http');

    let watchSessionId = sessionArg || null;
    let terminalBusy = false;
    let currentSSEReq = null; // giữ reference để ngắt khi đổi session

    // Vẽ lại prompt watch mode sau khi in async output
    const WATCH_PROMPT = `\n${C.gray}(lệnh: 'exit' thoát, 'mode:up/down/both' đổi mode)${C.reset}\n${C.bold}${C.cyan}> Terminal query: ${C.reset}`;
    // Chỉ vẽ lại dòng prompt (không vẽ lại hint đã có trên màn hình)
    const redrawPrompt = () => { if (!terminalBusy) process.stdout.write(`${C.bold}${C.cyan}> Terminal query: ${C.reset}`); };

    // ── Helper hiển thị KẾT QUẢ TRẢ VỀ (dùng chung cho SSE + streaming) ────────
    const displayResult = (aiResponse, stepAccum = {}) => {
      const tTotal = stepAccum.s7?.responseTimeMs || stepAccum.s6?.timeMs || 0;
      const intent = aiResponse.intent || stepAccum.s3?.intent || 'N/A';
      console.log('\n' + dividerHi('-'));
      console.log(`${C.bold}  KẾT QUẢ TRẢ VỀ CHO FRONTEND  ${C.gray}⏱ tổng ${tTotal}ms${C.reset}`);
      console.log(dividerHi('-'));
      console.log(kv('  intent:', `${C.cyan}${intent}${C.reset}`));
      console.log('');
      console.log(`  ${C.bold}Response đầy đủ:${C.reset}`);
      (aiResponse.response || '').split('\n').forEach(line => {
        if (line.length <= 90) { console.log(`    ${line}`); return; }
        const words = line.split(' '); let cur = '    ';
        for (const w of words) { if (cur.length + w.length > 94) { console.log(cur); cur = '    ' + w + ' '; } else cur += w + ' '; }
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
      console.log(dividerHi('=') + '\n');
    };

    // ── SSE client: nhận pipeline steps từ UI real-time ──────────────────────────
    let sseGeneration = 0; // tăng mỗi lần connectSSE → stale doConnect tự dừng
    const connectSSE = (sid) => {
      if (currentSSEReq) { try { currentSSEReq.destroy(); } catch { /* ignore */ } currentSSEReq = null; }
      if (!sid) return;
      const myGen = ++sseGeneration; // closure capture — stale nếu sseGeneration > myGen
      const sseAccum = { query: null };
      const doConnect = () => {
        if (sseGeneration !== myGen) return; // stale closure — dừng reconnect
        let reconnectScheduled = false; // chỉ schedule reconnect 1 lần dù nhiều error fires
        const scheduleReconnect = (delay) => {
          if (reconnectScheduled || sseGeneration !== myGen) return;
          reconnectScheduled = true;
          setTimeout(doConnect, delay);
        };
        const req = http.get(
          `http://localhost:8888/api/chatbot/events?sessionId=${encodeURIComponent(sid)}`,
          (res) => {
            let buf = '';
            res.on('data', chunk => {
              buf += chunk.toString();
              const events = buf.split('\n\n');
              buf = events.pop();
              for (const event of events) {
                if (event.startsWith(':')) continue; // heartbeat
                const dataLine = event.split('\n').find(l => l.startsWith('data: '));
                if (!dataLine) continue;
                try {
                  const msg = JSON.parse(dataLine.slice(6));
                  if (terminalBusy) continue; // terminal đang xử lý query riêng
                  // Erase prompt line trước khi in — chỉ khi không busy
                  process.stdout.write('\r\x1b[2K');
                  if (msg.type === 'connected') {
                    console.log(`\n${C.teal}${C.bold}[SSE]${C.reset} Kết nối real-time session ${C.dim}${sid}${C.reset}`);
                    redrawPrompt();
                  } else if (msg.type === 'start') {
                    sseAccum.query = msg.query; sseAccum.normalized = null; sseAccum.s3 = null; sseAccum.s6 = null; sseAccum.s7 = null;
                    console.log(`\n${C.teal}${C.bold}[UI → Terminal]${C.reset} Query mới: "${msg.query}"`);
                    // Header banner
                    const hdrIn = W - 2;
                    const cl2 = (t) => { const p = hdrIn - t.length; const l = Math.floor(p/2); return '|' + ' '.repeat(l) + t + ' '.repeat(p-l) + '|'; };
                    const hdrB = '+' + '='.repeat(hdrIn) + '+';
                    console.log('\n' + C.bold + C.teal + hdrB);
                    console.log(cl2('TECHSTORE RAG CHATBOT  --  PIPELINE DEMO'));
                    console.log(cl2('Luận văn tốt nghiệp'));
                    console.log(hdrB + C.reset);
                    console.log(`  Query:${' '.repeat(16)}"${msg.query}"`);
                    console.log(`  Mode:${' '.repeat(17)}up`);
                    const mT = `${C.bold}${C.green}[ LLM UP  ]${C.reset}`;
                    console.log('\n' + dividerHi('='));
                    console.log(`${C.bold}  RAG PIPELINE DEMO  |  Mode: ${mT}  ${compact ? `${C.dim}[compact]${C.reset}` : `${C.dim}[detailed]${C.reset}`}${C.reset}`);
                    console.log(dividerHi('='));
                    console.log(kv('Query đầu vào:', `"${msg.query}"`));
                  } else if (msg.type === 'step') {
                    if (msg.step === '2' && msg.data?.after) sseAccum.normalized = msg.data.after;
                    if (msg.step === '3') sseAccum.s3 = msg.data;
                    if (msg.step === '4') sseAccum.s4 = msg.data;
                    if (msg.step === '6') sseAccum.s6 = msg.data;
                    if (msg.step === '7') sseAccum.s7 = msg.data;
                    displayStreamStep(msg.step, msg.data, sseAccum);
                  } else if (msg.type === 'done' && sseAccum.query) {
                    displayResult(msg.data, sseAccum);
                    redrawPrompt();
                  }
                } catch { /* ignore parse error */ }
              }
            });
            res.on('end', () => {
              if (watchSessionId === sid) scheduleReconnect(3000);
            });
            res.on('error', () => {
              if (watchSessionId === sid) scheduleReconnect(3000);
            });
          }
        );
        req.on('error', () => {
          if (watchSessionId === sid) scheduleReconnect(5000);
        });
        currentSSEReq = req;
      };
      doConnect();
    };

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

    const initSession = async (sid) => {
      watchSessionId = sid;
      const count = await ChatMessage.count({ where: { sessionId: sid } }).catch(() => 0);
      console.log(`${C.teal}${C.bold}[Watch]${C.reset} Đang theo dõi session id: ${C.dim}${sid}${C.reset} (${count} msgs hiện có)`);
      connectSSE(sid);
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

    // Chỉ kiểm tra session change — DB message polling thay bằng SSE
    const checkSession = async () => {
      if (terminalBusy) return;
      const latestSid = await fetchLatestSession();
      if (latestSid && latestSid !== watchSessionId) {
        console.log(`\n${C.yellow}[Watch]${C.reset} Session UI đổi → follow session mới: ${C.dim}${latestSid}${C.reset}`);
        await initSession(latestSid);
        return;
      }
      if (!watchSessionId && latestSid) await initSession(latestSid);
    };

    setInterval(checkSession, 2000);

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askWatch = () => {
      process.stdout.write(WATCH_PROMPT);
      rl.once('line', async (input) => {
        input = input.trim();
        if (!input || input === 'exit') { rl.close(); process.exit(0); }
        if (input.startsWith('mode:')) {
          currentMode = input.split(':')[1] || currentMode;
          console.log(ok(`Mode → ${C.cyan}${currentMode}${C.reset}`));
          if (currentMode === 'down') console.log(sub(`${C.dim}mode:down → local pipeline, không gọi server LLM.${C.reset}`));
        } else {
          const sid = watchSessionId || 'demo-' + Date.now();
          terminalBusy = true;
          try {
            if (currentMode === 'down') {
              // mode:down → local pipeline (không gọi server LLM, tức thì, không cần sync UI)
              console.log(`\n${C.teal}${C.bold}[Terminal Local]${C.reset} Chạy local pipeline (LLM DOWN)  ${C.gray}(session: ${sid.slice(0,8)}...)${C.reset}`);
              await runPipeline(input, 'down', sid);
            } else {
              // mode:up/both → server streaming
              console.log(`\n${C.teal}${C.bold}[Terminal → Server]${C.reset} Gửi: "${input}"  ${C.gray}(session: ${sid.slice(0,8)}...)${C.reset}`);
              const hdrInner = W - 2;
              const cl = (text) => { const p = hdrInner - text.length; const l = Math.floor(p/2); return '|' + ' '.repeat(l) + text + ' '.repeat(p-l) + '|'; };
              const hdrBorder = '+' + '='.repeat(hdrInner) + '+';
              console.log('\n' + C.bold + C.teal + hdrBorder);
              console.log(cl('TECHSTORE RAG CHATBOT  --  PIPELINE DEMO'));
              console.log(cl('Luận văn tốt nghiệp'));
              console.log(hdrBorder + C.reset);
              console.log(`  Query:${' '.repeat(16)}"${input}"`);
              console.log('\n' + dividerHi('='));
              console.log(`${C.bold}  RAG PIPELINE DEMO  |  ${compact ? `${C.dim}[compact]${C.reset}` : `${C.dim}[detailed]${C.reset}`}${C.reset}`);
              console.log(dividerHi('='));
              console.log(kv('Query đầu vào:', `"${input}"`));
              const accum = { query: input };
              await callChatbotServerStreaming(input, sid, (msg) => {
                if (msg.type === 'step') {
                  if (msg.step === '2' && msg.data?.after) accum.normalized = msg.data.after;
                  if (msg.step === '3') accum.s3 = msg.data;
                  if (msg.step === '4') accum.s4 = msg.data;
                  if (msg.step === '6') accum.s6 = msg.data;
                  if (msg.step === '7') accum.s7 = msg.data;
                  displayStreamStep(msg.step, msg.data, accum);
                } else if (msg.type === 'done') {
                  displayResult(msg.data, accum);
                } else if (msg.type === 'error') {
                  console.log(warn(`Server lỗi: ${msg.data?.message || 'unknown'}`));
                }
              });
              console.log(sub(`${C.green}✓ UI sẽ hiển thị cùng response này${C.reset}`));
            }
          } catch (e) {
            if (e.message === 'stream timeout' || e.message?.includes('ECONNREFUSED')) {
              console.log(warn(`Server streaming không khả dụng — fallback trace`));
              try {
                const res = await callChatbotServer(input, sid, { trace: true });
                if (res.ok && res.data?.data?.trace) {
                  const d = res.data.data;
                  displayPipeline(res.data.data.trace, input, { intent: d.intent, response: d.response, products: d.products, suggestions: d.suggestions });
                }
              } catch { /* ignore */ }
            } else {
              console.error(`${C.red}Lỗi stream:${C.reset}`, e.message);
            }
          }
          terminalBusy = false;
        }
        askWatch();
      });
    };
    askWatch();
    return;
  }

  // One-shot
  if (oneShot) {
    const inputQuery = query;
    console.log(kv('Query:', `"${inputQuery}"`));
    console.log(kv('Mode:', currentMode));
    const httpP = (noHttp || oneShot) ? null : callChatbotServer(inputQuery, sessionId);
    try {
      if (currentMode === 'down' || currentMode === 'both') await runPipeline(inputQuery, 'down', sessionId);
      if (currentMode === 'up'   || currentMode === 'both') await runPipeline(inputQuery, 'up', sessionId);
    } catch (e) { console.error(`\n${C.red}Lỗi:${C.reset}`, e.message); }
    if (httpP) printServerResponse(await httpP);
    process.exit(0);
  }

  // Interactive loop
  console.log(kv('Mode:', currentMode));
  console.log(kv('Session ID:', sessionId));
  console.log(sub('Chạy interactive — nhập query để trace pipeline'));

  while (true) {
    const input = await askQuery(sessionId);

    if (!input || input === 'exit' || input === 'quit') {
      console.log(ok('Thoát demo.'));
      process.exit(0);
    }

    if (input.startsWith('mode:')) {
      currentMode = input.split(':')[1]?.trim() || currentMode;
      console.log(ok(`Đã đổi mode → ${C.cyan}${currentMode}${C.reset}`));
      continue;
    }

    if (input === 'clear') {
      process.stdout.write('\x1Bc');
      const oldSid = sessionId;
      sessionId = 'demo-' + Date.now();
      const r = await clearSessionOnServer(oldSid);
      console.log(HEADER);
      console.log(ok(`Session đã xóa  (old: ${oldSid})`));
      if (r) console.log(sub(`Server: ${r.message || JSON.stringify(r)}`));
      console.log(kv('Session mới:', sessionId));
      console.log(kv('Mode:', currentMode));
      continue;
    }

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
