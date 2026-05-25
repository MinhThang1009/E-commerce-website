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
  if (process.env.LLM_API_KEY && baseUrl && process.env.LLM_MODEL_1) {
    demoProviders.push({ key: process.env.LLM_API_KEY, url: `${baseUrl}/chat/completions`, model: process.env.LLM_MODEL_1 });
  }
  if (process.env.LLM_MODEL_2) {
    demoProviders.push({
      key: process.env.LLM_API_KEY_2 || process.env.LLM_API_KEY,
      url: `${process.env.LLM_BASE_URL_2 || baseUrl}/chat/completions`,
      model: process.env.LLM_MODEL_2,
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
    console.log(fail(`Không hợp lệ: ${v.reason}`));
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
    console.log(warn('⚠️  Prompt injection → trả về phản hồi bảo vệ, kết thúc pipeline'));
    return;
  }
  if (offTopic) {
    console.log(warn('⚠️  Off-topic → trả về thông báo phạm vi hỗ trợ, kết thúc pipeline'));
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
  const hasPronoun = PRONOUN_RE.test(normalized);
  const BRAND_RE = /iphone|samsung|macbook|xiaomi|oppo|realme|apple|dell|asus|acer|casio|citizen|laptop|tablet|điện thoại|đồng hồ|máy tính|smartwatch|earphone|headphone|airpod/i;
  const isImplicitFollowup = !hasPronoun && normalized.trim().length <= 50 && !BRAND_RE.test(normalized);
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
      const firstBullet = text.split('\n').find(l => l.includes('•'));
      if (firstBullet) return firstBullet.replace(/^.*?•\s*/, '').replace(/\s*-\s*[\d.,]+.*$/, '').trim();
      return text.substring(0, 60);
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

  const queryForRetrieval = enrichedQuery
    .replace(/(?:không\s+(?:cần|muốn|thích|dùng)|tránh|avoid|don't\s+want)\s+[\p{L}\p{N}\s,/]+?(?=\s+(?:gì|hay|hoặc|được|cũng|mà|nhưng|,|$)|\s*$)/igu, ' ')
    .trim() || enrichedQuery;

  if (queryForRetrieval !== enrichedQuery) {
    console.log(warn('Strip mệnh đề phủ định trước khi embedding:'));
    console.log(kv('  Trước:', `"${enrichedQuery}"`));
    console.log(kv('  Sau:', `"${queryForRetrieval}"`));
  } else {
    console.log(kv('  Strip negation:', 'Không có mệnh đề phủ định'));
  }

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
            { role: 'user', content: queryForRetrieval },
          ],
          max_tokens: 80, temperature: 0,
        }, { headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' }, timeout: 8000 });
        const rw = rwRes.data.choices?.[0]?.message?.content?.trim();
        if (rw && rw.toLowerCase() !== normalized.toLowerCase()) llmRewrite = rw;
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
    console.log(kv('  rewriteQuery:', `${C.yellow}[SKIP] Chưa cấu hình LLM_MODEL_1 / LLM_MODEL_2${C.reset}`));
  } else {
    console.log(kv('  rewriteQuery:', `${C.yellow}[SKIP] LLM DOWN mode${C.reset}`));
  }
  console.log(kv('  hybridSearch:', 'Chạy — semantic (cosine) + keyword (BM25)  |  topK=10'));

  // hybridSearch lần 1 (chatbot-service.js:439)
  const t0 = Date.now();
  await vectorStoreService.loadPromise;
  const initialResults = await vectorStoreService.hybridSearch(queryForRetrieval, 10);
  const t1 = Date.now();

  console.log(ok(`hybridSearch lần 1 hoàn thành  ->  ${initialResults.length} kết quả  ${C.gray}⏱ ${t1 - t0}ms${C.reset}`));
  console.log('');
  console.log(`  ${C.bold}${C.dim}  #   ${'Tên sản phẩm'.padEnd(42)}  Score   Conf${C.reset}`);
  console.log(`  ${C.gray}  ${'-'.repeat(60)}${C.reset}`);
  initialResults.forEach((r, i) => {
    const name  = (r.metadata?.name || '?').substring(0, 42).padEnd(42);
    const score = fmtScore(r.score);
    const conf  = r.lowConfidence ? `${C.yellow}low${C.reset}` : `${C.green}ok ${C.reset}`;
    console.log(`  ${C.gray}${String(i+1).padStart(3)}.${C.reset} ${name}  ${C.cyan}${score}${C.reset}  ${conf}`);
  });

  // hybridSearch lần 2 khi rewrite khác query (chatbot-service.js:445-465)
  let products;
  let finalQuery = enrichedQuery;
  if (llmRewrite) {
    finalQuery = llmRewrite;
    const t2 = Date.now();
    const refinedResults = await vectorStoreService.hybridSearch(llmRewrite, 10);
    const useRefined = refinedResults.length > 0;
    console.log(ok(`hybridSearch lần 2 (rewrite)  ->  ${refinedResults.length} kết quả  ${C.gray}⏱ ${Date.now() - t2}ms${C.reset}`));
    if (!useRefined) console.log(sub('Lần 2 rỗng → fallback dùng initialResults (lần 1)'));
    const results = useRefined ? refinedResults : initialResults;
    products = results.map(r => ({ ...r.metadata, score: r.score, ...(r.lowConfidence && { lowConfidence: true }) }));
  } else {
    products = initialResults.map(r => ({ ...r.metadata, score: r.score, ...(r.lowConfidence && { lowConfidence: true }) }));
  }

  // K1 fallback khi 0 kết quả (chatbot-service.js:468-476)
  if (products.length === 0) {
    console.log(warn('0 kết quả trên threshold → hạ minScore=0, lấy top-3 (fallback)'));
    try {
      const t3 = Date.now();
      const lowResults = await vectorStoreService.hybridSearch(finalQuery, 3, 0);
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
      console.log(warn('Chưa cấu hình LLM_MODEL_1 / LLM_MODEL_2 → fallback simpleKeywordMatch'));
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
          Brand.findAll({ attributes: ['nameVi'], raw: true }),
          Category.findAll({ attributes: ['nameVi'], where: { parentId: null }, raw: true }),
        ]);
        if (brands.length) brandsStr    = brands.map(b => b.nameVi).filter(Boolean).join(', ');
        if (cats.length)   categoriesStr = cats.map(c => c.nameVi).filter(Boolean).join(', ');
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

      console.log(kv('  N1._getCatalogData:', brandsStr ? `brands: ${brandsStr.substring(0, 40)}` : `${C.dim}(empty — server không phản hồi)${C.reset}`));
      console.log(kv('  A. _sanitizeMessage:', `"${sanitized.substring(0, 55)}..."`));
      console.log(kv('  B. buildAugmentedPrompt:', `${augPrompt.length} ký tự  (${products.length} SP + store info)`));
      console.log(kv('  C. messages[]:', `[system(6 rules), ${conversationHistory.length} history, user+RAG_context]`));

      let llmSuccess = false;
      for (let pi = 0; pi < demoProviders.length; pi++) {
        const p = demoProviders[pi];
        console.log(kv('  D. LLM call:', `${p.model}  (provider ${pi + 1}/${demoProviders.length})  |  temp=0.3  |  max_tokens=800`));
        console.log(sub(`POST -> ${p.url}  (đang chờ...)`));
        const t2 = Date.now();
        try {
          const res = await axios.post(p.url,
            { model: p.model, messages, response_format: { type: 'json_object' }, temperature: 0.3, max_tokens: 800 },
            { headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' }, timeout: 30000 }
          );
          const raw = res.data.choices?.[0]?.message?.content || '';
          if (!raw) { console.log(warn(`Provider ${pi + 1} trả về rỗng → thử tiếp`)); continue; }
          console.log(ok(`Nhận phản hồi  (${Date.now() - t2}ms  |  ${raw.length} ký tự JSON)`));
          console.log(kv('  E. parseLLMOutput:', 'extractJSON -> map names -> dedup -> extractProductsFromText'));
          aiResponse = responseParser.parseLLMOutput(raw, products, finalQuery);
          console.log(ok('Hoàn thành'));
          llmSuccess = true;
          break;
        } catch (err) {
          const status = err.response?.status;
          // 400/401: lỗi cố định → break ngay (chatbot-service.js:698-704)
          if (status === 400 || status === 401) {
            console.log(warn(`Provider ${pi + 1} lỗi cố định (${status}) → dừng retry`));
            break;
          }
          // 429/402/500/503/network → thử provider tiếp
          if (pi + 1 < demoProviders.length)
            console.log(warn(`Provider ${pi + 1} lỗi (${status || err.code}) → thử provider ${pi + 2}`));
          else
            console.log(warn(`Tất cả providers lỗi → fallback simpleKeywordMatch`));
        }
      }
      if (!llmSuccess) {
        const { simpleKeywordMatch } = require('@modules/ai/services/chatbot/keyword/keyword-fallback');
        aiResponse = simpleKeywordMatch(finalQuery, products);
      }
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

// ── HTTP song song đến server đang chạy ──────────────────────────────────────

async function callChatbotServer(query, sid, retries = 2) {
  const http = require('http');
  const SERVER = 'http://localhost:8888/api/chatbot/message';
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

    let watchSessionId = sessionArg || null;
    let lastCount = 0;

    // Khởi tạo session và count hiện tại
    const initSession = async (sid) => {
      const res = await httpGet(`http://localhost:8888/api/chatbot/session/${sid}/messages`);
      lastCount = res?.data?.messages?.length ?? 0;
      watchSessionId = sid;
      console.log(`${C.teal}${C.bold}[Watch]${C.reset} Đang theo dõi session id: ${C.dim}${sid}${C.reset} (${lastCount} msgs hiện có)`);
    };

    if (watchSessionId) {
      await initSession(watchSessionId);
    } else {
      // Auto-detect session mới nhất
      const res = await httpGet('http://localhost:8888/api/chatbot/session/latest');
      if (res?.data?.sessionId) await initSession(res.data.sessionId);
      else console.log(sub('Chưa có session nào — chờ UI gửi tin đầu tiên...'));
    }

    const poll = async () => {
      // Kiểm tra xem UI có tạo session mới không (khi user xóa chat)
      const latestRes = await httpGet('http://localhost:8888/api/chatbot/session/latest');
      const latestSid = latestRes?.data?.sessionId;
      if (latestSid && latestSid !== watchSessionId) {
        // Session đổi → follow session mới, reset count
        console.log(`\n${C.yellow}[Watch]${C.reset} Session UI đổi → follow session mới: ${C.dim}${latestSid}${C.reset}`);
        await initSession(latestSid);
        return;
      }

      if (!watchSessionId) return;

      const res = await httpGet(`http://localhost:8888/api/chatbot/session/${watchSessionId}/messages`);
      const msgs = res?.data?.messages ?? [];

      if (msgs.length > lastCount) {
        const newMsgs = msgs.slice(lastCount).filter(m => m.role === 'user');
        lastCount = msgs.length;
        for (const m of newMsgs) {
          console.log(`\n${C.teal}${C.bold}[UI → Terminal]${C.reset} Query mới: "${m.content}"`);
          try {
            if (currentMode === 'down' || currentMode === 'both') await runPipeline(m.content, 'down', watchSessionId);
            if (currentMode === 'up'   || currentMode === 'both') await runPipeline(m.content, 'up', watchSessionId);
          } catch (e) { console.error(`${C.red}Lỗi trace:${C.reset}`, e.message); }
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
          console.log(`\n${C.teal}${C.bold}[Terminal]${C.reset} Chạy pipeline cho: "${input}"  ${C.gray}(session: ${sid.slice(0,8)}...)${C.reset}`);
          // Gửi HTTP đến server song song để UI auto-poll bắt được
          const httpP = noHttp ? null : callChatbotServer(input, sid);
          // Tăng lastCount ngay lập tức — tránh poll 2s phát hiện message này và trace lại
          if (!noHttp) lastCount += 2;
          try {
            if (currentMode === 'down' || currentMode === 'both') await runPipeline(input, 'down', sid);
            if (currentMode === 'up'   || currentMode === 'both') await runPipeline(input, 'up', sid);
          } catch (e) { console.error(`${C.red}Lỗi:${C.reset}`, e.message); }
          if (httpP) {
            const res = await httpP.catch(e => ({ ok: false, error: e.message }));
            if (res && res.ok === false) {
              console.log(warn(`HTTP sync thất bại (${res.error || 'unknown'}) — dùng --no-http để tắt sync`));
            } else {
              console.log(sub(`${C.green}✓ Đã sync với server${C.reset} — UI auto-poll sẽ cập nhật trong ~3s`));
            }
          }
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
    const httpP = noHttp ? null : callChatbotServer(inputQuery, sessionId);
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
