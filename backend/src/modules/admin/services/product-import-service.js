/**
 * @file product-import-service.js
 * @layer Service
 * @module admin
 * @description Business logic import/export sản phẩm hàng loạt từ file CSV hoặc JSON.
 *
 * Export 2 hàm public:
 *   - `importProducts({ file, adminId })` — parse file → validate → bulk insert từng dòng
 *   - `exportProducts(format)` — lấy toàn bộ sản phẩm → trả về CSV string hoặc JSON array
 *
 * Internal helpers (không export, chỉ dùng trong file này):
 *   - `_buildLookupMaps()` — tải danh sách category/brand từ DB để tra cứu nhanh theo slug/tên
 *   - `_insertProductRow(row, categoryMap, brandMap)` — insert 1 dòng trong 1 transaction riêng
 *
 * Dùng repository riêng: `sequelize-product-import-repository.js`
 * (KHÔNG phải `sequelize-admin-repository.js` dùng cho CRUD thông thường).
 *
 * Sau khi import thành công, sync vector store bằng `setImmediate` (fire-and-forget) —
 * không block response, lỗi sync chỉ ghi log.
 */
const path = require('path');
const slugify = require('slugify');
const repo = require('@modules/admin/repositories/sequelize-product-import-repository');
const logger = require('@utils/logger');
const { AppError } = require('@shared/errors');
const { t: i18n } = require('@utils/i18n');
const vectorStoreService = require('@services/vector-store/vector-store');
const {
  parseCsv,
  validateRow,
  escapeCsvField,
  CSV_HEADERS,
} = require('@modules/admin/utils/csv-parser');

/**
 * Tải toàn bộ danh sách category và brand từ DB, rồi đóng gói thành 2 Map tra cứu nhanh
 * để tránh query DB lặp lại khi xử lý từng dòng import (N+1 queries).
 *
 * Kết quả trả về:
 *   - `categoryMap`: Map từ `category.slug` → `category.id`
 *     Ví dụ: `{ 'dien-thoai': 1, 'laptop': 2, ... }`
 *   - `brandMap`: Map tra cứu brand theo cả tên (lowercase) lẫn slug:
 *     `{ 'apple': 5, 'apple-inc': 5, 'samsung': 6, 'samsung-electronics': 6, ... }`
 *     Lý do có 2 key cho mỗi brand: CSV có thể ghi tên brand theo dạng tự do (vd: "Apple")
 *     hoặc theo slug (vd: "apple-inc") — map theo cả 2 để tăng khả năng khớp.
 *
 * Hàm này được gọi 1 lần trước vòng lặp insert (không gọi bên trong vòng lặp).
 *
 * @returns {Promise<{categoryMap: Object<string, number>, brandMap: Object<string, number>}>}
 *   Hai Map tra cứu: categoryMap (slug → id) và brandMap (name_lowercase hoặc slug → id)
 */
const _buildLookupMaps = async () => {
  const [categories, brands] = await Promise.all([
    repo.findCategoriesForImport(),
    repo.findBrandsForImport(),
  ]);
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.id]));
  const brandMap = {};
  brands.forEach((b) => {
    brandMap[b.name.toLowerCase()] = b.id;
    brandMap[b.slug] = b.id;
  });
  return { categoryMap, brandMap };
};

