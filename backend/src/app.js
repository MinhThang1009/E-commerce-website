const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const sanitizeHtml = require('sanitize-html');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const { apiLimiter, authLimiter } = require('@middlewares/rate-limiter');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('@config/swagger');
const routes = require('./routes');
const { errorHandler } = require('@middlewares/error-handler');
const path = require('path');
const logger = require('@utils/logger');

// Phase 42.2+ — Modular Monolith modules. DI deps build trung tâm tại đây.
const eventBus = require('@shared/event-bus');
const sequelize = require('@config/sequelize');
const {
  User,
  Address,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  Wishlist,
  Review,
  Order,
  OrderItem,
  Feedback,
  ChatMessage,
  Category,
  Brand,
  ProductAttribute,
  ProductImage,
  ProductSpecification,
  RecentlyViewed,
  DiscountCode,
  InventoryLog,
} = require('@models');
const constants = require('./constants');
const emailService = require('@services/email');
const buildAuthModule = require('@modules/auth/module');
const buildUsersModule = require('@modules/users/module');
const buildCartModule = require('@modules/cart/module');
const buildWishlistModule = require('@modules/wishlist/module');
const buildReviewsModule = require('@modules/reviews/module');
const buildContentModule = require('@modules/content/module');
const buildUploadModule = require('@modules/upload/module');
const buildCatalogModule = require('@modules/catalog/module');
const buildOrdersModule = require('@modules/orders/module');
const buildPaymentModule = require('@modules/payment/module');
const buildInventoryModule = require('@modules/inventory/module');
const buildAIModule = require('@modules/ai/module');
const buildSearchHistoryModule = require('@modules/search-history/module');
const buildImageModule = require('@modules/image/module');
const buildDiscountCodeModule = require('@modules/discount-code/module');
const buildAttributeModule = require('@modules/attribute/module');
const buildAdminModule = require('@modules/admin/module');
const chatbotService = require('@modules/ai/services/chatbot/chatbot-service');
chatbotService.initialize({ Brand, Category, ChatMessage });
const momoService = require('@modules/payment/services/momo-service');
const vnpayService = require('@modules/payment/services/vnpay-service');

const authModule = buildAuthModule({
  User,
  eventBus,
  logger,
  emailService,
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
  Cart,
  CartItem,
  Product,
  ProductVariant,
  sequelize,
  eventBus,
  logger,
});
cartModule.subscribeEvents();

const wishlistModule = buildWishlistModule({
  Wishlist,
  Product,
  eventBus,
  logger,
});
wishlistModule.subscribeEvents();

const reviewsModule = buildReviewsModule({
  Review,
  Product,
  User,
  Order,
  OrderItem,
  eventBus,
  logger,
});
reviewsModule.subscribeEvents();

const contentModule = buildContentModule({
  Feedback,
  emailService,
  eventBus,
  logger,
});
contentModule.subscribeEvents();

const uploadModule = buildUploadModule({ eventBus, logger });
uploadModule.subscribeEvents();

const catalogModule = buildCatalogModule({
  Category,
  Brand,
  Product,
  ProductAttribute,
  ProductImage,
  ProductVariant,
  ProductSpecification,
  Review,
  RecentlyViewed,
  sequelize,
  eventBus,
  logger,
});
catalogModule.subscribeEvents();

const ordersModule = buildOrdersModule({
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  User,
  DiscountCode,
  InventoryLog,
  sequelize,
  eventBus,
  logger,
  emailService,
  constants,
});
ordersModule.subscribeEvents();

const paymentModule = buildPaymentModule({
  Order,
  OrderItem,
  User,
  Cart,
  CartItem,
  DiscountCode,
  sequelize,
  eventBus,
  logger,
  momoService,
  vnpayService,
  emailService,
});
paymentModule.subscribeEvents();

const inventoryModule = buildInventoryModule({
  Product,
  ProductVariant,
  InventoryLog,
  User,
  sequelize,
  eventBus,
  logger,
});
inventoryModule.subscribeEvents();

const aiModule = buildAIModule({
  Product,
  ProductVariant,
  Category,
  chatbotService,
  sequelize,
  eventBus,
  logger,
});
aiModule.subscribeEvents();

