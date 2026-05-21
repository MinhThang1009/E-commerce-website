/**
 * @file errorHandler.js
 * @layer Middleware
 * @module global
 * @description Express middleware: errorHandler
 */
const logger = require('@utils/logger');
const AppError = require('@shared/errors/app-error');
const { t } = require('@utils/i18n');

// Translate message nếu là i18n key, giữ nguyên nếu không
const translateMessage = (msg, lang, params) => t(msg, lang, params) || msg;

const sendErrorDev = (err, lang, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: translateMessage(err.message, lang, err.params),
    error: err,
    stack: err.stack,
  });
};

const sendErrorProd = (err, lang, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: translateMessage(err.message, lang, err.params),
    });
  } else {
    logger.error('ERROR', err);
    res.status(500).json({
      status: 'error',
      message: t('common.unknownError', lang),
    });
  }
};

// Xử lý lỗi CastError (giá trị không hợp lệ)
const handleCastErrorDB = (err) => {
  return new AppError('common.invalidValue', 400, { value: err.value });
};

// Xử lý lỗi duplicate key (MongoDB legacy — dùng cho compatibility)
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  return new AppError('common.duplicateValue', 409, { value });
};

// Xử lý lỗi validation (Mongoose legacy — dùng cho compatibility)
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  return new AppError('common.invalidData', 422, { details: errors.join('. ') });
};

const handleJWTError = () => new AppError('auth.jwtInvalid', 401);

const handleJWTExpiredError = () => new AppError('auth.jwtExpired', 401);

const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors && err.errors[0]?.path;
  const value = err.errors && err.errors[0]?.value;
  if (field) return new AppError('common.fieldDuplicate', 409, { field, value });
  return new AppError('common.dataExists', 409);
};

const handleSequelizeValidationError = (err) => {
  const errors = err.errors ? err.errors.map((e) => e.message) : [err.message];
  return new AppError('common.invalidDataDetails', 422, { details: errors.join('. ') });
};

const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') return new AppError('common.fileTooLarge', 400);
  if (err.code === 'LIMIT_UNEXPECTED_FILE') return new AppError('common.invalidFileField', 400);
  return new AppError('common.uploadError', 400, { details: err.message });
};

// Chuẩn hóa loại lỗi thành AppError — áp dụng cho cả development và production
const normalizeError = (err) => {
  const error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
  error.message = err.message;

  if (error.name === 'CastError') return handleCastErrorDB(error);
  // Lỗi duplicate key của MongoDB legacy (code 11000)
  if (error.code === 11000) return handleDuplicateFieldsDB(error);
  if (error.name === 'ValidationError') return handleValidationErrorDB(error);
  if (error.name === 'JsonWebTokenError') return handleJWTError();
  if (error.name === 'TokenExpiredError') return handleJWTExpiredError();
  if (error.name === 'SequelizeUniqueConstraintError')
    return handleSequelizeUniqueConstraintError(error);
  if (error.name === 'SequelizeValidationError') return handleSequelizeValidationError(error);
  // MulterError được nhận dạng qua instanceof nên truyền err gốc vào
  if (err.name === 'MulterError') return handleMulterError(err);

  return error;
};

// Middleware xử lý lỗi chính
const errorHandler = (err, req, res, next) => {
  const normalizedErr = normalizeError(err);
  normalizedErr.statusCode = normalizedErr.statusCode || 500;
  normalizedErr.status = normalizedErr.status || 'error';
  const lang = req.locale || 'vi';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(normalizedErr, lang, res);
  } else {
    sendErrorProd(normalizedErr, lang, res);
  }
};

module.exports = {
  AppError,
  errorHandler,
};
