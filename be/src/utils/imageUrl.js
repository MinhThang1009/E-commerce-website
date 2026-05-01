const DEFAULT_LOCAL_BASE = 'http://localhost:8888';

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

const apiUrl = normalizeBaseUrl(process.env.API_URL);
const frontendUrl = normalizeBaseUrl(process.env.FRONTEND_URL);
const assetBaseEnv =
  normalizeBaseUrl(process.env.ASSET_BASE_URL) ||
  normalizeBaseUrl(process.env.CDN_BASE_URL);

const apiRoot =
  apiUrl && apiUrl.toLowerCase().endsWith('/api')
    ? apiUrl.slice(0, -4)
    : apiUrl;

const assetBase =
  normalizeBaseUrl(
    assetBaseEnv || frontendUrl || apiRoot || DEFAULT_LOCAL_BASE
  ) || DEFAULT_LOCAL_BASE;

const prefixesToStrip = [
  normalizeBaseUrl('http://localhost:8888'),
  normalizeBaseUrl('http://127.0.0.1:8888'),
  apiUrl,
  apiRoot,
  assetBase,
].filter(Boolean);

const normalizePath = (value) => value.replace(/\\/g, '/');

const ensureLeadingSlash = (value) =>
  value.startsWith('/') ? value : `/${value}`;

const stripLeadingSlash = (value) => value.replace(/^\/+/, '');

const combineBaseAndPath = (base, path) => {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
};

const startsWithPrefix = (value, prefix) =>
  value.toLowerCase().startsWith(prefix.toLowerCase());

const isDataUrl = (value) => /^data:/i.test(value);

const sanitizeStoredImageValue = (input) => {
  const value = trimToNull(input);
  if (!value) return null;

  let sanitized = normalizePath(value);

  if (isDataUrl(sanitized)) {
    return sanitized;
  }

  sanitized = sanitized.replace(/\/api\/uploads/gi, '/uploads');

  for (const prefix of prefixesToStrip) {
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
    for (const prefix of prefixesToStrip) {
      if (startsWithPrefix(normalized, prefix)) {
        const suffix = normalized.slice(prefix.length);
        return combineBaseAndPath(assetBase, ensureLeadingSlash(suffix));
      }
    }
    return normalized;
  }

  const pathWithSlash = ensureLeadingSlash(normalized);
  return combineBaseAndPath(assetBase, pathWithSlash);
};

const coerceToArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_) {
      // Ignore JSON parse errors and treat as newline/comma separated list
    }
    return value
      .split(/[\r\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const sanitizeImageCollection = (value) =>
  coerceToArray(value)
    .map(sanitizeStoredImageValue)
    .filter(Boolean);

const buildPublicImageCollection = (value) =>
  coerceToArray(value)
    .map(buildPublicImageUrl)
    .filter(Boolean);

module.exports = {
  assetBaseUrl: assetBase,
  sanitizeStoredImageValue,
  sanitizeImageCollection,
  buildPublicImageUrl,
  buildPublicImageCollection,
};
