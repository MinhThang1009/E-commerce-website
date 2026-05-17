/**
 * @file adminImportController.js
 * @layer Controller
 * @module admin
 * @description Xử lý HTTP request/response cho admin
 */
const multer = require('multer');
const path = require('path');
const slugify = require('slugify');
const {
  sequelize,
  Product,
  ProductVariant,
  ProductImage,
  ProductCategory,
  ProductSpecification,
  Category,
  Brand,
  ImportLog,
} = require('../../../models');
const { Op } = require('sequelize');
const logger = require('../../../utils/logger');
const { catchAsync } = require('../../../utils/catchAsync');
const { AppError } = require('../../../shared/errors');
const vectorStoreService = require('../../../modules/ai/services/vectorStore');

// ===================================================
// CẤU HÌNH MULTER — chỉ nhận CSV/JSON, tối đa 5MB
// ===================================================
const importStorage = multer.memoryStorage();

// Kiểm tra MIME type và extension cho file import
const importFileFilter = (_req, file, cb) => {
  const allowedMimes = ['text/csv', 'application/json', 'text/plain', 'application/octet-stream'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.csv', '.json'].includes(ext)) {
    cb(null, true);
  } else if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Chỉ chấp nhận file CSV hoặc JSON', 400), false);
  }
};

const importUpload = multer({
  storage: importStorage,
  fileFilter: importFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB tối đa
});

// Middleware upload cho import endpoint — xuất ra để route dùng
const uploadImportFile = importUpload.single('file');

// ===================================================
// TIÊU CHUẨN CSV — các cột và thứ tự
// ===================================================
const CSV_HEADERS = [
  'name', // * bắt buộc
  'slug', // tùy chọn — auto-gen từ name nếu bỏ trống
  'short_description',
  'base_price', // * bắt buộc
  'category_slug', // * bắt buộc
  'brand', // tùy chọn
  'status', // mặc định: active
  'stock_quantity', // mặc định: 0
  'sku', // SKU cho variant mặc định
  'weight_kg', // cân nặng (kg)
  'image_urls', // phân cách bởi | — URL hoặc tên file
  'spec_cpu',
  'spec_ram',
  'spec_storage',
  'spec_display',
  'spec_battery',
];

// ===================================================
// HÀM PARSE CSV — đơn giản, không dùng thư viện ngoài
// ===================================================

/**
 * Parse một dòng CSV xử lý cả giá trị có dấu phẩy bên trong ngoặc kép.
 * Ví dụ: "Samsung Galaxy,A52","Red, Blue",50000 → ['Samsung Galaxy,A52', 'Red, Blue', '50000']
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote ("") → chèn dấu ngoặc kép thật
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse toàn bộ CSV content → mảng objects { header: value }.
 * Trả về { rows, headers } — headers từ dòng đầu tiên.
 */
function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.every((v) => v === '')) continue; // bỏ qua dòng trống

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : '';
    });
    row._lineNumber = i + 1; // số dòng thực tế trong file (để báo lỗi)
    rows.push(row);
  }

  return { headers, rows };
}

// ===================================================
// VALIDATE MỘT DÒNG DỮ LIỆU
// ===================================================

/**
 * Validate một row từ CSV/JSON.
 * Trả về mảng lỗi [{ row, field, message }], mảng rỗng nếu hợp lệ.
 */
function validateRow(row, rowIndex) {
  const errors = [];

  if (!row.name || !String(row.name).trim()) {
    errors.push({ row: rowIndex, field: 'name', message: 'Trường name là bắt buộc' });
  }

  if (!row.base_price || isNaN(parseFloat(row.base_price))) {
    errors.push({ row: rowIndex, field: 'base_price', message: 'base_price phải là số hợp lệ' });
  } else if (parseFloat(row.base_price) < 0) {
    errors.push({ row: rowIndex, field: 'base_price', message: 'base_price không được âm' });
  }

  if (!row.category_slug || !String(row.category_slug).trim()) {
    errors.push({
      row: rowIndex,
      field: 'category_slug',
      message: 'Trường category_slug là bắt buộc',
    });
  }

  return errors;
}

// ===================================================
// GET /api/admin/products/import-template
// Trả về file CSV mẫu để admin download
// ===================================================
const getImportTemplate = catchAsync(async (_req, res) => {
  const headerRow = CSV_HEADERS.join(',');
  // Dòng ví dụ minh họa format
  const exampleRow = [
    'iPhone 17 Pro Max', // name
    '', // slug (để trống — auto-gen)
    'Smartphone cao cấp mới nhất của Apple', // short_description
    '36990000', // base_price
    'dien-thoai', // category_slug
    'Apple', // brand
    'active', // status
    '50', // stock_quantity
    'IPH17PM-256-BLK', // sku
    '0.228', // weight_kg
    '/uploads/products/iphone17-pro-max.jpg', // image_urls
    'Apple A19 Pro', // spec_cpu
    '8GB', // spec_ram
    '256GB', // spec_storage
    '6.9" Super Retina XDR', // spec_display
    '4685 mAh', // spec_battery
  ].join(',');

  const csvContent = `${headerRow}\n${exampleRow}\n`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.csv"');
  res.send(csvContent);
});

