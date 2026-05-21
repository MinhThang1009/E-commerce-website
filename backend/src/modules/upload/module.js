/**
 * @file module.js
 * @layer Module
 * @module upload
 * @description Entry point upload module — khởi tạo dependencies và đăng ký routes
 */
const path = require('path');
const fsPromises = require('fs').promises;
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('@shared/errors');

const UploadController = require('@modules/upload/controllers/upload-controller');
const UploadService = require('@modules/upload/services/upload-service');
const FilesystemUploadRepository = require('@modules/upload/repositories/filesystem-upload-repository');
const buildRoutes = require('@modules/upload/routes');

// Upload module — file upload qua multer + magic bytes validation. Dùng
// FilesystemUploadRepository (không phải Sequelize). Multer config ở
// infrastructure layer (module.js), service chỉ chứa pure validation logic.
//
// Module nhận `uploadsBaseDir` để override path cho test (default
// backend/uploads/). Tạo các sub-dir nếu chưa tồn tại (async, non-blocking).
module.exports = ({ uploadsBaseDir, eventBus, logger } = {}) => {
  const baseDir = uploadsBaseDir || path.resolve(__dirname, '../../../uploads');

  const uploadDirs = {
    reviews: path.join(baseDir, 'reviews'),
    products: path.join(baseDir, 'products'),
    users: path.join(baseDir, 'users'),
    categories: path.join(baseDir, 'categories'),
    brands: path.join(baseDir, 'brands'),
    banners: path.join(baseDir, 'banners'),
    news: path.join(baseDir, 'news'),
    avatars: path.join(baseDir, 'avatars'),
    temp: path.join(baseDir, 'temp'),
  };

  // Tạo dir async — không block startup
  (async () => {
    for (const dir of Object.values(uploadDirs)) {
      try {
        await fsPromises.mkdir(dir, { recursive: true });
      } catch {
        /* already exists */
      }
    }
  })();

  // Multer storage — pick uploadDir theo req.params.type
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadType = req.params.type || 'general';
      const uploadPath = uploadDirs[uploadType] || uploadDirs.products;
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = uuidv4();
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uniqueSuffix}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new AppError('Only JPG, PNG, WEBP allowed', 400), false);
  };

  const uploadEngine = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 10,
    },
  });

  const uploadRepository = new FilesystemUploadRepository();
  const uploadService = new UploadService({ uploadRepository, uploadDirs, eventBus, logger });
  const uploadController = new UploadController({ uploadService, uploadEngine });
  const router = buildRoutes({ uploadController });

  return {
    basePath: '/uploads',
    router,
    subscribeEvents() {},
    // Expose internals cho test/legacy compat
    _uploadDirs: uploadDirs,
    _uploadEngine: uploadEngine,
    // Pure helpers cho unit test (validateMagicBytes/deleteFile được wrap thành function)
    validateMagicBytes: (filePath) => uploadService.validateMagicBytes(filePath),
    deleteFile: (req, res, next) => uploadController.deleteFile(req, res, next),
  };
};
