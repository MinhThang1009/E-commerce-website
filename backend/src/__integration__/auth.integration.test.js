require('module-alias/register');
const sequelize = require('@config/sequelize');
const { User } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await User.destroy({ where: { email: { [Op.like]: `__int_auth_${TS}%` } }, force: true });
});

describe('Auth Integration — User', () => {
  let user;

  test('Tạo user — password hash tự động qua hook', async () => {
    user = await User.create({
      firstName: '__INT_Auth',
      lastName: 'Test',
      email: `__int_auth_${TS}@test.com`,
      password: 'PlainPassword123!',
      role: 'customer',
    });

    expect(user.id).toBeDefined();
    // Hook beforeCreate hash password — không lưu plain text
    expect(user.password).not.toBe('PlainPassword123!');
    expect(user.password.length).toBeGreaterThan(20);
  });

  test('Tìm user theo email', async () => {
    const found = await User.findOne({ where: { email: `__int_auth_${TS}@test.com` } });
    expect(found).not.toBeNull();
    expect(found.id).toBe(user.id);
    expect(found.firstName).toBe('__INT_Auth');
  });

  test('Update firstName', async () => {
    await user.update({ firstName: '__INT_Auth_Updated' });
    await user.reload();
    expect(user.firstName).toBe('__INT_Auth_Updated');
  });

  test('Email unique — tạo duplicate bị reject', async () => {
    await expect(
      User.create({
        firstName: 'Dup',
        lastName: 'User',
        email: `__int_auth_${TS}@test.com`,
        password: 'Another123!',
        role: 'customer',
      }),
    ).rejects.toThrow();
  });

  test('isEmailVerified default false', async () => {
    expect(user.isEmailVerified).toBe(false);
    await user.update({ isEmailVerified: true });
    await user.reload();
    expect(user.isEmailVerified).toBe(true);
  });

  test('Soft delete user — tìm bình thường không thấy, paranoid:false thấy', async () => {
    const tempUser = await User.create({
      firstName: '__INT_Del',
      lastName: 'User',
      email: `__int_auth_del_${TS}@test.com`,
      password: 'Delete123!',
      role: 'customer',
    });
    await tempUser.destroy();
    const notFound = await User.findByPk(tempUser.id);
    expect(notFound).toBeNull();
    const found = await User.findByPk(tempUser.id, { paranoid: false });
    expect(found).not.toBeNull();
    expect(found.deletedAt).not.toBeNull();
    await found.destroy({ force: true });
  });
});
