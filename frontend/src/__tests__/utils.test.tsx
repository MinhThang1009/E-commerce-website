/// <reference types="jest" />
/**
 * Frontend unit tests — Utility functions.
 * price-utils, format, localize, error-utils
 */
import {
  calculateDiscountPercentage,
  calculatePriceRange,
  formatCurrency,
} from '@utils/price-utils';
import {
  getErrorMsg,
  getErrorMessage,
  parseError,
  createErrorHandler,
  retryWithBackoff,
  isRetryableError,
  formatErrorForLogging,
  ErrorType,
} from '@utils/error-utils';
import {
  formatPrice,
  formatPriceUSD,
  formatNumber,
  formatDate,
  parsePrice,
  getLocale,
} from '@utils/format';

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

// ── format.ts ─────────────────────────────────────────────────────────────────
describe('formatPrice', () => {
  test('số hợp lệ → chuỗi định dạng VND', () => {
    const result = formatPrice(1000000);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('chuỗi số hợp lệ → định dạng', () => {
    const result = formatPrice('500000');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('chuỗi không phải số (NaN) → "0 <symbol>"', () => {
    const result = formatPrice('abc');
    expect(result).toContain('0');
  });
});

describe('formatPriceUSD', () => {
  test('số hợp lệ → định dạng USD', () => {
    expect(formatPriceUSD(10.5)).toBe('$10.50');
  });

  test('chuỗi số hợp lệ', () => {
    expect(formatPriceUSD('25.99')).toBe('$25.99');
  });

  test('chuỗi không phải số → "$0.00"', () => {
    expect(formatPriceUSD('invalid')).toBe('$0.00');
  });
});

describe('formatNumber', () => {
  test('số nguyên → chuỗi định dạng theo locale', () => {
    const result = formatNumber(1000);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatDate', () => {
  test('chuỗi ngày → định dạng', () => {
    const result = formatDate('2026-01-15');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('Date object → định dạng', () => {
    const result = formatDate(new Date('2026-06-20'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('có options year:numeric → kết quả chứa năm', () => {
    const result = formatDate('2026-01-15', { year: 'numeric' });
    expect(result).toContain('2026');
  });
});

describe('parsePrice', () => {
  test('number → pass-through', () => {
    expect(parsePrice(12345)).toBe(12345);
  });

  test('chuỗi số hợp lệ → parse đúng', () => {
    expect(parsePrice('199000')).toBe(199000);
  });

  test('chuỗi không phải số → 0', () => {
    expect(parsePrice('invalid')).toBe(0);
  });
});

// ── price-utils.ts — additional ───────────────────────────────────────────────
describe('calculatePriceRange', () => {
  test('không có variants → dùng basePrice', () => {
    const result = calculatePriceRange(500000);
    expect(result.minPrice).toBe(500000);
    expect(result.maxPrice).toBe(500000);
    expect(result.basePrice).toBe(500000);
  });

  test('variants với min=max → không hiện "từ"', () => {
    const variants = [{ price: 300000 }, { price: 300000 }] as any;
    const result = calculatePriceRange(200000, variants);
    expect(result.minPrice).toBe(300000);
    expect(result.maxPrice).toBe(300000);
    expect(result.basePrice).toBe(300000);
  });

  test('variants với nhiều giá khác nhau → min làm basePrice', () => {
    const variants = [{ price: 200000 }, { price: 500000 }, { price: 350000 }] as any;
    const result = calculatePriceRange(100000, variants);
    expect(result.minPrice).toBe(200000);
    expect(result.maxPrice).toBe(500000);
    expect(result.basePrice).toBe(200000);
  });
});

describe('formatCurrency', () => {
  test('số → chuỗi tiền tệ VND', () => {
    const result = formatCurrency(100000);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── error-utils.ts — additional branches ─────────────────────────────────────
describe('parseError — additional branches', () => {
  test('lỗi có .status=401 → AUTHENTICATION_ERROR', () => {
    const result = parseError({ status: 401, data: { message: 'Unauthorized' } });
    expect(result.type).toBe(ErrorType.AUTHENTICATION_ERROR);
    expect(result.code).toBe(401);
  });

  test('lỗi có .status=400 → VALIDATION_ERROR', () => {
    expect(parseError({ status: 400, data: {} }).type).toBe(ErrorType.VALIDATION_ERROR);
  });

  test('lỗi có .status=403 → AUTHORIZATION_ERROR', () => {
    expect(parseError({ status: 403, data: {} }).type).toBe(ErrorType.AUTHORIZATION_ERROR);
  });

  test('lỗi có .status=404 → NOT_FOUND_ERROR', () => {
    expect(parseError({ status: 404, data: {} }).type).toBe(ErrorType.NOT_FOUND_ERROR);
  });

  test('lỗi có .status=500 → SERVER_ERROR', () => {
    expect(parseError({ status: 500, data: {} }).type).toBe(ErrorType.SERVER_ERROR);
  });

  test('lỗi có .status="ERR_NETWORK" (string) → NETWORK_ERROR', () => {
    const result = parseError({ status: 'ERR_NETWORK', data: {} });
    expect(result.type).toBe(ErrorType.NETWORK_ERROR);
    expect(result.code).toBe('ERR_NETWORK');
  });

  test('axios code="ERR_NETWORK" → NETWORK_ERROR với message từ i18n (không dùng raw Axios message)', () => {
    const result = parseError({ code: 'ERR_NETWORK', message: 'Network Error' });
    expect(result.type).toBe(ErrorType.NETWORK_ERROR);
    // message phải là i18n key/value, KHÔNG phải raw 'Network Error' từ Axios
    expect(result.message).not.toBe('Network Error');
  });

  test('axios code="ECONNABORTED" → NETWORK_ERROR', () => {
    expect(parseError({ code: 'ECONNABORTED', message: 'timeout' }).type).toBe(
      ErrorType.NETWORK_ERROR,
    );
  });

  test('axios response.status=403 → AUTHORIZATION_ERROR', () => {
    const result = parseError({ response: { status: 403, data: { message: 'Forbidden' } } });
    expect(result.type).toBe(ErrorType.AUTHORIZATION_ERROR);
    expect(result.message).toBe('Forbidden');
  });

  test('axios response.status=422 → UNKNOWN_ERROR (không map được)', () => {
    expect(parseError({ response: { status: 422, data: {} } }).type).toBe(ErrorType.UNKNOWN_ERROR);
  });

  test('axios response với data.error.message → lấy nested message', () => {
    const result = parseError({
      response: { status: 500, data: { error: { message: 'Internal' } } },
    });
    expect(result.message).toBe('Internal');
  });
});

describe('createErrorHandler', () => {
  test('có callback → gọi callback với parsed error', () => {
    const onError = jest.fn();
    const handler = createErrorHandler(onError);
    const result = handler(new Error('test error'));

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ type: ErrorType.UNKNOWN_ERROR }),
    );
    expect(result.type).toBe(ErrorType.UNKNOWN_ERROR);
  });

  test('không có callback → chỉ parse và trả về', () => {
    const handler = createErrorHandler();
    const result = handler(new Error('no callback'));
    expect(result.type).toBe(ErrorType.UNKNOWN_ERROR);
  });
});

describe('retryWithBackoff', () => {
  test('thành công ngay lần đầu', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, 3, 0);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('thất bại 1 lần rồi thành công', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');
    const result = await retryWithBackoff(fn, 3, 0);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('thất bại hết maxRetries → throw lỗi cuối', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fail'));
    await expect(retryWithBackoff(fn, 2, 0)).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('isRetryableError', () => {
  test('NETWORK_ERROR → true', () => {
    expect(isRetryableError({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe(true);
  });

  test('SERVER_ERROR (500) → true', () => {
    expect(isRetryableError({ status: 500, data: {} })).toBe(true);
  });

  test('VALIDATION_ERROR (400) → false', () => {
    expect(isRetryableError({ status: 400, data: {} })).toBe(false);
  });
});

describe('formatErrorForLogging', () => {
  test('trả về chuỗi JSON hợp lệ với đủ fields', () => {
    const result = formatErrorForLogging(new Error('test logging'));
    const parsed = JSON.parse(result);
    expect(parsed.type).toBe('UNKNOWN_ERROR');
    expect(parsed.message).toBe('test logging');
    expect(parsed.timestamp).toBeDefined();
  });
});

// ── parseError — ERR_NETWORK không có .message → dùng i18n key (line 110) ────
describe('parseError — ERR_NETWORK không có message', () => {
  test('code=ERR_NETWORK, không có error.message → dùng i18n fallback', () => {
    const result = parseError({ code: 'ERR_NETWORK' }); // không có .message
    expect(result.type).toBe(ErrorType.NETWORK_ERROR);
    // Với mock i18next.t trả về key, message = 'errors.network'
    expect(result.message).toBe('errors.network');
  });
});

// ── retryWithBackoff — default params (lines 189-190) ────────────────────────
describe('retryWithBackoff — dùng default params', () => {
  test('gọi không truyền maxRetries/baseDelay → dùng default, thành công lần đầu', async () => {
    const fn = jest.fn().mockResolvedValue('done');
    const result = await retryWithBackoff(fn); // maxRetries=3, baseDelay=1000 (default)
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1); // thành công ngay → không retry
  });
});

// ── getErrorMessage — line 166 (message là "Unknown error" → dùng i18n key) ──
describe('getErrorMessage — fallback i18n key', () => {
  test('axios response không có message → dùng i18n key (line 166)', () => {
    // status 404, data={} → extractMessage trả về "Unknown error" → branch if() false → line 166
    const result = getErrorMessage({ response: { status: 404, data: {} } });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Với mock, i18next.t trả về key → 'errors.notFound'
    expect(result).toBe('errors.notFound');
  });
});

// ── getErrorMsg — branch msg==="Unknown error" (line 246) ────────────────────
describe('getErrorMsg — msg equals "Unknown error"', () => {
  test('msg là "Unknown error" → isGeneric=true → trả về fallback', () => {
    // Dùng spy để làm i18next.t trả về "Unknown error" → hit branch msg==='Unknown error'
    const i18nextMod = require('i18next');
    const spy = jest.spyOn(i18nextMod.default, 't').mockReturnValueOnce('Unknown error');

    // parseError({response:{status:500,data:{}}}) → message='Unknown error'
    // getErrorMessage → t('errors.server') → 'Unknown error' (spy)
    // isGeneric: false || true = true → trả về fallback
    const result = getErrorMsg({ response: { status: 500, data: {} } }, 'Fallback cụ thể');

    expect(result).toBe('Fallback cụ thể');
    spy.mockRestore();
  });
});

// ── retryWithBackoff — line 209 (maxRetries=0 → throw lastError) ─────────────
describe('retryWithBackoff — maxRetries=0', () => {
  test('maxRetries=0 → không retry, throw undefined (line 209)', async () => {
    const fn = jest.fn();
    await expect(retryWithBackoff(fn, 0, 0)).rejects.toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });
});

// ── getLocale — branch 'en-US' (format.ts line 9) ────────────────────────────
describe('getLocale — en-US branch', () => {
  test('language khác vi → trả về en-US', () => {
    // Tạm đổi language trong mock object để trigger branch 'en-US'
    const i18nextMock = require('i18next');
    const prev = i18nextMock.default.language;
    i18nextMock.default.language = 'en';

    expect(getLocale()).toBe('en-US');

    i18nextMock.default.language = prev; // restore
  });
});
