/**
 * @file DomainError.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: DomainError
 */
// Backward compat alias — DomainError đã đổi tên thành BusinessError sau Phase 1 refactor
const BusinessError = require('@shared/errors/business-error');
module.exports = BusinessError;
