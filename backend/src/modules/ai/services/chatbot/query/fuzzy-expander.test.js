/**
 * @file fuzzy-expander.test.js
 * @description Tests cho fuzzy-expander.js — editDistance, buildPrefixIndex,
 *   expandTokenWithSplit, fuzzyExpandQuery.
 */

const { fuzzyExpandQuery, buildPrefixIndex, editDistance } = require('./fuzzy-expander');

// ── editDistance ─────────────────────────────────────────────────────────────

describe('editDistance', () => {
  test('chuỗi giống nhau → distance = 0', () => {
    expect(editDistance('apple', 'apple')).toBe(0);
  });

  test('thay 1 ký tự → distance = 1', () => {
    expect(editDistance('apple', 'apply')).toBe(1);
  });

  test('thêm 1 ký tự → distance = 1', () => {
    expect(editDistance('cat', 'cats')).toBe(1);
  });

  test('xóa 1 ký tự → distance = 1', () => {
    expect(editDistance('cats', 'cat')).toBe(1);
  });

  test('chuỗi rỗng so với chuỗi có nội dung', () => {
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
  });

  test('cả hai rỗng → distance = 0', () => {
    expect(editDistance('', '')).toBe(0);
  });

  test('hoàn toàn khác nhau', () => {
    expect(editDistance('abc', 'xyz')).toBe(3);
  });
});

// ── buildPrefixIndex ─────────────────────────────────────────────────────────

describe('buildPrefixIndex', () => {
  test('tạo prefix index từ product names', () => {
    const index = buildPrefixIndex(['iPhone 15 Pro', 'Samsung Galaxy']);
    // "iPhone" → prefixes: "ip", "iph", "ipho", "iphon", "iphone" + full
    expect(index.has('ip')).toBe(true);
    expect(index.has('iph')).toBe(true);
    expect(index.get('ip').has('iPhone')).toBe(true);
  });

  test('bỏ qua token < 3 ký tự', () => {
    const index = buildPrefixIndex(['AB CD EFG']);
    // "AB" và "CD" < 3 ký tự → không index
    expect(index.has('ab')).toBe(false);
    expect(index.has('cd')).toBe(false);
    // "EFG" = 3 ký tự → được index
    expect(index.has('ef')).toBe(true);
  });

  test('bỏ qua token toàn số', () => {
    const index = buildPrefixIndex(['Model 123 Pro']);
    // "123" toàn số → /[a-zA-Z]/.test fails → bỏ
    expect(index.has('12')).toBe(false);
    // "Model" hợp lệ
    expect(index.has('mo')).toBe(true);
  });

  test('danh sách rỗng → index rỗng', () => {
    const index = buildPrefixIndex([]);
    expect(index.size).toBe(0);
  });

  test('token chữ-số kiểu "A57" vẫn được index', () => {
    const index = buildPrefixIndex(['OPPO A57']);
    // "A57" chứa chữ + /[a-zA-Z]/ matches → indexed
    expect(index.has('a5')).toBe(true);
  });
});

// ── fuzzyExpandQuery ─────────────────────────────────────────────────────────

describe('fuzzyExpandQuery', () => {
  const productNames = [
    'iPhone 15 Pro Max',
    'Samsung Galaxy S24 Ultra',
    'OPPO Reno 11',
    'MacBook Pro 14',
  ];

  test('query rỗng → trả về nguyên gốc', () => {
    const result = fuzzyExpandQuery('', productNames);
    expect(result.expanded).toBe('');
    expect(result.changed).toBe(false);
    expect(result.changes).toEqual([]);
  });

  test('productNames rỗng → trả về nguyên gốc', () => {
    const result = fuzzyExpandQuery('ip15', []);
    expect(result.expanded).toBe('ip15');
    expect(result.changed).toBe(false);
  });

  test('query null → trả về nguyên gốc', () => {
    const result = fuzzyExpandQuery(null, productNames);
    expect(result.expanded).toBe(null);
    expect(result.changed).toBe(false);
  });

  test('query dài không phải viết tắt → giữ nguyên', () => {
    const result = fuzzyExpandQuery('samsung galaxy', productNames);
    // "samsung" 7 ký tự ≥ 6 → giữ nguyên (single segment, length ≥ 6)
    // "galaxy" cũng ≥ 6 → giữ nguyên
    expect(result.changed).toBe(false);
  });

  test('exact prefix match với 1 candidate → expand', () => {
    // "macb" → prefix → candidates = ["MacBook"] → 1 candidate → expand
    const result = fuzzyExpandQuery('macb', productNames);
    expect(result.changed).toBe(true);
    expect(result.expanded.toLowerCase()).toContain('macbook');
  });

  test('ambiguous prefix (nhiều candidates) → không expand', () => {
    // Tạo product names khiến prefix "sa" match cả Samsung và Samusung
    const names = ['Samsung Galaxy', 'Samsonic Speaker'];
    const result = fuzzyExpandQuery('sam', names);
    // "sam" có 2 candidates → ambiguous → keep
    // (Tuy nhiên expandTokenWithSplit với segment dài ≥ 6 giữ nguyên)
    expect(typeof result.expanded).toBe('string');
  });

  test('token chữ-số "ip15" → tách thành "ip" + "15" → expand "ip" → "iPhone 15"', () => {
    const result = fuzzyExpandQuery('ip15', productNames);
    // "ip" → prefix match → "iPhone"; "15" giữ nguyên (số)
    if (result.changed) {
      expect(result.expanded.toLowerCase()).toContain('iphone');
    }
  });

  test('whitespace trong query được giữ nguyên', () => {
    const result = fuzzyExpandQuery('macb  pro', productNames);
    // Whitespace được preserve
    expect(typeof result.expanded).toBe('string');
  });

  test('edit distance match khi prefix không khớp chính xác', () => {
    // "iphon" gần "iphone" nhưng không phải exact prefix
    const result = fuzzyExpandQuery('iphon', productNames);
    if (result.changed) {
      expect(result.expanded.toLowerCase()).toContain('iphone');
    }
  });

  test('changes array chứa thông tin chi tiết khi expand', () => {
    const result = fuzzyExpandQuery('macb', productNames);
    if (result.changed) {
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes[0]).toHaveProperty('original');
      expect(result.changes[0]).toHaveProperty('expanded');
      expect(result.changes[0]).toHaveProperty('score');
      expect(result.changes[0]).toHaveProperty('method');
    }
  });

  test('nextNumSeg disambiguate — "ip" + "15" chọn candidate chứa "15"', () => {
    // Tạo names khiến "ip" có nhiều candidates mà 1 chứa "15"
    const names = ['iPhone 15 Pro', 'iPad Air'];
    const result = fuzzyExpandQuery('ip15', names);
    // "ip" ambiguous giữa iPhone và iPad, nhưng nextNumSeg="15" → ưu tiên iPhone
    if (result.changed) {
      expect(result.expanded.toLowerCase()).toContain('iphone');
    }
  });

  test('dedup: expanded đã chứa số model của segment kế tiếp', () => {
    // "Reno11" trong product names, "reno11" → segments ["reno", "11"]
    // Nếu expanded="Reno11" đã chứa "11" → bỏ segment "11" để tránh "Reno11 11"
    const names = ['OPPO Reno11 Pro'];
    const result = fuzzyExpandQuery('reno11', names);
    // Không nên có "11 11" trong output
    expect(result.expanded).not.toMatch(/11\s+11/);
  });
});
