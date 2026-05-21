/**
 * @file imageUrl.js
 * @layer Utility
 * @module global
 * @description Helper utility: imageUrl
 */
const DEFAULT_LOCAL_BASE = process.env.BACKEND_URL || '';

const trimToNull = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeBaseUrl = (value) => {
  const trimmed = trimToNull(value);
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
};

const API_URL = normalizeBaseUrl(process.env.API_URL);
const FRONTEND_URL = normalizeBaseUrl(process.env.FRONTEND_URL);
const ASSET_BASE_ENV =
  normalizeBaseUrl(process.env.ASSET_BASE_URL) || normalizeBaseUrl(process.env.CDN_BASE_URL);

const API_ROOT = API_URL && API_URL.toLowerCase().endsWith('/api') ? API_URL.slice(0, -4) : API_URL;

// Ảnh được serve từ backend — ưu tiên ASSET_BASE_URL > API_ROOT > BACKEND_URL, không dùng FRONTEND_URL làm base
const ASSET_BASE =
  normalizeBaseUrl(ASSET_BASE_ENV || API_ROOT || DEFAULT_LOCAL_BASE) || DEFAULT_LOCAL_BASE;

const PREFIXES_TO_STRIP = [
  normalizeBaseUrl(process.env.BACKEND_URL),
  normalizeBaseUrl('http://127.0.0.1:8888'),
  API_URL,
  API_ROOT,
  ASSET_BASE,
].filter(Boolean);

const normalizePath = (value) => value.replace(/\\/g, '/');

const ensureLeadingSlash = (value) => (value.startsWith('/') ? value : `/${value}`);

const stripLeadingSlash = (value) => value.replace(/^\/+/, '');

const combineBaseAndPath = (base, path) => {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
};

const startsWithPrefix = (value, prefix) => value.toLowerCase().startsWith(prefix.toLowerCase());

const isDataUrl = (value) => /^data:/i.test(value);

const sanitizeStoredImageValue = (input) => {
  const value = trimToNull(input);
  if (!value) return null;

  let sanitized = normalizePath(value);

  if (isDataUrl(sanitized)) {
    return sanitized;
  }

  sanitized = sanitized.replace(/\/api\/uploads/gi, '/uploads');

  for (const prefix of PREFIXES_TO_STRIP) {
    if (startsWithPrefix(sanitized, prefix)) {
      sanitized = sanitized.slice(prefix.length);
      break;
    }
  }

  sanitized = stripLeadingSlash(sanitized);

  return sanitized.length ? sanitized : null;
};

const buildPublicImageUrl = (input) => {
  const value = trimToNull(input);
  if (!value) return null;

  let normalized = normalizePath(value);

  if (isDataUrl(normalized)) {
    return normalized;
  }

  normalized = normalized.replace(/\/api\/uploads/gi, '/uploads');

  if (/^https?:\/\//i.test(normalized)) {
    for (const prefix of PREFIXES_TO_STRIP) {
      if (startsWithPrefix(normalized, prefix)) {
        const suffix = normalized.slice(prefix.length);
        return combineBaseAndPath(ASSET_BASE, ensureLeadingSlash(suffix));
      }
    }
    return normalized;
  }

  const pathWithSlash = ensureLeadingSlash(normalized);
  return combineBaseAndPath(ASSET_BASE, pathWithSlash);
};

module.exports = {
  assetBaseUrl: ASSET_BASE,
  sanitizeStoredImageValue,
  buildPublicImageUrl,
};
