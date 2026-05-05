// Re-export socket setup từ config/socket. Hiện coupling với chat handlers
// (sendMessage/typing/...). Sprint 10 (chat module DDD-lite) sẽ tách handlers
// chat ra adapter riêng để shared/socket chỉ giữ bootstrap + JWT auth.
module.exports = require('../../config/socket');
