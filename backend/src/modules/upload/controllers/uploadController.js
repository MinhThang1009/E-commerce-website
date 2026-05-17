const multer = require('multer');
const { AppError } = require('../../../shared/errors');
const { t } = require('../../../utils/i18n');

// Upload Controller — wrap multer middleware. Multer parse multipart/form-data
// vào req.file/files trước khi gọi service. Multer error mapping vào AppError
// (413 file size, 400 file count, 400 generic).
class UploadController {
  constructor({ uploadService, uploadEngine }) {
    this.uploadService = uploadService;
    this.uploadEngine = uploadEngine;  // multer instance đã wire storage + filter
  }

  // Map multer error → AppError với HTTP status đúng
  _mapMulterError(err, maxFiles) {
    if (!(err instanceof multer.MulterError)) return err;
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError('File quá lớn. Kích thước tối đa 5MB', 413);
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return new AppError(`Số lượng file tối đa là ${maxFiles}`, 400);
    }
    return new AppError(`Lỗi upload: ${err.message}`, 400);
  }

  uploadSingle = async (req, res, next) => {
    try {
      const middleware = this.uploadEngine.single('file');
      middleware(req, res, async (err) => {
        if (err) return next(this._mapMulterError(err));
        try {
          const uploadType = req.params.type || 'general';
          const data = await this.uploadService.processSingleUpload({
            file: req.file, uploadType,
          });
          res.status(200).json({
            status: 'success',
            message: t('upload.uploadSuccess', req.locale),
            data,
          });
        } catch (e) { next(e); }
      });
    } catch (err) { next(err); }
  };

  uploadMultiple = async (req, res, next) => {
    try {
      const uploadType = req.params.type || 'general';
      const maxFiles = uploadType === 'reviews' ? 5 : 10;
      const middleware = this.uploadEngine.array('files', maxFiles);
      middleware(req, res, async (err) => {
        if (err) return next(this._mapMulterError(err, maxFiles));
        try {
          const files = await this.uploadService.processMultipleUpload({
            files: req.files, uploadType,
          });
          res.status(200).json({
            status: 'success',
            message: t('upload.batchUploadSuccess', req.locale, { count: files.length }),
            data: { files, type: uploadType, count: files.length },
          });
        } catch (e) { next(e); }
      });
    } catch (err) { next(err); }
  };

  deleteFile = async (req, res, next) => {
    try {
      const result = await this.uploadService.deleteFile({
        user: req.user,
        type: req.params.type,
        filenameRaw: req.params.filename,
      });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };
}

module.exports = UploadController;