/**
 * Insert một dòng sản phẩm từ file import vào DB, bao gồm tất cả dữ liệu liên quan.
 *
 * Mỗi dòng được bọc trong **transaction riêng biệt** — nếu dòng này lỗi (ví dụ: SKU trùng,
 * vi phạm constraint DB), chỉ rollback dòng đó, các dòng khác không bị ảnh hưởng.
 * Đây là thiết kế "partial insert": import 100 dòng, 3 dòng lỗi → 97 dòng được insert thành công.
 *
 * Thứ tự insert trong transaction:
 *   1. `products` — row chính (name, slug, basePrice, categoryId, brandId, status, stockQuantity)
 *   2. `product_variants` — 1 variant mặc định (nếu `row.sku` có giá trị)
 *   3. `product_images` — 1 hoặc nhiều ảnh (từ `row.image_urls` phân cách bởi `|`)
 *   4. `product_categories` — liên kết product ↔ category (nếu categoryId resolve được)
 *   5. `product_specifications` — tối đa 5 thông số kỹ thuật (CPU, RAM, Bộ nhớ, Màn hình, Pin)
 *
 * Slug deduplication: nếu slug đã tồn tại trong DB, append `-{Date.now()}` để tạo slug duy nhất.
 * Lưu ý: nếu import chạy song song (nhiều request cùng lúc), có race condition nhỏ — 2 dòng
 * cùng slug có thể chạy `findProductBySlug` cùng lúc và cùng nhận kết quả "không tồn tại",
 * dẫn đến 1 trong 2 fail ở DB constraint. Chấp nhận được vì import admin thường không song song.
 *
 * @param {Object} row - Dữ liệu 1 dòng đã qua `validateRow` (chỉ gọi hàm này với row hợp lệ):
 *   - `name` {string} — tên sản phẩm (bắt buộc)
 *   - `base_price` {string|number} — giá gốc (bắt buộc, parse bằng `parseFloat`)
 *   - `category_slug` {string} — slug category để tra cứu trong categoryMap
 *   - `brand` {string} — tên brand để tra cứu trong brandMap (lowercase match)
 *   - `slug` {string?} — slug tùy chỉnh (nếu không có → tự tạo từ name bằng slugify)
 *   - `short_description` {string?}
 *   - `status` {string?} — 'active' | 'inactive' (mặc định: 'active')
 *   - `stock_quantity` {string|number?} — tồn kho (mặc định: 0)
 *   - `sku` {string?} — nếu có, tạo 1 variant mặc định với SKU này
 *   - `image_urls` {string?} — URLs ảnh phân cách bởi `|`; ảnh đầu tiên là thumbnail
 *   - `spec_cpu`, `spec_ram`, `spec_storage`, `spec_display`, `spec_battery` {string?} — thông số kỹ thuật
 *   - `_lineNumber` {number} — số dòng trong file (dùng để report lỗi)
 * @param {Object<string, number>} categoryMap - Map slug → categoryId (từ `_buildLookupMaps`)
 * @param {Object<string, number>} brandMap - Map tên/slug → brandId (từ `_buildLookupMaps`)
 * @returns {Promise<number>} ID của sản phẩm vừa tạo
 * @throws {Error} Lỗi DB (vi phạm constraint, mất kết nối) — caller ghi vào `rowErrors` và tiếp tục
 */
const _insertProductRow = async (row, categoryMap, brandMap) => {
  return repo.runInTransaction(async (t) => {
    const categoryId = categoryMap[String(row.category_slug).trim()] || null;
    const brandName = row.brand ? String(row.brand).trim().toLowerCase() : null;
    const brandId = brandName ? (brandMap[brandName] ?? null) : null;

    const rawSlug = row.slug
      ? String(row.slug).trim()
      : slugify(String(row.name).trim(), { lower: true, strict: true });

    let finalSlug = rawSlug;
    const existing = await repo.findProductBySlug(rawSlug, t);
    if (existing) finalSlug = `${rawSlug}-${Date.now()}`;

    const product = await repo.createProduct(
      {
        name: String(row.name).trim(),
        slug: finalSlug,
        shortDescription: row.short_description ? String(row.short_description).trim() : null,
        basePrice: parseFloat(row.base_price),
        categoryId,
        brandId,
        status: row.status || 'active',
        stockQuantity: parseInt(row.stock_quantity) || 0,
      },
      t,
    );

    if (row.sku && String(row.sku).trim()) {
      await repo.createProductVariant(
        {
          productId: product.id,
          sku: String(row.sku).trim(),
          price: parseFloat(row.base_price),
          stockQuantity: parseInt(row.stock_quantity) || 0,
          isDefault: true,
        },
        t,
      );
    }

    if (row.image_urls && String(row.image_urls).trim()) {
      const urls = String(row.image_urls)
        .split('|')
        .map((u) => u.trim())
        .filter(Boolean);
      for (let i = 0; i < urls.length; i++) {
        await repo.createProductImage(
          {
            productId: product.id,
            imageUrl: urls[i],
            isThumbnail: i === 0,
            sortOrder: i + 1,
          },
          t,
        );
      }
    }

    if (categoryId) {
      await repo.createProductCategory({ productId: product.id, categoryId }, t);
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
        await repo.createProductSpecification(
          {
            productId: product.id,
            name: spec.key,
            value: String(spec.value).trim(),
            sortOrder: spec.order,
          },
          t,
        );
      }
    }

    return product.id;
  });
};

