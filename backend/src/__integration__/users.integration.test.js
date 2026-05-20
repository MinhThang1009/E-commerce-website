require('module-alias/register');
const sequelize = require('@config/sequelize');
const { User, Address } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let testUser;

beforeAll(async () => {
  await sequelize.authenticate();
  testUser = await User.create({
    firstName: '__INT_Users',
    lastName: 'Test',
    email: `__int_users_${TS}@test.com`,
    password: 'Test123!',
    role: 'customer',
  });
});

afterAll(async () => {
  await Address.destroy({ where: { userId: testUser.id }, force: true });
  await testUser.destroy({ force: true });
});

describe('Users Integration — Address', () => {
  let addr1, addr2;

  test('Tạo địa chỉ mặc định', async () => {
    addr1 = await Address.create({
      userId: testUser.id,
      firstName: '__INT',
      lastName: 'Addr',
      address1: '123 Test St',
      city: 'HCM',
      state: 'HCM',
      zip: '70000',
      country: 'VN',
      phone: '0900000001',
      isDefault: true,
    });
    expect(addr1.id).toBeDefined();
    expect(addr1.isDefault).toBe(true);
  });

  test('Tạo địa chỉ thứ 2 không default', async () => {
    addr2 = await Address.create({
      userId: testUser.id,
      firstName: '__INT',
      lastName: 'Addr2',
      address1: '456 Test Ave',
      city: 'HN',
      state: 'HN',
      zip: '10000',
      country: 'VN',
      phone: '0900000002',
      isDefault: false,
    });
    expect(addr2.isDefault).toBe(false);
  });

  test('Đổi default sang addr2', async () => {
    await addr1.update({ isDefault: false });
    await addr2.update({ isDefault: true });
    await addr2.reload();
    expect(addr2.isDefault).toBe(true);
  });

  test('Update city', async () => {
    await addr1.update({ city: 'DN' });
    await addr1.reload();
    expect(addr1.city).toBe('DN');
  });

  test('Lấy tất cả địa chỉ của user', async () => {
    const addrs = await Address.findAll({ where: { userId: testUser.id } });
    expect(addrs.length).toBe(2);
  });

  test('Xóa địa chỉ', async () => {
    await addr1.destroy();
    const remaining = await Address.findAll({ where: { userId: testUser.id } });
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(addr2.id);
  });
});
