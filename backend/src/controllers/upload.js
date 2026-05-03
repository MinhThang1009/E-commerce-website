const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../middlewares/errorHandler');

// Tạo các thư mục upload nếu chưa tồn tại (dùng async để không block server)
const uploadDirs = {
  reviews: path.join(__dirname, '../../uploads/reviews'),
  products: path.join(__dirname, '../../uploads/products'),
  users: path.join(__dirname, '../../uploads/users'),
  categories: path.join(__dirname, '../../uploads/categories'),
  collections: path.join(__dirname, '../../uploads/collections'),
  brands: path.join(__dirname, '../../uploads/brands'),
  banners: path.join(__dirname, '../../uploads/banners'),
  news: path.join(__dirname, '../../uploads/news'),
  avatars: path.join(__dirname, '../../uploads/avatars'),
  // Thư mục tạm — cleanup tự động mỗi ngày lúc 2AM
  temp: path.join(__dirname, '../../uploads/temp'),
};

// Khởi tạo thư mục bất đồng bộ — không block server process
(async () => {
  for (const dir of Object.values(uploadDirs)) {
    try {
      await fsPromises.mkdir(dir, { recursive: true });
    } catch {
      // Thư mục đã tồn tại hoặc lỗi không nghiêm trọng — bỏ qua
    }
  }
})();

// Magic bytes signatures cho các định dạng ảnh được phép
// Dùng để phát hiện file giả mạo (đổi tên .exe thành .jpg)
const MAGIC_BYTES = {
  jpeg: [Buffer.from([0xff, 0xd8, 0xff])],
  png: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  // WebP: bắt đầu bằng RIFF (4 bytes) + 4 bytes size + WEBP
  webp: [Buffer.from([0x52, 0x49, 0x46, 0x46])],
};

// Kiểm tra magic bytes của file đã lưu để phát hiện file giả mạo
async function validateMagicBytes(filePath) {
  const fd = await fsPromises.open(filePath, 'r');
  try {
    // Đọc 12 bytes đầu để check JPEG, PNG và WebP header
    const buf = Buffer.alloc(12);
    await fd.read(buf, 0, 12, 0);

    const isJpeg = MAGIC_BYTES.jpeg[0].equals(buf.slice(0, 3));
    const isPng = MAGIC_BYTES.png[0].equals(buf.slice(0, 8));
    // WebP: RIFF ở offset 0 và WEBP ở offset 8
    const isWebp =
      MAGIC_BYTES.webp[0].equals(buf.slice(0, 4)) &&
      buf.slice(8, 12).toString('ascii') === 'WEBP';

    return isJpeg || isPng || isWebp;
  } finally {
    await fd.close();
  }
}

// Cấu hình lưu trữ file
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

// Bộ lọc file — chỉ chấp nhận JPEG, PNG, WebP (không nhận GIF hay file khác)
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError('Only JPG, PNG, WEBP allowed', 400),
      false
    );
  }
};

// Cấu hình Multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB tối đa
    files: 10,
  },
});

// Upload một file
const uploadSingle = async (req, res, next) => {
  try {
    const uploadType = req.params.type || 'general';

    const uploadMiddleware = upload.single('file');

    uploadMiddleware(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(
              new AppError('File quá lớn. Kích thước tối đa 5MB', 413)
            );
          }
          return next(new AppError(`Lỗi upload: ${err.message}`, 400));
        }
        return next(err);
      }

      if (!req.file) {
        return next(new AppError('Không có file được upload', 400));
      }

      // Kiểm tra magic bytes để phát hiện file giả mạo
      // MIME type do browser gửi có thể bị fake — cần verify thực tế
      const isValidMagic = await validateMagicBytes(req.file.path);
      if (!isValidMagic) {
        // Xóa file giả mạo ngay lập tức
        await fsPromises.unlink(req.file.path).catch(() => {});
        return next(new AppError('Only JPG, PNG, WEBP allowed', 400));
      }

      const fileUrl = `/uploads/${uploadType}/${req.file.filename}`;

      res.status(200).json({
        status: 'success',
        message: 'Upload file thành công',
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          url: fileUrl,
          size: req.file.size,
          type: uploadType,
        },
      });
    });
  } catch (error) {
    next(error);
  }
};

// Upload nhiều file
const uploadMultiple = async (req, res, next) => {
  try {
    const uploadType = req.params.type || 'general';
    const maxFiles = uploadType === 'reviews' ? 5 : 10;

    const uploadMiddleware = upload.array('files', maxFiles);

    uploadMiddleware(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(
              new AppError('File quá lớn. Kích thước tối đa 5MB', 413)
            );
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return next(
              new AppError(`Số lượng file tối đa là ${maxFiles}`, 400)
            );
          }
          return next(new AppError(`Lỗi upload: ${err.message}`, 400));
        }
        return next(err);
      }

      if (!req.files || req.files.length === 0) {
        return next(new AppError('Không có file được upload', 400));
      }

      // Kiểm tra magic bytes cho từng file
      const validFiles = [];
      const invalidPaths = [];

      for (const file of req.files) {
        const isValid = await validateMagicBytes(file.path);
        if (isValid) {
          validFiles.push(file);
        } else {
          invalidPaths.push(file.path);
        }
      }

      // Xóa các file giả mạo
      await Promise.allSettled(invalidPaths.map((p) => fsPromises.unlink(p)));

      if (validFiles.length === 0) {
        return next(new AppError('Only JPG, PNG, WEBP allowed', 400));
      }

      const files = validFiles.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        url: `/uploads/${uploadType}/${file.filename}`,
        size: file.size,
      }));

      res.status(200).json({
        status: 'success',
        message: `Upload ${files.length} file thành công`,
        data: {
          files,
          type: uploadType,
          count: files.length,
        },
      });
    });
  } catch (error) {
    next(error);
  }
};

// Xóa file đã upload
const deleteFile = async (req, res, next) => {
  try {
    const { type } = req.params;

    // Chỉ admin mới được phép xóa file
    if (!req.user || req.user.role !== 'admin') {
      throw new AppError('Truy cập bị từ chối', 403);
    }

    if (!uploadDirs[type]) {
      throw new AppError('Loại file không hợp lệ', 400);
    }

    // Chỉ lấy tên file, không cho phép path traversal
    const filename = path.basename(req.params.filename);
    if (filename !== req.params.filename) {
      throw new AppError('Tên file không hợp lệ', 400);
    }

    const uploadDir = path.resolve(uploadDirs[type]);
    const filePath = path.join(uploadDir, filename);

    // Kiểm tra file nằm trong thư mục upload để tránh path traversal
    if (!filePath.startsWith(uploadDir + path.sep) && filePath !== uploadDir) {
      throw new AppError('Truy cập bị từ chối', 403);
    }

    // Kiểm tra file tồn tại bằng async stat
    try {
      await fsPromises.stat(filePath);
    } catch {
      throw new AppError('File không tồn tại', 404);
    }

    await fsPromises.unlink(filePath);

    res.status(200).json({
      status: 'success',
      message: 'Xóa file thành công',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  deleteFile,
  upload,
  uploadDirs,
  validateMagicBytes, // export để unit test
};
