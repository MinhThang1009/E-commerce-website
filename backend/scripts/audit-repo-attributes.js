/**
 * Phase 46.3 — Repository Attribute Drift Audit
 *
 * Quét backend/src/modules/*\/repositories/*.js, parse mọi `attributes: [...]`
 * literal trong include[] và findAll/findOne options. So với model.rawAttributes.
 * Báo những attribute không tồn tại trong model tương ứng.
 *
 * Usage: node backend/scripts/auditRepoAttributes.js
 *
 * Note: Heuristic regex-based — không full AST parse. Match association name
 * → resolve model qua sequelize.models[Capitalized(association)]. False
 * positive có thể xảy ra với association name không khớp model name.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const glob = require('glob');

// Load all models
const models = require('../src/models');
const sequelize = require('../src/config/sequelize');

// Map association alias → model name (manually defined for known patterns)
const ASSOCIATION_TO_MODEL = {
  category: 'Category',
  categories: 'Category',
  reviews: 'Review',
  productImages: 'ProductImage',
  productImage: 'ProductImage',
  variants: 'ProductVariant',
  variant: 'ProductVariant',
  brand: 'Brand',
  brands: 'Brand',
  collection: 'Collection',
  collections: 'Collection',
  user: 'User',
  users: 'User',
  product: 'Product',
  products: 'Product',
  productAttributes: 'ProductAttribute',
  cart: 'Cart',
  cartItems: 'CartItem',
  cartItem: 'CartItem',
  order: 'Order',
  orderItems: 'OrderItem',
  orderItem: 'OrderItem',
  address: 'Address',
  inventoryLogs: 'InventoryLog',
  chatMessages: 'ChatMessage',
};

function getModelAttrs(modelName) {
  const model = models[modelName];
  if (!model) return null;
  return new Set(Object.keys(model.rawAttributes));
}

function auditFile(filepath, content) {
  const drifts = [];
  const lines = content.split('\n');

  // Match: { association: 'name', attributes: [...] } — top-level chỉ
  // Skip nếu có `include:` hoặc `through:` giữa association và attributes
  // (nested attrs thuộc model nested, KHÔNG thuộc top-level association).
  const includeRegex = /association:\s*['"`](\w+)['"`]([^{}]*?)attributes:\s*\[([^\]]+)\]/gs;
  let match;
  while ((match = includeRegex.exec(content)) !== null) {
    const assocName = match[1];
    const between = match[2];
    const attrsStr = match[3];

    // False-positive guard: nếu giữa association và attributes có `include:` hoặc `through:` →
    // attributes thuộc nested association, không validate được mà không AST parse.
    if (/\binclude\s*:|\bthrough\s*:/.test(between)) continue;
    const attrs = attrsStr
      .split(',')
      .map((s) => s.trim().replace(/^['"`]|['"`]$/g, '').replace(/^\['([^']+)',\s*'([^']+)'\]$/, '$2'))
      .filter((s) => s && !s.startsWith('[') && !s.startsWith('this.') && s.length < 50);

    const modelName = ASSOCIATION_TO_MODEL[assocName];
    if (!modelName) continue; // skip unknown associations
    const modelAttrs = getModelAttrs(modelName);
    if (!modelAttrs) continue;

    // Find line number of this match
    const beforeMatch = content.substring(0, match.index);
    const lineNum = beforeMatch.split('\n').length;

    for (const attr of attrs) {
      // Skip array-form aliases like ['base_price', 'price']
      if (!attr || attr.includes('[') || attr.includes(']')) continue;
      if (!modelAttrs.has(attr)) {
        drifts.push({ filepath, lineNum, assocName, modelName, attr });
      }
    }
  }

  return drifts;
}

async function main() {
  console.log('🔍 Phase 46.3 — Repository Attribute Drift Audit\n');

  const repoFiles = glob.sync('backend/src/modules/*/repositories/*.js', {
    cwd: path.join(__dirname, '..', '..'),
    absolute: true,
  });

  console.log(`Tìm thấy ${repoFiles.length} repository files. Đang audit...\n`);

  let totalDrifts = 0;
  const lines = [];
  lines.push('# Repository Attribute Drift Report — Phase 46.3');
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Files audited: ${repoFiles.length}`);
  lines.push('');

  const allDrifts = [];
  for (const filepath of repoFiles) {
    const content = fs.readFileSync(filepath, 'utf8');
    const drifts = auditFile(filepath, content);
    if (drifts.length > 0) {
      const relPath = path.relative(path.join(__dirname, '..', '..'), filepath).replace(/\\/g, '/');
      lines.push(`## ${relPath}`);
      lines.push('');
      for (const d of drifts) {
        lines.push(`- Line ${d.lineNum}: \`{ association: '${d.assocName}', attributes: [..., '${d.attr}', ...] }\` → ${d.modelName} model không có attr \`${d.attr}\``);
      }
      lines.push('');
      totalDrifts += drifts.length;
      allDrifts.push(...drifts);
    }
  }

  if (totalDrifts === 0) {
    lines.push('✅ **NO DRIFT** — Tất cả repository attributes khớp với model definitions.');
  } else {
    lines.unshift('');
    lines.unshift(`❌ **${totalDrifts} drift** detected — fix ngay để tránh runtime 500 error.`);
    lines.unshift('## Tổng kết');
    lines.unshift('');
  }

  const reportPath = path.join(__dirname, '..', '..', 'docs', 'REPO_ATTRIBUTE_DRIFT_REPORT.md');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`📝 Report ghi vào: ${reportPath}`);
  console.log(`📊 Tổng drift: ${totalDrifts}`);

  await sequelize.close();
  process.exit(totalDrifts > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Audit fail:', err);
  process.exit(2);
});
