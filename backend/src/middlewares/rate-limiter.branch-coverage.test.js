describe('rate-limiter handler callbacks — branch coverage', () => {
  let capturedOptions;

  beforeAll(() => {
    jest.resetModules();
    capturedOptions = [];

    jest.doMock('express-rate-limit', () =>
      jest.fn().mockImplementation((options) => {
        capturedOptions.push(options);
        if (options?.store?.init) options.store.init({ windowMs: options.windowMs || 60000 });
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        return mw;
      }),
    );
    jest.doMock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    }));
    jest.doMock('@utils/i18n', () => ({ t: (key) => key }));

    require('./rate-limiter');
  });

  afterAll(() => jest.resetModules());

  function findByWindowAndMax(windowMs, max) {
    return capturedOptions.find((o) => o.windowMs === windowMs && o.max === max);
  }
  function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  }

  test('apiLimiter handler → 429', () => {
    const opts = findByWindowAndMax(
      15 * 60 * 1000,
      process.env.NODE_ENV === 'development' ? 1000 : 100,
    );
    expect(opts?.handler).toBeDefined();
    const res = makeRes();
    opts.handler({ locale: 'vi' }, res, jest.fn(), { statusCode: 429 });
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('destructiveLimiter handler → 429', () => {
    const opts = findByWindowAndMax(15 * 60 * 1000, 10);
    expect(opts?.handler).toBeDefined();
    const res = makeRes();
    opts.handler({ locale: 'vi' }, res, jest.fn(), { statusCode: 429 });
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('chatLimiter handler → 429', () => {
    const opts = findByWindowAndMax(5 * 60 * 1000, 30);
    expect(opts?.handler).toBeDefined();
    const res = makeRes();
    opts.handler({ locale: 'vi' }, res, jest.fn(), { statusCode: 429 });
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
