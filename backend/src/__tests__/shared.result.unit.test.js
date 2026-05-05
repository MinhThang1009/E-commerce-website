// Phase 42.1 — Unit tests cho shared/result wrapper
const Result = require('../shared/result');

describe('shared/result', () => {
  test('Result.ok wraps value, ok=true, error=null', () => {
    const r = Result.ok({ id: 1 });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ id: 1 });
    expect(r.error).toBeNull();
  });

  test('Result.fail wraps error code + details', () => {
    const r = Result.fail('NOT_FOUND', { id: 5 });
    expect(r.ok).toBe(false);
    expect(r.value).toBeNull();
    expect(r.error).toBe('NOT_FOUND');
    expect(r.details).toEqual({ id: 5 });
  });

  test('Result.fail không details → details=null', () => {
    const r = Result.fail('SOME_ERROR');
    expect(r.details).toBeNull();
  });

  test('Result.isOk / Result.isFail predicates', () => {
    expect(Result.isOk(Result.ok(1))).toBe(true);
    expect(Result.isOk(Result.fail('e'))).toBe(false);
    expect(Result.isFail(Result.fail('e'))).toBe(true);
    expect(Result.isFail(Result.ok(1))).toBe(false);
    expect(Result.isOk(null)).toBe(false);
    expect(Result.isFail(undefined)).toBe(false);
  });
});
