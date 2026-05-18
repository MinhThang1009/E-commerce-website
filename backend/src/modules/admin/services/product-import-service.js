/**
 * @file productImportService.js
 * @layer Service
 * @module admin
 * @description Business logic import/export sản phẩm từ CSV/JSON
 */
const path = require('path');
const slugify = require('slugify');
const { Op } = require('sequelize');
const {
  sequelize, Product, ProductVariant, ProductImage,
  ProductCategory, ProductSpecification, Category, Brand, ImportLog,
} = require('@models');
const logger = require('@utils/logger');
const { AppError } = require('@shared/errors');
const vectorStoreService = require('@modules/ai/services/vectorstore/vector-store');
const { parseCsv, validateRow, escapeCsvField, CSV_HEADERS } = require('@modules/admin/utils/csv-parser');

const _buildLookupMaps = async () => {
  const [categories, brands] = await Promise.all([
    Category.findAll({ attributes: ['id', 'slug', 'name'] }),
    Brand.findAll({ attributes: ['id', 'name', 'slug'] }),
  ]);
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.id]));
  const brandMap = {};
  brands.forEach((b) => {
    brandMap[b.name.toLowerCase()] = b.id;
    brandMap[b.slug] = b.id;
  });
  return { categoryMap, brandMap };
};

const _insertProductRow = async (row, categoryMap, brandMap) => {
  return sequelize.transaction(async (t) => {
    const categoryId = categoryMap[String(row.category_slug).trim()] || null;
    const brandName = row.brand ? String(row.brand).trim().toLowerCase() : null;
    const brandId = brandName ? (brandMap[brandName] ?? null) : null;

    const rawSlug = row.slug
      ? String(row.slug).trim()
      : slugify(String(row.name).trim(), { lower: true, strict: true });

    let finalSlug = rawSlug;
    const existing = await Product.findOne({ where: { slug: rawSlug }, transaction: t, attributes: ['id'] });
    if (existing) finalSlug = `${rawSlug}-${Date.now()}`;

    const product = await Product.create({
      name: String(row.name).trim(),
      slug: finalSlug,
      shortDescription: row.short_description ? String(row.short_description).trim() : null,
      basePrice: parseFloat(row.base_price),
      categoryId,
      brandId,
      status: row.status || 'active',
      stockQuantity: parseInt(row.stock_quantity) || 0,
    }, { transaction: t });

    if (row.sku && String(row.sku).trim()) {
      await ProductVariant.create({
        productId: product.id,
        sku: String(row.sku).trim(),
        price: parseFloat(row.base_price),
        stockQuantity: parseInt(row.stock_quantity) || 0,
        isDefault: true,
      }, { transaction: t });
    }

    if (row.image_urls && String(row.image_urls).trim()) {
      const urls = String(row.image_urls).split('|').map((u) => u.trim()).filter(Boolean);
      for (let i = 0; i < urls.length; i++) {
        await ProductImage.create({ productId: product.id, imageUrl: urls[i], isThumbnail: i === 0, sortOrder: i + 1 }, { transaction: t });
      }
    }

    if (categoryId) {
      await ProductCategory.create({ productId: product.id, categoryId }, { transaction: t });
    }

    const specFields = [
      { key: 'CPU', value: row.spec_cpu, order: 1 },
      { key: 'RAM', value: row.spec_ram, order: 2 },
      { key: 'Bộ nhớ', value: row.spec_storage, order: 3 },
      { key: 'Màn hình', value: row.spec_display, order: 4 },
      { key: 'Pin', value: row.spec_battery, order: 5 },
    ];
    for (const spec of specFields) {
      if (spec.value && String(spec.value).trim()) {
        await ProductSpecification.create({ productId: product.id, specKey: spec.key, specValue: String(spec.value).trim(), sortOrder: spec.order }, { transaction: t });
      }
    }

    return product.id;
  });
};

