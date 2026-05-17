const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

// Middleware kiểm tra request body theo Joi schema
// statusCode mặc định 400; dùng 422 cho các endpoint có semantic validation (RFC 4918)
const validateRequest = (schema, statusCode = 400) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(', ');
      return next(new AppError(errorMessage, statusCode));
    }

    next();
  };
};

/**
 * Middleware để kiểm tra validation errors từ express-validator
 */
const validateExpressValidator = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    // Log chi tiết để debug
    const logger = require('../utils/logger');
    logger.error('Validation Errors: ' + JSON.stringify(formattedErrors, null, 2));
    logger.debug('📝 Request Body: ' + JSON.stringify(req.body, null, 2));
    logger.debug('🔗 Request Params: ' + JSON.stringify(req.params, null, 2));

    return res.status(400).json({
      status: 'fail',
      message: 'Lỗi kiểm tra dữ liệu đầu vào',
      errors: formattedErrors,
    });
  }

  next();
};

/**
 * Factory function để tạo validate middleware với express-validator rules
 */
const validate = (validationRules) => {
  return [...validationRules, validateExpressValidator];
};

module.exports = {
  validateRequest,
  validate,
  validateExpressValidator,
};