/**
 * Import sản phẩm hàng loạt từ file CSV hoặc JSON được upload.
 *
 * Luồng xử lý chi tiết:
 *   1. Xác định format từ extension file (`.csv` hoặc `.json`)
 *   2. Parse nội dung file thành mảng `rows`:
 *      - JSON: `JSON.parse()` → kiểm tra là array → gán `_lineNumber = index + 2` (line 1 = header)
 *      - CSV: dùng `parseCsv()` từ `utils/csv-parser.js`
 *   3. Validate toàn bộ rows bằng `validateRow()` — thu thập lỗi mà không dừng lại
 *   4. Nếu MỌI row đều fail validation → return `{ allFailed: true, errors }` ngay (không insert gì)
 *   5. Build lookup maps 1 lần duy nhất (tránh N+1 query)
 *   6. Lọc ra `validRows` (loại bỏ các row có validation error)
 *   7. Insert từng valid row bằng `_insertProductRow` — mỗi row trong transaction riêng.
 *      Nếu row lỗi DB → ghi vào `rowErrors`, tăng `failedCount`, tiếp tục (không abort toàn bộ)
 *   8. Sau khi insert xong, sync vector store bằng `setImmediate` (async fire-and-forget):
 *      load sản phẩm mới → enrich data → upsert vào vector store → save → log.
 *      Lỗi sync không ảnh hưởng response (chỉ log warning).
 *
 * Partial insert behavior: đây là THIẾT KẾ CÓ CHỦ Ý, không phải bug.
 * Import 100 dòng, 10 dòng fail validation + 5 dòng fail DB → 85 dòng được insert thành công.
 * Response trả về đủ thông tin để admin biết dòng nào lỗi và lý do.
 *
 * @param {Object} params
 * @param {Express.Multer.File} params.file - File upload từ multer memoryStorage:
 *   - `file.originalname` — tên file gốc (dùng để xác định extension)
 *   - `file.buffer` — nội dung file dưới dạng Buffer
 *   Chỉ nhận `.csv` hoặc `.json`, tối đa 5MB (giới hạn ở multer config trong controller)
 * @param {number} params.adminId - ID admin thực hiện import
 * @returns {Promise<Object>} Kết quả import:
 *   - Nếu mọi dòng đều fail validation: `{ allFailed: true, errors: Array, totalRows: number }`
 *   - Bình thường: `{ totalRows: number, successCount: number, failedCount: number, errors: Array }`
 *     - `errors`: mảng các object `{ row: number, field: string, message: string }`
 *       (gộp cả validation errors lẫn DB insert errors)
 * @throws {AppError} HTTP 400 nếu file JSON không thể parse hoặc file CSV rỗng
 */
