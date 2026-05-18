'use strict';
/**
 * @file i18n.js
 * @layer Utility
 * @module global
 * @description Helper utility: i18n
 */


const vi = require('../locales/vi.json');
const en = require('../locales/en.json');

const TRANSLATIONS = { vi, en };

// Lấy giá trị từ object theo dot-notation key (vd: 'auth.emailInUse')
function getNestedValue(obj, key) {
  const keys = key.split('.');
  let value = obj;
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) return null;
  }
  return typeof value === 'string' ? value : null;
}

// Translate i18n key → chuỗi đã dịch. Trả null nếu key không tồn tại (= không phải i18n key).
function t(key, lang = 'vi', params = {}) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.vi;
  const value = getNestedValue(dict, key);
  if (!value) return null;
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => (params[name] !== undefined ? params[name] : ''));
}

module.exports = { t };
