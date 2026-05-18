/**
 * @file uploadService.js
 * @layer Service
 * @module upload
 * @description Business logic layer cho upload
 */
const path = require('path');
const { AppError } = require('@shared/errors');

// Upload Service — magic bytes validation + file URL builder + admin delete.
// File system operations qua uploadRepository (FilesystemUploadRepository hoặc
// adapter S3 tương lai).

// Magic bytes signatures cho các định dạng ảnh được phép. Phát hiện file giả
// mạo (đổi tên .exe thành .jpg) qua check 12 bytes header.
const MAGIC_BYTES = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  webp: Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF — cần kiểm 'WEBP' ở offset 8
};

class UploadService {
  constructor({ uploadRepository, uploadDirs, eventBus, logger }) {
    this.uploadRepository = uploadRepository;
    this.uploadDirs = uploadDirs;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  // Pure: kiểm tra magic bytes của buffer 12-byte header
  static isValidImageMagic(buf) {
    if (!buf || buf.length < 12) return false;
    const isJpeg = MAGIC_BYTES.jpeg.equals(buf.slice(0, 3));
    const isPng = MAGIC_BYTES.png.equals(buf.slice(0, 8));
    const isWebp =
      MAGIC_BYTES.webp.equals(buf.slice(0, 4)) &&
      buf.slice(8, 12).toString('ascii') === 'WEBP';
    return isJpeg || isPng || isWebp;
  }

  async validateMagicBytes(filePath) {
    const buf = await this.uploadRepository.readFileHeader(filePath, 12);
    return UploadService.isValidImageMagic(buf);
  }

  buildFileUrl(uploadType, filename) {
    return `/uploads/${uploadType}/${filename}`;
  }

  // Validate single uploaded file — kiểm magic bytes, xóa nếu giả mạo, trả URL.
  async processSingleUpload({ file, uploadType }) {
    if (!file) {
      throw new AppError('upload.noFile', 400);
    }

    const isValidMagic = await this.validateMagicBytes(file.path);
    if (!isValidMagic) {
      // Xóa file giả mạo ngay lập tức (best-effort, không chặn response)
      await this.uploadRepository.deleteFile(file.path).catch(() => {});
      throw new AppError('upload.invalidFileType', 400);
    }

    return {
      filename: file.filename,
      originalName: file.originalname,
      url: this.buildFileUrl(uploadType, file.filename),
      size: file.size,
      type: uploadType,
    };
  }

  // Validate multiple files — phân loại valid/invalid, xóa invalid, trả mảng valid.
  async processMultipleUpload({ files, uploadType }) {
    if (!files || files.length === 0) {
      throw new AppError('upload.noFile', 400);
    }

    const validFiles = [];
    const invalidPaths = [];

    for (const file of files) {
      const isValid = await this.validateMagicBytes(file.path);
      if (isValid) {
        validFiles.push(file);
      } else {
        invalidPaths.push(file.path);
      }
    }

    // Xóa file giả mạo song song (best-effort)
    await Promise.allSettled(
      invalidPaths.map((p) => this.uploadRepository.deleteFile(p))
    );

    if (validFiles.length === 0) {
      throw new AppError('upload.invalidFileType', 400);
    }

    return validFiles.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      url: this.buildFileUrl(uploadType, file.filename),
      size: file.size,
    }));
  }

  // Xóa file đã upload — admin only, validate path traversal.
  async deleteFile({ user, type, filenameRaw }) {
    if (!user || user.role !== 'admin') {
      throw new AppError('upload.accessDenied', 403);
    }

    if (!this.uploadDirs[type]) {
      throw new AppError('upload.invalidType', 400);
    }

    const filename = path.basename(filenameRaw);
    if (filename !== filenameRaw) {
      throw new AppError('upload.invalidFileName', 400);
    }

    const uploadDir = path.resolve(this.uploadDirs[type]);
    const filePath = path.join(uploadDir, filename);

    if (!filePath.startsWith(uploadDir + path.sep) && filePath !== uploadDir) {
      throw new AppError('upload.accessDenied', 403);
    }

    const exists = await this.uploadRepository.fileExists(filePath);
    if (!exists) {
      throw new AppError('upload.fileNotFound', 404);
    }

    await this.uploadRepository.deleteFile(filePath);
    return { message: 'upload.deleteSuccess' };
  }
}

module.exports = UploadService;
module.exports.MAGIC_BYTES = MAGIC_BYTES;
