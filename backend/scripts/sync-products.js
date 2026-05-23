/**
 * Sync sản phẩm từ backend/data/products.json → DB
 * Usage:
 *   node scripts/syncProducts.js            # áp dụng thay đổi
 *   node scripts/syncProducts.js --dry-run  # chỉ xem trước, không ghi DB
 *
 * Quy tắc:
 *   - Thêm mới  : sản phẩm trong JSON chưa có trong DB (so sánh theo name)
 *   - Cập nhật  : sản phẩm đã có → update toàn bộ trường TRỪ stockQuantity
 *   - Variant   : upsert theo SKU; SKU mới → tạo; SKU mất → soft-delete
 *   - Ảnh       : xóa hết ảnh cũ, tạo lại từ JSON
 *   - "Xóa"     : sản phẩm trong DB không có trong JSON → status = 'inactive'
 *                 (KHÔNG hard-delete để bảo toàn orders, reviews)
 */
require('dotenv').config();
const path = require('path');
const sequelize = require('../src/config/sequelize');
const { Brand, Category, Product, ProductVariant, ProductImage } = require('../src/models');

const DATA_FILE = path.join(__dirname, '../data/products.json');
const toDecimal = v => v == null ? null : parseFloat(v).toFixed(2);
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Helpers ────────────────────────────────────────────────────────────────

async function buildLookups() {
  const brands = await Brand.findAll({ attributes: ['id', 'slug'] });
  const categories = await Category.findAll({ attributes: ['id', 'slug'] });
  return {
    brandMap: Object.fromEntries(brands.map(b => [b.slug, b.id])),
    catMap: Object.fromEntries(categories.map(c => [c.slug, c.id])),
  };
}

function validateEntry(entry) {
  for (const f of ['name', 'categorySlug', 'brandSlug', 'basePrice']) {
    if (!entry[f]) throw new Error(`Thiếu trường bắt buộc: "${f}"`);
  }
}

// ─── Create (sản phẩm mới) ──────────────────────────────────────────────────

async function createProduct(entry, brandId, categoryId, t) {
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
    if (!v.sku) throw new Error('Variant thiếu SKU');
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
    }, { transaction: t });
  }

  return product;
}

// ─── Update (sản phẩm đã tồn tại) ───────────────────────────────────────────

