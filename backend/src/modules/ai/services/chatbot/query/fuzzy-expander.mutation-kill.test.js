/**
 * fuzzy-expander.mutation-kill.test.js
 *
 * Bổ sung cho fuzzy-expander.test.js — kill mutant bằng golden-output:
 * fuzzyExpandQuery trả về { expanded, changes, changed } → so khớp CHÍNH XÁC
 * cho từng method (exact_prefix / prefix_disambig / edit_distance / multi-segment),
 * threshold option, whitespace preserve, case-capitalize, score format.
 * buildPrefixIndex: token filter + full-token key.
 */

const { fuzzyExpandQuery, buildPrefixIndex, editDistance } = require('./fuzzy-expander');

// ══════════════════════════════════════════════════════════════════════════════
// fuzzyExpandQuery — golden output từng method
// ══════════════════════════════════════════════════════════════════════════════

describe('fuzzyExpandQuery output', () => {
  it('exact_prefix single candidate → expand + capitalize + score 100%', () => {
    expect(fuzzyExpandQuery('ip', ['iPhone'])).toEqual({
      expanded: 'IPhone',
      changes: [{ original: 'ip', expanded: 'IPhone', score: '100%', method: 'exact_prefix' }],
      changed: true,
    });
  });

  it('nhiều candidate, không disambiguate được → KHÔNG expand', () => {
    expect(fuzzyExpandQuery('ip', ['iPhone', 'iPad'])).toEqual({
      expanded: 'ip',
      changes: [],
      changed: false,
    });
  });

  it('prefix_disambig: số model kế tiếp lọc đúng 1 candidate + dedup số → score 90%', () => {
    expect(fuzzyExpandQuery('re8', ['Reno8 Pro', 'Realme C55'])).toEqual({
      expanded: 'Reno8',
      changes: [{ original: 're8', expanded: 'Reno8', score: '90%', method: 'prefix_disambig' }],
      changed: true,
    });
  });

  it('edit_distance: token gần prefix (dist 1) → expand, score 83%', () => {
    expect(fuzzyExpandQuery('galxy', ['Galaxy'])).toEqual({
      expanded: 'Galaxy',
      changes: [{ original: 'galxy', expanded: 'Galaxy', score: '83%', method: 'edit_distance' }],
      changed: true,
    });
  });

  it('multi-segment "ip17pm" → "IPhone 17 pm" (số giữ nguyên, pm không khớp)', () => {
    expect(fuzzyExpandQuery('ip17pm', ['iPhone 17 Pro Max'])).toEqual({
      expanded: 'IPhone 17 pm',
      changes: [
        { original: 'ip17pm', expanded: 'IPhone 17 pm', score: '100%', method: 'exact_prefix' },
      ],
      changed: true,
    });
  });

  it('giữ nguyên whitespace giữa các token (chỉ expand "ip")', () => {
    expect(fuzzyExpandQuery('ip mini', ['iPhone', 'mini case'])).toEqual({
      expanded: 'IPhone mini',
      changes: [{ original: 'ip', expanded: 'IPhone', score: '100%', method: 'exact_prefix' }],
      changed: true,
    });
  });

  it('token đơn dài ≥6 ký tự → giữ nguyên, KHÔNG expand (early-return)', () => {
    // "galaxyy" (7) gần "Galaxy" (edit-dist 1) nhưng là 1 segment dài → giữ nguyên.
    // Mutant bỏ early-return → sẽ expand thành Galaxy.
    expect(fuzzyExpandQuery('galaxyy', ['Galaxy'])).toEqual({
      expanded: 'galaxyy',
      changes: [],
      changed: false,
    });
  });

  it('token đơn đúng 6 ký tự → giữ nguyên (biên >= 6)', () => {
    // "galaxx" (6) gần "Galaxy" nhưng length===6 → early-return giữ nguyên.
    // Mutant >= 6 → > 6 sẽ cho 6 ký tự lọt xuống edit-distance → expand.
    expect(fuzzyExpandQuery('galaxx', ['Galaxy'])).toEqual({
      expanded: 'galaxx',
      changes: [],
      changed: false,
    });
  });

  it('giữ nguyên nhiều khoảng trắng giữa token (split /(\\s+)/ gom nhóm)', () => {
    expect(fuzzyExpandQuery('ip  mini', ['iPhone', 'mini case'])).toEqual({
      expanded: 'IPhone  mini',
      changes: [{ original: 'ip', expanded: 'IPhone', score: '100%', method: 'exact_prefix' }],
      changed: true,
    });
  });

  it('dedup số model + segment chữ theo sau: "re8x" → "Reno8 x"', () => {
    expect(fuzzyExpandQuery('re8x', ['Reno8 Pro'])).toEqual({
      expanded: 'Reno8 x',
      changes: [{ original: 're8x', expanded: 'Reno8 x', score: '100%', method: 'exact_prefix' }],
      changed: true,
    });
  });

  it('nhiều token: chỉ expand token khớp, giữ token + whitespace còn lại', () => {
    expect(fuzzyExpandQuery('ss va ip', ['Samsung', 'iPhone'])).toEqual({
      expanded: 'ss va IPhone',
      changes: [{ original: 'ip', expanded: 'IPhone', score: '100%', method: 'exact_prefix' }],
      changed: true,
    });
  });

  it('edit_distance nội suy khác (samsn → Samsung, 83%)', () => {
    expect(fuzzyExpandQuery('samsn', ['Samsung'])).toEqual({
      expanded: 'Samsung',
      changes: [{ original: 'samsn', expanded: 'Samsung', score: '83%', method: 'edit_distance' }],
      changed: true,
    });
  });

  it('query rỗng → giữ nguyên', () => {
    expect(fuzzyExpandQuery('', ['iPhone'])).toEqual({ expanded: '', changes: [], changed: false });
  });

  it('productNames rỗng → giữ nguyên', () => {
    expect(fuzzyExpandQuery('hello', [])).toEqual({
      expanded: 'hello',
      changes: [],
      changed: false,
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// threshold option — chi phối edit_distance có expand hay không
// ══════════════════════════════════════════════════════════════════════════════

describe('threshold option', () => {
  it('threshold mặc định 0.75 → "samx" (score 75%, không vượt ngưỡng) KHÔNG expand', () => {
    expect(fuzzyExpandQuery('samx', ['Samsung'])).toEqual({
      expanded: 'samx',
      changes: [],
      changed: false,
    });
  });

  it('threshold 0.5 → "samx" (score 75% > 0.5) expand thành Samsung', () => {
    expect(fuzzyExpandQuery('samx', ['Samsung'], { threshold: 0.5 })).toEqual({
      expanded: 'Samsung',
      changes: [{ original: 'samx', expanded: 'Samsung', score: '75%', method: 'edit_distance' }],
      changed: true,
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// editDistance — giá trị chính xác
// ══════════════════════════════════════════════════════════════════════════════

describe('editDistance', () => {
  it('khoảng cách Levenshtein đúng', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('samsang', 'samsung')).toBe(1);
    expect(editDistance('ab', 'a')).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// buildPrefixIndex
// ══════════════════════════════════════════════════════════════════════════════

describe('buildPrefixIndex', () => {
  it('tạo prefix len 2..n-1 + full token (key lowercase, value original-case)', () => {
    const idx = buildPrefixIndex(['iPhone']);
    expect([...idx.keys()].sort()).toEqual(['ip', 'iph', 'ipho', 'iphon', 'iphone']);
    expect([...idx.get('ip')]).toEqual(['iPhone']);
    expect([...idx.get('iphone')]).toEqual(['iPhone']);
  });

  it('bỏ token không có chữ cái hoặc < 3 ký tự', () => {
    // "17" (không chữ cái), "AB" (< 3) → bị loại; chỉ "Pro" tạo index
    const idx = buildPrefixIndex(['Pro 17 AB']);
    expect([...idx.keys()].sort()).toEqual(['pr', 'pro']);
  });

  it('2 token cùng lowercase full → gộp vào cùng Set, không ghi đè', () => {
    const idx = buildPrefixIndex(['iPhone', 'iphone']);
    expect([...idx.get('iphone')]).toEqual(['iPhone', 'iphone']);
  });
});
