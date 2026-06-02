#!/usr/bin/env node
/**
 * check-patch-coverage.mjs — Patch coverage gate.
 * Phát hiện "thêm/sửa code mà CHƯA có test phủ": chỉ xét file source ĐỔI so với base ref,
 * chạy test liên quan + đo coverage, FAIL nếu file đổi có lines.pct < ngưỡng (hoặc không có test nào chạm).
 *
 * ENV:
 *   PATCH_BASE            base ref so sánh (mặc định 'origin/main', fallback 'main')
 *   PATCH_COV_THRESHOLD   ngưỡng % lines cho file đổi (mặc định 80)
 * Dùng: npm run check:patch-coverage   (CI gate cho PR)
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(BACKEND, '..');
const THRESHOLD = Number(process.env.PATCH_COV_THRESHOLD || 80);

function sh(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

// Base ref: ưu tiên origin/main, fallback main
let base = process.env.PATCH_BASE;
if (!base) {
  try { sh('git rev-parse --verify origin/main', ROOT); base = 'origin/main'; }
  catch { base = 'main'; }
}

// File source đổi (loại test + file bị jest exclude khỏi coverage)
const EXCLUDE = /(\.test\.js$|\.spec\.js$|\/__tests__\/|\/__mocks__\/|\/migrations\/|\/config\/|server\.js$|app\.js$|module\.js$|index\.js$|\/dtos?\/|i-[a-z-]+-repository\.js$|\bI[A-Z][A-Za-z]*\.js$)/;
let changed;
try {
  changed = sh(`git diff --name-only ${base}...HEAD -- backend/src`, ROOT)
    .split('\n').filter(Boolean)
    .filter((f) => f.endsWith('.js') && !EXCLUDE.test(f))
    .map((f) => f.replace(/^backend\//, '')); // → relative cho jest (chạy từ backend/)
} catch (e) {
  console.log(`⏭️  Không so sánh được với base '${base}' (${e.message.split('\n')[0]}). Bỏ qua patch-coverage.`);
  process.exit(0);
}

if (changed.length === 0) {
  console.log('✅ Không có file source backend nào đổi → patch-coverage bỏ qua.');
  process.exit(0);
}

console.log(`🔎 Patch-coverage (base=${base}, ngưỡng=${THRESHOLD}% lines) cho ${changed.length} file:`);
changed.forEach((f) => console.log('   • ' + f));

// Chạy test liên quan + đo coverage (json-summary)
try {
  execSync(
    `npx jest --findRelatedTests ${changed.join(' ')} --coverage --coverageReporters=json-summary --silent --forceExit --passWithNoTests`,
    { cwd: BACKEND, stdio: ['pipe', 'pipe', 'inherit'] },
  );
} catch {
  console.error('❌ Test liên quan thất bại — fix test trước.');
  process.exit(1);
}

const summaryPath = join(BACKEND, 'coverage', 'coverage-summary.json');
if (!existsSync(summaryPath)) {
  console.error('❌ Không tìm thấy coverage-summary.json.');
  process.exit(1);
}
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
// Map key (absolute) → pct lines
const covByAbs = {};
for (const [k, v] of Object.entries(summary)) {
  if (k === 'total') continue;
  covByAbs[resolve(k)] = v.lines?.pct ?? 0;
}

const failures = [];
for (const rel of changed) {
  const abs = resolve(BACKEND, rel);
  const pct = covByAbs[abs];
  if (pct === undefined) failures.push(`${rel} — KHÔNG có test nào phủ (0 entry)`);
  else if (pct < THRESHOLD) failures.push(`${rel} — lines ${pct}% < ${THRESHOLD}%`);
}

if (failures.length) {
  console.error(`\n❌ Patch-coverage FAIL — ${failures.length} file đổi thiếu test:`);
  failures.forEach((f) => console.error('   ✗ ' + f));
  console.error('\n   → Viết/bổ sung test cho code mới trước khi merge.');
  process.exit(1);
}
console.log(`\n✅ Patch-coverage PASS — mọi file đổi ≥ ${THRESHOLD}% lines.`);
process.exit(0);
