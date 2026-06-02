#!/usr/bin/env node
/**
 * check-unused-routes.mjs — Phát hiện endpoint backend KHÔNG được frontend gọi
 * (nghi ngờ "API thừa"/orphan khi xóa tính năng).
 *
 * Heuristic (không hoàn hảo — kết quả để con người review):
 *  1. Quét backend/src/modules/ **routes.js, trích (method, subpath).
 *  2. Ghép basePath module → full path (FE gọi path KHÔNG có tiền tố /api).
 *  3. Lấy phần tĩnh trước :param, grep frontend/src xem có tham chiếu không.
 *  4. Bỏ qua webhook/oauth/cron (ALLOWLIST — không gọi từ FE là bình thường).
 *
 * Dùng: node scripts/check-unused-routes.mjs   (hoặc: npm run check:routes)
 * Thoát code 0 luôn (informational) — KHÔNG fail build.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(BACKEND, '..');
const FE_SRC = join(ROOT, 'frontend', 'src');

// basePath theo module (khớp app.js). catalog có 3 mount → thử cả 3.
const BASE_PATHS = {
  auth: ['/auth'], users: ['/users'], cart: ['/cart'], orders: ['/orders'],
  payment: ['/payments'], reviews: ['/reviews'], inventory: ['/inventory'],
  'discount-code': ['/discount-codes'], upload: ['/uploads'], image: ['/images'],
  content: ['/contact'], 'search-history': ['/search-histories'], wishlist: ['/wishlists'],
  ai: ['/chatbot'], admin: ['/admin'], attribute: ['/attributes'],
  catalog: ['/products', '/categories', '/brands'],
};

// Server-to-server / không gọi từ FE là bình thường → bỏ qua
const ALLOWLIST = [
  '/payments/momo/return', '/payments/momo/ipn', '/payments/vnpay/return', '/payments/vnpay/ipn',
  '/auth/google', '/auth/refresh-token', '/auth/verify-otp', '/auth/resend-verification',
  '/images/test-upload', '/images/admin/cleanup', '/health',
];

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (f === 'routes.js') out.push(p);
  }
  return out;
}

// Đọc toàn bộ FE source vào 1 chuỗi để grep nhanh
function readAllFe() {
  let buf = '';
  const stack = [FE_SRC];
  while (stack.length) {
    const d = stack.pop();
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      const s = statSync(p);
      if (s.isDirectory()) stack.push(p);
      else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) buf += readFileSync(p, 'utf8');
    }
  }
  return buf;
}

const routeRe = /\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
const modulesDir = join(BACKEND, 'src', 'modules');
const feSrc = readAllFe();
const suspects = [];

for (const file of walk(modulesDir)) {
  const moduleName = file.split(/[\\/]/).slice(-2)[0];
  const bases = BASE_PATHS[moduleName] || ['/' + moduleName];
  const txt = readFileSync(file, 'utf8');
  let m;
  while ((m = routeRe.exec(txt))) {
    const [, method, sub] = m;
    const subClean = sub === '/' ? '' : sub;
    const candidates = bases.map((base) => (base + subClean).replace(/\/+$/, '') || base);
    if (candidates.some((full) => ALLOWLIST.some((a) => full.startsWith(a)))) continue;
    // FE có tham chiếu nếu BẤT KỲ candidate (full path hoặc phần tĩnh trước :param) xuất hiện
    const referenced = candidates.some((full) => {
      const staticPrefix = full.split('/:')[0];
      return feSrc.includes(full) || (staticPrefix.length > 4 && feSrc.includes(staticPrefix));
    });
    if (!referenced) {
      suspects.push({ method: method.toUpperCase(), path: candidates[0], module: moduleName });
    }
  }
}

// Dedupe theo method+path
const seen = new Set();
for (let i = suspects.length - 1; i >= 0; i--) {
  const k = suspects[i].method + ' ' + suspects[i].path;
  if (seen.has(k)) suspects.splice(i, 1);
  else seen.add(k);
}

if (suspects.length === 0) {
  console.log('✅ Không phát hiện endpoint nghi ngờ thừa (mọi route có tham chiếu FE hoặc nằm trong allowlist).');
} else {
  console.log(`⚠️  ${suspects.length} endpoint NGHI NGỜ không được frontend gọi (review thủ công):\n`);
  for (const s of suspects) console.log(`   ${s.method.padEnd(6)} ${s.path}   [${s.module}]`);
  console.log('\n   Lưu ý: heuristic — có thể FP nếu FE gọi qua biến/template. Kiểm tra trước khi xóa.');
}
process.exit(0);
