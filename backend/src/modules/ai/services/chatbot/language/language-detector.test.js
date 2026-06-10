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
  test('vi khi text là "ban co khong"', () => {
    expect(detectLanguage('ban co khong')).toBe('vi');
  });

  test('en khi không khớp VI pattern', () => {
    expect(detectLanguage('iphone 15 price')).toBe('en');
  });
  test('en với text tiếng Anh thuần túy', () => {
    expect(detectLanguage('best laptop for gaming')).toBe('en');
  });

  // Verifies [M3]: từ tiếng Anh thông dụng (camera/ram/chip/pin/ban/hang) không còn
  // bị nhận nhầm là tiếng Việt không dấu → user tiếng Anh nhận đúng response tiếng Anh
  test('en với câu hỏi tiếng Anh chứa "camera"', () => {
    expect(detectLanguage('which phone has the best camera')).toBe('en');
  });
  test('en với câu hỏi tiếng Anh chứa "ram" và "chip"', () => {
    expect(detectLanguage('laptop with 16gb ram and fast chip')).toBe('en');
  });
  test('en với câu chứa "pin" và "hang"', () => {
    expect(detectLanguage('pin this product please hang on')).toBe('en');
  });
  test('vi khi gõ không dấu "bo nho" (sửa typo bon nho)', () => {
    expect(detectLanguage('may nay bo nho bao nhieu')).toBe('vi');
  });

  // Verifies [M13]: ĩ/ũ (U+0129/U+0169) nằm ngoài dải Ạ-ỹ — từng bị miss
  test('vi khi diacritic duy nhất là ũ ("cũ")', () => {
    expect(detectLanguage('iphone cũ ok ko shop')).toBe('vi');
  });
  test('vi khi diacritic duy nhất là ĩ ("kĩ")', () => {
    expect(detectLanguage('test kĩ chưa shop')).toBe('vi');
  });
});
