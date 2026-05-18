const fs = require('fs');
const path = require('path');

const viPath = "d:/QUAN TRỌNG/e-commerce website/frontend/src/locales/vi.json";
const enPath = "d:/QUAN TRỌNG/e-commerce website/frontend/src/locales/en.json";

const viData = JSON.parse(fs.readFileSync(viPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

const viFlat = flattenObject(viData);
const enFlat = flattenObject(enData);

const viKeys = Object.keys(viFlat).sort();
const enKeys = Object.keys(enFlat).sort();
const enKeysSet = new Set(enKeys);

// 1. Keys missing in en.json
const missingInEn = viKeys.filter(key => !enKeysSet.has(key));

// 2. Keys with Vietnamese characters in en.json
const viChars = /[À-ỹ]/;
const vietnameseInEn = [];

viKeys.forEach(key => {
  if (enKeysSet.has(key)) {
    const viValue = viFlat[key];
    const enValue = enFlat[key];
    if (typeof enValue === 'string' && viChars.test(enValue) && enValue !== viValue) {
      vietnameseInEn.push({
        key,
        viValue,
        enValue
      });
    }
  }
});

console.log('=== KEYS MISSING IN en.json ===');
console.log(`Total: ${missingInEn.length}\n`);
missingInEn.forEach(key => {
  console.log(`- ${key}`);
});

console.log('\n=== KEYS WITH VIETNAMESE VALUE IN en.json ===');
console.log(`Total: ${vietnameseInEn.length}\n`);
vietnameseInEn.forEach(item => {
  console.log(`- ${item.key}`);
  console.log(`  VI: ${item.viValue}`);
  console.log(`  EN: ${item.enValue}`);
});

console.log('\n=== SUMMARY ===');
console.log(`Total keys in vi.json: ${viKeys.length}`);
console.log(`Total keys in en.json: ${enKeys.length}`);
console.log(`Missing in en.json: ${missingInEn.length}`);
console.log(`Vietnamese in en.json: ${vietnameseInEn.length}`);
