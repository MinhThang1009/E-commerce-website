/**
 * Setup cho integration tests — kết nối database thật (test_db).
 * KHÔNG mock bất kỳ thứ gì.
 */
require('module-alias/register');
require('dotenv').config();

// Dùng techstore — DB thật với dữ liệu seed đầy đủ
// Tests tạo data với prefix '__INT_TEST_' và xóa sạch trong afterAll
process.env.NODE_ENV = 'development';
process.env.DB_NAME = 'techstore_test';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? '';

// Biến bắt buộc cho các modules
process.env.JWT_SECRET = 'integration-test-jwt-secret-minimum-32-chars';
process.env.JWT_REFRESH_SECRET = 'integration-test-refresh-secret-min-32-chars';
process.env.OPENROUTER_API_KEY = 'demo-key';
process.env.PORT = '9998';

// CI: suppress winston console output (embedding/vector warnings rất noisy)
if (process.env.CI) process.env.LOG_LEVEL = 'silent';
