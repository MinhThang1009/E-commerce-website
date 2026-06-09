/**
 * Shared setup cho HTTP integration tests dùng supertest.
 * Import file này trong mỗi http.test.js.
 */
// Set DB_NAME TRƯỚC dotenv để luôn dùng test DB, tránh ảnh hưởng DB chính
process.env.NODE_ENV = 'development';
process.env.DB_NAME = 'techstore_test';

require('module-alias/register');
require('dotenv').config();
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? '';

process.env.JWT_SECRET = 'http-test-jwt-secret-minimum-32-chars';
process.env.JWT_REFRESH_SECRET = 'http-test-refresh-secret-min-32-chars';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
process.env.OPENROUTER_API_KEY = 'demo-key';
process.env.PORT = '9997';

// Payment gateway defaults cho CI (không có .env)
process.env.MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || 'MOMOCI';
process.env.MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || 'ci-momo-access-key';
process.env.MOMO_SECRET_KEY = process.env.MOMO_SECRET_KEY || 'ci-momo-secret-key-32chars-min';
process.env.MOMO_API_ENDPOINT =
  process.env.MOMO_API_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';
process.env.MOMO_REDIRECT_URL =
  process.env.MOMO_REDIRECT_URL || 'http://localhost:5175/orders?payment=momo-return';
process.env.MOMO_IPN_URL =
  process.env.MOMO_IPN_URL || 'http://localhost:8888/api/payments/momo/ipn';
process.env.VNP_TMN_CODE = process.env.VNP_TMN_CODE || 'TESTCI01';
process.env.VNP_HASH_SECRET = process.env.VNP_HASH_SECRET || 'ci-vnpay-hash-secret-32chars-x';
process.env.VNP_URL = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
process.env.VNP_RETURN_URL =
  process.env.VNP_RETURN_URL || 'http://localhost:8888/api/payments/vnpay/return';
process.env.VNP_IPN_URL = process.env.VNP_IPN_URL || 'http://localhost:8888/api/payments/vnpay/ipn';

const app = require('../app');
const request = require('supertest');
const { User, Product, ProductVariant, Category, Brand } = require('@models');

/** Tạo user test và trả về { user, token } */
async function createTestUser(overrides = {}) {
  const TS = Date.now();
  const user = await User.create({
    firstName: '__HTTP',
    lastName: 'Test',
    email: overrides.email || `__http_test_${TS}@t.com`,
    password: 'Test123!',
    role: overrides.role || 'customer',
    isEmailVerified: true,
    isActive: true,
    ...overrides,
  });

  // Lấy token qua login
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: 'Test123!' });

  const token = res.body?.token || res.body?.data?.token || '';
  return { user, token };
}

/** Tạo sản phẩm test đầy đủ */
async function createTestProduct(overrides = {}) {
  const TS = Date.now() + Math.random();
  const cat = await Category.create({
    nameVi: `__HTTP_Cat_${TS}`,
    nameEn: `__HTTP_Cat_${TS}`,
    slug: `http-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__HTTP_Brand_${TS}`,
    nameEn: `__HTTP_Brand_${TS}`,
    slug: `http-brand-${TS}`,
  });
  const product = await Product.create({
    nameVi: `__HTTP_Product_${TS}`,
    nameEn: `__HTTP_Product_${TS}`,
    baseName: `__HTTP_Product_${TS}`,
    slug: `http-product-${TS}`,
    basePrice: 5_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 50,
    ...overrides,
  });
  const variant = await ProductVariant.create({
    productId: product.id,
    sku: `HTTP-VAR-${TS}`,
    variantName: 'Base',
    price: 5_000_000,
    stockQuantity: 50,
    isDefault: true,
  });
  return { product, variant, cat, brand };
}

module.exports = { app, request, createTestUser, createTestProduct };