// ===================================================
// POST /api/admin/products/import
// Upload CSV/JSON → parse → validate → batch insert
// ===================================================
const importProducts = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Vui lòng upload file CSV hoặc JSON', 400));
  }

  const filename = req.file.originalname;
  const ext = path.extname(filename).toLowerCase();
  const content = req.file.buffer.toString('utf8');

  let rows = [];

  // ── Parse file dựa theo extension ──
  if (ext === '.json') {
    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        return next(new AppError('File JSON phải là mảng các object sản phẩm', 400));
      }
      // Chuẩn hóa JSON rows — thêm _lineNumber để báo lỗi
      rows = parsed.map((item, idx) => ({ ...item, _lineNumber: idx + 2 }));
    } catch {
      return next(new AppError('File JSON không hợp lệ — không thể parse', 400));
    }
  } else {
    // Mặc định xử lý như CSV
    const { rows: csvRows } = parseCsv(content);
    if (csvRows.length === 0) {
      return next(new AppError('File CSV rỗng hoặc không có dữ liệu', 400));
    }
    rows = csvRows;
  }

  // ── Load tất cả categories và brands một lần để lookup nhanh ──
  const categories = await Category.findAll({ attributes: ['id', 'slug', 'name'] });
  const brands = await Brand.findAll({ attributes: ['id', 'name', 'slug'] });

  const categoryMap = {};
  categories.forEach((c) => {
    categoryMap[c.slug] = c.id;
  });

  const brandMap = {};
  brands.forEach((b) => {
    brandMap[b.name.toLowerCase()] = b.id;
    brandMap[b.slug] = b.id;
  });

  // ── Validate tất cả dòng trước khi insert ──
  const validationErrors = [];
  for (const row of rows) {
    const rowErrors = validateRow(row, row._lineNumber);
    validationErrors.push(...rowErrors);
  }

  // Nếu tất cả dòng đều lỗi → báo lỗi sớm
  if (validationErrors.length === rows.length) {
    return res.status(422).json({
      status: 'error',
      message: 'Tất cả dòng đều không hợp lệ — không có gì được import',
      errors: validationErrors,
    });
  }

  // ── Batch insert các dòng hợp lệ trong một transaction ──
  let successCount = 0;
  let failedCount = 0;
  const rowErrors = [...validationErrors]; // lỗi validation đã có
  const newProductIds = [];

  // Các dòng không có lỗi validation
  const validRows = rows.filter((row) => {
    const hasError = rowErrors.some((e) => e.row === row._lineNumber);
    if (hasError) {
      failedCount++;
    }
    return !hasError;
  });

  // Xử lý từng dòng hợp lệ — mỗi product trong transaction riêng
  // để lỗi 1 dòng không ảnh hưởng dòng khác
  for (const row of validRows) {
    try {
      await sequelize.transaction(async (t) => {
        const categoryId = categoryMap[String(row.category_slug).trim()] || null;
        const brandName = row.brand ? String(row.brand).trim().toLowerCase() : null;
        const brandId = brandName ? (brandMap[brandName] ?? null) : null;

        // Auto-generate slug nếu để trống
        const rawSlug = row.slug
          ? String(row.slug).trim()
          : slugify(String(row.name).trim(), { lower: true, strict: true });

        // Đảm bảo slug unique — thêm timestamp nếu trùng
        let finalSlug = rawSlug;
        const existingSlug = await Product.findOne({
          where: { slug: rawSlug },
          transaction: t,
          attributes: ['id'],
        });
        if (existingSlug) {
          finalSlug = `${rawSlug}-${Date.now()}`;
        }

        const product = await Product.create(
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
          { transaction: t },
        );

        newProductIds.push(product.id);

        // Variant mặc định nếu có SKU
        if (row.sku && String(row.sku).trim()) {
          await ProductVariant.create(
            {
              productId: product.id,
              sku: String(row.sku).trim(),
              price: parseFloat(row.base_price),
              stockQuantity: parseInt(row.stock_quantity) || 0,
              isDefault: true,
            },
            { transaction: t },
          );
        }

        // Ảnh sản phẩm — phân cách bởi |
        if (row.image_urls && String(row.image_urls).trim()) {
          const imageUrls = String(row.image_urls)
            .split('|')
            .map((u) => u.trim())
            .filter(Boolean);
          for (let i = 0; i < imageUrls.length; i++) {
            await ProductImage.create(
              {
                productId: product.id,
                imageUrl: imageUrls[i],
                isThumbnail: i === 0,
                sortOrder: i + 1,
              },
              { transaction: t },
            );
          }
        }

        // Liên kết product_categories nếu có categoryId
        if (categoryId) {
          await ProductCategory.create(
            {
              productId: product.id,
              categoryId,
            },
            { transaction: t },
          );
        }

        // Thông số kỹ thuật — chỉ insert nếu có giá trị
        const specFields = [
          { key: 'CPU', value: row.spec_cpu, order: 1 },
          { key: 'RAM', value: row.spec_ram, order: 2 },
          { key: 'Bộ nhớ', value: row.spec_storage, order: 3 },
          { key: 'Màn hình', value: row.spec_display, order: 4 },
          { key: 'Pin', value: row.spec_battery, order: 5 },
        ];
        for (const spec of specFields) {
          if (spec.value && String(spec.value).trim()) {
            await ProductSpecification.create(
              {
                productId: product.id,
                specKey: spec.key,
                specValue: String(spec.value).trim(),
                sortOrder: spec.order,
              },
              { transaction: t },
            );
          }
        }
      });

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

  // ── Lưu import log ──
  await ImportLog.create({
    adminId: req.user.id,
    filename,
    totalRows: rows.length,
    successRows: successCount,
    failedRows: failedCount,
    errorDetail: rowErrors.length > 0 ? rowErrors : null,
    importedAt: new Date(),
  });

  // ── Trigger vector sync bất đồng bộ sau khi insert xong ──
  if (newProductIds.length > 0) {
    setImmediate(async () => {
      try {
        // Load products vừa tạo với đầy đủ relations để embed
        const { enrichProductData } = require('../../../modules/ai/services/vectorStore');
        const newProducts = await Product.findAll({
          where: { id: { [Op.in]: newProductIds } },
          include: [
            { model: Category, as: 'categories', attributes: ['name'] },
            {
              model: ProductImage,
              as: 'productImages',
              attributes: ['imageUrl', 'isThumbnail'],
              required: false,
            },
            {
              model: ProductVariant,
              as: 'variants',
              attributes: ['stockQuantity'],
              required: false,
            },
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

  return res.status(200).json({
    status: 'success',
    data: {
      totalRows: rows.length,
      successCount,
      failedCount,
      errors: rowErrors.length > 0 ? rowErrors : [],
    },
  });
});

// ===================================================
// GET /api/admin/products/import-history
// Lịch sử các lần import, mới nhất trước
// ===================================================
const getImportHistory = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const { rows, count } = await ImportLog.findAndCountAll({
    order: [['importedAt', 'DESC']],
    limit,
    offset,
    attributes: {
      // Không trả về error_detail trong list view — có thể rất lớn
      exclude: ['errorDetail'],
    },
  });

  return res.status(200).json({
    status: 'success',
    data: {
      logs: rows,
      total: count,
      page,
      limit,
    },
  });
});

// ===================================================
// GET /api/admin/products/export?format=csv
// Export tất cả sản phẩm thành file CSV/JSON
// ===================================================
const exportProducts = catchAsync(async (req, res) => {
  const format = req.query.format === 'json' ? 'json' : 'csv';

  // Lấy tất cả sản phẩm kèm category, brand (unbounded — đây là admin export, không phải user-facing)
  const products = await Product.findAll({
    include: [
      { model: Category, as: 'category', attributes: ['slug'] },
      { model: require('../../../models').Brand, as: 'brand', attributes: ['name'] },
      {
        model: require('../../../models').ProductImage,
        as: 'productImages',
        attributes: ['imageUrl'],
        limit: 5,
      },
      { model: ProductSpecification, as: 'specifications', attributes: ['specKey', 'specValue'] },
    ],
    order: [['id', 'ASC']],
  });

  if (format === 'json') {
    // Export JSON — mỗi sản phẩm là một object
    const data = products.map((p) => ({
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
        (p.specifications || []).map((s) => [`spec_${s.specKey.toLowerCase()}`, s.specValue]),
      ),
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="products-export-${Date.now()}.json"`,
    );
    return res.json(data);
  }

  // Export CSV — dòng header + mỗi sản phẩm một dòng
  const csvRows = [CSV_HEADERS.join(',')];

  for (const p of products) {
    const specMap = {};
    (p.specifications || []).forEach((s) => {
      specMap[s.specKey.toLowerCase()] = s.specValue;
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
      '', // sku — không export variant level
      '', // weight_kg
      escapeCsvField((p.productImages || []).map((img) => img.imageUrl).join('|')),
      escapeCsvField(specMap['cpu'] || ''),
      escapeCsvField(specMap['ram'] || ''),
      escapeCsvField(specMap['bộ nhớ'] || specMap['storage'] || ''),
      escapeCsvField(specMap['màn hình'] || specMap['display'] || ''),
      escapeCsvField(specMap['pin'] || specMap['battery'] || ''),
    ];
    csvRows.push(row.join(','));
  }

  const csvContent = csvRows.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="products-export-${Date.now()}.csv"`);
  return res.send(csvContent);
});

// Escape field cho CSV — bọc ngoặc kép nếu có dấu phẩy/ngoặc kép/newline
function escapeCsvField(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

module.exports = {
  uploadImportFile,
  getImportTemplate,
  importProducts,
  getImportHistory,
  exportProducts,
};
