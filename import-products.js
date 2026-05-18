/**
 * Script import sản phẩm 46-60 từ file products_46_60_template.json
 *
 * Cách dùng:
 *   1. Sửa products_46_60_template.json (ảnh, giá, stock...)
 *   2. Chạy: cd backend && node ../import_products.js
 *
 * - Ảnh placeholder (THAY_URL_ANH_...) sẽ được bỏ qua
 * - id = null → INSERT mới, id có giá trị → UPDATE
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function main() {
  const templatePath = path.join(__dirname, 'products_46_60_template.json');

  if (!fs.existsSync(templatePath)) {
    console.error('Không tìm thấy file products_46_60_template.json');
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  console.log(`Đọc được ${products.length} sản phẩm từ template\n`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'techstore',
    port: process.env.DB_PORT || 3306,
  });

  let stats = { productUpdated: 0, imageUpdated: 0, imageInserted: 0, imageSkipped: 0, variantUpdated: 0, variantInserted: 0 };

  for (const p of products) {
    // Update product — tất cả fields có trong template
    await conn.execute(
      `UPDATE products SET
        name = ?, slug = ?, model = ?, base_price = ?, compare_at_price = ?,
        short_description = ?, description = ?, specifications = ?, attributes = ?,
        tags = ?, stock_quantity = ?, shipping_info = ?, updated_at = NOW()
      WHERE id = ?`,
      [
        p.name, p.slug, p.model, p.base_price, p.compare_at_price,
        p.short_description, p.description,
        JSON.stringify(p.specifications), JSON.stringify(p.attributes),
        JSON.stringify(p.tags), p.stock_quantity,
        JSON.stringify(p.shipping_info), p.id,
      ],
    );
    stats.productUpdated++;

    // Images — skip placeholder
    for (const img of p.images) {
      if (img.image_url.startsWith('THAY_URL_ANH_')) {
        stats.imageSkipped++;
        continue;
      }
      if (img.id !== null) {
        await conn.execute(
          `UPDATE product_images SET image_url = ?, is_thumbnail = ?, color = ?, updated_at = NOW() WHERE id = ?`,
          [img.image_url, img.is_thumbnail, img.color, img.id],
        );
        stats.imageUpdated++;
      } else {
        await conn.execute(
          `INSERT INTO product_images (product_id, image_url, is_thumbnail, color, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [p.id, img.image_url, img.is_thumbnail, img.color],
        );
        stats.imageInserted++;
      }
    }

    // Variants
    for (const v of p.variants) {
      if (v.id !== null) {
        await conn.execute(
          `UPDATE product_variants SET
            sku = ?, variant_name = ?, display_name = ?, price = ?, compare_at_price = ?,
            stock_quantity = ?, is_default = ?, attributes = ?, sort_order = ?, is_available = ?,
            updated_at = NOW()
          WHERE id = ?`,
          [
            v.sku, v.variant_name, v.display_name, v.price, v.compare_at_price,
            v.stock_quantity, v.is_default, JSON.stringify(v.attributes),
            v.sort_order || 0, v.is_available, v.id,
          ],
        );
        stats.variantUpdated++;
      } else {
        await conn.execute(
          `INSERT INTO product_variants (product_id, sku, variant_name, display_name, price, compare_at_price, stock_quantity, is_default, attributes, sort_order, is_available, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            p.id, v.sku, v.variant_name, v.display_name, v.price, v.compare_at_price,
            v.stock_quantity, v.is_default || 0, JSON.stringify(v.attributes),
            v.sort_order || 0, v.is_available,
          ],
        );
        stats.variantInserted++;
      }
    }

    const realImgs = p.images.filter(i => !i.image_url.startsWith('THAY_URL_ANH_')).length;
    console.log(`  P#${p.id}: ${p.name.substring(0, 50)}... (${realImgs} ảnh, ${p.variants.length} variant)`);
  }

  console.log(`\n=== Hoàn tất ===`);
  console.log(`Sản phẩm:      ${stats.productUpdated}`);
  console.log(`Ảnh update:    ${stats.imageUpdated}`);
  console.log(`Ảnh insert:    ${stats.imageInserted}`);
  console.log(`Ảnh skip:      ${stats.imageSkipped} (placeholder)`);
  console.log(`Variant update: ${stats.variantUpdated}`);
  console.log(`Variant insert: ${stats.variantInserted}`);

  await conn.end();
}

main().catch((e) => {
  console.error('Lỗi:', e.message);
  process.exit(1);
});
