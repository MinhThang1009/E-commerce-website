require('module-alias/register');
const sequelize = require('@config/sequelize');
const { User, Address } = require('@models');

const TS = Date.now();
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

describe('Users Integration — Extra', () => {
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
