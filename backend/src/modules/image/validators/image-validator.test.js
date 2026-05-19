process.env.NODE_ENV = 'test';

const { uploadSchema, base64Schema } = require('./image-validator');

test('uploadSchema parse dữ liệu mặc định', () => {
  const result = uploadSchema.safeParse({});
  expect(result.success).toBe(true);
});

test('base64Schema parse dữ liệu hợp lệ', () => {
  const result = base64Schema.safeParse({ base64Data: 'abc123' });
  expect(result.success).toBe(true);
});

test('base64Schema fail khi thiếu base64Data', () => {
  const result = base64Schema.safeParse({});
  expect(result.success).toBe(false);
});