async function updateProduct(entry, existing, brandId, categoryId, t) {
  let changed = false;

  existing.set({
    model: entry.model || entry.name,
    categoryId,
    brandId,
    status: entry.status || 'active',
    condition: entry.condition || 'new',
    isFeatured: entry.isFeatured || false,
    basePrice: toDecimal(entry.basePrice),
    compareAtPrice: toDecimal(entry.compareAtPrice),
    shortDescription: entry.shortDescription || '',
    description: entry.description || '',
    tags: entry.tags || [],
    specifications: entry.specifications || {},
    attributes: entry.attributes || [],
    shippingInfo: entry.shippingInfo || {},
  });
  if (existing.changed() && existing.changed().length > 0) {
    await existing.save({ transaction: t });
    changed = true;
  }

  // Variants: upsert theo SKU, giữ nguyên stockQuantity
  const dbVariants = await ProductVariant.findAll({
    where: { productId: existing.id },
    paranoid: false,
  });
  const dbVariantMap = Object.fromEntries(dbVariants.map(v => [v.sku, v]));
  const jsonSkus = new Set((entry.variants || []).map(v => v.sku).filter(Boolean));

  for (const v of (entry.variants || [])) {
    if (!v.sku) continue;
    const dbVariant = dbVariantMap[v.sku];
    if (dbVariant) {
      if (dbVariant.deletedAt) { await dbVariant.restore({ transaction: t }); changed = true; }
      dbVariant.set({
        variantName: v.variantName || v.sku,
        displayName: v.displayName || v.variantName || v.sku,
        price: toDecimal(v.price ?? entry.basePrice),
        compareAtPrice: toDecimal(v.compareAtPrice ?? entry.compareAtPrice),
        isDefault: v.isDefault || false,
        attributes: v.attributes || {},
      });
      if (dbVariant.changed() && dbVariant.changed().length > 0) {
        await dbVariant.save({ transaction: t });
        changed = true;
      }
    } else {
      await ProductVariant.create({
        productId: existing.id,
        sku: v.sku,
        variantName: v.variantName || v.sku,
        displayName: v.displayName || v.variantName || v.sku,
        price: v.price ?? entry.basePrice,
        compareAtPrice: v.compareAtPrice ?? entry.compareAtPrice ?? null,
        stockQuantity: v.stockQuantity ?? 0,
        isDefault: v.isDefault || false,
        attributes: v.attributes || {},
      }, { transaction: t });
      changed = true;
    }
  }

  // SKU trong DB nhưng không còn trong JSON → soft-delete
  for (const dbVariant of dbVariants) {
    if (!jsonSkus.has(dbVariant.sku) && !dbVariant.deletedAt) {
      await dbVariant.destroy({ transaction: t });
      changed = true;
    }
  }

  // Ảnh: so sánh URL trước khi xóa/tạo lại
  const dbImages = await ProductImage.findAll({ where: { productId: existing.id }, paranoid: false });
  const dbImageUrls = dbImages.filter(i => !i.deletedAt).map(i => i.imageUrl).sort().join('|');
  const jsonImageUrls = (entry.images || []).filter(i => i.imageUrl).map(i => i.imageUrl).sort().join('|');
  if (dbImageUrls !== jsonImageUrls) {
    await ProductImage.destroy({ where: { productId: existing.id }, force: true, transaction: t });
    for (const img of (entry.images || [])) {
      if (!img.imageUrl) continue;
      await ProductImage.create({
        productId: existing.id,
        imageUrl: img.imageUrl,
        isThumbnail: img.isThumbnail || false,
        color: img.color || null,
      }, { transaction: t });
    }
    changed = true;
  }

  return changed;
}

// ─── Dry-run diff ─────────────────────────────────────────────────────────

