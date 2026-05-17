/**
 * Script one-time: migrate specs từ products.specifications JSON → product_specifications table
 * rồi translate value → value_en bằng AI.
 *
 * Chạy: node scripts/translateSpecValues.js
 */
require('dotenv').config();

const sequelize = require('../src/config/sequelize');
require('../src/models'); // load tất cả associations
const Product = require('../src/models/product');
const ProductSpecification = require('../src/models/productSpecification');
const { translateBatch } = require('../src/services/ai/translateService');

const BATCH_SIZE = 20;

async function run() {
  await sequelize.authenticate();

  // Lấy tất cả products có specifications JSON
  const products = await Product.findAll({
    attributes: ['id', 'specifications'],
    where: sequelize.literal('specifications IS NOT NULL AND specifications != "{}" AND specifications != "null"'),
  });

  console.log(`Tìm thấy ${products.length} sản phẩm cần migrate specs.`);

  let totalSpecs = 0;

  for (const product of products) {
    let specs;
    try {
      specs = typeof product.specifications === 'string'
        ? JSON.parse(product.specifications)
        : product.specifications;
    } catch {
      continue;
    }

    if (!specs || typeof specs !== 'object') continue;

    const entries = Object.entries(specs).filter(([, v]) => v !== null && v !== undefined);
    if (entries.length === 0) continue;

    // Skip nếu đã có rows trong product_specifications
    const existing = await ProductSpecification.count({ where: { productId: product.id } });
    if (existing > 0) {
      console.log(`  Product ${product.id}: đã có ${existing} specs — bỏ qua.`);
      continue;
    }

    // Translate values từng batch
    const keys = entries.map(([k]) => k);
    const values = entries.map(([, v]) => String(v));
    const translated = await translateBatch(values);

    // Insert vào product_specifications table
    const rows = keys.map((name, i) => ({
      productId: product.id,
      name,
      value: values[i],
      valueEn: translated[i] || null,
      category: 'General',
      sortOrder: i,
    }));

    await ProductSpecification.bulkCreate(rows);
    totalSpecs += rows.length;
    console.log(`  Product ${product.id}: đã migrate ${rows.length} specs.`);
  }

  console.log(`\nDone. Tổng ${totalSpecs} specs đã được migrate và dịch.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Lỗi:', err.message);
  process.exit(1);
});
