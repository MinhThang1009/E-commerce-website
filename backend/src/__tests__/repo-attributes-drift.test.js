/**
 * Phase 46.5 — Repository Attribute Drift Unit Test
 *
 * Parse all `backend/src/modules/*\/repositories/*.js` source files.
 * Verify mọi attribute trong `attributes: [...]` tồn tại trong model
 * tương ứng (resolve qua association name).
 *
 * Catch bug `attributes: ['altText']` ngay tại jest, không phải runtime.
 *
 * Note: Heuristic regex-based — skip nested association attributes (sau `include:` hoặc `through:`)
 * vì regex không phân biệt được scope. False negative possible nhưng false positive hạn chế.
 */

const path = require('path');
const fs = require('fs');
const glob = require('glob');

// Map association alias → model name (giống auditRepoAttributes.js)
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

let models;
let modelAttrs;

beforeAll(() => {
  // Mock sequelize để không cần DB
  process.env.DB_SYNC = 'false';
  models = require('@models');
  modelAttrs = {};
  for (const [name, model] of Object.entries(models)) {
    if (model && model.rawAttributes) {
      modelAttrs[name] = new Set(Object.keys(model.rawAttributes));
    }
  }
});

function findRepoFiles() {
  return glob.sync('src/modules/*/repositories/*.js', {
    cwd: path.join(__dirname, '..', '..'),
    absolute: true,
  });
}

function extractDirectAttributes(content) {
  // Match: { association: 'X', attributes: [...] }
  // Skip: nếu giữa association và attributes có `include:` hoặc `through:`
  // (nested attrs thuộc nested model, không validate được bằng regex).
  const regex = /association:\s*['"`](\w+)['"`]([^{}]*?)attributes:\s*\[([^\]]+)\]/gs;
  const queries = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const [, assocName, between, attrsStr] = match;
    if (/\binclude\s*:|\bthrough\s*:/.test(between)) continue;

    const attrs = attrsStr
      .split(',')
      .map((s) => s.trim().replace(/^['"`]|['"`]$/g, ''))
      .filter((s) => {
        if (!s) return false;
        if (s.includes('[') || s.includes(']')) return false; // alias arrays
        if (s.startsWith('this.') || s.includes('.')) return false; // expressions
        if (s.length > 50) return false; // probably code, not attr
        return true;
      });

    if (attrs.length > 0) {
      queries.push({ assocName, attrs });
    }
  }
  return queries;
}

describe('Phase 46.5 — Repository attribute drift unit check', () => {
  test('Tất cả attribute trong include[].attributes phải tồn tại trong model tương ứng', () => {
    const repoFiles = findRepoFiles();
    expect(repoFiles.length).toBeGreaterThan(0);

    const drifts = [];
    for (const filepath of repoFiles) {
      const content = fs.readFileSync(filepath, 'utf8');
      const queries = extractDirectAttributes(content);

      for (const { assocName, attrs } of queries) {
        const modelName = ASSOCIATION_TO_MODEL[assocName];
        if (!modelName) continue; // unknown association — skip
        const knownAttrs = modelAttrs[modelName];
        if (!knownAttrs) continue;

        for (const attr of attrs) {
          if (!knownAttrs.has(attr)) {
            const relPath = path
              .relative(path.join(__dirname, '..', '..'), filepath)
              .replace(/\\/g, '/');
            drifts.push(
              `${relPath}: { association: '${assocName}', attributes: [..., '${attr}', ...] } → ${modelName} không có attribute '${attr}'`,
            );
          }
        }
      }
    }

    expect(drifts).toEqual([]);
  });

  test('Audit script phải tìm được ít nhất 5 file repository (sanity check)', () => {
    const repoFiles = findRepoFiles();
    expect(repoFiles.length).toBeGreaterThanOrEqual(5);
  });
});
