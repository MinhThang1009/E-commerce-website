#!/usr/bin/env node
/**
 * check-patch-coverage.mjs (frontend) — Patch coverage gate cho FE.
 * Chỉ xét file source FE ĐỔI so với base ref, chạy test liên quan + đo coverage,
 * FAIL nếu file đổi < ngưỡng lines (hoặc không có test nào phủ).
 *
 * ENV: PATCH_BASE (mặc định origin/main → main), PATCH_COV_THRESHOLD (mặc định 80)
 * Dùng: npm run check:patch-coverage
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(FE, '..');
const THRESHOLD = Number(process.env.PATCH_COV_THRESHOLD || 80);

const sh = (cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

let base = process.env.PATCH_BASE;
if (!base) {
  try { sh('git rev-parse --verify origin/main', ROOT); base = 'origin/main'; }
  catch { base = 'main'; }
}

// Loại test, type-only, entry, generated
const EXCLUDE = /(\.test\.[tj]sx?$|\.d\.ts$|\/__tests__\/|\/__mocks__\/|main\.tsx$|vite-env|\/types\/|\.types\.ts$|routes\/paths\.ts$)/;
let changed;
try {
  changed = sh(`git diff --name-only ${base}...HEAD -- frontend/src`, ROOT)
    .split('\n').filter(Boolean)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !EXCLUDE.test(f))
    .map((f) => f.replace(/^frontend\//, ''));
} catch (e) {
  console.log(`⏭️  Không so sánh được base '${base}' (${e.message.split('\n')[0]}). Bỏ qua.`);
  process.exit(0);
}

if (changed.length === 0) {
  console.log('✅ Không có file source frontend nào đổi → patch-coverage bỏ qua.');
  process.exit(0);
}

console.log(`🔎 FE patch-coverage (base=${base}, ngưỡng=${THRESHOLD}% lines) cho ${changed.length} file:`);
changed.forEach((f) => console.log('   • ' + f));

try {
  execSync(
    `npx jest --config jest.config.cjs --findRelatedTests ${changed.join(' ')} --coverage --coverageReporters=json-summary --silent --passWithNoTests`,
    { cwd: FE, stdio: ['pipe', 'pipe', 'inherit'] },
  );
} catch {
  console.error('❌ Test liên quan FE thất bại — fix trước.');
  process.exit(1);
}

const summaryPath = join(FE, 'coverage', 'coverage-summary.json');
if (!existsSync(summaryPath)) {
  console.error('❌ Không tìm thấy coverage-summary.json (FE).');
  process.exit(1);
}
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const covByAbs = {};
for (const [k, v] of Object.entries(summary)) {
  if (k === 'total') continue;
  covByAbs[resolve(k)] = v.lines?.pct ?? 0;
}

const failures = [];
for (const rel of changed) {
  const abs = resolve(FE, rel);
  const pct = covByAbs[abs];
  if (pct === undefined) failures.push(`${rel} — KHÔNG có test nào phủ`);
  else if (pct < THRESHOLD) failures.push(`${rel} — lines ${pct}% < ${THRESHOLD}%`);
}

if (failures.length) {
  console.error(`\n❌ FE patch-coverage FAIL — ${failures.length} file đổi thiếu test:`);
  failures.forEach((f) => console.error('   ✗ ' + f));
  process.exit(1);
}
console.log(`\n✅ FE patch-coverage PASS — mọi file đổi ≥ ${THRESHOLD}% lines.`);
process.exit(0);
