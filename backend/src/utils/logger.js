const winston = require('winston');

// Symbol splat được winston dùng để lưu extra arguments
const SPLAT = Symbol.for('splat');

const LEVEL_ICONS = { error: '❌', warn: '⚠️ ', info: '✅', debug: '🔍', verbose: '📋' };

const formatSplat = (splat) => {
  if (!splat || splat.length === 0) return '';
  return ' ' + splat
    .map((s) => (s !== null && typeof s === 'object' ? JSON.stringify(s) : String(s)))
    .join(' ');
};

// Định dạng log đơn giản cho development (human-readable)
const devFormat = winston.format.combine(
  // Chỉ colorize khi chạy trong terminal thật — tránh ANSI codes xuất hiện khi pipe/IDE
  ...(process.stdout.isTTY ? [winston.format.colorize()] : []),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack, [SPLAT]: splat }) => {
    // Strip ANSI để tính độ dài thật của level string khi colorize
    const levelClean = level.replace(/\x1B\[[0-9;]*m/g, '');
    const pad = ' '.repeat(Math.max(0, 5 - levelClean.length));
    const icon = LEVEL_ICONS[levelClean] ?? '  ';
    const extra = formatSplat(splat);
    const base = `${timestamp} ${level}${pad} ${icon} ${message}${extra}`;
    return stack ? `${base}\n${stack}` : base;
  }),
);

// Định dạng JSON cho production (dễ parse bởi log aggregator như ELK, Datadog)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const logger = winston.createLogger({
  // LOG_LEVEL env var để override từ bên ngoài, fallback theo môi trường
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'api' },
  transports: [
    new winston.transports.Console(),
    // Chỉ ghi file ở production — tránh tạo file log không cần thiết trong dev/test
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

module.exports = logger;
