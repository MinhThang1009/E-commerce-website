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
const logger = require('./utils/logger');

// Phase 42.2+ — Modular Monolith modules. DI deps build trung tâm tại đây.
const eventBus = require('./shared/eventBus');
const sequelize = require('./config/sequelize');
const {
  User, Address,
  Cart, CartItem, Product, ProductVariant, WarrantyPackage,
} = require('./models');
const emailService = require('./services/email');
const { AdminAuditService } = require('./services/adminAudit');
const { getRedisClient } = require('./config/redis');
const buildAuthModule = require('./modules/auth/module');
const buildUsersModule = require('./modules/users/module');
const buildCartModule = require('./modules/cart/module');

const authModule = buildAuthModule({
  User,
  eventBus,
  logger,
  emailService,
  auditService: AdminAuditService,
  redisClient: getRedisClient,
});
authModule.subscribeEvents();

const usersModule = buildUsersModule({
  User,
  Address,
  eventBus,
  logger,
});
usersModule.subscribeEvents();

const cartModule = buildCartModule({
  Cart, CartItem, Product, ProductVariant, WarrantyPackage,
  sequelize, eventBus, logger,
});
cartModule.subscribeEvents();

// Khởi tạo ứng dụng Express
const app = express();

// Đăng ký scheduled cleanup jobs (cron) — abandoned carts, expired OTP, search history, v.v.
require('./jobs/cleanup');

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
    : (process.env.CORS_ORIGINS_DEV || '').split(',').map(o => o.trim()).filter(Boolean);
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

// Phục vụ file upload tĩnh — cache 1 năm vì filename chứa hash/timestamp
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '365d',
  immutable: true,
}));

// Phase 42.2+ — Mount Modular Monolith modules TRƯỚC routes/index để new module
// thắng path mặc định (routes/index.js đã tháo các route cũ tương ứng).
app.use('/api' + authModule.basePath, authModule.router);
app.use('/api' + usersModule.basePath, usersModule.router);
app.use('/api' + cartModule.basePath, cartModule.router);

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
