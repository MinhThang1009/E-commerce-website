/**
 * @file admin-validator.test.js
 * @description Unit tests cho admin Zod validators — tập trung vào preprocess functions
 */

'use strict';

const { paginationSchema } = require('./admin-validator');

describe('admin-validator — paginationSchema', () => {
  describe('isEmailVerified preprocess', () => {
    test('"true" string → boolean true', () => {
      const result = paginationSchema.parse({ isEmailVerified: 'true' });
      expect(result.isEmailVerified).toBe(true);
    });

    test('"false" string → boolean false', () => {
      const result = paginationSchema.parse({ isEmailVerified: 'false' });
      expect(result.isEmailVerified).toBe(false);
    });

    test('boolean true → pass-through as true', () => {
      const result = paginationSchema.parse({ isEmailVerified: true });
      expect(result.isEmailVerified).toBe(true);
    });

    test('undefined → undefined (optional)', () => {
      const result = paginationSchema.parse({});
      expect(result.isEmailVerified).toBeUndefined();
    });

    test('string khác "true"/"false" → giữ nguyên value (pass-through)', () => {
      // preprocess trả về giá trị gốc khi không phải 'true' hay 'false'
      // z.boolean().optional() sẽ fail với string khác
      // Test với empty string → false theo boolean coercion
      expect(() => paginationSchema.parse({ isEmailVerified: 'other' })).toThrow();
    });
  });

  describe('isActive preprocess', () => {
    test('"true" string → boolean true', () => {
      const result = paginationSchema.parse({ isActive: 'true' });
      expect(result.isActive).toBe(true);
    });

    test('"false" string → boolean false', () => {
      const result = paginationSchema.parse({ isActive: 'false' });
      expect(result.isActive).toBe(false);
    });

    test('boolean false → pass-through as false', () => {
      const result = paginationSchema.parse({ isActive: false });
      expect(result.isActive).toBe(false);
    });

    test('undefined → undefined (optional)', () => {
      const result = paginationSchema.parse({});
      expect(result.isActive).toBeUndefined();
    });
  });
});
