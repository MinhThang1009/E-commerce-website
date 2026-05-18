/**
 * @file adminImportController.js
 * @layer Controller
 * @module admin
 * @description Xử lý HTTP request/response cho admin product import/export
 */
const multer = require('multer');
const path = require('path');
const { catchAsync } = require('@utils/catch-async');
const { AppError } = require('@shared/errors');
const { CSV_HEADERS } = require('@modules/admin/utils/csv-parser');
const importService = require('@modules/admin/services/product-import-service');

const importUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.json'].includes(ext)) return cb(null, true);
    const allowedMimes = ['text/csv', 'application/json', 'text/plain', 'application/octet-stream'];
    if (allowedMimes.includes(file.mimetype)) return cb(null, true);
    cb(new AppError('Chỉ chấp nhận file CSV hoặc JSON', 400), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadImportFile = importUpload.single('file');

const getImportTemplate = catchAsync(async (_req, res) => {
  const exampleRow = [
    'iPhone 17 Pro Max', '', 'Smartphone cao cấp mới nhất của Apple',
    '36990000', 'dien-thoai', 'Apple', 'active', '50', 'IPH17PM-256-BLK',
    '0.228', '/uploads/products/iphone17-pro-max.jpg',
    'Apple A19 Pro', '8GB', '256GB', '6.9" Super Retina XDR', '4685 mAh',
  ].join(',');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.csv"');
  res.send(`${CSV_HEADERS.join(',')}\n${exampleRow}\n`);
});

const importProducts = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('Vui lòng upload file CSV hoặc JSON', 400));

  const result = await importService.importProducts({ file: req.file, adminId: req.user.id });

  if (result.allFailed) {
    return res.status(422).json({
      status: 'error',
      message: 'Tất cả dòng đều không hợp lệ — không có gì được import',
      errors: result.errors,
    });
  }

  res.status(200).json({ status: 'success', data: result });
});

const getImportHistory = catchAsync(async (req, res) => {
  const data = await importService.getImportHistory(req.query);
  res.status(200).json({ status: 'success', data });
});

const exportProducts = catchAsync(async (req, res) => {
  const format = req.query.format === 'json' ? 'json' : 'csv';
  const data = await importService.exportProducts(format);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="products-export-${Date.now()}.json"`);
    return res.json(data);
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="products-export-${Date.now()}.csv"`);
  res.send(data);
});

module.exports = { uploadImportFile, getImportTemplate, importProducts, getImportHistory, exportProducts };
