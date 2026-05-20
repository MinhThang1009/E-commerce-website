/**
 * Integration tests — Admin module với DB thật.
 * Test: dashboard stats queries, audit log, order management.
 */
require('module-alias/register');
const sequelize = require('@config/sequelize');
const {
  User,
  Order,
  OrderItem,
  Product,
  ProductVariant,
  Category,
  Brand,
  AuditLog,
} = require('@models');
const { Op, fn, col, literal } = require('sequelize');

const TS = Date.now();
let admin, customer, product;

beforeAll(async () => {
  await sequelize.authenticate();
  admin = await User.create({
    firstName: '__INT_Admin',
    lastName: 'Admin',
    email: `__int_admin_${TS}@t.com`,
    password: 'Admin123!',
    role: 'admin',
  });
  customer = await User.create({
    firstName: '__INT_Admin',
    lastName: 'Customer',
    email: `__int_admin_cust_${TS}@t.com`,
    password: 'Cust123!',
    role: 'customer',
  });

  const cat = await Category.create({
    nameVi: `__INT_Admin_Cat_${TS}`,
    nameEn: `__INT_Admin_Cat_${TS}`,
    slug: `int-admin-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_Admin_Brand_${TS}`,
    nameEn: `__INT_Admin_Brand_${TS}`,
    slug: `int-admin-brand-${TS}`,
  });
  product = await Product.create({
    nameVi: `__INT_Admin_Product_${TS}`,
    nameEn: `__INT_Admin_Product_${TS}`,
    baseName: `__INT_Admin_Product_${TS}`,
    slug: `int-admin-product-${TS}`,
    basePrice: 3_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 50,
  });
  await ProductVariant.create({
    productId: product.id,
    sku: `INT-ADMIN-${TS}`,
    variantName: 'Base',
    price: 3_000_000,
    stockQuantity: 50,
    isDefault: true,
  });
});

afterAll(async () => {
  await AuditLog.destroy({ where: { adminId: admin?.id }, force: true });
  await OrderItem.destroy({ where: {}, force: true });
  await Order.destroy({ where: { number: { [Op.like]: `INT-ADMIN-${TS}%` } }, force: true });
  if (product) await product.destroy({ force: true });
  if (customer) await customer.destroy({ force: true });
  if (admin) await admin.destroy({ force: true });
});

describe('Admin Integration — Dashboard Stats', () => {
  beforeAll(async () => {
    // Tạo 3 orders: 2 paid, 1 pending
    const orderBase = {
      userId: customer.id,
      shippingFirstName: '__INT',
      shippingLastName: 'Admin',
      shippingAddress1: '1 St',
      shippingCity: 'HCM',
      billingFirstName: '__INT',
      billingLastName: 'Admin',
      billingAddress1: '1 St',
      billingCity: 'HCM',
      subtotal: 3_000_000,
      tax: 0,
      shippingCost: 0,
      total: 3_000_000,
    };
    await Order.create({
      ...orderBase,
      number: `INT-ADMIN-${TS}-1`,
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
    });
    await Order.create({
      ...orderBase,
      number: `INT-ADMIN-${TS}-2`,
      status: 'processing',
      paymentMethod: 'vnpay',
      paymentStatus: 'paid',
    });
    await Order.create({
      ...orderBase,
      number: `INT-ADMIN-${TS}-3`,
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
    });
  });

  test('Đếm tổng đơn hàng', async () => {
    const count = await Order.count({ where: { number: { [Op.like]: `INT-ADMIN-${TS}%` } } });
    expect(count).toBe(3);
  });

  test('Đếm đơn hàng theo paymentStatus', async () => {
    const paid = await Order.count({
      where: { number: { [Op.like]: `INT-ADMIN-${TS}%` }, paymentStatus: 'paid' },
    });
    expect(paid).toBe(2);
  });

  test('Tổng doanh thu từ đơn đã thanh toán', async () => {
    const result = await Order.findOne({
      where: { number: { [Op.like]: `INT-ADMIN-${TS}%` }, paymentStatus: 'paid' },
      attributes: [[fn('SUM', col('total')), 'revenue']],
      raw: true,
    });
    expect(Number(result.revenue)).toBe(6_000_000); // 2 orders × 3M
  });

  test('Đếm đơn hàng theo status group', async () => {
    const groups = await Order.findAll({
      where: { number: { [Op.like]: `INT-ADMIN-${TS}%` } },
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    });
    const map = Object.fromEntries(groups.map((g) => [g.status, Number(g.count)]));
    expect(map['delivered']).toBe(1);
    expect(map['processing']).toBe(1);
    expect(map['pending']).toBe(1);
  });

  test('Đếm user mới theo role', async () => {
    const customerCount = await User.count({
      where: { email: { [Op.like]: `__int_admin%_${TS}@t.com` }, role: 'customer' },
    });
    expect(customerCount).toBe(1);
  });
});

describe('Admin Integration — Audit Log', () => {
  test('Ghi audit log khi admin thực hiện action', async () => {
    const log = await AuditLog.create({
      adminId: admin.id,
      action: 'UPDATE_PRODUCT',
      entityType: 'product',
      entityId: product.id,
      changes: JSON.stringify({ basePrice: { before: 3_000_000, after: 2_800_000 } }),
      ipAddress: '127.0.0.1',
    });
    expect(log.id).toBeDefined();
    expect(log.action).toBe('UPDATE_PRODUCT');
  });

  test('Lấy audit log theo adminId', async () => {
    const logs = await AuditLog.findAll({ where: { adminId: admin.id } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.every((l) => l.adminId === admin.id)).toBe(true);
  });

  test('Lấy audit log theo entityType + entityId', async () => {
    const logs = await AuditLog.findAll({
      where: { adminId: admin.id, entityType: 'product', entityId: product.id },
    });
    expect(logs.length).toBeGreaterThan(0);
    // Verify log tồn tại và entityId đúng
    expect(logs[0].entityId).toBe(product.id);
    expect(logs[0].action).toBe('UPDATE_PRODUCT');
  });

  test('Audit log có timestamps', async () => {
    const log = await AuditLog.findOne({ where: { adminId: admin.id } });
    expect(log.createdAt).toBeInstanceOf(Date);
  });
});

describe('Admin Integration — Product management', () => {
  test('Admin update product status', async () => {
    await product.update({ status: 'inactive' });
    await product.reload();
    expect(product.status).toBe('inactive');
    await product.update({ status: 'active' }); // restore
  });

  test('Lấy tất cả sản phẩm với filter status', async () => {
    const active = await Product.findAll({
      where: { nameVi: { [Op.like]: `__INT_Admin_Product_${TS}` }, status: 'active' },
    });
    expect(active.length).toBe(1);
  });

  test('Soft delete + paranoid restore', async () => {
    const temp = await Product.create({
      nameVi: `__INT_Admin_Temp_${TS}`,
      nameEn: `__INT_Admin_Temp_${TS}`,
      baseName: `__INT_Admin_Temp_${TS}`,
      slug: `int-admin-temp-${TS}`,
      basePrice: 1_000_000,
      categoryId: product.categoryId,
      brandId: product.brandId,
      status: 'active',
      stockQuantity: 1,
    });
    await temp.destroy(); // soft delete
    const notFound = await Product.findByPk(temp.id);
    expect(notFound).toBeNull();
    // Hard delete để cleanup
    await Product.destroy({ where: { id: temp.id }, force: true });
  });
});
