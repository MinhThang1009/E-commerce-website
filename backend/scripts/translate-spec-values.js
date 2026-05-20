/**
 * Script: dịch value → value_en cho product_specifications còn thiếu.
 *
 * 2 bước:
 *   1. Pattern-based translation (offline, nhanh, không tốn API) cho các pattern phổ biến
 *   2. AI translation (OpenRouter) cho phần còn lại — cần API key
 *
 * Chạy: node -r module-alias/register scripts/translate-spec-values.js
 */
require('dotenv').config();
require('module-alias/register');

const { ProductSpecification } = require('@models');
const { translateBatch } = require('@modules/ai/services/translate/translate-service');

// ── Pattern-based translations (không cần API) ─────────────────────────────
const PATTERNS = [
  // Processor cores/threads
  [/(\d+) nhân (\d+) luồng/gi, '$1-core $2-thread'],
  [/(\d+) nhân/gi, '$1-core'],
  [/(\d+) luồng/gi, '$1-thread'],
  // Hardware/material
  [/Vỏ nhựa/gi, 'Plastic chassis'],
  [/Vỏ nhôm/gi, 'Aluminum chassis'],
  [/Vỏ kim loại/gi, 'Metal chassis'],
  [/Vỏ hợp kim/gi, 'Alloy chassis'],
  [/Card tích hợp/gi, 'Integrated graphics'],
  [/Tích hợp/gi, 'Integrated'],
  [/Không có đèn nền/gi, 'No backlight'],
  [/Không có đèn/gi, 'No backlight'],
  [/Đèn nền/gi, 'Backlight'],
  // Manufacturer info
  [/Hãng không công bố/gi, 'Not specified by manufacturer'],
  [/Không công bố/gi, 'Not specified'],
  // Storage/memory
  [/Có thể tháo ra, lắp thanh khác/gi, 'Removable, upgradeable'],
  [/Có thể tháo ra/gi, 'Removable'],
  [/tối đa/gi, 'up to'],
  // Charging
  [/Sạc nhanh/gi, 'Fast charging'],
  [/sạc không dây/gi, 'wireless charging'],
  [/Sạc không dây/gi, 'Wireless charging'],
  // Water resistance
  [/Kháng nước\/bụi/gi, 'Water/dust resistance'],
  [/Kháng nước/gi, 'Water resistance'],
  [/Kháng bụi/gi, 'Dust resistance'],
  // Display
  [/Chống chói Anti Glare/gi, 'Anti-Glare'],
  [/Chống chói/gi, 'Anti-glare'],
  // Connectivity
  [/Hỗ trợ/gi, 'Supports'],
  [/hỗ trợ/gi, 'supports'],
  // Dimensions
  [/Dài ([0-9.]+) mm/gi, 'Length: $1 mm'],
  [/Rộng ([0-9.]+) mm/gi, 'Width: $1 mm'],
  [/Dày ([0-9.]+) mm/gi, 'Thickness: $1 mm'],
  [/Dài /gi, 'Length: '],
  [/Rộng /gi, 'Width: '],
  [/Dày /gi, 'Thickness: '],
  // Design
  [/Thiết kế mỏng nhẹ/gi, 'Slim and lightweight design'],
  // Process
  [/Tiến trình/gi, 'Process node'],
  [/tiến trình/gi, 'process node'],
];

function applyPatterns(text) {
  if (!text) return null;
  let result = text;
  for (const [pattern, replacement] of PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  // Trả null nếu text không thay đổi (vẫn cần AI dịch)
  return result !== text ? result : null;
}

const BATCH_SIZE = 20;

async function run() {
  // Lấy tất cả specs thiếu valueEn HOẶC valueEn = value (chưa dịch thực sự)
  const allSpecs = await ProductSpecification.findAll({
    attributes: ['id', 'value', 'valueEn'],
  });

  const needsTranslation = allSpecs.filter(
    (s) => !s.valueEn || s.valueEn === s.value,
  );

  console.log(`Specs cần dịch: ${needsTranslation.length}/${allSpecs.length}`);

  // Bước 1: Pattern-based (offline)
  let patternFixed = 0;
  const stillNeeds = [];

  for (const spec of needsTranslation) {
    const patternResult = applyPatterns(spec.value);
    if (patternResult) {
      await spec.update({ valueEn: patternResult });
      patternFixed++;
    } else {
      stillNeeds.push(spec);
    }
  }

  console.log(`Pattern-based: ${patternFixed} specs đã dịch`);
  console.log(`Còn lại cần AI: ${stillNeeds.length} specs`);

  // Bước 2: AI translation cho phần còn lại
  if (stillNeeds.length > 0) {
    let aiFixed = 0;
    for (let i = 0; i < stillNeeds.length; i += BATCH_SIZE) {
      const batch = stillNeeds.slice(i, i + BATCH_SIZE);
      const values = batch.map((s) => s.value);

      try {
        const translated = await translateBatch(values, 'vi', 'en');

        for (let j = 0; j < batch.length; j++) {
          const en = translated[j];
          // Chỉ update nếu AI thực sự dịch (khác với input)
          if (en && en !== values[j]) {
            await batch[j].update({ valueEn: en });
            aiFixed++;
          }
        }

        console.log(`AI batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} specs processed`);
      } catch (err) {
        console.warn(`AI batch lỗi: ${err.message} — bỏ qua batch này`);
      }
    }

    console.log(`AI-based: ${aiFixed} specs đã dịch`);
    console.log(`Còn ${stillNeeds.length - aiFixed} specs chưa dịch được (cần kiểm tra API key)`);
  }

  // Verify cuối
  const remaining = await ProductSpecification.count({
    where: { valueEn: null },
  });
  console.log(`\nKết quả: ${remaining} specs vẫn còn null valueEn`);
  console.log('Done!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Lỗi:', err.message);
  process.exit(1);
});
