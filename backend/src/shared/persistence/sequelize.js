/**
 * @file sequelize.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: sequelize
 */
// Re-export Sequelize singleton từ config/sequelize để mọi nơi (gồm modules/*) cùng
// dùng 1 connection pool. Phase 5 cleanup sẽ flip — implementation move vào
// đây và config/sequelize.js bị xóa.
module.exports = require('../../config/sequelize');
