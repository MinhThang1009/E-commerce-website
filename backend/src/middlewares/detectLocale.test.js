'use strict';
const detectLocale = require('./detectLocale');

function makeReq(overrides = {}) {
  return { headers: {}, query: {}, ...overrides };
}
function makeRes() { return {}; }
function next(req) { return () => {}; }

describe('detectLocale middleware', () => {
  test('?lang=en → req.locale = en', () => {
    const req = makeReq({ query: { lang: 'en' } });
    detectLocale(req, makeRes(), () => {});
    expect(req.locale).toBe('en');
  });

  test('?lang=vi → req.locale = vi', () => {
    const req = makeReq({ query: { lang: 'vi' } });
    detectLocale(req, makeRes(), () => {});
    expect(req.locale).toBe('vi');
  });

  test('?lang=fr (unsupported) → default vi', () => {
    const req = makeReq({ query: { lang: 'fr' } });
    detectLocale(req, makeRes(), () => {});
    expect(req.locale).toBe('vi');
  });

  test('Accept-Language: en-US → req.locale = en', () => {
    const req = makeReq({ headers: { 'accept-language': 'en-US,en;q=0.9' } });
    detectLocale(req, makeRes(), () => {});
    expect(req.locale).toBe('en');
  });

  test('Accept-Language: vi → req.locale = vi', () => {
    const req = makeReq({ headers: { 'accept-language': 'vi' } });
    detectLocale(req, makeRes(), () => {});
    expect(req.locale).toBe('vi');
  });

  test('Accept-Language: fr,en;q=0.8 → en (first supported)', () => {
    const req = makeReq({ headers: { 'accept-language': 'fr,en;q=0.8,vi;q=0.6' } });
    detectLocale(req, makeRes(), () => {});
    expect(req.locale).toBe('en');
  });

  test('No headers, no query → default vi', () => {
    const req = makeReq();
    detectLocale(req, makeRes(), () => {});
    expect(req.locale).toBe('vi');
  });

  test('?lang= overrides Accept-Language', () => {
    const req = makeReq({ query: { lang: 'en' }, headers: { 'accept-language': 'vi' } });
    detectLocale(req, makeRes(), () => {});
    expect(req.locale).toBe('en');
  });

  test('calls next()', () => {
    const req = makeReq();
    const mockNext = jest.fn();
    detectLocale(req, makeRes(), mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});
