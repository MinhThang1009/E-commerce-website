/**
 * logger.mutation-kill.test.js
 *
 * Kill mutant logger (DEV_FORMAT printf): icon theo level, level uppercase+padEnd,
 * formatSplat (object→JSON, primitive→String, join " "), timestamp format, template ghép.
 * Lưu ý: màu ANSI KHÔNG xuất hiện trong jest (process.stdout.isTTY=false) → mutant màu là
 * equivalent trong test, chấp nhận.
 */

const logger = require('@utils/logger');

function capture(fn) {
  const lines = [];
  const spy = jest.spyOn(process.stdout, 'write').mockImplementation((s) => {
    lines.push(s);
    return true;
  });
  fn();
  spy.mockRestore();
  return lines.join('');
}

describe('logger DEV format', () => {
  it('info → icon ✅ + level "INFO" + message', () => {
    const out = capture(() => logger.info('hello world'));
    expect(out).toContain('✅');
    expect(out).toContain('INFO');
    expect(out).toContain('hello world');
  });

  it('error → icon ❌ + "ERROR"', () => {
    const out = capture(() => logger.error('boom'));
    expect(out).toContain('❌');
    expect(out).toContain('ERROR');
  });

  it('warn → icon ⚠️ + "WARN"', () => {
    const out = capture(() => logger.warn('careful'));
    expect(out).toContain('⚠️');
    expect(out).toContain('WARN');
  });

  it('debug → icon 🔍 + "DEBUG"', () => {
    const out = capture(() => logger.debug('dbg'));
    expect(out).toContain('🔍');
    expect(out).toContain('DEBUG');
  });

  it('formatSplat: object splat → JSON.stringify', () => {
    const out = capture(() => logger.info('msg', { a: 1 }));
    expect(out).toContain('msg {"a":1}');
  });

  it('không splat → chỉ message (không thừa khoảng trắng cuối message)', () => {
    const out = capture(() => logger.info('plain'));
    expect(out).toMatch(/INFO\s+plain/);
    expect(out).not.toContain('plain ');
  });

  it('timestamp format [YYYY-MM-DD HH:mm:ss]', () => {
    const out = capture(() => logger.info('x'));
    expect(out).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
  });
});
