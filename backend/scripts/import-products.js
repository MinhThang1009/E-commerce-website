/**
 * Import sản phẩm từ backend/data/products.json → DB
 * Usage: npm run db:import
 *
 * - Dùng brandSlug / categorySlug thay vì ID (dễ đọc hơn)
 * - Bỏ qua sản phẩm đã tồn tại (theo tên), không gây lỗi duplicate
 * - Dùng transaction: nếu variant/image lỗi thì rollback toàn bộ product
 * - Báo lỗi rõ ràng từng sản phẩm, không ảnh hưởng các sản phẩm khác
 */
require('dotenv').config();
const path = require('path');
const sequelize = require('../src/config/sequelize');
const { Brand, Category, Product, ProductVariant, ProductImage } = require('../src/models');

const DATA_FILE = path.join(__dirname, '../data/products.json');

async function buildLookups() {
  const brands = await Brand.findAll({ attributes: ['id', 'slug'] });
  const categories = await Category.findAll({ attributes: ['id', 'slug'] });
  return {
    brandMap: Object.fromEntries(brands.map(b => [b.slug, b.id])),
    catMap: Object.fromEntries(categories.map(c => [c.slug, c.id])),
  };
}

async function importProduct(entry, brandMap, catMap) {
  // --- Validate bắt buộc ---
  for (const field of ['name', 'categorySlug', 'brandSlug', 'basePrice']) {
    if (!entry[field]) throw new Error(`Thiếu trường bắt buộc: "${field}"`);
  }

  const brandId = brandMap[entry.brandSlug];
  if (!brandId) throw new Error(`Không tìm thấy brand slug: "${entry.brandSlug}"`);

  const categoryId = catMap[entry.categorySlug];
  if (!categoryId) throw new Error(`Không tìm thấy category slug: "${entry.categorySlug}"`);

  // --- Kiểm tra duplicate ---
  const existing = await Product.findOne({ where: { name: entry.name } });
  if (existing) {
    console.log(`  ⏭  Bỏ qua (đã tồn tại): ${entry.name}`);
    return null;
  }

  // --- Transaction: rollback nếu variant/image lỗi ---
  const t = await sequelize.transaction();
  try {
    const product = await Product.create({
      name: entry.name,
      model: entry.model || entry.name,
      categoryId,
      brandId,
      status: entry.status || 'active',
      condition: entry.condition || 'new',
      isFeatured: entry.isFeatured || false,
      visibility: 'public',
      basePrice: entry.basePrice,
      compareAtPrice: entry.compareAtPrice || null,
      shortDescription: entry.shortDescription || '',
      description: entry.description || '',
      tags: entry.tags || [],
      specifications: entry.specifications || {},
      attributes: entry.attributes || [],
      shippingInfo: entry.shippingInfo || {},
      soldCount: 0,
      viewCount: 0,
      ratingAverage: 0,
    }, { transaction: t });

    for (const v of (entry.variants || [])) {
      if (!v.sku) throw new Error(`Variant thiếu SKU`);
      await ProductVariant.create({
        productId: product.id,
        sku: v.sku,
        variantName: v.variantName || v.sku,
        displayName: v.displayName || v.variantName || v.sku,
        price: v.price ?? entry.basePrice,
        compareAtPrice: v.compareAtPrice ?? entry.compareAtPrice ?? null,
        stockQuantity: v.stockQuantity ?? 0,
        isDefault: v.isDefault || false,
        attributes: v.attributes || {},
      }, { transaction: t });
    }

    for (const img of (entry.images || [])) {
      if (!img.imageUrl) continue;
      await ProductImage.create({
        productId: product.id,
        imageUrl: img.imageUrl,
        isThumbnail: img.isThumbnail || false,
        color: img.color || null,
        altText: img.altText || entry.name,
      }, { transaction: t });
    }

    await t.commit();
    return product;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function run() {
  let entries;
  try {
    entries = require(DATA_FILE).filter(e => !!e.name);
  } catch (err) {
    console.error(`❌ Không đọc được ${DATA_FILE}:`, err.message);
    process.exit(1);
  }

  if (entries.length === 0) {
    console.log('⚠️  Không có sản phẩm nào để import.');
    process.exit(0);
  }

  try {
    await sequelize.authenticate();
    console.log(`✅ Kết nối DB thành công`);
    console.log(`📋 Tìm thấy ${entries.length} sản phẩm trong products.json\n`);

    const { brandMap, catMap } = await buildLookups();
    let success = 0, skipped = 0, failed = 0;

    for (const entry of entries) {
      const name = entry.name || '(không tên)';
      try {
        const result = await importProduct(entry, brandMap, catMap);
        if (result) {
          console.log(`  ✅ Đã thêm: ${name} (id=${result.id})`);
          success++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`  ❌ Lỗi "${name}": ${err.message}`);
        failed++;
      }
    }

    console.log(`\n📊 Kết quả:`);
    console.log(`   ✅ Thêm mới: ${success}`);
    console.log(`   ⏭  Bỏ qua:  ${skipped}`);
    console.log(`   ❌ Lỗi:     ${failed}`);

    if (success > 0) {
      console.log(`\n💡 Chạy tiếp để chatbot nhận ra sản phẩm mới:`);
      console.log(`   npm run db:index`);
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('❌ Lỗi kết nối DB:', err.message);
    process.exit(1);
  }
}

run();
