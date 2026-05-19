process.env.NODE_ENV = 'test';

const { updateProfileSchema, changePasswordSchema, addressSchema } = require('./users-validator');

test('updateProfileSchema parse dữ liệu hợp lệ', () => {
  expect(updateProfileSchema.safeParse({ firstName: 'Nguyễn' }).success).toBe(true);
});

test('changePasswordSchema pass khi mật khẩu khớp', () => {
  const result = changePasswordSchema.safeParse({
    currentPassword: 'old123',
    newPassword: 'new1234',
    confirmPassword: 'new1234',
  });
  expect(result.success).toBe(true);
});

test('changePasswordSchema fail khi mật khẩu không khớp', () => {
  const result = changePasswordSchema.safeParse({
    currentPassword: 'old123',
    newPassword: 'new1234',
    confirmPassword: 'wrong',
  });
  expect(result.success).toBe(false);
});

test('addressSchema parse dữ liệu hợp lệ', () => {
  const result = addressSchema.safeParse({
    firstName: 'An',
    lastName: 'Nguyễn',
    address1: '123 Lê Lợi',
    city: 'Hà Nội',
    state: 'Hà Nội',
    zip: '100000',
    country: 'Việt Nam',
  });
  expect(result.success).toBe(true);
});
