const logger = require('../../utils/logger');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const Image = require('../models/image');
const { AppError } = require('../middlewares/errorHandler');

class ImageService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.initializeDirectories();
  }

  // Khởi tạo các thư mục upload
  async initializeDirectories() {
    const dirs = [
      path.join(this.uploadDir, 'images/products'),
      path.join(this.uploadDir, 'images/thumbnails'),
      path.join(this.uploadDir, 'images/users'),
      path.join(this.uploadDir, 'images/reviews'),
      path.join(this.uploadDir, 'images/temp'),
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        logger.error(`Không thể tạo thư mục ${dir}:`, error);
      }
    }
  }

  // Tạo đường dẫn file có cấu trúc theo ngày
  generateFilePath(category, fileName) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    return path.join('images', category, year.toString(), month, fileName);
  }

  // Tạo tên file duy nhất bằng UUID
  generateUniqueFileName(originalName) {
    const uuid = uuidv4();
    const ext = path.extname(originalName);
    return `${uuid}${ext}`;
  }

  // Lấy kích thước ảnh
  async getImageDimensions(filePath) {
    try {
      const metadata = await sharp(filePath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      logger.error('Lỗi khi lấy kích thước ảnh:', error);
      return { width: null, height: null };
    }
  }

  // Xử lý và tối ưu hóa ảnh — resize, chuyển WebP, strip EXIF
  async processImage(inputPath, outputPath, options = {}) {
    try {
      let sharpInstance = sharp(inputPath);

      // Xoay đúng chiều theo EXIF orientation trước khi strip metadata
      sharpInstance = sharpInstance.rotate();

      // Thay đổi kích thước nếu được chỉ định
      if (options.width || options.height) {
        sharpInstance = sharpInstance.resize({
          width: options.width,
          height: options.height,
          fit: options.fit || 'inside',
          withoutEnlargement: true,
        });
      }

      // Áp dụng cài đặt chất lượng theo định dạng đầu ra
      if (options.quality) {
        if (outputPath.endsWith('.jpg') || outputPath.endsWith('.jpeg')) {
          sharpInstance = sharpInstance.jpeg({ quality: options.quality });
        } else if (outputPath.endsWith('.png')) {
          sharpInstance = sharpInstance.png({ quality: options.quality });
        } else if (outputPath.endsWith('.webp')) {
          sharpInstance = sharpInstance.webp({ quality: options.quality });
        }
      }

      // Strip toàn bộ EXIF metadata — tránh lộ GPS location và thông tin cá nhân
      sharpInstance = sharpInstance.withMetadata(false);

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await sharpInstance.toFile(outputPath);

      return outputPath;
    } catch (error) {
      logger.error('Lỗi khi xử lý ảnh:', error);
      throw new AppError('Failed to process image', 500);
    }
  }

  // Pipeline chuẩn cho ảnh sản phẩm — resize max 800x800, chuyển WebP, strip EXIF
  async processProductImage(inputPath, outputPath) {
    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      await sharp(inputPath)
        .rotate() // Xoay đúng chiều theo EXIF orientation trước khi strip
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .withMetadata(false) // Strip EXIF — tránh lộ GPS location
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      logger.error('Lỗi khi xử lý ảnh sản phẩm:', error);
      throw new AppError('Failed to process product image', 500);
    }
  }

  // Tạo ảnh thumbnail
  async generateThumbnails(originalPath, fileName, category) {
    const thumbnails = [];
    const thumbSizes = [
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 300, height: 300 },
      { name: 'large', width: 600, height: 600 },
    ];

    for (const size of thumbSizes) {
      try {
        const thumbFileName = `${path.parse(fileName).name}_${size.name}${path.extname(fileName)}`;
        const thumbPath = this.generateFilePath('thumbnails', thumbFileName);
        const fullThumbPath = path.join(this.uploadDir, thumbPath);

        await this.processImage(originalPath, fullThumbPath, {
          width: size.width,
          height: size.height,
          quality: 85,
          fit: 'cover',
        });

        thumbnails.push({
          size: size.name,
          path: thumbPath,
          fileName: thumbFileName,
        });
      } catch (error) {
        logger.error(`Lỗi khi tạo thumbnail ${size.name}:`, error);
      }
    }

    return thumbnails;
  }

  // Upload và xử lý ảnh đơn
  async uploadImage(file, options = {}) {
    try {
      logger.debug('📤 Bắt đầu upload ảnh:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        options,
      });

      const {
        category = 'product',
        productId = null,
        userId = null,
        generateThumbs = true,
        optimize = true,
      } = options;

      // Tạo tên file duy nhất
      const fileName = this.generateUniqueFileName(file.originalname);
      const filePath = this.generateFilePath(category, fileName);
      const fullPath = path.join(this.uploadDir, filePath);

      // Đảm bảo thư mục tồn tại
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Xử lý và lưu ảnh
      if (optimize) {
        await this.processImage(file.path, fullPath, {
          quality: 90,
        });
      } else {
        // Chỉ sao chép file
        await fs.copyFile(file.path, fullPath);
      }

      // Lấy kích thước ảnh
      const dimensions = await this.getImageDimensions(fullPath);

      // Lưu vào database
      const imageRecord = await Image.create({
        originalName: file.originalname,
        fileName: fileName,
        filePath: filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        width: dimensions.width,
        height: dimensions.height,
        category: category,
        productId: productId,
        userId: userId,
      });

      // Tạo thumbnail nếu được yêu cầu
      let thumbnails = [];
      if (generateThumbs && category === 'product') {
        thumbnails = await this.generateThumbnails(
          fullPath,
          fileName,
          category
        );
      }

      // Xóa file tạm
      try {
        await fs.unlink(file.path);
      } catch (error) {
        logger.error('Lỗi khi xóa file tạm:', error);
      }

      return {
        id: imageRecord.id,
        fileName: fileName,
        filePath: filePath,
        url: `/uploads/${filePath}`,
        originalName: file.originalname,
        size: file.size,
        dimensions,
        thumbnails,
        category,
      };
    } catch (error) {
      logger.error('Lỗi khi upload ảnh:', error);
      throw new AppError('Failed to upload image', 500);
    }
  }

  // Upload nhiều ảnh cùng lúc
  async uploadMultipleImages(files, options = {}) {
    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const result = await this.uploadImage(file, options);
        results.push(result);
      } catch (error) {
        errors.push({
          fileName: file.originalname,
          error: error.message,
        });
      }
    }

    return {
      successful: results,
      failed: errors,
      count: {
        total: files.length,
        successful: results.length,
        failed: errors.length,
      },
    };
  }

  // Lấy ảnh theo ID
  async getImageById(id) {
    try {
      const image = await Image.findByPk(id);
      if (!image) {
        throw new AppError('Image not found', 404);
      }
      return image;
    } catch (error) {
      throw error;
    }
  }

  // Xóa ảnh
  async deleteImage(id) {
    try {
      const image = await this.getImageById(id);
      const fullPath = path.join(this.uploadDir, image.filePath);

      // Xóa file khỏi hệ thống
      try {
        await fs.unlink(fullPath);
      } catch (error) {
        logger.error('Lỗi khi xóa file:', error);
      }

      // Xóa thumbnail nếu tồn tại
      if (image.category === 'product') {
        const thumbSizes = ['small', 'medium', 'large'];
        for (const size of thumbSizes) {
          try {
            const thumbFileName = `${path.parse(image.fileName).name}_${size}${path.extname(image.fileName)}`;
            const thumbPath = path.join(
              this.uploadDir,
              'images/thumbnails',
              thumbFileName
            );
            await fs.unlink(thumbPath);
          } catch (error) {
            // Bỏ qua lỗi khi xóa thumbnail
          }
        }
      }

      // Xóa khỏi database
      await image.destroy();

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Lấy danh sách ảnh theo ID sản phẩm
  async getImagesByProductId(productId) {
    try {
      const images = await Image.findAll({
        where: { productId, isActive: true },
        order: [['createdAt', 'ASC']],
      });
      return images;
    } catch (error) {
      throw error;
    }
  }

  // Chuyển đổi base64 thành file
  async convertBase64ToFile(base64Data, options = {}) {
    try {
      const { category = 'product', productId = null, userId = null } = options;

      // Trích xuất mime type và dữ liệu base64
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new AppError('Invalid base64 data', 400);
      }

      const mimeType = matches[1];
      const base64 = matches[2];

      // Xác định phần mở rộng file
      const ext = mimeType.split('/')[1];
      const fileName = `${uuidv4()}.${ext}`;
      const filePath = this.generateFilePath(category, fileName);
      const fullPath = path.join(this.uploadDir, filePath);

      // Đảm bảo thư mục tồn tại
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Chuyển đổi và lưu file
      const buffer = Buffer.from(base64, 'base64');
      await fs.writeFile(fullPath, buffer);

      // Lấy kích thước ảnh
      const dimensions = await this.getImageDimensions(fullPath);

      // Lưu vào database
      const imageRecord = await Image.create({
        originalName: `converted_${fileName}`,
        fileName: fileName,
        filePath: filePath,
        fileSize: buffer.length,
        mimeType: mimeType,
        width: dimensions.width,
        height: dimensions.height,
        category: category,
        productId: productId,
        userId: userId,
      });

      return {
        id: imageRecord.id,
        fileName: fileName,
        filePath: filePath,
        url: `/uploads/${filePath}`,
        originalName: `converted_${fileName}`,
        size: buffer.length,
        dimensions,
        category,
      };
    } catch (error) {
      logger.error('Lỗi khi chuyển đổi base64 thành file:', error);
      throw new AppError('Failed to convert base64 to file', 500);
    }
  }

  // Dọn dẹp các file không còn được tham chiếu
  async cleanupOrphanedFiles() {
    try {
      // Lấy tất cả file trong thư mục upload
      const allFiles = await this.getAllFiles(this.uploadDir);

      // Lấy tất cả ảnh đang hoạt động từ database
      const activeImages = await Image.findAll({
        where: { isActive: true },
        attributes: ['filePath'],
      });

      const activeFilePaths = new Set(activeImages.map((img) => img.filePath));

      // Tìm các file không còn được tham chiếu
      const orphanedFiles = allFiles.filter((filePath) => {
        const relativePath = path.relative(this.uploadDir, filePath);
        return !activeFilePaths.has(relativePath);
      });

      // Xóa các file không còn được tham chiếu
      for (const filePath of orphanedFiles) {
        try {
          await fs.unlink(filePath);
          logger.debug(`Đã xóa file không còn tham chiếu: ${filePath}`);
        } catch (error) {
          logger.error(`Lỗi khi xóa file không còn tham chiếu ${filePath}:`, error);
        }
      }

      return {
        totalFiles: allFiles.length,
        activeFiles: activeImages.length,
        orphanedFiles: orphanedFiles.length,
        deletedFiles: orphanedFiles.length,
      };
    } catch (error) {
      logger.error('Lỗi khi dọn dẹp file không còn tham chiếu:', error);
      throw new AppError('Failed to cleanup orphaned files', 500);
    }
  }

  // Phương thức hỗ trợ lấy toàn bộ file theo đệ quy
  async getAllFiles(dirPath) {
    const files = [];
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }
}

module.exports = new ImageService();

