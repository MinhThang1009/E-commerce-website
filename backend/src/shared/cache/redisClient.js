// Re-export Redis singleton từ config/redis (gồm in-memory fallback).
// Phase 5 cleanup sẽ flip — implementation move vào đây.
module.exports = require('../../config/redis');
