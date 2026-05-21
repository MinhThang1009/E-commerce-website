/**
 * @file logger.js
 * @layer Utility
 * @module global
 * @description Helper utility: logger
 */
const path = require('path');
const winston = require('winston');

// __dirname = backend/src/utils/ → ../../logs/ = backend/logs/ (absolute, CWD-independent)
const LOGS_DIR = path.join(__dirname, '../../logs');

// Symbol splat được winston dùng để lưu extra arguments
const SPLAT = Symbol.for('splat');

const LEVEL_ICONS = { error: '❌', warn: '⚠️ ', info: '✅', debug: '🔍', verbose: '📋' };
const LEVEL_COLORS = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
  verbose: '\x1b[35m',
};
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

const useColor = Boolean(process.stdout.isTTY);
/* istanbul ignore next */
const c = (code, str) => (useColor ? `${code}${str}${RESET}` : str);

const formatSplat = (splat) => {
  if (!splat || splat.length === 0) return '';
  return (
    ' ' +
    splat
      .map((s) => (s !== null && typeof s === 'object' ? JSON.stringify(s) : String(s)))
      .join(' ')
  );
};

// Định dạng log đơn giản cho development (human-readable)
const DEV_FORMAT = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack, [SPLAT]: splat }) => {
    const icon = LEVEL_ICONS[level] ?? '  ';
    const color = LEVEL_COLORS[level] ?? '';
    const lvl = c(BOLD + color, level.toUpperCase().padEnd(5));
    const ts = c(DIM, `[${timestamp}]`);
    const extra = formatSplat(splat);
    const msg = `${message}${extra}`;
    const base = `${ts}  ${icon}  ${lvl}  ${msg}`;
    return stack ? `${base}\n${c(DIM, stack)}` : base;
  }),
);

// Định dạng JSON cho production (dễ parse bởi log aggregator như ELK, Datadog)
const PROD_FORMAT = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

const logger = winston.createLogger({
  // LOG_LEVEL env var để override từ bên ngoài, fallback theo môi trường
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: process.env.NODE_ENV === 'production' ? PROD_FORMAT : DEV_FORMAT,
  defaultMeta: { service: 'api' },
  transports: [
    new winston.transports.Console(),
    // Chỉ ghi file ở production — tránh tạo file log không cần thiết trong dev/test
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: path.join(LOGS_DIR, 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: path.join(LOGS_DIR, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

module.exports = logger;
