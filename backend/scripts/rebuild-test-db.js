/**
 * Khởi tạo lại database test riêng (techstore_test).
 * Dùng để tách biệt test data khỏi DB website chính.
 * Chạy: npm run db:test:setup
 */
process.env.DB_NAME = 'techstore_test';
require('./rebuild-db');
