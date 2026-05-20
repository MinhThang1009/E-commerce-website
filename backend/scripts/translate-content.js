/**
 * Script dịch nội dung tiếng Việt sang tiếng Anh dùng OpenRouter.
 * Model cấu hình qua TRANSLATE_MODEL trong .env (mặc định: openai/gpt-4o-mini).
 *
 * Chạy: node scripts/translateContent.js [--dry-run] [--table=products]
 *   --dry-run  : in ra nội dung dịch, không write DB
 *   --table    : chỉ dịch bảng cụ thể (products | categories | brands | collections)
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
require('module-alias/register');
const axios = require('axios');
const sequelize = require('../src/config/sequelize');

// Models
const { Product, Category, Brand, Collection } = require('../src/models');

const DRY_RUN  = process.argv.includes('--dry-run');
const TABLE_ARG = (process.argv.find((a) => a.startsWith('--table=')) || '').replace('--table=', '') || null;

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL   = process.env.TRANSLATE_MODEL || 'openai/gpt-4o-mini';

// Delay giữa mỗi batch request để tránh rate limit
const DELAY_MS = 800;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Gọi OpenRouter API để dịch một batch items.
 * Mỗi item có dạng { id, vi: string, context: string }
 * Trả về array { id, en: string }
 */
async function translateBatch(items) {
  if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY không được set trong .env');
    process.exit(1);
  }

  const listText = items
    .map((item, i) => `${i + 1}. [${item.id}] [ctx:${item.context}] ${item.vi}`)
    .join('\n');

  const prompt = `You are a professional translator for a Vietnamese e-commerce website selling electronics (smartphones, laptops, tablets).

Translate each item from Vietnamese to English. Rules:
- Product/brand names that are already English (iPhone, Samsung, MacBook, etc.) → keep as-is
- Technical specs → translate accurately
- Marketing copy → natural English, not literal
- Keep it concise (same approximate length)
- Output ONLY a numbered list matching input order, format: "N. [id] english text"
- No explanations, no extra text

Items to translate:
${listText}`;

  const response = await axios.post(
    API_URL,
    {
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const text = response.data?.choices?.[0]?.message?.content || '';
  const results = [];

  // Parse: "1. [id] translation text"
  const lines = text.trim().split('\n').filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^\d+\.\s*\[([^\]]+)\]\s+(.+)$/);
    if (match) {
      results.push({ id: match[1], en: match[2].trim() });
    }
  }

  // Fallback: nếu parse sai → dùng vi text
  if (results.length !== items.length) {
    console.warn(`  ⚠️  Parse mismatch: expected ${items.length}, got ${results.length}`);
    for (const item of items) {
      if (!results.find((r) => r.id === item.id)) {
        results.push({ id: item.id, en: item.vi }); // fallback = vi
      }
    }
  }
  return results;
}

/**
 * Dịch và update một bảng.
 * fieldMap: { viField, enField, context }[]
 */
async function processTable(Model, tableName, fieldMaps, batchSize = 5) {
  const rows = await Model.findAll({ paranoid: false });
  const toProcess = rows.filter((r) => {
    // Chỉ dịch row chưa có EN data
    return fieldMaps.some((f) => !r[f.enField] && r[f.viField]);
  });

  console.log(`\n📦 ${tableName}: ${rows.length} total, ${toProcess.length} cần dịch`);
  if (toProcess.length === 0) return;

  let translated = 0;
  for (let i = 0; i < toProcess.length; i += batchSize) {
    const batch = toProcess.slice(i, i + batchSize);

    // Build items cho từng field trong batch
    for (const { viField, enField, context } of fieldMaps) {
      const items = batch
        .filter((r) => r[viField] && !r[enField])
        .map((r) => ({ id: String(r.id), vi: r[viField], context }));

      if (items.length === 0) continue;

      try {
        const results = await translateBatch(items);

        for (const result of results) {
          const row = batch.find((r) => String(r.id) === result.id);
          if (!row) continue;

          if (DRY_RUN) {
            console.log(`  [DRY] ${tableName}#${row.id} ${viField} → ${enField}:`);
            console.log(`    VI: ${row[viField]?.substring(0, 80)}`);
            console.log(`    EN: ${result.en?.substring(0, 80)}`);
          } else {
            await row.update({ [enField]: result.en }, { silent: true });
            translated++;
          }
        }

        process.stdout.write(`  ✓ batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toProcess.length / batchSize)} (${enField})\n`);
        await sleep(DELAY_MS);
      } catch (err) {
        console.error(`  ❌ Lỗi batch ${i}-${i + batchSize} field ${viField}:`, err.message);
        await sleep(2000); // Back-off khi lỗi
      }
    }
  }

  if (!DRY_RUN) console.log(`  ✅ Đã dịch ${translated} values trong ${tableName}`);
}

/**
 * Dịch specifications JSON — values tiếng Việt → tiếng Anh.
 * Giữ nguyên keys (đã là English), chỉ dịch values.
 */
