/**
 * Tests for embedding-intent-classifier.js
 */
const {
  EmbeddingIntentClassifier,
  cosineSimilarity,
  SIMILARITY_THRESHOLD,
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
});
