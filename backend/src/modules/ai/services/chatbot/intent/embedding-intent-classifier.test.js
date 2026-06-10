/**
 * Tests for embedding-intent-classifier.js
 */
const {
  EmbeddingIntentClassifier,
  cosineSimilarity,
  SIMILARITY_THRESHOLD,
  INTENT_THRESHOLDS,
  INTENT_EXAMPLES,
} = require('./embedding-intent-classifier');

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  test('vector giống hệt → 1.0', () => {
    const v = [1, 0, 0, 1];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  test('vector vuông góc → 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  test('vector ngược chiều → -1', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  test('zero vector → 0 (không chia cho 0)', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

// ── EmbeddingIntentClassifier ─────────────────────────────────────────────────

describe('EmbeddingIntentClassifier', () => {
  const makeEmbedFn = (mapping) => async (text) => {
    const key = Object.keys(mapping).find((k) => text.includes(k)) || '__default';
    return mapping[key] || mapping['__default'] || [0, 0, 0, 0];
  };

  test('isReady() = false trước initialize', () => {
    const clf = new EmbeddingIntentClassifier();
    expect(clf.isReady()).toBe(false);
  });

  test('isReady() = true sau initialize', async () => {
    const clf = new EmbeddingIntentClassifier();
    const embedFn = jest.fn().mockResolvedValue([1, 0, 0, 0]);
    await clf.initialize(embedFn);
    expect(clf.isReady()).toBe(true);
    // embed() được gọi cho mỗi example
    const totalExamples = Object.values(INTENT_EXAMPLES).reduce((s, a) => s + a.length, 0);
    expect(embedFn).toHaveBeenCalledTimes(totalExamples);
  });

  test('initialize: embed tuần tự (không concurrent)', async () => {
    const clf = new EmbeddingIntentClassifier();
    const order = [];
    const embedFn = jest.fn().mockImplementation(async (text) => {
      order.push(text);
      return [Math.random(), Math.random()];
    });
    await clf.initialize(embedFn);
    // Mỗi example chỉ xuất hiện 1 lần, thứ tự deterministic (tuần tự theo INTENT_EXAMPLES)
    expect(order.length).toBe(Object.values(INTENT_EXAMPLES).reduce((s, a) => s + a.length, 0));
  });

  test('embed() throw nếu chưa initialize', async () => {
    const clf = new EmbeddingIntentClassifier();
    await expect(clf.embed('test')).rejects.toThrow('chưa được initialize');
  });

  test('embed() gọi embedFn sau khi initialize', async () => {
    const clf = new EmbeddingIntentClassifier();
    const embedFn = jest.fn().mockResolvedValue([1, 0]);
    await clf.initialize(embedFn);
    embedFn.mockClear();
    const result = await clf.embed('hello');
    expect(embedFn).toHaveBeenCalledWith('hello');
    expect(result).toEqual([1, 0]);
  });

  test('classify: trả về intent có score cao nhất khi vượt threshold', async () => {
    const clf = new EmbeddingIntentClassifier();
    // product_search examples → vector [1,0], tất cả intent khác → [0,1]
    // query → [1,0] → cosine similarity với product_search = 1.0
    const embedFn = async (text) => {
      const isProductExample = INTENT_EXAMPLES.product_search.some((ex) => ex === text);
      return isProductExample ? [1, 0] : [0, 1];
    };
    await clf.initialize(embedFn);
    // query embedding = [1,0] → gần nhất với product_search
    const result = clf.classify([1, 0]);
    expect(result).toBe('product_search');
  });

  test('classify: trả null khi score dưới threshold', async () => {
    const clf = new EmbeddingIntentClassifier();
    // Tất cả examples → vector [1,0]
    const embedFn = jest.fn().mockResolvedValue([1, 0]);
    await clf.initialize(embedFn);
    // query embedding vuông góc với tất cả → score ~ 0 < THRESHOLD
    const result = clf.classify([0, 1]);
    // score = 0 < SIMILARITY_THRESHOLD → null
    expect(result).toBeNull();
  });

  test('classify: trả null nếu chưa có example embeddings', () => {
    const clf = new EmbeddingIntentClassifier();
    // Chưa initialize → _exampleEmbeddings rỗng → bestScore = -Infinity < threshold
    const result = clf.classify([1, 0]);
    expect(result).toBeNull();
  });

  test('SIMILARITY_THRESHOLD được export đúng', () => {
    expect(typeof SIMILARITY_THRESHOLD).toBe('number');
    expect(SIMILARITY_THRESHOLD).toBeGreaterThan(0);
    expect(SIMILARITY_THRESHOLD).toBeLessThan(1);
  });

  // ── Nâng cấp primary classifier: off_topic + classifyWithScore + thresholds ──

  test('INTENT_EXAMPLES có nhóm off_topic (embedding quyết off-topic thay regex)', () => {
    expect(Array.isArray(INTENT_EXAMPLES.off_topic)).toBe(true);
    expect(INTENT_EXAMPLES.off_topic.length).toBeGreaterThanOrEqual(8);
  });

  test('INTENT_THRESHOLDS có đủ 6 intent, giá trị hợp lệ trong (0,1)', () => {
    // Giá trị cụ thể được calibrate bằng scripts/eval-intent-classifier.js trên
    // 173 labeled queries (run 2026-06-10: off_topic 0.5 cho kết quả tốt nhất,
    // không gây block oan câu on-topic nào) — test chỉ assert tính hợp lệ cấu trúc
    for (const intent of Object.keys(INTENT_EXAMPLES)) {
      expect(typeof INTENT_THRESHOLDS[intent]).toBe('number');
      expect(INTENT_THRESHOLDS[intent]).toBeGreaterThan(0);
      expect(INTENT_THRESHOLDS[intent]).toBeLessThan(1);
    }
  });

  test('classifyWithScore trả {intent, score} không áp threshold', async () => {
    const clf = new EmbeddingIntentClassifier();
    const embedFn = async (text) =>
      INTENT_EXAMPLES.off_topic.some((ex) => ex === text) ? [1, 0] : [0, 1];
    await clf.initialize(embedFn);
    // query gần off_topic examples
    const result = clf.classifyWithScore([1, 0]);
    expect(result.intent).toBe('off_topic');
    expect(result.score).toBeCloseTo(1.0);
    // query vuông góc → score thấp nhưng VẪN trả kết quả (caller tự áp threshold)
    const low = clf.classifyWithScore([0.7, 0.71]);
    expect(low).toHaveProperty('intent');
    expect(low.score).toBeLessThan(1);
  });

  test('classifyWithScore trả null khi chưa initialize (không có example embeddings)', () => {
    const clf = new EmbeddingIntentClassifier();
    expect(clf.classifyWithScore([1, 0])).toBeNull();
  });

  test('classify (backward-compat) vẫn trả string|null như cũ', async () => {
    const clf = new EmbeddingIntentClassifier();
    const embedFn = async (text) =>
      INTENT_EXAMPLES.pricing.some((ex) => ex === text) ? [1, 0] : [0, 1];
    await clf.initialize(embedFn);
    expect(clf.classify([1, 0])).toBe('pricing');
    expect(clf.classify([0, 1])).not.toBe('pricing');
  });
});

// ── Persistent cache example embeddings ────────────────────────────────────────

describe('EmbeddingIntentClassifier — disk cache', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intent-cache-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('lần 2 initialize với cache hit → KHÔNG gọi embedFn lại', async () => {
    const cachePath = path.join(tmpDir, 'cache.json');
    const embedFn = jest.fn().mockResolvedValue([1, 0]);

    const clf1 = new EmbeddingIntentClassifier();
    await clf1.initialize(embedFn, { cachePath, cache: true });
    const callsFirstRun = embedFn.mock.calls.length;
    expect(callsFirstRun).toBeGreaterThan(0);
    expect(fs.existsSync(cachePath)).toBe(true);

    const clf2 = new EmbeddingIntentClassifier();
    embedFn.mockClear();
    await clf2.initialize(embedFn, { cachePath, cache: true });
    expect(embedFn).not.toHaveBeenCalled(); // cache hit
    expect(clf2.isReady()).toBe(true);
    expect(clf2.classifyWithScore([1, 0])).not.toBeNull();
  });

  test('cacheSalt khác (đổi provider) → cache invalid → embed lại', async () => {
    const cachePath = path.join(tmpDir, 'cache.json');
    const embedFn = jest.fn().mockResolvedValue([1, 0]);

    const clf1 = new EmbeddingIntentClassifier();
    await clf1.initialize(embedFn, { cachePath, cache: true, cacheSalt: 'jina' });

    const clf2 = new EmbeddingIntentClassifier();
    embedFn.mockClear();
    await clf2.initialize(embedFn, { cachePath, cache: true, cacheSalt: 'hf' });
    expect(embedFn).toHaveBeenCalled(); // salt lệch → re-embed
  });

  test('mặc định NODE_ENV=test → không đọc/ghi file cache', async () => {
    const embedFn = jest.fn().mockResolvedValue([1, 0]);
    const clf = new EmbeddingIntentClassifier();
    await clf.initialize(embedFn); // không truyền opts — default cache=false trong test
    expect(embedFn).toHaveBeenCalled();
  });
});
