'use strict';

/**
 * Branch coverage tests for src/utils/logger.js
 *
 * Uncovered branches (lines 18-26, 43-49):
 *   - Line 18: process.stdout.isTTY ternary — false branch (not a TTY → no colorize)
 *   - Line 26: LEVEL_ICONS[levelClean] ?? '  ' — ?? fallback when icon not found
 *   - Lines 43-49: NODE_ENV === 'production' → file transports added
 *
 * Strategy: require logger in isolated modules via jest.resetModules() so we
 * can control process.env.NODE_ENV and process.stdout.isTTY per test.
 */

describe('logger — devFormat printf (LEVEL_ICONS ?? fallback branch, line 26)', () => {
  // The printf callback uses: const icon = LEVEL_ICONS[levelClean] ?? '  ';
  // To hit the ?? right-side (fallback '  '), we need levelClean NOT in LEVEL_ICONS.
  // winston's format.printf receives a function — we capture and call it directly
  // by intercepting the winston.format.printf call.

  it('uses icon from LEVEL_ICONS when level is known (left side of ??)', () => {
    jest.resetModules();

    // Capture the printf callback by mocking winston.format.printf
    let capturedPrintf = null;
    jest.doMock('winston', () => {
      const actual = jest.requireActual('winston');
      return {
        ...actual,
        format: {
          ...actual.format,
          printf: jest.fn().mockImplementation((fn) => {
            capturedPrintf = fn;
            return actual.format.printf(fn);
          }),
          combine: actual.format.combine.bind(actual.format),
          timestamp: actual.format.timestamp.bind(actual.format),
          errors: actual.format.errors.bind(actual.format),
          splat: actual.format.splat.bind(actual.format),
          colorize: actual.format.colorize.bind(actual.format),
          json: actual.format.json.bind(actual.format),
        },
      };
    });

    require('./logger');

    expect(capturedPrintf).not.toBeNull();

    // Known level → icon found → ?? left branch taken
    const result = capturedPrintf({
      level: 'info',
      message: 'test message',
      timestamp: '2026-01-01 00:00:00',
      stack: undefined,
    });
    expect(result).toContain('test message');
    expect(result).toContain('✅');

    jest.resetModules();
  });

  it('uses fallback "  " icon when level is unknown (right side of ??)', () => {
    jest.resetModules();

    let capturedPrintf = null;
    jest.doMock('winston', () => {
      const actual = jest.requireActual('winston');
      return {
        ...actual,
        format: {
          ...actual.format,
          printf: jest.fn().mockImplementation((fn) => {
            capturedPrintf = fn;
            return actual.format.printf(fn);
          }),
          combine: actual.format.combine.bind(actual.format),
          timestamp: actual.format.timestamp.bind(actual.format),
          errors: actual.format.errors.bind(actual.format),
          splat: actual.format.splat.bind(actual.format),
          colorize: actual.format.colorize.bind(actual.format),
          json: actual.format.json.bind(actual.format),
        },
      };
    });

    require('./logger');

    expect(capturedPrintf).not.toBeNull();

    // Unknown level → LEVEL_ICONS['custom'] = undefined → ?? right branch → '  '
    const result = capturedPrintf({
      level: 'custom',
      message: 'custom level message',
      timestamp: '2026-01-01 00:00:00',
      stack: undefined,
    });
    // Icon falls back to '  ' (two spaces)
    expect(result).toContain('custom level message');
    // The output contains '  ' (two spaces) as icon placeholder
    expect(result).toMatch(/  custom level message/);

    jest.resetModules();
  });

  it('appends stack trace when stack is present', () => {
    jest.resetModules();

    let capturedPrintf = null;
    jest.doMock('winston', () => {
      const actual = jest.requireActual('winston');
      return {
        ...actual,
        format: {
          ...actual.format,
          printf: jest.fn().mockImplementation((fn) => {
            capturedPrintf = fn;
            return actual.format.printf(fn);
          }),
          combine: actual.format.combine.bind(actual.format),
          timestamp: actual.format.timestamp.bind(actual.format),
          errors: actual.format.errors.bind(actual.format),
          splat: actual.format.splat.bind(actual.format),
          colorize: actual.format.colorize.bind(actual.format),
          json: actual.format.json.bind(actual.format),
        },
      };
    });

    require('./logger');

    const result = capturedPrintf({
      level: 'error',
      message: 'error occurred',
      timestamp: '2026-01-01 00:00:00',
      stack: 'Error: error occurred\n  at line 1',
    });
    // Stack appended after base
    expect(result).toContain('Error: error occurred\n  at line 1');

    jest.resetModules();
  });
});

describe('logger — isTTY branch (line 18): non-TTY environment', () => {
  it('loads without colorize when stdout is not a TTY', () => {
    // In Jest test environment, process.stdout.isTTY is undefined/false.
    // The devFormat is constructed at module-load time.
    // This test verifies the module loads successfully in a non-TTY environment
    // (Jest CI runner), covering the false branch of the isTTY ternary.
    jest.resetModules();

    const originalIsTTY = process.stdout.isTTY;
    // Explicitly set to falsy to ensure non-TTY branch is taken
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

    const logger = require('./logger');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');

    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });

    jest.resetModules();
  });

  it('loads with colorize when stdout is a TTY', () => {
    jest.resetModules();

    const originalIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    const logger = require('./logger');
    expect(logger).toBeDefined();
    expect(typeof logger.warn).toBe('function');
    // Gọi log để trigger DEV_FORMAT printf với useColor=true → cover nhánh c() true
    expect(() => logger.info('test-tty-color-branch')).not.toThrow();

    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });

    jest.resetModules();
  });
});

describe('logger — production file transports (lines 43-49)', () => {
  it('creates file transports when NODE_ENV is production', () => {
    jest.resetModules();

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const logger = require('./logger');

    // In production, the logger should have Console + 2 File transports = 3 total
    expect(logger.transports.length).toBe(3);
    const transportNames = logger.transports.map((t) => t.constructor.name);
    expect(transportNames).toContain('Console');
    expect(transportNames.filter((n) => n === 'File').length).toBe(2);

    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  it('does not create file transports when NODE_ENV is not production', () => {
    jest.resetModules();

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const logger = require('./logger');

    // In test, only Console transport
    expect(logger.transports.length).toBe(1);
    expect(logger.transports[0].constructor.name).toBe('Console');

    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });
});
