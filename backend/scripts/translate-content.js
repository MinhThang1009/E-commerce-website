/**
 * Script dịch nội dung tiếng Việt sang tiếng Anh.
 * Provider fallback: DeepL → Google Translate unofficial → MyMemory
 *
 * Chạy: node scripts/translate-content.js [--dry-run] [--table=products]
 *   --dry-run  : in ra nội dung dịch, không write DB
 *   --table    : chỉ dịch bảng cụ thể (products | categories | brands | collections | specs)
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
require('module-alias/register');
const axios = require('axios');
const sequelize = require('../src/config/sequelize');

const { Product, Category, Brand, Collection } = require('../src/models');

const DRY_RUN  = process.argv.includes('--dry-run');
const TABLE_ARG = (process.argv.find((a) => a.startsWith('--table=')) || '').replace('--table=', '') || null;
const DELAY_MS = 300;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Translation providers (ưu tiên: DeepL → Google → MyMemory) ---

async function translateDeepL(text) {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error('DEEPL_API_KEY chưa cấu hình');
  const baseUrl = key.endsWith(':fx')
    ? 'https://api-free.deepl.com'
    : 'https://api.deepl.com';
  const resp = await axios.post(
    `${baseUrl}/v2/translate`,
    { text: [text], target_lang: 'EN', source_lang: 'VI' },
    { headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  const result = resp.data?.translations?.[0]?.text;
  if (!result) throw new Error('DeepL: response rỗng');
  return result;
}

async function translateGoogle(text) {
  const encoded = encodeURIComponent(text);
  const resp = await axios.get(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=en&dt=t&q=${encoded}`,
    { timeout: 15000 }
  );
  const result = resp.data?.[0]?.map((x) => x?.[0]).filter(Boolean).join('');
  if (!result) throw new Error('Google: response rỗng');
  return result;
}

async function translateMyMemory(text) {
  const encoded = encodeURIComponent(text);
  const resp = await axios.get(
    `https://api.mymemory.translated.net/get?q=${encoded}&langpair=vi|en`,
    { timeout: 15000 }
  );
  const result = resp.data?.responseData?.translatedText;
  if (!result || result === text) throw new Error('MyMemory: dịch thất bại');
  return result;
}

const PROVIDERS = [
  { name: 'Google',   fn: translateGoogle },
  { name: 'MyMemory', fn: translateMyMemory },
];

// Dịch 1 đoạn text với fallback chain
async function translate(text) {
  if (!text || !text.trim()) return text;
  for (let i = 0; i < PROVIDERS.length; i++) {
    const { name, fn } = PROVIDERS[i];
    try {
      const result = await fn(text);
      if (i > 0) process.stdout.write(` [fallback:${name}]`);
      return result;
    } catch (err) {
      if (i < PROVIDERS.length - 1) {
        // Tiếp tục sang provider tiếp theo
      } else {
        console.error(`\n  ❌ Tất cả providers thất bại: ${err.message}`);
        return text; // giữ nguyên VI nếu mọi provider đều fail
      }
    }
  }
}

// Dịch batch items — gọi translate() cho từng item tuần tự
async function translateBatch(items) {
  const results = [];
  for (const item of items) {
    const en = await translate(item.vi);
    results.push({ id: item.id, en });
    await sleep(DELAY_MS);
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
 * Dịch specifications JSON — dịch từng value, giữ nguyên keys.
 */
async function translateSpecifications() {
  const [rows] = await sequelize.query(
    `SELECT id, name_vi, specifications FROM products
     WHERE specifications IS NOT NULL AND specifications_en IS NULL LIMIT 1000`
  );

  console.log(`\n🔧 specifications: ${rows.length} sản phẩm cần dịch`);
  if (rows.length === 0) return;

  let done = 0;
  for (const row of rows) {
    let specs;
    try { specs = JSON.parse(row.specifications); } catch { continue; }

    process.stdout.write(`  specs#${row.id} "${String(row.name_vi).substring(0, 30)}"... `);

    const specsEn = {};
    for (const [key, val] of Object.entries(specs)) {
      specsEn[key] = typeof val === 'string' ? await translate(val) : val;
      await sleep(DELAY_MS);
    }

    if (DRY_RUN) {
      console.log(`\n  [DRY] ${JSON.stringify(specsEn).substring(0, 120)}`);
    } else {
      await sequelize.query(
        'UPDATE products SET specifications_en = ? WHERE id = ?',
        { replacements: [JSON.stringify(specsEn), row.id] }
      );
      done++;
    }
    process.stdout.write('✅\n');
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