async function printDiff(entry, existing, brandId, categoryId) {
  if (!existing) {
    console.log(`  [+] TẠO MỚI  : ${entry.name}`);
    console.log(`       variants : ${(entry.variants || []).length} | ảnh: ${(entry.images || []).length}`);
    return;
  }

  const changes = [];
  if (parseFloat(existing.basePrice) !== parseFloat(entry.basePrice)) changes.push(`basePrice ${existing.basePrice} → ${entry.basePrice}`);
  if (existing.status !== (entry.status || 'active')) changes.push(`status "${existing.status}" → "${entry.status || 'active'}"`);
  if ((existing.shortDescription || '') !== (entry.shortDescription || '')) changes.push('shortDescription thay đổi');
  if ((existing.description || '') !== (entry.description || '')) changes.push('description thay đổi');
  if (Boolean(existing.isFeatured) !== Boolean(entry.isFeatured || false)) changes.push(`isFeatured ${existing.isFeatured} → ${entry.isFeatured}`);

  const dbVariants = await ProductVariant.findAll({ where: { productId: existing.id }, paranoid: false });
  const dbSkus = new Set(dbVariants.filter(v => !v.deletedAt).map(v => v.sku));
  const jsonSkus = new Set((entry.variants || []).map(v => v.sku).filter(Boolean));
  const newSkus = [...jsonSkus].filter(s => !dbSkus.has(s));
  const removedSkus = [...dbSkus].filter(s => !jsonSkus.has(s));

  if (newSkus.length) changes.push(`thêm variant: ${newSkus.join(', ')}`);
  if (removedSkus.length) changes.push(`xóa variant: ${removedSkus.join(', ')}`);

  if (changes.length === 0) {
    console.log(`  [=] KHÔNG ĐỔI: ${entry.name}`);
  } else {
    console.log(`  [~] CẬP NHẬT : ${entry.name}`);
    changes.forEach(c => console.log(`       · ${c}`));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function run() {
  let entries;
  try {
    entries = require(DATA_FILE).filter(e => !!e.name);
  } catch (err) {
    console.error(`❌ Không đọc được ${DATA_FILE}:`, err.message);
    process.exit(1);
  }

  if (entries.length === 0) {
    console.log('⚠️  products.json không có sản phẩm nào (hoặc thiếu trường name).');
    process.exit(0);
  }

  try {
    await sequelize.authenticate();
  } catch (err) {
    console.error('❌ Không kết nối được DB:', err.message);
    process.exit(1);
  }

  if (DRY_RUN) console.log('🔍 DRY-RUN — không ghi DB\n');

  const { brandMap, catMap } = await buildLookups();

  // Load tất cả products đang active hoặc inactive từ DB
  const allDbProducts = await Product.findAll({ paranoid: false });
  const dbNameMap = Object.fromEntries(allDbProducts.map(p => [p.name, p]));
  const jsonNames = new Set(entries.map(e => e.name));

  let created = 0, updated = 0, deactivated = 0, failed = 0, unchanged = 0;

  // ── Thêm / cập nhật ────────────────────────────────────────────────────
  for (const entry of entries) {
    const name = entry.name;
    try {
      validateEntry(entry);
      const brandId = brandMap[entry.brandSlug];
      if (!brandId) throw new Error(`Không tìm thấy brand slug: "${entry.brandSlug}"`);
      const categoryId = catMap[entry.categorySlug];
      if (!categoryId) throw new Error(`Không tìm thấy category slug: "${entry.categorySlug}"`);

      const existing = dbNameMap[name] || null;

      if (DRY_RUN) {
        await printDiff(entry, existing, brandId, categoryId);
        if (!existing) created++;
        else unchanged++;
        continue;
      }

      const t = await sequelize.transaction();
      try {
        if (!existing) {
          const p = await createProduct(entry, brandId, categoryId, t);
          await t.commit();
          console.log(`  ✅ TẠO MỚI  : ${name} (id=${p.id})`);
          created++;
        } else {
          const didChange = await updateProduct(entry, existing, brandId, categoryId, t);
          await t.commit();
          if (didChange) {
            console.log(`  🔄 CẬP NHẬT : ${name} (id=${existing.id})`);
            updated++;
          } else {
            unchanged++;
          }
        }
      } catch (err) {
        await t.rollback();
        throw err;
      }
    } catch (err) {
      console.error(`  ❌ LỖI "${name}": ${err.message}`);
      failed++;
    }
  }

  // ── Deactivate sản phẩm không còn trong JSON ───────────────────────────
  for (const dbProduct of allDbProducts) {
    if (!jsonNames.has(dbProduct.name) && dbProduct.status === 'active') {
      if (DRY_RUN) {
        console.log(`  [-] DEACTIVATE: ${dbProduct.name} (id=${dbProduct.id})`);
        deactivated++;
        continue;
      }
      try {
        await dbProduct.update({ status: 'inactive' });
        console.log(`  ⚫ DEACTIVATE : ${dbProduct.name} (id=${dbProduct.id})`);
        deactivated++;
      } catch (err) {
        console.error(`  ❌ Lỗi deactivate "${dbProduct.name}": ${err.message}`);
        failed++;
      }
    }
  }

  // ── Kết quả ────────────────────────────────────────────────────────────
  console.log(`\n📊 Kết quả${DRY_RUN ? ' (dry-run)' : ''}:`);
  if (DRY_RUN) {
    console.log(`   [+] Sẽ tạo mới  : ${created}`);
    console.log(`   [-] Sẽ deactivate: ${deactivated}`);
  } else {
    console.log(`   ✅ Tạo mới    : ${created}`);
    console.log(`   🔄 Cập nhật   : ${updated}`);
    console.log(`   [=] Không đổi : ${unchanged}`);
    console.log(`   ⚫ Deactivate : ${deactivated}`);
    console.log(`   ❌ Lỗi        : ${failed}`);
  }

  if (!DRY_RUN && (created > 0 || updated > 0)) {
    console.log(`\n💡 Chạy tiếp để chatbot nhận ra thay đổi:`);
    console.log(`   npm run db:index`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

run();
