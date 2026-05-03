// Class lỗi tùy chỉnh
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Xử lý lỗi ở môi trường development — gửi thông tin lỗi chi tiết
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

// Xử lý lỗi ở môi trường production — chỉ gửi thông tin lỗi giới hạn
const sendErrorProd = (err, res) => {
  // Lỗi có thể dự đoán được: gửi message cho client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Lỗi lập trình hoặc lỗi không xác định: không để lộ chi tiết
    console.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Đã xảy ra lỗi. Vui lòng thử lại sau.',
    });
  }
};

// Xử lý lỗi CastError (giá trị không hợp lệ)
const handleCastErrorDB = (err) => {
  const message = `Giá trị không hợp lệ: ${err.value}`;
  return new AppError(message, 400);
};

// Xử lý lỗi duplicate key (MongoDB legacy — dùng cho compatibility)
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Giá trị trùng lặp: ${value}. Vui lòng sử dụng giá trị khác!`;
  return new AppError(message, 409);
};

// Xử lý lỗi validation (Mongoose legacy — dùng cho compatibility)
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Dữ liệu không hợp lệ. ${errors.join('. ')}`;
  return new AppError(message, 422);
};

const handleJWTError = () =>
  new AppError('Token không hợp lệ. Vui lòng đăng nhập lại!', 401);

const handleJWTExpiredError = () =>
  new AppError('Token đã hết hạn. Vui lòng đăng nhập lại!', 401);

// Xử lý lỗi unique constraint của Sequelize — trả 409 Conflict
const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors && err.errors[0]?.path;
  const value = err.errors && err.errors[0]?.value;
  const message = field
    ? `Giá trị '${value}' đã tồn tại cho trường '${field}'. Vui lòng sử dụng giá trị khác!`
    : 'Dữ liệu đã tồn tại. Vui lòng sử dụng giá trị khác!';
  return new AppError(message, 409);
};

// Xử lý lỗi validation của Sequelize — trả 422 Unprocessable Entity
const handleSequelizeValidationError = (err) => {
  const errors = err.errors ? err.errors.map((e) => e.message) : [err.message];
  const message = `Dữ liệu không hợp lệ: ${errors.join('. ')}`;
  return new AppError(message, 422);
};

// Xử lý lỗi upload file của Multer
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File tải lên vượt quá kích thước cho phép.', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Trường file không hợp lệ hoặc quá nhiều file.', 400);
  }
  return new AppError(`Lỗi upload file: ${err.message}`, 400);
};

// Chuẩn hóa loại lỗi thành AppError — áp dụng cho cả development và production
const normalizeError = (err) => {
  let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
  error.message = err.message;

  if (error.name === 'CastError') return handleCastErrorDB(error);
  // Lỗi duplicate key của MongoDB legacy (code 11000)
  if (error.code === 11000) return handleDuplicateFieldsDB(error);
  if (error.name === 'ValidationError') return handleValidationErrorDB(error);
  if (error.name === 'JsonWebTokenError') return handleJWTError();
  if (error.name === 'TokenExpiredError') return handleJWTExpiredError();
  if (error.name === 'SequelizeUniqueConstraintError') return handleSequelizeUniqueConstraintError(error);
  if (error.name === 'SequelizeValidationError') return handleSequelizeValidationError(error);
  // MulterError được nhận dạng qua instanceof nên truyền err gốc vào
  if (err.name === 'MulterError') return handleMulterError(err);

  return error;
};

// Middleware xử lý lỗi chính
const errorHandler = (err, req, res, next) => {
  // Chuẩn hóa lỗi Sequelize/JWT/Multer trước khi kiểm tra môi trường
  const normalizedErr = normalizeError(err);
  normalizedErr.statusCode = normalizedErr.statusCode || 500;
  normalizedErr.status = normalizedErr.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(normalizedErr, res);
  } else {
    // Production và mọi môi trường khác: ẩn stack trace
    sendErrorProd(normalizedErr, res);
  }
};

module.exports = {
  AppError,
  errorHandler,
};