const importProducts = async ({ file, adminId, locale = 'vi' }) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const content = file.buffer.toString('utf8');

  let rows = [];
  if (ext === '.json') {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AppError(i18n('admin.jsonParseError', locale), 400);
    }
    if (!Array.isArray(parsed)) throw new AppError(i18n('admin.jsonMustBeArray', locale), 400);
    if (parsed.length === 0) throw new AppError(i18n('admin.csvEmpty', locale), 400);
    rows = parsed.map((item, idx) => ({ ...item, _lineNumber: idx + 2 }));
  } else {
    const { rows: csvRows } = parseCsv(content);
    if (csvRows.length === 0) throw new AppError(i18n('admin.csvEmpty', locale), 400);
    rows = csvRows;
  }

  const validationErrors = rows.flatMap((row) => validateRow(row, row._lineNumber));
  const failedRowCount = new Set(validationErrors.map((e) => e.row)).size;
  if (failedRowCount === rows.length) {
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
      rowErrors.push({
        row: row._lineNumber,
        field: 'general',
        message: err.message || 'Lỗi khi insert vào DB',
      });
      logger.warn(`[IMPORT] Lỗi dòng ${row._lineNumber}:`, err.message);
    }
  }

  if (newProductIds.length > 0) {
    setImmediate(async () => {
      try {
        const { enrichProductData } = require('@utils/product-helpers');
        const newProducts = await repo.findProductsByIds(newProductIds);
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

/**
 * Export toàn bộ sản phẩm ra CSV string hoặc JSON array.
 *
 * CSV format (mặc định, khi `format` không phải `'json'`):
 *   - Dòng đầu tiên là header: 16 cột theo thứ tự trong `CSV_HEADERS`
 *     (`name, slug, short_description, base_price, category_slug, brand, status,
 *      stock_quantity, sku, weight_kg, image_urls, spec_cpu, spec_ram, spec_storage,
 *      spec_display, spec_battery`)
 *   - Các dòng tiếp theo: mỗi sản phẩm 1 dòng, các field text dùng `escapeCsvField()`
 *     để tránh dấu phẩy hoặc ký tự xuống dòng làm vỡ format CSV
 *   - Nhiều ảnh trong `image_urls`: phân cách bởi `|` (pipe)
 *   - Thông số kỹ thuật được map từ `spec_key.toLowerCase()` về tên cột CSV tương ứng
 *     (vd: key 'Bộ nhớ' → cột `spec_storage`, 'Màn hình' → `spec_display`, 'Pin' → `spec_battery`)
 *   - Các cột `sku` và `weight_kg` luôn trống trong export hiện tại (placeholder cho tương lai)
 *
 * JSON format (`format === 'json'`): trả về array of plain objects với cùng các field trên.
 * Caller (controller) gọi `res.json()` trực tiếp với mảng này.
 *
 * @param {'csv'|'json'} format - Format output: `'json'` để lấy array of objects,
 *   bất kỳ giá trị nào khác (kể cả `undefined`) → trả về CSV string
 * @returns {Promise<string|Array>} CSV string (nhiều dòng, nối bằng `'\n'`) hoặc
 *   Array of plain objects tùy theo `format`
 */
const exportProducts = async (format) => {
  const products = await repo.findProductsForExport();

  const mapProduct = (p) => ({
    name: p.name,
    slug: p.slug,
    short_description: p.shortDescription || '',
    base_price: p.basePrice,
    category_slug: p.category?.slug || '',
    brand: p.brand?.name || '',
    status: p.status || 'active',
    stock_quantity: p.stockQuantity || 0,
    image_urls: (p.productImages || []).map((img) => img.imageUrl).join('|'),
    ...Object.fromEntries(
      (p.productSpecifications || []).map((s) => [`spec_${s.name.toLowerCase()}`, s.value]),
    ),
  });

  if (format === 'json') return products.map(mapProduct);

  const csvRows = [CSV_HEADERS.join(',')];
  for (const p of products) {
    const specMap = {};
    (p.productSpecifications || []).forEach((s) => {
      specMap[s.name.toLowerCase()] = s.value;
    });
    const row = [
      escapeCsvField(p.name),
      escapeCsvField(p.slug),
      escapeCsvField(p.shortDescription || ''),
      p.basePrice || 0,
      escapeCsvField(p.category?.slug || ''),
      escapeCsvField(p.brand?.name || ''),
      p.status || 'active',
      p.stockQuantity || 0,
      '',
      '',
      escapeCsvField((p.productImages || []).map((img) => img.imageUrl).join('|')),
      escapeCsvField(specMap['cpu'] || ''),
      escapeCsvField(specMap['ram'] || ''),
      escapeCsvField(specMap['bộ nhớ'] || ''),
      escapeCsvField(specMap['màn hình'] || ''),
      escapeCsvField(specMap['pin'] || ''),
    ];
    csvRows.push(row.join(','));
  }
  return csvRows.join('\n');
};

module.exports = { importProducts, exportProducts };
