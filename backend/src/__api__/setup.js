/**
 * Setup cho API (HTTP) tests — kết nối database thật.
 * Chạy trước mỗi test file qua jest.api.config.js setupFiles.
 */
require('module-alias/register');
require('dotenv').config();

process.env.NODE_ENV = 'development';
process.env.DB_NAME = 'techstore_test';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? '';

process.env.JWT_SECRET = 'api-test-jwt-secret-minimum-32-chars-ok';
process.env.JWT_REFRESH_SECRET = 'api-test-refresh-secret-minimum-32-chars';
process.env.OPENROUTER_API_KEY = 'demo-key';
process.env.PORT = '9997';
