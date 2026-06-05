/**
 * @file uploadMiddleware.js
 * @layer Middleware
 * @module image
 * @description Multer config cho image upload
 */
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('@shared/errors');
const { t } = require('@utils/i18n');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../../../uploads/temp'));
  },
  filename: (req, file, cb) => {
    cb(null, `temp_${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new AppError(t('image.invalidFileType', req.locale), 400), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

module.exports = upload;
