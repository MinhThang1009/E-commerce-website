/**
 * @file logger.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: logger
 */
// Re-export Winston logger singleton từ utils/logger. Phase 5 cleanup sẽ flip.
module.exports = require('@utils/logger');