// Khởi tạo ứng dụng Express
const app = express();

// Đăng ký scheduled cleanup jobs (cron) — abandoned carts, expired OTP, search history, v.v.
require('@jobs/cleanup');

// Thiết lập các HTTP security headers
// CSP bị tắt vì backend chỉ trả về JSON — CSP chỉ có ý nghĩa cho HTML document.
// Frontend (Vite/Nginx) là nơi đặt CSP cho HTML page.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
    contentSecurityPolicy: false,
  }),
);

// Cấu hình CORS
const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Cache-Control'],
  exposedHeaders: ['Set-Cookie'],
};

// Kiểm tra biến môi trường CORS_ORIGIN để xác định origin cho phép
if (process.env.CORS_ORIGIN === '*') {
  corsOptions.origin = '*';
} else if (process.env.CORS_ORIGIN) {
  // Phân tách danh sách origins ngăn cách bởi dấu phẩy
  const origins = process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  corsOptions.origin = origins;
} else {
  // Dùng giá trị mặc định theo môi trường
  corsOptions.origin =
    process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL || 'https://yourdomain.com'
      : (process.env.CORS_ORIGINS_DEV || '')
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
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
      ? null // wildcard → không kiểm tra
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
    }),
  );
}

// Giới hạn auth endpoints (áp dụng mọi môi trường để chặn brute force)
app.use('/api/auth', authLimiter);

// Giới hạn toàn bộ API trên production
if (process.env.NODE_ENV === 'production') {
  app.use('/api', apiLimiter);
}

// Phát hiện locale từ Accept-Language header hoặc ?lang= query param
app.use(require('@middlewares/detect-locale'));

// Đọc dữ liệu từ body request — 2mb mặc định, upload routes override riêng
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Xử lý cookie
app.use(cookieParser());

// Sanitize string fields trong req.body — chống XSS stored attacks
const sanitizeBody = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    const clean = (obj) => {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeHtml(obj[key], { allowedTags: [], allowedAttributes: {} });
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          clean(obj[key]);
        }
      }
    };
    clean(req.body);
  }
  next();
};
app.use(sanitizeBody);

// Nén response để tăng hiệu năng
app.use(compression());

// Image proxy — bypass CDN hotlink protection trên localhost dev
app.use('/api/img', require('@modules/image/middlewares/image-proxy-router'));

// Phục vụ file upload tĩnh — filename chứa hash/timestamp để đảm bảo freshness
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'), {
    maxAge: '365d',
    immutable: true,
  }),
);

// Phase 42.2+ — Mount Modular Monolith modules TRƯỚC routes/index để new module
// thắng path mặc định (routes/index.js đã tháo các route cũ tương ứng).
app.use('/api' + authModule.basePath, authModule.router);
app.use('/api' + usersModule.basePath, usersModule.router);
app.use('/api' + cartModule.basePath, cartModule.router);
app.use('/api' + wishlistModule.basePath, wishlistModule.router);
app.use('/api' + reviewsModule.basePath, reviewsModule.router);
app.use('/api' + contentModule.basePath, contentModule.router);
app.use('/api' + uploadModule.basePath, uploadModule.router);
catalogModule.mounts.forEach(({ basePath, router }) => {
  app.use('/api' + basePath, router);
});
app.use('/api' + ordersModule.basePath, ordersModule.router);
app.use('/api' + paymentModule.basePath, paymentModule.router);
app.use('/api' + inventoryModule.basePath, inventoryModule.router);
app.use('/api' + aiModule.basePath, aiModule.router);
// Wrapper modules — thin delegates to flat routes (migrated from routes/index.js)
const searchHistoryModule = buildSearchHistoryModule();
const imageModule = buildImageModule();
const discountCodeModule = buildDiscountCodeModule();
const attributeModule = buildAttributeModule();
app.use('/api' + searchHistoryModule.basePath, searchHistoryModule.router);
app.use('/api' + imageModule.basePath, imageModule.router);
app.use('/api' + discountCodeModule.basePath, discountCodeModule.router);
app.use('/api' + attributeModule.basePath, attributeModule.router);
const adminModule = buildAdminModule();
app.use('/api' + adminModule.basePath, adminModule.router);

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
