#!/usr/bin/env node
/**
 * check-doc-freshness.mjs — Cảnh báo .md stale khi thêm/sửa/xóa tính năng.
 *
 * Heuristic (không auto-sync — auto-rewrite docs dễ tạo drift sai):
 *   Nếu code trong backend/src/modules/<m>/** (hoặc frontend/src/features/<f>/**) ĐỔI
 *   mà CLAUDE.md của module/feature đó KHÔNG nằm trong cùng changeset → cảnh báo.
 *
 * Mặc định xét file STAGED (dùng trong pre-commit). Đặt CHECK_BASE=<ref> để xét diff vs ref.
 * Informational: exit 0 (chỉ nhắc, không chặn). Đặt DOC_FRESH_STRICT=1 để exit 1 (gate CI).
 */
import { execSync } from 'node:child_process';

const ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const base = process.env.CHECK_BASE;
const diffCmd = base
  ? `git diff --name-only ${base}...HEAD`
  : 'git diff --cached --name-only --diff-filter=ACMD';

const files = execSync(diffCmd, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);

// CLAUDE.md theo module/feature (1:1 với thư mục code)
const GROUPS = [
  { re: /^backend\/src\/modules\/([^/]+)\//, claude: (m) => `backend/src/modules/${m}/CLAUDE.md` },
  { re: /^frontend\/src\/features\/([^/]+)\//, claude: (f) => `frontend/src/features/${f}/CLAUDE.md` },
];

// .md ở ROOT (và CLAUDE.md cấp cao) ↔ vùng code liên quan. Code khớp đổi mà doc không đổi → nhắc.
const ROOT_DOCS = [
  { doc: 'STRUCTURE.md', re: /^backend\/src\/(models\/|app\.js|modules\/[^/]+\/module\.js)/ },
  { doc: 'DIAGRAMS.md', re: /^backend\/src\/(models\/|app\.js|modules\/[^/]+\/(routes|services)\/)/ },
  { doc: 'TESTING_STRATEGY.md', re: /(jest\.[a-z.]*config\.[cm]?js$|__e2e__|__api__|__integration__)/ },
  { doc: 'RAG_CHATBOT_PIPELINE.md', re: /^backend\/src\/modules\/ai\// },
  { doc: 'PIPELINE_TRACE_EXAMPLES.md', re: /^backend\/src\/modules\/ai\// },
  { doc: 'README.md', re: /(^backend\/package\.json$|^frontend\/package\.json$|\.env\.example$)/ },
  { doc: 'backend/CLAUDE.md', re: /^backend\/src\/(app\.js|modules\/[^/]+\/module\.js)$/ },
  { doc: 'frontend/CLAUDE.md', re: /^frontend\/src\/(routes\/|App\.tsx$)/ },
];

const fileSet = new Set(files);
const warnings = [];
const reported = new Set();

for (const f of files) {
  if (/\.md$/.test(f) || /\.(test|spec)\.[tj]sx?$/.test(f)) continue; // bỏ .md & test
  for (const g of GROUPS) {
    const mt = f.match(g.re);
    if (!mt) continue;
    const claudePath = g.claude(mt[1]);
    if (!reported.has(claudePath) && !fileSet.has(claudePath)) {
      warnings.push({ name: mt[1], doc: claudePath });
      reported.add(claudePath);
    }
  }
}

// Root docs: code khớp đổi (bỏ qua chính file .md) mà doc đó không nằm trong changeset
const codeChanged = files.filter((f) => !/\.md$/.test(f));
const rootWarnings = [];
for (const rd of ROOT_DOCS) {
  if (fileSet.has(rd.doc)) continue; // doc đã được cập nhật cùng
  if (codeChanged.some((f) => rd.re.test(f))) rootWarnings.push(rd.doc);
}

if (warnings.length === 0 && rootWarnings.length === 0) {
  console.log('✅ doc-freshness: tài liệu liên quan các thay đổi đã được cập nhật cùng (hoặc không cần ghi).');
  process.exit(0);
}

console.log('⚠️  doc-freshness — tài liệu CÓ THỂ stale (code đổi nhưng .md liên quan chưa cập nhật):');
for (const w of warnings) console.log(`   • [module] ${w.name}  → ${w.doc}`);
for (const d of rootWarnings) console.log(`   • [root]   ${d}`);
console.log('   (Nhắc nhở — không chặn. Cập nhật nếu thay đổi ảnh hưởng tài liệu; bỏ qua nếu chỉ sửa nội bộ.)');

process.exit(process.env.DOC_FRESH_STRICT === '1' ? 1 : 0);
