/**
 * Shared helpers cho E2E tests.
 * Import vào từng .e2e.test.js để tái sử dụng helpers tạo/dọn data.
 */
require('module-alias/register');
require('dotenv').config();

process.env.NODE_ENV = 'development';
process.env.PORT = '9996';

const app = require('../app');
const request = require('supertest');
const { User, Product, ProductVariant, Category, Brand } = require('@models');

/**
 * Tạo customer test với email duy nhất và trả về { user, token }.
 * Prefix '__E2E_' để dễ cleanup sau.
 */
async function createE2EUser(overrides = {}) {
  const TS = Date.now() + Math.floor(Math.random() * 10000);
  const email = overrides.email || `__e2e_user_${TS}@t.com`;

  const user = await User.create({
    firstName: '__E2E',
    lastName: 'Customer',
    email,
    password: 'E2ETest1!',
    role: 'customer',
    isEmailVerified: true,
    isActive: true,
    ...overrides,
  });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: 'E2ETest1!' });

  const token = res.body?.token || res.body?.data?.token || '';
  return { user, token };
}

/**
 * Tạo admin test và trả về { user, token }.
 */
async function createE2EAdmin(overrides = {}) {
  return createE2EUser({ role: 'admin', ...overrides });
}

/**
 * Tạo sản phẩm test đầy đủ (category + brand + product + variant).
 */
async function createE2EProduct(overrides = {}) {
  const TS = Date.now() + Math.floor(Math.random() * 10000);

  const cat = await Category.create({
    nameVi: `__E2E_Cat_${TS}`,
    nameEn: `__E2E_Cat_${TS}`,
    slug: `e2e-cat-${TS}`,
    isActive: true,
  });

  const brand = await Brand.create({
    nameVi: `__E2E_Brand_${TS}`,
    nameEn: `__E2E_Brand_${TS}`,
    slug: `e2e-brand-${TS}`,
  });

  const product = await Product.create({
    nameVi: `__E2E_Product_${TS}`,
    nameEn: `__E2E_Product_${TS}`,
    baseName: `__E2E_Product_${TS}`,
    slug: `e2e-product-${TS}`,
    basePrice: 3_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 100,
    ...overrides,
  });

  const variant = await ProductVariant.create({
    productId: product.id,
    sku: `E2E-VAR-${TS}`,
    variantName: 'Mặc định',
    price: 3_000_000,
    stockQuantity: 100,
    isDefault: true,
  });

  return { product, variant, cat, brand };
}

module.exports = { app, request, createE2EUser, createE2EAdmin, createE2EProduct };
