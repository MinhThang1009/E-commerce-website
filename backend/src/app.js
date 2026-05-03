const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const { apiLimiter, authLimiter } = require('./middlewares/rateLimiter');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');
const path = require('path');
const cron = require('node-cron');
const fs = require('fs').promises;
const logger = require('./utils/logger');

// Khởi tạo ứng dụng Express
const app = express();

// Dọn dẹp file tạm trong uploads/temp/ mỗi ngày lúc 2:00 AM
// File cũ hơn 24 giờ sẽ bị xóa — tránh tích lũy orphaned files khi user upload nhưng không save
cron.schedule('0 2 * * *', async () => {
  const tempDir = path.join(__dirname, '../uploads/temp');
  const maxAge = 24 * 60 * 60 * 1000; // 24 giờ tính bằng milliseconds

  try {
    const files = await fs.readdir(tempDir);

    await Promise.allSettled(
      files.map(async (file) => {
        const filePath = path.join(tempDir, file);
        try {
          const stat = await fs.stat(filePath);
          if (Date.now() - stat.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            logger.info(`[CLEANUP] Xóa file tạm cũ: ${file}`);
          }
        } catch {
          // Bỏ qua file không đọc được hoặc đã bị xóa bởi process khác
        }
      })
    );
  } catch (err) {
    // tempDir chưa tồn tại hoặc không có quyền đọc — bỏ qua
    logger.warn('[CLEANUP] Không thể dọn dẹp uploads/temp:', err.message);
  }
});

// // Tin tưởng reverse proxy headers khi chạy sau Nginx/PM2
// if (process.env.NODE_ENV === 'production') {
//   app.set('trust proxy', 1);
// }

// Thiết lập các HTTP security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
    // Content Security Policy — chỉ cho phép script từ các domain tin cậy,
    // không cho phép unsafe-eval để giảm thiểu rủi ro XSS code injection
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          'https://js.stripe.com',
          'https://accounts.google.com',
        ],
        // unsafe-inline cần thiết cho Ant Design và inline styles của React
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", 'https://api.stripe.com'],
        frameSrc: [
          'https://js.stripe.com',
          'https://hooks.stripe.com',
        ],
      },
    },
  })
);

// Cấu hình CORS
const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
};

// Kiểm tra biến môi trường CORS_ORIGIN để xác định origin cho phép
if (process.env.CORS_ORIGIN === '*') {
  corsOptions.origin = '*';
} else if (process.env.CORS_ORIGIN) {
  // Phân tách danh sách origins ngăn cách bởi dấu phẩy
  const origins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  corsOptions.origin = origins;
} else {
  // Dùng giá trị mặc định theo môi trường
  corsOptions.origin = process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || 'https://yourdomain.com'
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',
      ];
}

app.use(cors(corsOptions));

// Xử lý preflight requests
app.options('*', cors());

// CSRF Protection — defense-in-depth cho endpoints nhận cookie
//
// Tại sao API này ít bị CSRF hơn session-based auth:
//   - Access token lưu trong localStorage → browser KHÔNG tự gửi qua cross-site request
//   - Authorization header phải được JavaScript đặt tường minh → attacker không thể làm được
//
// Tuy nhiên sessionId cookie (guest cart) vẫn bị browser tự gửi → cần bảo vệ.
// Cách bảo vệ hiện tại:
//   1. sessionId cookie đã có SameSite=Strict → chặn hoàn toàn cross-site cookie gửi
//   2. Middleware dưới đây verify Origin header cho mọi POST/PUT/PATCH/DELETE từ browser
//      có Origin (request từ Postman/curl không có Origin → được phép để không break tooling)
app.use((req, res, next) => {
  const { method, headers } = req;
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (!stateChangingMethods.includes(method)) return next();

  const origin = headers.origin;
  // Không có Origin = request từ server-to-server, Postman, mobile app → được phép
  if (!origin) return next();

  // Xây danh sách allowed origins từ cùng config CORS
  const allowedOrigins = Array.isArray(corsOptions.origin)
    ? corsOptions.origin
    : corsOptions.origin === '*'
      ? null                    // wildcard → không kiểm tra
      : [corsOptions.origin];

  if (allowedOrigins && !allowedOrigins.includes(origin)) {
    return res.status(403).json({
      status: 'fail',
      message: 'CSRF: Origin không hợp lệ',
    });
  }

  next();
});

// Ghi log HTTP request — bỏ qua health check để tránh noise, không log sensitive body
// Dùng Morgan cho cả dev lẫn production; format 'combined' cung cấp đủ context để debug
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan(':method :url :status :response-time ms', {
      // Bỏ qua /health endpoint để tránh log noise từ uptime monitoring
      skip: (req) => req.url === '/health' || req.url === '/api/health',
    })
  );
}

// Giới hạn auth endpoints (áp dụng mọi môi trường để chặn brute force)
app.use('/api/auth', authLimiter);

// Giới hạn toàn bộ API trên production
if (process.env.NODE_ENV === 'production') {
  app.use('/api', apiLimiter);
}

// Đọc dữ liệu từ body request vào req.body
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Xử lý cookie
app.use(cookieParser());

// Sanitize input chống XSS (xss-clean không hỗ trợ per-field whitelist;
// DOMPurify ở frontend bảo vệ khi render HTML từ API)
app.use(xss());

// Nén response để tăng hiệu năng
app.use(compression());

// Phục vụ file upload tĩnh
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Định nghĩa các API routes
app.use('/api', routes);

// Tài liệu API Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Xử lý route không tồn tại (404)
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Không tìm thấy đường dẫn: ${req.originalUrl}`,
  });
});

// Middleware xử lý lỗi toàn cục
app.use(errorHandler);

module.exports = app;
