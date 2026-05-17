/**
 * Script one-time: dịch product_variants.attributes → attributes_en
 * Chạy: node scripts/translateVariantAttributes.js
 */
require('dotenv').config();

const sequelize = require('../src/config/sequelize');
require('../src/models');
const ProductVariant = require('../src/models/productVariant');
const { translateBatch } = require('../src/services/ai/translateService');

async function run() {
  await sequelize.authenticate();

  const variants = await ProductVariant.findAll({
    attributes: ['id', 'attributes', 'attributesEn'],
    where: sequelize.literal('attributes IS NOT NULL AND attributes_en IS NULL'),
  });

  console.log(`Tìm thấy ${variants.length} variants cần dịch.`);
  if (!variants.length) { console.log('Done.'); process.exit(0); }

  let done = 0;
  for (const variant of variants) {
    const attrs = variant.attributes;
    if (!attrs || typeof attrs !== 'object' || Object.keys(attrs).length === 0) {
      done++; continue;
    }

    const keys = Object.keys(attrs);
    const values = keys.map(k => String(attrs[k]));

    const translated = await translateBatch(values);

    const attrsEn = {};
    keys.forEach((k, i) => { attrsEn[k] = translated[i] || values[i]; });

    await variant.update({ attributesEn: attrsEn });
    done++;
    if (done % 20 === 0) console.log(`  ${done}/${variants.length}...`);
  }

  console.log(`Done. Đã dịch ${done} variants.`);
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
