// Thiết lập biến môi trường để server không crash khi các file require REQUIRED_ENV_VARS
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long';
process.env.DB_NAME = 'test_db';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = '';
process.env.OPENROUTER_API_KEY = 'demo-key';
process.env.PORT = '9999';