const importProducts = async ({ file, adminId }) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const content = file.buffer.toString('utf8');

  let rows = [];
  if (ext === '.json') {
    let parsed;
    try { parsed = JSON.parse(content); } catch { throw new AppError('File JSON không hợp lệ — không thể parse', 400); }
    if (!Array.isArray(parsed)) throw new AppError('File JSON phải là mảng các object sản phẩm', 400);
    rows = parsed.map((item, idx) => ({ ...item, _lineNumber: idx + 2 }));
  } else {
    const { rows: csvRows } = parseCsv(content);
    if (csvRows.length === 0) throw new AppError('File CSV rỗng hoặc không có dữ liệu', 400);
    rows = csvRows;
  }

  const validationErrors = rows.flatMap((row) => validateRow(row, row._lineNumber));
  if (validationErrors.length === rows.length) {
    return { allFailed: true, errors: validationErrors, totalRows: rows.length };
  }

  const { categoryMap, brandMap } = await _buildLookupMaps();

  let successCount = 0;
  let failedCount = 0;
  const rowErrors = [...validationErrors];
  const newProductIds = [];

  const validRows = rows.filter((row) => {
    const hasError = rowErrors.some((e) => e.row === row._lineNumber);
    if (hasError) failedCount++;
    return !hasError;
  });

  for (const row of validRows) {
    try {
      const productId = await _insertProductRow(row, categoryMap, brandMap);
      newProductIds.push(productId);
      successCount++;
    } catch (err) {
      failedCount++;
      rowErrors.push({ row: row._lineNumber, field: 'general', message: err.message || 'Lỗi khi insert vào DB' });
      logger.warn(`[IMPORT] Lỗi dòng ${row._lineNumber}:`, err.message);
    }
  }

  await ImportLog.create({
    adminId,
    filename: file.originalname,
    totalRows: rows.length,
    successRows: successCount,
    failedRows: failedCount,
    errorDetail: rowErrors.length > 0 ? rowErrors : null,
    importedAt: new Date(),
  });

  // Vector sync bất đồng bộ
  if (newProductIds.length > 0) {
    setImmediate(async () => {
      try {
        const { enrichProductData } = require('@modules/ai/services/vectorstore/vector-store');
        const newProducts = await Product.findAll({
          where: { id: { [Op.in]: newProductIds } },
          include: [
            { model: Category, as: 'categories', attributes: ['name'] },
            { model: ProductImage, as: 'productImages', attributes: ['imageUrl', 'isThumbnail'], required: false },
            { model: ProductVariant, as: 'variants', attributes: ['stockQuantity'], required: false },
          ],
        });
        for (const p of newProducts) {
          await vectorStoreService.upsertProduct(enrichProductData(p.toJSON()));
        }
        await vectorStoreService.save();
        logger.info(`[VECTOR] Đã sync ${newProductIds.length} sản phẩm mới vào vector store`);
      } catch (err) {
        logger.error('[VECTOR] Sync thất bại sau import:', err.message);
      }
    });
  }

  return { totalRows: rows.length, successCount, failedCount, errors: rowErrors };
};

const getImportHistory = async ({ page = 1, limit = 20 }) => {
  const safePage = parseInt(page, 10);
  const safeLimit = Math.min(parseInt(limit, 10), 100);
  const { rows, count } = await ImportLog.findAndCountAll({
    order: [['importedAt', 'DESC']],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
    attributes: { exclude: ['errorDetail'] },
  });
  return { logs: rows, total: count, page: safePage, limit: safeLimit };
};

const exportProducts = async (format) => {
  const { Brand: BrandModel, ProductImage: PIModel } = require('@models');
  const products = await Product.findAll({
    include: [
      { model: Category, as: 'category', attributes: ['slug'] },
      { model: BrandModel, as: 'brand', attributes: ['name'] },
      { model: PIModel, as: 'productImages', attributes: ['imageUrl'], limit: 5 },
      { model: ProductSpecification, as: 'specifications', attributes: ['specKey', 'specValue'] },
    ],
    order: [['id', 'ASC']],
  });

  const mapProduct = (p) => ({
    name: p.name, slug: p.slug, short_description: p.shortDescription || '',
    base_price: p.basePrice, category_slug: p.category?.slug || '',
    brand: p.brand?.name || '', status: p.status || 'active',
    stock_quantity: p.stockQuantity || 0,
    image_urls: (p.productImages || []).map((img) => img.imageUrl).join('|'),
    ...Object.fromEntries((p.specifications || []).map((s) => [`spec_${s.specKey.toLowerCase()}`, s.specValue])),
  });

  if (format === 'json') return products.map(mapProduct);

  const specKeyMap = { 'bộ nhớ': 'storage', 'màn hình': 'display', 'pin': 'battery' };
  const csvRows = [CSV_HEADERS.join(',')];
  for (const p of products) {
    const specMap = {};
    (p.specifications || []).forEach((s) => { specMap[s.specKey.toLowerCase()] = s.specValue; });
    const row = [
      escapeCsvField(p.name), escapeCsvField(p.slug),
      escapeCsvField(p.shortDescription || ''), p.basePrice || 0,
      escapeCsvField(p.category?.slug || ''), escapeCsvField(p.brand?.name || ''),
      p.status || 'active', p.stockQuantity || 0, '', '',
      escapeCsvField((p.productImages || []).map((img) => img.imageUrl).join('|')),
      escapeCsvField(specMap['cpu'] || ''), escapeCsvField(specMap['ram'] || ''),
      escapeCsvField(specMap[specKeyMap['bộ nhớ']] || specMap['storage'] || ''),
      escapeCsvField(specMap[specKeyMap['màn hình']] || specMap['display'] || ''),
      escapeCsvField(specMap[specKeyMap['pin']] || specMap['battery'] || ''),
    ];
    csvRows.push(row.join(','));
  }
  return csvRows.join('\n');
};

module.exports = { importProducts, getImportHistory, exportProducts };
