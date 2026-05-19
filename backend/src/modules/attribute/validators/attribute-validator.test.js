process.env.NODE_ENV = 'test';

const {
  createGroupSchema,
  updateGroupSchema,
  addValueSchema,
  previewNameSchema,
} = require('./attribute-validator');

test('createGroupSchema parse dữ liệu hợp lệ', () => {
  const result = createGroupSchema.safeParse({ name: 'Màu sắc' });
  expect(result.success).toBe(true);
});

test('updateGroupSchema parse partial data', () => {
  const result = updateGroupSchema.safeParse({ isActive: false });
  expect(result.success).toBe(true);
});

test('addValueSchema parse dữ liệu hợp lệ', () => {
  const result = addValueSchema.safeParse({ name: 'Đỏ' });
  expect(result.success).toBe(true);
});

test('previewNameSchema parse dữ liệu hợp lệ', () => {
  const result = previewNameSchema.safeParse({ baseName: 'Laptop' });
  expect(result.success).toBe(true);
});
