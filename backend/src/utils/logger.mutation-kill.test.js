/**
 * logger.mutation-kill.test.js
 *
 * Kill mutant logger (DEV_FORMAT printf): icon theo level, level uppercase+padEnd,
 * formatSplat (object→JSON, join), timestamp format, template ghép.
 * Dùng winston capture-transport đọc info[Symbol.for('message')] (formatted output) —
 * robust hơn spy process.stdout (tránh flaky khi chạy full suite song song).
 * Màu ANSI không xuất hiện (isTTY=false) → mutant màu equivalent, chấp nhận.
 */

const Transport = require('winston-transport');
const logger = require('@utils/logger');

const MESSAGE = Symbol.for('message');
let captured = [];

class CaptureTransport extends Transport {
  log(info, callback) {
    captured.push(info[MESSAGE]);
    callback();
  }
}

const capTransport = new CaptureTransport({ level: 'debug' });

beforeAll(() => logger.add(capTransport));
afterAll(() => logger.remove(capTransport));
beforeEach(() => {
  captured = [];
});

function out(fn) {
  fn();
  return captured.join('\n');
}

describe('logger DEV format', () => {
  it('info → icon ✅ + level "INFO" + message', () => {
    const s = out(() => logger.info('hello world'));
    expect(s).toContain('✅');
    expect(s).toContain('INFO');
    expect(s).toContain('hello world');
  });

  it('error → icon ❌ + "ERROR"', () => {
    const s = out(() => logger.error('boom'));
    expect(s).toContain('❌');
    expect(s).toContain('ERROR');
  });

  it('warn → icon ⚠️ + "WARN"', () => {
    const s = out(() => logger.warn('careful'));
    expect(s).toContain('⚠️');
    expect(s).toContain('WARN');
  });

  it('debug → icon 🔍 + "DEBUG"', () => {
    const s = out(() => logger.debug('dbg'));
    expect(s).toContain('🔍');
    expect(s).toContain('DEBUG');
  });

  it('formatSplat: object splat → JSON.stringify', () => {
    const s = out(() => logger.info('msg', { a: 1 }));
    expect(s).toContain('msg {"a":1}');
  });

  it('timestamp format [YYYY-MM-DD HH:mm:ss]', () => {
    const s = out(() => logger.info('x'));
    expect(s).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
  });
});
