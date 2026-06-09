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

describe('Users Integration — Extra', () => {
  let testUser;

  beforeAll(async () => {
    await sequelize.authenticate();
    testUser = await User.create({
      firstName: '__INT_UsersX',
      lastName: 'Test',
      email: `__int_usersx_${TS}@test.com`,
      password: 'Test123!',
      role: 'customer',
    });
  });

  afterAll(async () => {
    await Address.destroy({ where: { userId: testUser.id }, force: true });
    await testUser.destroy({ force: true });
  });

  test('Tạo địa chỉ → findAll trả đúng userId', async () => {
    await Address.create({
      userId: testUser.id,
      firstName: '__INT',
      lastName: 'AddrX1',
      address1: '10 Lý Tự Trọng',
      city: 'HCM',
      state: 'HCM',
      zip: '70000',
      country: 'VN',
      phone: '0900000010',
      isDefault: false,
    });

    const addresses = await Address.findAll({ where: { userId: testUser.id } });

    expect(addresses.length).toBeGreaterThanOrEqual(1);
    // Mọi địa chỉ trả về phải thuộc đúng user
    addresses.forEach((addr) => {
      expect(addr.userId).toBe(testUser.id);
    });
  });

  test('Set địa chỉ default → chỉ 1 địa chỉ isDefault=true', async () => {
    // Tạo thêm địa chỉ thứ 2
    await Address.create({
      userId: testUser.id,
      firstName: '__INT',
      lastName: 'AddrX2',
      address1: '20 Nguyễn Huệ',
      city: 'HCM',
      state: 'HCM',
      zip: '70000',
      country: 'VN',
      phone: '0900000011',
      isDefault: false,
    });

    const allAddrs = await Address.findAll({ where: { userId: testUser.id } });

    // Đặt tất cả về non-default, sau đó set địa chỉ đầu tiên thành default
    for (const addr of allAddrs) {
      await addr.update({ isDefault: false });
    }
    await allAddrs[0].update({ isDefault: true });

    const refreshed = await Address.findAll({ where: { userId: testUser.id } });
    const defaultAddrs = refreshed.filter((a) => a.isDefault === true);

    expect(defaultAddrs.length).toBe(1);
    expect(defaultAddrs[0].id).toBe(allAddrs[0].id);
  });
});
