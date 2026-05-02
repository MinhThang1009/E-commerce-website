/**
 * Export toàn bộ sản phẩm từ DB → backend/data/products.json
 * Usage: npm run db:export:json
 *
 * Dùng để khởi tạo products.json từ DB hiện có,
 * sau đó có thể dùng npm run db:sync để quản lý qua file.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Product, ProductVariant, ProductImage, Brand, Category } = require('../src/models');

const OUTPUT = path.join(__dirname, '../data/products.json');

async function run() {
  try {
    const [brands, categories, products] = await Promise.all([
      Brand.findAll({ attributes: ['id', 'slug'] }),
      Category.findAll({ attributes: ['id', 'slug'] }),
      Product.findAll({
        include: [
          { model: ProductVariant, as: 'variants' },
          { model: ProductImage, as: 'productImages' },
        ],
        paranoid: false,
        order: [['id', 'ASC']],
      }),
    ]);

    const brandSlugById = Object.fromEntries(brands.map(b => [b.id, b.slug]));
    const catSlugById = Object.fromEntries(categories.map(c => [c.id, c.slug]));

    const entries = products.map(p => {
      const variants = (p.variants || [])
        .filter(v => !v.deletedAt)
        .sort((a, b) => a.id - b.id)
        .map(v => ({
          sku: v.sku,
          variantName: v.variantName,
          displayName: v.displayName || undefined,
          price: parseFloat(v.price),
          compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice) : undefined,
          stockQuantity: v.stockQuantity,
          isDefault: v.isDefault,
          attributes: v.attributes || {},
        }));

      const images = (p.productImages || [])
        .filter(img => !img.deletedAt)
        .sort((a, b) => a.id - b.id)
        .map(img => ({
          imageUrl: img.imageUrl,
          isThumbnail: img.isThumbnail,
          color: img.color || undefined,
        }));

      const entry = {
        name: p.name,
        categorySlug: catSlugById[p.categoryId] || null,
        brandSlug: brandSlugById[p.brandId] || null,
        model: p.model || undefined,
        status: p.status || 'active',
        condition: p.condition || undefined,
        isFeatured: p.isFeatured || false,
        basePrice: parseFloat(p.basePrice),
        compareAtPrice: p.compareAtPrice ? parseFloat(p.compareAtPrice) : undefined,
        warrantyMonths: p.warrantyMonths || 12,
        shortDescription: p.shortDescription || '',
        description: p.description || '',
        tags: p.tags || [],
        specifications: p.specifications || {},
        attributes: p.attributes || [],
        shippingInfo: p.shippingInfo || {},
      };

      if (variants.length) entry.variants = variants;
      if (images.length) entry.images = images;

      return entry;
    });

    fs.writeFileSync(OUTPUT, JSON.stringify(entries, null, 2), 'utf8');

    console.log(`✅ Đã export ${entries.length} sản phẩm → ${OUTPUT}`);
    console.log(`\n💡 Giờ có thể:`);
    console.log(`   - Sửa/xóa sản phẩm trong products.json`);
    console.log(`   - Xem trước: npm run db:sync:dry`);
    console.log(`   - Áp dụng:   npm run db:sync`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  }
}

run();
