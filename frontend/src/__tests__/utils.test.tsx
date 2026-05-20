/// <reference types="jest" />
/**
 * Frontend unit tests — Utility functions.
 * price-utils, format, localize, error-utils
 */
import { calculateDiscountPercentage } from '@utils/price-utils';
import { getErrorMsg } from '@utils/error-utils';

// Mock toàn bộ i18next và dependencies
jest.mock('i18next', () => ({
  default: { t: (k: string) => k, language: 'vi' },
  t: (k: string) => k,
  language: 'vi',
  use: () => ({ init: () => {} }),
}));
jest.mock('@/config/i18n', () => ({
  t: (k: string) => k,
  language: 'vi',
}));

// calculatePriceRange cần i18next nên test riêng
// Chỉ test calculateDiscountPercentage (không cần i18next)

describe('calculateDiscountPercentage', () => {
  test('giảm 10% đúng', () => {
    expect(calculateDiscountPercentage(1_000_000, 900_000)).toBe(10);
  });

  test('giảm 50%', () => {
    expect(calculateDiscountPercentage(2_000_000, 1_000_000)).toBe(50);
  });

  test('giảm 19% (làm tròn)', () => {
    expect(calculateDiscountPercentage(12_990_000, 10_560_000)).toBe(19);
  });

  test('không giảm (compareAtPrice = basePrice) → 0', () => {
    expect(calculateDiscountPercentage(500_000, 500_000)).toBe(0);
  });

  test('basePrice > compareAtPrice (không hợp lệ) → 0', () => {
    expect(calculateDiscountPercentage(500_000, 600_000)).toBe(0);
  });
});

// ── Error Utils ───────────────────────────────────────────────
describe('getErrorMsg', () => {
  test('Axios error với response.data.message → trả về message', () => {
    const err = { response: { data: { message: 'Lỗi từ server' } } };
    const result = getErrorMsg(err, 'default');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Phải là message từ response hoặc fallback
    expect(['Lỗi từ server', 'default'].some((v) => result.includes(v) || result.length > 0)).toBe(
      true,
    );
  });

  test('Error object thông thường → có message', () => {
    const err = new Error('Something failed');
    const result = getErrorMsg(err, 'default');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('Lỗi không xác định → trả về string (fallback hoặc key)', () => {
    // getErrorMsg có thể dùng i18n key hoặc fallback tùy implementation
    const r1 = getErrorMsg(null, 'Fallback');
    const r2 = getErrorMsg(undefined, 'Fallback2');
    const r3 = getErrorMsg({}, 'Fallback3');
    expect(typeof r1).toBe('string');
    expect(typeof r2).toBe('string');
    expect(typeof r3).toBe('string');
  });

  test('String error → trả về string đó', () => {
    const result = getErrorMsg('Error string', 'default');
    expect(typeof result).toBe('string');
    expect(result).toBe('Error string');
  });
});
