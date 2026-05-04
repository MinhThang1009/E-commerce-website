// Script kiểm tra key parity giữa vi.json và en.json
// Chạy: node scripts/check-i18n.js
const vi = require('../frontend/src/locales/vi.json');
const en = require('../frontend/src/locales/en.json');

// Lấy tất cả key dạng phẳng (dotted path) từ object lồng nhau
function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...flattenKeys(obj[key], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const viKeys = flattenKeys(vi).sort();
const enKeys = flattenKeys(en).sort();

const viSet = new Set(viKeys);
const enSet = new Set(enKeys);

const missingInEn = viKeys.filter(k => !enSet.has(k));
const missingInVi = enKeys.filter(k => !viSet.has(k));

console.log(`vi.json: ${viKeys.length} keys`);
console.log(`en.json: ${enKeys.length} keys`);
console.log('');
console.log('Missing in en:', missingInEn.length ? missingInEn : []);
console.log('Missing in vi:', missingInVi.length ? missingInVi : []);

if (missingInEn.length === 0 && missingInVi.length === 0) {
  console.log('\n✅ Key parity OK — 2 file đồng bộ hoàn toàn');
} else {
  console.log(`\n❌ Có ${missingInEn.length + missingInVi.length} key lệch nhau`);
  process.exit(1);
}
