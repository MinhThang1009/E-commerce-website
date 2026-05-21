'use strict';
/**
 * @file detectLocale.js
 * @layer Middleware
 * @module global
 * @description Express middleware: detectLocale
 */

const SUPPORTED_LOCALES = ['vi', 'en'];
const DEFAULT_LOCALE = 'vi';

/**
 * Middleware phát hiện locale từ request:
 * 1. Query param: ?lang=en
 * 2. Accept-Language header: en-US,en;q=0.9,vi;q=0.8
 * Gán req.locale = 'vi' | 'en'
 */
module.exports = function detectLocale(req, _res, next) {
  // Query param có độ ưu tiên cao hơn header
  const queryLang = req.query.lang;
  if (queryLang && SUPPORTED_LOCALES.includes(queryLang)) {
    req.locale = queryLang;
    return next();
  }

  const acceptHeader = req.headers['accept-language'] || '';
  // Parse "en-US,en;q=0.9,vi;q=0.8" → ['en', 'vi']
  const langs = acceptHeader
    .split(',')
    .map((s) => s.split(';')[0].trim().substring(0, 2).toLowerCase())
    .filter((l) => SUPPORTED_LOCALES.includes(l));

  req.locale = langs[0] || DEFAULT_LOCALE;
  next();
};