async function translateSpecifications(batchSize = 3) {
  const [rows] = await sequelize.query(
    `SELECT id, name_vi, specifications FROM products
     WHERE specifications IS NOT NULL AND specifications_en IS NULL LIMIT 1000`
  );

  console.log(`\n🔧 specifications: ${rows.length} sản phẩm cần dịch`);
  if (rows.length === 0) return;

  let done = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const items = batch.map((r) => {
      let specs;
      try { specs = JSON.parse(r.specifications); } catch { specs = {}; }
      return { id: String(r.id), specs };
    });

    const itemsText = items
      .map((item) => `Product ${item.id}:\n${JSON.stringify(item.specs, null, 2)}`)
      .join('\n\n---\n\n');

    const prompt = `You are translating product specifications from Vietnamese to English for an electronics e-commerce site.

For each product JSON below:
- Keep all keys exactly as-is (they're already in English)
- Translate only the VALUES from Vietnamese to English
- Keep English/numbers/units as-is (e.g., "8GB", "6.1 inch", "A19", "48 MP")
- Technical Vietnamese terms: translate accurately (e.g., "6 nhân" → "6-core", "pin" → "battery", "màn hình" → "display")
- Return ONLY valid JSON, one object per product, in format:
{"id": "1", "specs": {...}}
{"id": "2", "specs": {...}}

Products to translate:
${itemsText}`;

    try {
      const response = await axios.post(
        API_URL,
        {
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 6000,
        },
        {
          headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 40000,
        }
      );

      const rawText = response.data?.choices?.[0]?.message?.content || '';
      // Strip markdown code block nếu có
      const clean = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

      // Extract JSON objects bằng bracket matching (handle multi-line JSON)
      const jsonObjects = [];
      let depth = 0, start = -1;
      for (let ci = 0; ci < clean.length; ci++) {
        if (clean[ci] === '{') {
          if (depth === 0) start = ci;
          depth++;
        } else if (clean[ci] === '}') {
          depth--;
          if (depth === 0 && start !== -1) {
            jsonObjects.push(clean.slice(start, ci + 1));
            start = -1;
          }
        }
      }

      for (const jsonStr of jsonObjects) {
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.id && parsed.specs) {
            const row = batch.find((r) => String(r.id) === String(parsed.id));
            if (!row) continue;
            if (DRY_RUN) {
              console.log(`  [DRY] specs#${parsed.id}: ${JSON.stringify(parsed.specs).substring(0, 100)}`);
            } else {
              await sequelize.query(
                'UPDATE products SET specifications_en = ? WHERE id = ?',
                { replacements: [JSON.stringify(parsed.specs), parsed.id] }
              );
              done++;
            }
          }
        } catch (parseErr) {
          console.warn(`  ⚠️ JSON parse fail: ${parseErr.message?.substring(0, 60)}`);
        }
      }

      process.stdout.write(`  ✓ batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rows.length / batchSize)} (specifications_en)\n`);
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`  ❌ Lỗi specs batch ${i}:`, err.message);
      await sleep(2000);
    }
  }

  if (!DRY_RUN) console.log(`  ✅ Đã dịch specifications cho ${done} sản phẩm`);
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log(`🌐 Bắt đầu dịch${DRY_RUN ? ' (DRY RUN)' : ''}...`);

    const tables = {
      categories: () =>
        processTable(Category, 'categories', [
          { viField: 'nameVi',        enField: 'nameEn',        context: 'category-name' },
          { viField: 'descriptionVi', enField: 'descriptionEn', context: 'category-desc' },
        ]),
      brands: () =>
        processTable(Brand, 'brands', [
          { viField: 'nameVi', enField: 'nameEn', context: 'brand-name' },
        ]),
      collections: () =>
        processTable(Collection, 'collections', [
          { viField: 'nameVi',        enField: 'nameEn',        context: 'collection-name' },
          { viField: 'descriptionVi', enField: 'descriptionEn', context: 'collection-desc' },
        ]),
      products: () =>
        processTable(
          Product, 'products',
          [
            { viField: 'nameVi',             enField: 'nameEn',             context: 'product-name' },
            { viField: 'shortDescriptionVi', enField: 'shortDescriptionEn', context: 'product-short-desc' },
            { viField: 'descriptionVi',      enField: 'descriptionEn',      context: 'product-desc' },
            { viField: 'seoTitleVi',         enField: 'seoTitleEn',         context: 'product-seo-title' },
            { viField: 'seoDescriptionVi',   enField: 'seoDescriptionEn',   context: 'product-seo-desc' },
          ],
          5
        ),
      specs: () => translateSpecifications(),
    };

    const selected = TABLE_ARG ? [TABLE_ARG] : Object.keys(tables);
    for (const t of selected) {
      if (!tables[t]) {
        console.error(`❌ Không tìm thấy table: ${t}`);
        continue;
      }
      await tables[t]();
    }

    console.log('\n🎉 Hoàn tất!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  }
}

main();
