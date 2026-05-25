/**
 * @file fuzzy-expander.js
 * @layer Service
 * @module ai
 *
 * FuzzyExpander — mở rộng viết tắt dựa trên product catalog, không hardcode, không LLM.
 *
 * Thuật toán:
 *   1. Load tất cả product names từ vector store (đã có sẵn trong RAM)
 *   2. Tách thành tokens, build bảng prefix → full term
 *   3. Với mỗi token ngắn trong query, tìm best match qua prefix + edit distance
 *   4. Thay thế nếu confidence đủ cao
 *
 * Ưu điểm so với ABBREV_MAP cứng:
 *   - Tự cập nhật khi thêm brand/model mới vào DB
 *   - Không cần maintain tay
 *   - Hoạt động khi LLM down
 */

// ── Edit distance (Levenshtein) ───────────────────────────────────────────────

function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const temp = dp[i];
      dp[i] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[i - 1], dp[i]);
      prev = temp;
    }
  }
  return dp[m];
}

// ── Build token index từ product names ───────────────────────────────────────

/**
 * Tạo prefix map từ product names.
 * Ví dụ: "iPhone 17 Pro Max" → {"ip": ["iPhone"], "iph": ["iPhone"], ...}
 *
 * Chỉ build cho token có ít nhất 3 ký tự (tránh prefix quá ngắn → ambiguous).
 * Token số (17, 25...) bỏ qua — số model giữ nguyên, không expand.
 */
function buildPrefixIndex(productNames) {
  // Map: prefix (lowercase) → Set<full term (original case)>
  const index = new Map();

  for (const name of productNames) {
    // Tách theo whitespace, giữ cả token chữ-số kiểu "A57", "S25"
    const tokens = name.split(/\s+/).filter(t => /[a-zA-Z]/.test(t) && t.length >= 3);

    for (const token of tokens) {
      const lower = token.toLowerCase();
      // Add prefixes từ độ dài 2 đến token.length - 1
      for (let len = 2; len < lower.length; len++) {
        const prefix = lower.slice(0, len);
        if (!index.has(prefix)) index.set(prefix, new Set());
        index.get(prefix).add(token);
      }
      // Add chính token đó (full match)
      if (!index.has(lower)) index.set(lower, new Set());
      index.get(lower).add(token);
    }
  }

  return index;
}

// ── Expand một token ─────────────────────────────────────────────────────────

/**
 * Tìm expansion tốt nhất cho một sub-token (chỉ chữ, không số).
 * Internal — gọi từ expandTokenWithSplit.
 *
 * @param {string|null} nextNumSeg - Số model liền sau (nếu có), dùng để disambiguate.
 */
function expandLetterToken(token, index, threshold, nextNumSeg = null) {
  if (token.length < 2) return { expanded: token, score: 1, method: 'keep' };

  // Exact prefix match
  if (index.has(token)) {
    const candidates = [...index.get(token)];
    if (candidates.length === 1) return { expanded: candidates[0], score: 1.0, method: 'exact_prefix' };

    // Nhiều candidates → dùng số model kế tiếp để disambiguate
    // Ví dụ: "ip" + "17" → ưu tiên candidate có "17" trong product names (iPhone 17, không phải iPad A16)
    if (nextNumSeg) {
      const withNum = candidates.filter(c => c.toLowerCase().includes(nextNumSeg));
      if (withNum.length === 1) return { expanded: withNum[0], score: 0.9, method: 'prefix_disambig' };
    }
    // Fallback: candidate dài nhất thường cụ thể hơn (iPhone vs iPad → chọn dài hơn không hợp lý)
    // Chọn candidate có tên thông dụng nhất (alphabetical first không tốt)
    // → skip nếu quá ambiguous
    return { expanded: token, score: 0, method: 'keep' }; // ambiguous → không expand
  }

  // Edit-distance prefix match
  let bestExpanded = token;
  let bestScore = threshold;
  let bestMethod = 'keep';

  for (const [prefix, terms] of index) {
    if (Math.abs(prefix.length - token.length) > 1) continue;
    const dist = editDistance(token, prefix);
    const score = 1 - dist / Math.max(token.length, prefix.length);
    if (score > bestScore) {
      bestScore = score;
      bestExpanded = [...terms].sort((a, b) => a.length - b.length)[0];
      bestMethod = 'edit_distance';
    }
  }

  return { expanded: bestExpanded, score: bestScore, method: bestMethod };
}

