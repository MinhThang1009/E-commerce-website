/**
 * @file languageDetector.test.js
 * @description Tests cho languageDetector — covers cả VI_NO_ACCENT branch (line 13).
 */

const { detectLanguage } = require('./language-detector');

describe('detectLanguage', () => {
  test('vi khi có dấu tiếng Việt', () => {
    expect(detectLanguage('điện thoại iPhone')).toBe('vi');
  });

  // Line 13: VI_NO_ACCENT pattern — tiếng Việt không dấu
  test('vi khi text khớp VI_NO_ACCENT — "gia bao nhieu" (line 13)', () => {
    expect(detectLanguage('gia bao nhieu')).toBe('vi');
  });
  test('vi khi text là "dien thoai"', () => {
    expect(detectLanguage('dien thoai samsung')).toBe('vi');
  });
  test('vi khi text là "tim kiem san pham"', () => {
    expect(detectLanguage('ban co khong')).toBe('vi');
  });

  test('en khi không khớp VI pattern', () => {
    expect(detectLanguage('iphone 15 price')).toBe('en');
  });
  test('en với text tiếng Anh thuần túy', () => {
    expect(detectLanguage('best laptop for gaming')).toBe('en');
  });
});
