/**
 * @file eval-retrieval.js
 * @description Đánh giá ĐỊNH LƯỢNG chất lượng truy xuất (retrieval) của Hybrid Search.
 *   Với mỗi truy vấn test, ground-truth relevance được định nghĩa bằng PREDICATE
 *   khách quan trên metadata sản phẩm (loại / thương hiệu / model / giá) — tái lập được,
 *   không phụ thuộc phán đoán chủ quan.
 *
 *   Chỉ số (k=5): Hit@k, Precision@k, Recall@k, MRR (Mean Reciprocal Rank).
 *
 * Cần JINA_API_KEY hoặc HF_API_KEY (embedding thật).
 * Usage: node scripts/eval-retrieval.js
 */
require('dotenv').config();
process.env.LOG_LEVEL = 'error';
require('module-alias/register');

const vectorStore = require('@services/vector-store/vector-store');

const K = 5;

// ── Helper phân loại từ tên sản phẩm (khách quan) ──────────────────────────
const isPhone = (n) => n.startsWith('điện thoại');
const isTablet = (n) => n.startsWith('máy tính bảng');
const isLaptop = (n) => n.startsWith('laptop');
const isWatch = (n) => n.startsWith('đồng hồ') || n.startsWith('vòng đeo');
const hasGPU = (n) => /nitro|rtx|gaming/.test(n);

// ── Bộ truy vấn test + ground-truth predicate (rel: name viết thường, price) ──
const DATASET = [
  // Nhóm 1: Tên model cụ thể
  { q: 'iPhone 17 Pro Max', g: 'Tên model', rel: (n) => n.includes('iphone 17 pro max') },
  { q: 'Samsung Galaxy Tab S11 Ultra', g: 'Tên model', rel: (n) => n.includes('galaxy tab s11 ultra') },
  { q: 'MacBook Air M4', g: 'Tên model', rel: (n) => n.includes('macbook air') },
  { q: 'Apple Watch Ultra 3', g: 'Tên model', rel: (n) => n.includes('apple watch ultra') },
  // Nhóm 2: Loại + thương hiệu
  { q: 'điện thoại Samsung', g: 'Loại+hãng', rel: (n) => isPhone(n) && n.includes('samsung') },
  { q: 'laptop Dell', g: 'Loại+hãng', rel: (n) => isLaptop(n) && n.includes('dell') },
  { q: 'máy tính bảng Xiaomi', g: 'Loại+hãng', rel: (n) => isTablet(n) && /xiaomi|redmi/.test(n) },
  { q: 'đồng hồ thông minh Apple', g: 'Loại+hãng', rel: (n) => isWatch(n) && n.includes('apple watch') },
  { q: 'điện thoại OPPO', g: 'Loại+hãng', rel: (n) => isPhone(n) && n.includes('oppo') },
  // Nhóm 3: Nhu cầu (ngữ nghĩa) — ground-truth theo loại sản phẩm đúng
  { q: 'laptop chơi game cấu hình cao', g: 'Ngữ nghĩa', rel: (n) => isLaptop(n) && hasGPU(n) },
  { q: 'điện thoại pin trâu chụp ảnh đẹp', g: 'Ngữ nghĩa', rel: isPhone },
  { q: 'máy tính bảng học online cho sinh viên', g: 'Ngữ nghĩa', rel: isTablet },
  { q: 'đồng hồ theo dõi sức khỏe thể thao', g: 'Ngữ nghĩa', rel: isWatch },
  // Nhóm 4: Theo giá
  { q: 'điện thoại dưới 10 triệu', g: 'Theo giá', rel: (n, p) => isPhone(n) && p > 0 && p < 10000000 },
  { q: 'laptop dưới 20 triệu', g: 'Theo giá', rel: (n, p) => isLaptop(n) && p > 0 && p < 20000000 },
  // Nhóm 5: Viết tắt / không dấu
  { q: 'ip 17 pro max', g: 'Viết tắt', rel: (n) => n.includes('iphone 17 pro max') },
  { q: 'mb air m4', g: 'Viết tắt', rel: (n) => n.includes('macbook air') },
  { q: 'dien thoai samsung galaxy', g: 'Viết tắt', rel: (n) => isPhone(n) && n.includes('samsung') },
];