/**
 * Expand một token, tự split theo letter/digit boundary trước.
 * "ip17pm" → ["ip", "17", "pm"] → expand từng phần → "iPhone 17pm"
 *   (số giữa không expand; "pm" chỉ expand nếu là prefix rõ ràng)
 */
function expandTokenWithSplit(token, index, threshold = 0.75) {
  // Tách token thành segments: chữ xen số
  // "ip17pm" → ["ip", "17", "pm"]  |  "samsung" → ["samsung"]
  const segments = token.match(/[a-zA-Z]+|\d+/g) || [token];

  // Nếu chỉ 1 segment và dài ≥ 6 → giữ nguyên (chắc không phải viết tắt)
  if (segments.length === 1 && token.length >= 6) {
    return { expanded: token, score: 1, method: 'keep' };
  }

  const expandedParts = segments.map((seg, idx) => {
    if (/^\d+$/.test(seg)) return { part: seg, changed: false }; // số → giữ nguyên
    const nextNumSeg = segments[idx + 1] && /^\d+$/.test(segments[idx + 1]) ? segments[idx + 1] : null;
    const result = expandLetterToken(seg.toLowerCase(), index, threshold, nextNumSeg);
    const expandedLower = result.expanded.toLowerCase();
    const didChange = result.method !== 'keep' && expandedLower !== seg.toLowerCase();
    if (!didChange) return { part: seg, changed: false };

    // Dedup: nếu expanded đã chứa số model của segment kế tiếp → bỏ số đó ra
    const nextSeg = segments[idx + 1];
    let finalExpanded = result.expanded;
    if (nextSeg && /^\d+$/.test(nextSeg) && expandedLower.includes(nextSeg)) {
      // expanded = "Reno15", nextSeg = "15" → chỉ giữ expanded, bỏ nextSeg
      segments[idx + 1] = ''; // mark để skip
    }

    return { part: finalExpanded, changed: true, score: result.score, method: result.method };
  }).filter((p, i) => {
    // Bỏ các segment đã bị mark rỗng do dedup trên
    return segments[i] !== '';
  });

  const anyChanged = expandedParts.some(p => p.changed);
  if (!anyChanged) return { expanded: token, score: 1, method: 'keep' };

  const reconstructed = expandedParts.map(p => p.part).filter(Boolean).join(' ').trim();
  const firstChange = expandedParts.find(p => p.changed);
  return { expanded: reconstructed, score: firstChange?.score ?? 0.8, method: firstChange?.method ?? 'split' };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Mở rộng query bằng cách thay thế viết tắt với full term từ product catalog.
 *
 * @param {string} query - Query gốc của user.
 * @param {string[]} productNames - Tên sản phẩm từ vector store / DB.
 * @param {Object} [opts]
 * @param {number} [opts.threshold=0.75] - Ngưỡng confidence tối thiểu.
 * @param {boolean} [opts.debug=false] - Trả về chi tiết từng token.
 * @returns {{ expanded: string, changes: Array, changed: boolean }}
 */
function fuzzyExpandQuery(query, productNames, { threshold = 0.75, debug = false } = {}) {
  if (!query || !productNames.length) return { expanded: query, changes: [], changed: false };

  const index = buildPrefixIndex(productNames);
  const tokens = query.split(/(\s+)/); // giữ whitespace để reconstruct
  const changes = [];
  let changed = false;

  const resultParts = tokens.map(part => {
    if (!part.trim()) return part; // whitespace → giữ nguyên

    const lower = part.toLowerCase();
    const { expanded, score, method } = expandTokenWithSplit(lower, index, threshold);

    if (method !== 'keep' && expanded.toLowerCase() !== lower) {
      // Giữ case gốc nếu expansion ngắn hơn (viết hoa đầu)
      const result = expanded.charAt(0).toUpperCase() + expanded.slice(1);
      changes.push({ original: part, expanded: result, score: Math.round(score * 100) + '%', method });
      changed = true;
      return result;
    }

    return part;
  });

  return {
    expanded: resultParts.join(''),
    changes,
    changed,
  };
}

module.exports = { fuzzyExpandQuery, buildPrefixIndex, editDistance };
