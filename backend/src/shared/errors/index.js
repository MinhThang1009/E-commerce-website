/**
 * @file index.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: index
 */
const AppError = require('@shared/errors/app-error');
const DomainError = require('@shared/errors/domain-error');
const BusinessError = require('@shared/errors/business-error');
const ValidationError = require('@shared/errors/validation-error');
const NotFoundError = require('@shared/errors/not-found-error');

module.exports = {
  AppError,
  DomainError,
  BusinessError,
  ValidationError,
  NotFoundError,
};