(async () => {
  // Tổng số sản phẩm relevant trong toàn catalog cho mỗi query (để tính Recall)
  const all = vectorStore.getAllProductsMeta
    ? vectorStore.getAllProductsMeta()
    : null;

  // fallback: đọc trực tiếp vector-db.json để lấy danh sách metadata
  const fs = require('fs');
  const path = require('path');
  const db = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/vector-db.json'), 'utf8'),
  );
  const items = Array.isArray(db) ? db : db.items || [];
  const catalog = items.map((i) => ({
    name: (i.metadata.name || '').toLowerCase(),
    price: i.metadata.price || 0,
  }));

  const totalRel = (rel) => catalog.filter((c) => rel(c.name, c.price)).length;

  const rows = [];
  for (const tc of DATASET) {
    const results = await vectorStore.hybridSearch(tc.q, K);
    const names = results.map((r) =>
      ((r.metadata && r.metadata.name) || r.name || '').toLowerCase(),
    );
    const prices = results.map(
      (r) => (r.metadata && r.metadata.price) || r.price || 0,
    );
    const relFlags = names.map((n, i) => tc.rel(n, prices[i]));
    const relCount = relFlags.filter(Boolean).length;
    const firstRank = relFlags.findIndex(Boolean) + 1; // 0 nếu không có
    const totRel = totalRel(tc.rel);

    rows.push({
      group: tc.g,
      query: tc.q,
      hit: relCount > 0 ? 1 : 0,
      precision: relCount / K,
      recall: totRel > 0 ? Math.min(relCount, totRel) / totRel : 0,
      rr: firstRank > 0 ? 1 / firstRank : 0,
      retrieved: results.length,
    });
  }

  // In bảng
  console.log('\n=== KẾT QUẢ ĐÁNH GIÁ RETRIEVAL (k=' + K + ') ===\n');
  console.log(
    'Nhóm'.padEnd(12) +
      'Query'.padEnd(40) +
      'Hit'.padEnd(5) +
      'P@5'.padEnd(7) +
      'R@5'.padEnd(7) +
      'RR',
  );
  for (const r of rows) {
    console.log(
      r.group.padEnd(12) +
        r.query.slice(0, 38).padEnd(40) +
        String(r.hit).padEnd(5) +
        r.precision.toFixed(2).padEnd(7) +
        r.recall.toFixed(2).padEnd(7) +
        r.rr.toFixed(2),
    );
  }

  const avg = (f) => (rows.reduce((s, r) => s + f(r), 0) / rows.length).toFixed(3);
  console.log('\n--- TRUNG BÌNH (n=' + rows.length + ' truy vấn) ---');
  console.log('Hit@' + K + '      :', avg((r) => r.hit));
  console.log('Precision@' + K + ':', avg((r) => r.precision));
  console.log('Recall@' + K + '   :', avg((r) => r.recall));
  console.log('MRR        :', avg((r) => r.rr));

  // Theo nhóm
  console.log('\n--- THEO NHÓM ---');
  const groups = [...new Set(rows.map((r) => r.group))];
  for (const g of groups) {
    const gr = rows.filter((r) => r.group === g);
    const ga = (f) => (gr.reduce((s, r) => s + f(r), 0) / gr.length).toFixed(2);
    console.log(
      g.padEnd(12) +
        ' Hit=' + ga((r) => r.hit) +
        ' P@5=' + ga((r) => r.precision) +
        ' R@5=' + ga((r) => r.recall) +
        ' MRR=' + ga((r) => r.rr),
    );
  }

  process.exit(0);
})().catch((e) => {
  console.error('LỖI:', e.message);
  process.exit(2);
});
