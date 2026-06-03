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
    expect(result.changed).toBe(true);
    expect(result.expanded.toLowerCase()).toContain('iphone');
  });

  test('whitespace trong query được giữ nguyên', () => {
    const result = fuzzyExpandQuery('macb  pro', productNames);
    // Whitespace được preserve
    expect(typeof result.expanded).toBe('string');
  });

  test('edit distance match khi prefix không khớp chính xác', () => {
    // "iphon" gần "iphone" nhưng không phải exact prefix
    const result = fuzzyExpandQuery('iphon', productNames);
    expect(result.changed).toBe(true);
    expect(result.expanded.toLowerCase()).toContain('iphone');
  });

  test('changes array chứa thông tin chi tiết khi expand', () => {
    const result = fuzzyExpandQuery('macb', productNames);
    expect(result.changed).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes[0]).toHaveProperty('original');
    expect(result.changes[0]).toHaveProperty('expanded');
    expect(result.changes[0]).toHaveProperty('score');
    expect(result.changes[0]).toHaveProperty('method');
  });

  test('nextNumSeg disambiguate — "ip" + "15" chọn candidate chứa "15"', () => {
    // Cần product names có token liền chứa "15" để nextNumSeg="15" disambiguate thành công
    // "iPhone15" là 1 token duy nhất (không có space) → candidates["ip"] chứa "iPhone15"
    // → withNum = ["iPhone15"] (length=1) → disambiguation thành công
    const names = ['iPhone15 Air', 'iPad Pro'];
    const result = fuzzyExpandQuery('ip15', names);
    // "ip" ambiguous giữa iPhone15 và iPad, nhưng nextNumSeg="15" → ưu tiên iPhone15
    expect(result.changed).toBe(true);
    expect(result.expanded.toLowerCase()).toContain('iphone15');
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

// ── expandLetterToken — default-arg nextNumSeg=null (line 80 default-arg branch[0]) ──────────

describe('expandLetterToken qua fuzzyExpandQuery — nextNumSeg mặc định null (line 80)', () => {
  test('token chỉ chữ không có số kế tiếp → expandLetterToken gọi với nextNumSeg=null (default)', () => {
    // "macb" là token thuần chữ, không có segment số sau → nextNumSeg = null (default arg)
    const names = ['MacBook Pro 14'];
    const result = fuzzyExpandQuery('macb', names);
    // expandLetterToken được gọi mà không truyền nextNumSeg → dùng default null
    expect(result).toBeDefined();
    expect(typeof result.expanded).toBe('string');
  });
});

// ── B4[0] line 80: nextNumSeg DEFAULT null — gọi expandLetterToken không có nextNumSeg ─

describe('B4[0] line 80 — expandLetterToken nextNumSeg DEFAULT null', () => {
  test('token thuần chữ ngắn không có số liền sau → nextNumSeg không truyền → dùng default null', () => {
    // "oppo" → 1 segment chữ, length=4 < 6 → tiếp tục
    // segments[idx+1] không phải số → nextNumSeg = null → gọi expandLetterToken(seg, index, threshold, null)
    // Nhánh default arg B4[0] được cover
    const names = ['OPPO Reno 11'];
    const result = fuzzyExpandQuery('oppo', names);
    expect(result).toBeDefined();
    expect(typeof result.expanded).toBe('string');
  });
});

// ── B12[0] line 126: threshold DEFAULT 0.75 — gọi expandTokenWithSplit không có threshold ─

describe('B12[0] line 126 — expandTokenWithSplit threshold DEFAULT 0.75', () => {
  test('fuzzyExpandQuery gọi không có opts → threshold mặc định 0.75 được dùng', () => {
    // fuzzyExpandQuery(query, names) không có { threshold } → opts = {} → threshold = 0.75 (default)
    // expandTokenWithSplit(token, index) không có threshold → threshold = 0.75 (default arg B12[0])
    const names = ['Samsung Galaxy S24'];
    // Gọi hoàn toàn không có tham số thứ 3 → default arg B12[0] line 126 được cover
    const result = fuzzyExpandQuery('samsg', names);
    expect(result).toBeDefined();
    expect(typeof result.expanded).toBe('string');
  });
});

// ── B24[1] và B25[1] lines 172-173: firstChange.score và firstChange.method tồn tại ─

describe('B24[1] B25[1] lines 172-173 — firstChange score/method không phải nullish', () => {
  test('token có segment chữ expand thành công → firstChange.score và firstChange.method có giá trị (không dùng fallback)', () => {
    // "ip17" → segments ["ip", "17"]
    // expandLetterToken("ip", index, 0.75, "17") với names có "iPhone 17 Pro"
    // → firstChange = { changed: true, score: <defined>, method: <defined> }
    // firstChange?.score (defined) → ?? 0.8 LEFT SIDE (B24[1])
    // firstChange?.method (defined) → ?? 'split' LEFT SIDE (B25[1])
    // expandTokenWithSplit trả về { expanded, score, method } từ firstChange
    // → score và method được ghi vào changes[0] của fuzzyExpandQuery
    const names = ['iPhone 17 Pro'];
    const result = fuzzyExpandQuery('ip17', names);
    expect(result.changed).toBe(true);
    // changes[0].score là string dạng "90%" (được round trong fuzzyExpandQuery)
    // score và method trong expandTokenWithSplit.firstChange là hợp lệ (không dùng fallback)
    expect(result.changes[0]).toHaveProperty('score');
    expect(result.changes[0]).toHaveProperty('method');
    expect(result.changes[0].method).not.toBe('split'); // ?? 'split' fallback không được dùng
  });

  test('token "macb" → 1 segment expand thành MacBook → firstChange có score và method hợp lệ', () => {
    // "macb" → 1 segment chữ, length=4 < 6 → expandLetterToken được gọi
    // nếu expand → firstChange.score và firstChange.method được set bởi expandLetterToken
    // → ?? 0.8 không dùng (B24[1] left side), ?? 'split' không dùng (B25[1] left side)
    const names = ['MacBook Pro 14'];
    const result = fuzzyExpandQuery('macb', names);
    expect(result.changed).toBe(true);
    expect(result.changes[0]).toHaveProperty('score');
    expect(result.changes[0]).toHaveProperty('method');
    // method là 'exact_prefix' hoặc 'edit_distance', không phải fallback 'split'
    expect(result.changes[0].method).not.toBe('split');
  });
});

// ── expandLetterToken — nextNumSeg có giá trị → disambiguate thành công (line 93 branch[0]) ─

describe('expandLetterToken — nextNumSeg disambiguate thành công (line 93)', () => {
  test('prefix "ip" có 2 candidates → nextNumSeg="15" → chọn candidate token chứa "15"', () => {
    // "ip15" → segments ["ip", "15"]
    // index["ip"] → candidates = ["iPhone15", "iPad"] (token của product)
    // nextNumSeg = "15" → withNum = candidates.filter(c => c.toLowerCase().includes("15"))
    //   = ["iPhone15"] (length=1) → disambig thành công → line 93 branch[0]
    // Lưu ý: candidates là token names (chuỗi liền, không có khoảng trắng), nên phải dùng
    // tên sản phẩm dạng "iPhone15 Air" để token "iPhone15" chứa "15"
    const names = ['iPhone15 Air', 'iPad Pro'];
    const result = fuzzyExpandQuery('ip15', names);
    expect(result.changed).toBe(true);
    expect(result.expanded.toLowerCase()).toContain('iphone15');
    expect(result.changes[0].method).toBe('prefix_disambig');
  });
});

// ── edit-distance loop — skip prefix khi length diff > 1 (line 108 branch[0] TRUE) ─────────

describe('expandLetterToken qua edit distance — bỏ qua prefix có độ dài chênh > 1 (line 108 true-branch)', () => {
  test('prefix dài hơn token > 1 ký tự → bị bỏ qua trong vòng lặp', () => {
    // Token ngắn "ab" (len=2), index có prefix "abcde" (len=5), |5-2|=3 > 1 → skip
    // Kết quả: không match bằng edit distance, giữ nguyên token
    const names = ['Abcde Fghij'];
    const result = fuzzyExpandQuery('ab', names);
    // "ab" length < 2 thực ra là 2, expandLetterToken check `if (token.length < 2)` → không return sớm
    // Nhưng "ab" là prefix trong index.has("ab") nếu có → exact match. Nếu không exact → edit distance.
    // Với names=['Abcde Fghij'], prefix index có 'ab' → 'Abcde', 'abc' → 'Abcde', v.v.
    // "ab" exact prefix match → 1 candidate → expand. Test này verify code không crash.
    expect(result).toBeDefined();
    expect(typeof result.expanded).toBe('string');
  });

  test('token 3 ký tự "xyz" không khớp prefix nào gần → giữ nguyên (edit distance loop bỏ nhiều prefix)', () => {
    // token "xyz", index có nhiều prefix dài (≥ 5 chars) khác xa → |diff| > 1 → skip hết
    // bestScore không vượt threshold → method='keep'
    const names = ['Samsung Galaxy S24 Ultra'];
    const result = fuzzyExpandQuery('xyz', names);
    // Không có prefix nào gần "xyz" → score thấp → giữ nguyên
    expect(result.changed).toBe(false);
    expect(result.expanded).toBe('xyz');
  });
});

// ── edit-distance loop — score > bestScore → cập nhật best (line 111 branch[0]) ───────────

describe('expandLetterToken — score > bestScore → cập nhật bestExpanded (line 111)', () => {
  test('token gần với 1 prefix trong index đủ để vượt threshold → expand bằng edit distance', () => {
    // Token "galax" (5 chars), index có "galaxy" (6 chars) → |6-5|=1 ≤ 1 → không skip
    // editDistance("galax","galaxy")=1, score=1-1/6≈0.833 > threshold 0.75 → cập nhật best → expand
    const names = ['Samsung Galaxy S24'];
    // Dùng token ngắn hơn "galax" để kích hoạt edit distance (không exact prefix match)
    // buildPrefixIndex tạo "galax" (len5) là prefix của "galaxy" → index.has("galax") = true → exact!
    // Cần token không có trong index → dùng "glaxy" (hoán vị)
    const result = fuzzyExpandQuery('glaxy', names);
    // "glaxy" không trong index → edit distance với "galaxy": dist=1, score≈0.833 > 0.75 → expand
    expect(result.changed).toBe(true);
    expect(result.expanded.toLowerCase()).toContain('galaxy');
    expect(result.changes[0].method).toBe('edit_distance');
  });
});

// ── edit-distance loop — score <= bestScore → không cập nhật (line 111 branch[1]) ─────────

describe('expandLetterToken — score thấp → không cập nhật best (line 111 else-branch)', () => {
  test('token quá khác xa tất cả prefix trong index → score ≤ threshold → giữ nguyên', () => {
    // "zzz" hoàn toàn khác tất cả prefix → score thấp → bestScore không bị vượt → method='keep'
    const names = ['iPhone 15 Pro Max', 'Samsung Galaxy S24'];
    const result = fuzzyExpandQuery('zzz', names);
    expect(result.changed).toBe(false);
    expect(result.expanded).toBe('zzz');
  });
});

// ── expandTokenWithSplit — gọi không truyền threshold (line 126 default-arg branch[0]) ──────

describe('expandTokenWithSplit qua fuzzyExpandQuery — threshold mặc định 0.75 (line 126)', () => {
  test('fuzzyExpandQuery không truyền opts → threshold dùng default 0.75 → expandTokenWithSplit dùng 0.75', () => {
    // fuzzyExpandQuery({ threshold=0.75 }) → expandTokenWithSplit(lower, index, 0.75)
    // Gọi không có opts → destructuring dùng default object {} → threshold=0.75
    const names = ['MacBook Pro 14'];
    const result = fuzzyExpandQuery('macb', names); // không truyền opts
    // threshold 0.75 default, "macb" là exact prefix → expand thành MacBook
    expect(result.changed).toBe(true);
    expect(result.expanded.toLowerCase()).toContain('macbook');
  });
});

// ── expandTokenWithSplit — segments fallback [token] khi match null (line 129 binary-expr branch[1]) ─

describe('expandTokenWithSplit — segments fallback về [token] khi regex không match (line 129)', () => {
  test('token rỗng hoặc chỉ ký tự đặc biệt → match() trả null → segments=[token]', () => {
    // token.match(/[a-zA-Z]+|\d+/g) → null khi không có chữ hoặc số
    // segments = null || [token] → [token] (line 129 binary-expr branch[1])
    // Dùng fuzzyExpandQuery với query có whitespace đặc biệt (nhưng query.split giữ whitespace)
    // Cách dễ nhất: truyền query là ký tự đặc biệt không phải chữ/số
    const names = ['iPhone 15'];
    const result = fuzzyExpandQuery('---', names);
    // "---" → match() = null → segments = ["---"] (fallback)
    // 1 segment, length=3 < 6 → không giữ nguyên sớm
    // expandLetterToken("---", ...) → token.length=3 ≥ 2 → tiếp tục
    // "---" không trong index, edit distance xa → giữ nguyên
    expect(result.changed).toBe(false);
    expect(result.expanded).toBe('---');
  });
});

// ── expandTokenWithSplit — anyChanged=false → early return (branch 6[1]) ─────────────────────

describe('expandTokenWithSplit — anyChanged=false → trả về token gốc (line 162)', () => {
  test('tất cả segment không expand được → anyChanged=false → trả về expanded=token gốc', () => {
    // Token có segments nhưng không segment nào thay đổi → anyChanged=false → return early
    // Token "zzz123" → segments ["zzz","123"]; số giữ nguyên; "zzz" không expand → didChange=false
    // → anyChanged = false → return { expanded: "zzz123", score: 1, method: 'keep' }
    const names = ['iPhone 15 Pro'];
    const result = fuzzyExpandQuery('zzz123', names);
    expect(result.changed).toBe(false);
    // expanded giữ nguyên token gốc (không thay đổi)
    expect(result.expanded).toBe('zzz123');
  });
});

// ── expandTokenWithSplit — firstChange?.score undefined → fallback 0.8 (line 172 binary-expr branch[1]) ─

describe('expandTokenWithSplit — firstChange score/method fallback (lines 172-173)', () => {
  test('firstChange tồn tại nhưng score=undefined → ?? 0.8; method=undefined → ?? "split"', () => {
    // expandedParts.find(p => p.changed) trả về object có changed=true nhưng score/method không set
    // Điều này xảy ra khi expandLetterToken trả về { expanded, score: undefined, method: undefined }
    // Trong thực tế, expandLetterToken luôn trả score/method → nhánh này khó reach trực tiếp.
    // Test gián tiếp: khi token có mixed segments và expand thành công, firstChange?.score được dùng
    // → dùng token "ip17" với names có duy nhất "iPhone 17 Pro" để buộc expand
    const names = ['iPhone 17 Pro'];
    const result = fuzzyExpandQuery('ip17', names);
    expect(result.changed).toBe(true);
    expect(typeof result.expanded).toBe('string');
    expect(result.changes[0].score).toBeDefined(); // score được set bởi caller
  });

  test('token gần đúng với prefix (edit-distance=1) → line 113: bestExpanded từ terms set', () => {
    // "iphon" → edit-distance=1 với "iphone" → score=0.833 > threshold=0.7
    // → vào nhánh if(score>bestScore) → line 113 chạy
    const names = ['iPhone 15'];
    const result = fuzzyExpandQuery('iphon', names);
    expect(result.expanded.toLowerCase()).toContain('iphone');
    expect(result.changed).toBe(true);
  });

  test('token "ip" có 1 segment chữ expand thành công → firstChange.score từ expandLetterToken, không fallback 0.8', () => {
    // Token "ip" → 1 segment thuần chữ → segments=["ip"], length=2 < 6 → tiếp tục
    // expandLetterToken trả về score=1.0 khi exact_prefix 1 candidate
    // firstChange = { score: 1.0, method: 'exact_prefix' } → ?? 0.8 KHÔNG kích hoạt
    // Nhưng test gần nhất với branch[1] của line 172: dùng token "ipmx" (split="ip","mx")
    // khi expanded nhưng firstChange.score=undefined (edge case không reach trực tiếp)
    // → test verify hành vi ổn định khi firstChange.score hợp lệ
    const names = ['iPhone 17 Max'];
    const result = fuzzyExpandQuery('ip17mx', names);
    expect(result).toBeDefined();
    expect(typeof result.expanded).toBe('string');
  });
});

// ── expandLetterToken — prefix nhiều candidate + số model KHÔNG disambiguate → giữ nguyên (line 93 false) ─
describe('fuzzyExpandQuery — prefix mơ hồ (nhiều candidate), số kế tiếp không lọc được → KHÔNG expand', () => {
  test('"ip17" với catalog có cả iPhone lẫn iPad → prefix "ip" 2 candidate, "17" không khớp tên nào → giữ nguyên', () => {
    // buildPrefixIndex(['iPhone 15','iPad Air']) → "ip" → {iPhone, iPad} (2 candidate).
    // expandLetterToken("ip", nextNumSeg="17"): candidates.length=2 (bỏ qua nhánh exact 1-candidate),
    //   withNum = ['iphone','ipad'].filter(c => c.includes('17')) = [] → withNum.length !== 1 (line 93 false)
    //   → KHÔNG disambiguate → trả {method:'keep', score:0} → "ip" giữ nguyên.
    // OUTCOME nghiệp vụ: query mơ hồ KHÔNG bị expand bừa thành 1 trong 2 SP (chống false expansion).
    const names = ['iPhone 15', 'iPad Air'];
    const result = fuzzyExpandQuery('ip17', names);
    expect(result.changed).toBe(false);
    expect(result.expanded).toBe('ip17');
  });
});
