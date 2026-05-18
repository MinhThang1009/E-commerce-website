/**
 * @file validate-request.js
 * @layer Middleware
 * @module global
 * @description Express middleware: validate request body với Zod schema
 */
const { z } = require('zod');
const { AppError } = require('@middlewares/error-handler');

/**
 * Middleware validate request body với Zod schema.
 * Strip unknown fields tự động (Zod default với .strip()).
 * @param {z.ZodSchema} schema - Zod schema
 * @param {number} statusCode - HTTP status khi fail (default 400)
 * @param {'body'|'query'|'params'} source - Phần của request cần validate (default 'body')
 */
const validateRequest = (schema, statusCode = 400, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errorMessage = result.error.issues
        .map((issue) => issue.message)
        .join(', ');
      return next(new AppError(errorMessage, statusCode));
    }

    req[source] = result.data; // replace với parsed data (stripped + coerced)
    next();
  };
};

module.exports = { validateRequest };
