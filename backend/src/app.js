const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const sanitizeHtml = require('sanitize-html');
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
  Wishlist,
  Review, ReviewFeedback, Order, OrderItem,
  LoyaltyHistory,
  Banner, News, EmailCampaign, NewsletterSubscriber, Feedback,
  Category, Brand, Collection, ProductCollection,
  ProductAttribute, ProductSpecification, RecentlyViewed,
  DiscountCode, InventoryLog,
  ChatMessage,
} = require('./models');
const constants = require('./constants');
const emailService = require('./services/email');
const { AdminAuditService } = require('./services/adminAudit');
const { getRedisClient } = require('./config/redis');
const buildAuthModule = require('./modules/auth/module');
const buildUsersModule = require('./modules/users/module');
const buildCartModule = require('./modules/cart/module');
const buildWishlistModule = require('./modules/wishlist/module');
const buildReviewsModule = require('./modules/reviews/module');
const buildLoyaltyModule = require('./modules/loyalty/module');
const buildContentModule = require('./modules/content/module');
const buildUploadModule = require('./modules/upload/module');
const buildCatalogModule = require('./modules/catalog/module');
const buildOrdersModule = require('./modules/orders/module');
const buildPaymentModule = require('./modules/payment/module');
const buildInventoryModule = require('./modules/inventory/module');
const buildChatModule = require('./modules/chat/module');
const buildAiModule = require('./modules/ai/module');
const geminiChatbotService = require('./services/ai/geminiChatbot');
const ruleBasedChatbot = require('./services/ai/ruleBasedChatbot');
const momoService = require('./services/payment/momo');
const vnpayService = require('./services/payment/vnpay');

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

const wishlistModule = buildWishlistModule({
  Wishlist, Product, eventBus, logger,
});
wishlistModule.subscribeEvents();

const reviewsModule = buildReviewsModule({
  Review, ReviewFeedback, Product, User, Order, OrderItem,
  eventBus, logger,
});
reviewsModule.subscribeEvents();

const loyaltyModule = buildLoyaltyModule({
  User, LoyaltyHistory, sequelize, eventBus, logger,
});
loyaltyModule.subscribeEvents();

const contentModule = buildContentModule({
  Banner, News, EmailCampaign, NewsletterSubscriber, Feedback, User,
  emailService,
  redisClient: getRedisClient,
  eventBus, logger,
});
contentModule.subscribeEvents();

const uploadModule = buildUploadModule({ eventBus, logger });
uploadModule.subscribeEvents();

const catalogModule = buildCatalogModule({
  Category, Brand, Collection, ProductCollection, Product,
  ProductAttribute, ProductVariant, ProductSpecification,
  Review, RecentlyViewed, WarrantyPackage,
  sequelize,
  redisClient: getRedisClient,
  eventBus, logger,
});
catalogModule.subscribeEvents();

const ordersModule = buildOrdersModule({
  Order, OrderItem, Cart, CartItem, Product, ProductVariant, User,
  DiscountCode, LoyaltyHistory, InventoryLog, WarrantyPackage,
  sequelize, eventBus, logger,
  emailService, constants,
});
ordersModule.subscribeEvents();

const paymentModule = buildPaymentModule({
  Order, OrderItem, User, Cart, CartItem, DiscountCode,
  sequelize, eventBus, logger,
  momoService, vnpayService, emailService,
});
paymentModule.subscribeEvents();

const inventoryModule = buildInventoryModule({
  Product, ProductVariant, InventoryLog, User,
  eventBus, logger,
});
inventoryModule.subscribeEvents();

const chatModule = buildChatModule({
  ChatMessage, User,
  // io binding deferred — server.js gọi chatModule.bindSocketIO(io) sau .listen
  eventBus, logger,
});
chatModule.subscribeEvents();

const aiModule = buildAiModule({
  Product, ProductVariant, Category,
  geminiChatbotService, ruleBasedChatbot,
  sequelize, eventBus, logger,
});
aiModule.subscribeEvents();

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
          'https://accounts.google.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
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
app.use('/api' + wishlistModule.basePath, wishlistModule.router);
app.use('/api' + reviewsModule.basePath, reviewsModule.router);
app.use('/api' + loyaltyModule.basePath, loyaltyModule.router);
contentModule.mounts.forEach(({ basePath, router }) => {
  app.use('/api' + basePath, router);
});
app.use('/api' + uploadModule.basePath, uploadModule.router);
catalogModule.mounts.forEach(({ basePath, router }) => {
  app.use('/api' + basePath, router);
});
app.use('/api' + ordersModule.basePath, ordersModule.router);
// Payment module mount TRƯỚC routes/index.js — Express fall-through cho
// /sepay-webhook (legacy routes/payment.js still mounted via routes/index).
app.use('/api' + paymentModule.basePath, paymentModule.router);
app.use('/api' + inventoryModule.basePath, inventoryModule.router);
app.use('/api' + chatModule.basePath, chatModule.router);
// AI chatbot mount TRƯỚC routes/index — fall-through cho /analytics + /cart/add
// qua legacy routes/chatbot.js đến Phase 5 cleanup.
app.use('/api' + aiModule.basePath, aiModule.router);

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

// Expose chatModule trên app.locals để server.js bind Socket.IO sau khi listen
app.locals.chatModule = chatModule;

module.exports = app;
