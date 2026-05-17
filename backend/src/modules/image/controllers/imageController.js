const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const imageService = require('../services/imageService');
const { AppError } = require('../../../shared/errors');

// Cấu hình multer lưu file tạm — file sẽ được xử lý bởi imageService rồi xóa
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, '../../../../uploads/temp');
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `temp_${uniqueSuffix}${ext}`);
  },
});

// Chỉ chấp nhận file ảnh — từ chối các loại file khác
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP)', 400), false);
  }
};

// Giới hạn kích thước 10MB và tối đa 10 file mỗi request
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

class ImageController {
  // Upload một ảnh
  async uploadSingle(req, res, next) {
    try {
      const uploadMiddleware = upload.single('image');
      uploadMiddleware(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE')
              return next(new AppError('File quá lớn. Kích thước tối đa là 10MB', 400));
            return next(new AppError(`Lỗi upload: ${err.message}`, 400));
          }
          return next(err);
        }
        if (!req.file) return next(new AppError('Không có file nào được upload', 400));
        try {
          const options = {
            category: req.body.category || 'product',
            productId: req.body.productId || null,
            userId: req.user?.id || null,
            generateThumbs: req.body.generateThumbs !== 'false',
            optimize: req.body.optimize !== 'false',
          };
          const result = await imageService.uploadImage(req.file, options);
          res
            .status(200)
            .json({ status: 'success', message: 'Ảnh đã được upload thành công', data: result });
        } catch (error) {
          next(error);
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Upload nhiều ảnh (tối đa 10)
  async uploadMultiple(req, res, next) {
    try {
      const uploadMiddleware = upload.array('images', 10);
      uploadMiddleware(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE')
              return next(new AppError('File quá lớn. Kích thước tối đa là 10MB', 400));
            if (err.code === 'LIMIT_FILE_COUNT')
              return next(new AppError('Quá nhiều file. Tối đa là 10 file', 400));
            return next(new AppError(`Lỗi upload: ${err.message}`, 400));
          }
          return next(err);
        }
        if (!req.files || req.files.length === 0)
          return next(new AppError('Không có file nào được upload', 400));
        try {
          const options = {
            category: req.body.category || 'product',
            productId: req.body.productId || null,
            userId: req.user?.id || null,
            generateThumbs: req.body.generateThumbs !== 'false',
            optimize: req.body.optimize !== 'false',
          };
          const result = await imageService.uploadMultipleImages(req.files, options);
          res.status(200).json({
            status: 'success',
            message: `${result.count.successful} ảnh đã được upload thành công`,
            data: result,
          });
        } catch (error) {
          next(error);
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Lấy thông tin ảnh theo ID
  async getImageById(req, res, next) {
    try {
      const { id } = req.params;
      const image = await imageService.getImageById(id);
      res.status(200).json({
        status: 'success',
        data: { ...image.toJSON(), url: `/uploads/${image.filePath}` },
      });
    } catch (error) {
      next(error);
    }
  }

  // Lấy danh sách ảnh của một sản phẩm
  async getImagesByProductId(req, res, next) {
    try {
      const { productId } = req.params;
      const images = await imageService.getImagesByProductId(productId);
      const imagesWithUrls = images.map((image) => ({
        ...image.toJSON(),
        url: `/uploads/${image.filePath}`,
      }));
      res
        .status(200)
        .json({ status: 'success', data: { images: imagesWithUrls, count: images.length } });
    } catch (error) {
      next(error);
    }
  }

  // Xóa ảnh theo ID
  async deleteImage(req, res, next) {
    try {
      const { id } = req.params;
      await imageService.deleteImage(id);
      res.status(200).json({ status: 'success', message: 'Ảnh đã được xóa thành công' });
    } catch (error) {
      next(error);
    }
  }

  // Chuyển đổi ảnh từ base64 sang file lưu trên server
  async convertBase64(req, res, next) {
    try {
      const { base64Data, category, productId } = req.body;
      if (!base64Data) return next(new AppError('base64Data là bắt buộc', 400));
      const options = {
        category: category || 'product',
        productId: productId || null,
        userId: req.user?.id || null,
      };
      const result = await imageService.convertBase64ToFile(base64Data, options);
      res.status(200).json({
        status: 'success',
        message: 'Đã chuyển đổi base64 sang file thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Dọn dẹp các file ảnh không còn được tham chiếu trong DB
  async cleanupOrphanedFiles(req, res, next) {
    try {
      const result = await imageService.cleanupOrphanedFiles();
      res.status(200).json({
        status: 'success',
        message: 'Đã dọn dẹp các file không còn được tham chiếu thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Kiểm tra trạng thái hoạt động của image service
  async healthCheck(req, res, next) {
    try {
      res.status(200).json({
        status: 'success',
        message: 'Image service đang hoạt động bình thường',
        data: { timestamp: new Date().toISOString(), version: '1.0.0' },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ImageController();
