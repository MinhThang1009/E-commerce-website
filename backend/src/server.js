require('dotenv').config();
// Kích hoạt nodemon restart khi thay đổi .env

// Import logger trước validation để startup error có cùng định dạng với mọi log khác
const logger = require('./utils/logger');

// Fail fast nếu thiếu biến môi trường bắt buộc — server sẽ exit(1) thay vì crash âm thầm khi xử lý request
const REQUIRED_ENV_VARS = [
  'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
  'JWT_SECRET', 'JWT_REFRESH_SECRET',
  'GEMINI_API_KEY',
  'EMAIL_USERNAME', 'EMAIL_PASSWORD',
];

// Check undefined thay vì falsy — DB_PASSWORD có thể là empty string trên XAMPP local dev
const missingVars = REQUIRED_ENV_VARS.filter((key) => process.env[key] === undefined);
if (missingVars.length > 0) {
  logger.error(`[STARTUP ERROR] Thiếu biến môi trường bắt buộc: ${missingVars.join(', ')}`);
  logger.error('Hãy kiểm tra file .env (xem .env.example để biết danh sách đầy đủ).');
  process.exit(1);
}

const app = require('./app');
const sequelize = require('./config/sequelize');
const { exec } = require('child_process');
const { Server } = require('socket.io');
const { getRedisClient } = require('./config/redis');

// Load tất cả model trước (chưa có quan hệ)
const models = [
  require('./models/user'),
  require('./models/address'),
  require('./models/category'),
  require('./models/product'),
  require('./models/productCategory'),
  require('./models/productAttribute'),
  require('./models/productVariant'),
  require('./models/review'),
  require('./models/reviewFeedback'),
  require('./models/cart'),
  require('./models/cartItem'),
  require('./models/order'),
  require('./models/orderItem'),
  require('./models/wishlist'),
  require('./models/image'),
];

// Xử lý exception không được bắt
process.on('uncaughtException', (err) => {
  logger.error('Lỗi exception không được bắt — đang dừng server...');
  logger.error(err.name, err.message);
  logger.error(err.stack);
  process.exit(1);
});

// Kiểm tra kết nối database và load models
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Kết nối database thành công.');

    // Load models và quan hệ
    require('./models');
    logger.info('Đã load toàn bộ model.');

    // sequelize.sync() bị tắt để tránh lỗi "Too many keys" (giới hạn 64 key của MySQL)
    // Dùng migration thay thế: npm run db:migrate
    // if (process.env.NODE_ENV === 'development' && process.env.DB_SYNC === 'true') {
    //   await sequelize.sync({ alter: true, foreignKeys: false });
    //   logger.info('Đồng bộ bảng database thành công (giữ nguyên dữ liệu).');
    // }
  } catch (error) {
    logger.error('Không thể kết nối database:', error);
    logger.error('Chi tiết lỗi:', error.message);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

// Thêm các cột còn thiếu nếu chưa tồn tại
const ensureColumns = async () => {
  try {
    try {
      await sequelize.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(255);');
    } catch (e) {
      // Cột có thể đã tồn tại
    }
    
    // Thêm cột bảo hành vào bảng orders
    try {
      await sequelize.query(`ALTER TABLE orders ADD COLUMN warranty_cost DECIMAL(19, 2) DEFAULT 0;`);
    } catch (e) {
      // Cột có thể đã tồn tại
    }

    // Thêm cột bảo hành vào bảng order_items
    try {
      await sequelize.query(`ALTER TABLE order_items ADD COLUMN warranty_package_ids JSON DEFAULT NULL;`);
    } catch (e) {
      // Cột có thể đã tồn tại
    }
    
    // Thêm cột session_id vào bảng chat_messages
    try {
      await sequelize.query('ALTER TABLE chat_messages ADD COLUMN session_id VARCHAR(255);');
    } catch (e) {
      // Cột có thể đã tồn tại
    }

    try {
      await sequelize.query('ALTER TABLE chat_messages MODIFY COLUMN user_id INT NULL;');
    } catch (e) {
      // Cột có thể đã tồn tại hoặc không phải kiểu UUID/CHAR
    }
    
    logger.info('Các cột còn thiếu đã được đảm bảo tồn tại.');
  } catch (error) {
    logger.error('Lỗi khi kiểm tra cột:', error.message);
  }
};

// Kiểm tra và tự động rebuild vector store nếu lệch > 5% so với DB
const checkVectorStoreSync = async () => {
  try {
    // Lazy require sau khi connectDB() xong để đảm bảo associations đã được setup
    const { Product, ProductVariant } = require('./models');
    const vectorStoreService = require('./services/ai/vectorStore');
    // Đợi vector store load xong trước khi so sánh
    await vectorStoreService.loadPromise;
    // Fix: `inStock` không phải column/VIRTUAL.
    // "Còn hàng" = product có ít nhất 1 variant với stock_quantity > 0 (stock thực ở variant level)
    const { Op } = require('sequelize');
    const activeCount = await Product.count({
      where: { status: 'active' },
      include: [{
        model: ProductVariant,
        as: 'variants',
        where: { stockQuantity: { [Op.gt]: 0 } },
        required: true,
        attributes: [],
      }],
      distinct: true,
    });
    const vectorCount = vectorStoreService.items.length;
    if (activeCount === 0) return; // Chưa có dữ liệu — bỏ qua
    const deviation = Math.abs(activeCount - vectorCount) / activeCount;
    if (deviation > 0.05) {
      logger.warn(`⚠️ Vector store lệch >5% so với DB (DB: ${activeCount}, vector: ${vectorCount}). Tự động rebuild...`);
      // Dùng exec (async) để không block event loop trong lúc rebuild
      exec('npm run ai:rebuild-vectors', { cwd: __dirname + '/..', timeout: 120000 }, (rebuildErr) => {
        if (rebuildErr) {
          logger.error('❌ Rebuild vector store thất bại:', rebuildErr.message);
        } else {
          logger.info('✅ Đã rebuild vector store tự động.');
        }
      });
    } else {
      logger.info(`✅ Vector store OK: ${vectorCount} vectors / ${activeCount} sản phẩm active.`);
    }
  } catch (err) {
    logger.warn('⚠️ Không thể kiểm tra vector store sync:', err.message);
  }
};

// Pre-load dữ liệu ít thay đổi vào Redis cache để request đầu tiên không bị cold miss
const warmCache = async () => {
  try {
    const redis = await getRedisClient();
    const { Category, Brand } = require('./models');

    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    if (categories.length > 0) {
      await redis.setEx('categories:all', 1800, JSON.stringify({
        status: 'success',
        data: categories,
      }));
      logger.info(`[Cache] Warmed: ${categories.length} categories`);
    }

    const brands = await Brand.findAll({ order: [['name', 'ASC']] });
    if (brands.length > 0) {
      await redis.setEx('cache:brands:all', 1800, JSON.stringify({
        status: 'success',
        data: brands,
      }));
      logger.info(`[Cache] Warmed: ${brands.length} brands`);
    }
  } catch (err) {
    logger.warn('[Cache] Warming thất bại:', err.message);
  }
};

// Khởi động server
const startServer = async () => {
  await connectDB();
  await ensureColumns();

  // Khởi tạo Redis client sớm — nếu Redis không khả dụng thì dùng in-memory fallback
  await getRedisClient();

  const PORT = process.env.PORT || 8888;
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(
      `Server đang chạy ở chế độ ${process.env.NODE_ENV} trên cổng ${PORT}`
    );
  });

  // Kiểm tra vector store sync sau khi server start (không block startup)
  checkVectorStoreSync().catch(err => logger.warn('Vector store check failed:', err.message));

  // Cache warming — pre-load categories và brands vào Redis sau khi DB sẵn sàng
  warmCache().catch(err => logger.warn('Cache warming failed:', err.message));

  // Khởi tạo Socket.io
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  require('./config/socket')(io);

  // Phase 42.14 — Bind Socket.IO vào chat module để service emit realtime
  if (app.locals.chatModule && typeof app.locals.chatModule.bindSocketIO === 'function') {
    app.locals.chatModule.bindSocketIO(io);
  }

  // Xử lý promise rejection không được bắt
  process.on('unhandledRejection', (err) => {
    logger.error('Promise rejection không được xử lý — đang dừng server...');
    logger.error(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });

  // Xử lý tín hiệu SIGTERM (graceful shutdown)
  process.on('SIGTERM', () => {
    logger.info('Nhận SIGTERM — đang tắt server an toàn...');
    server.close(() => {
      logger.info('Server đã dừng hoàn toàn.');
    });
  });
};

startServer();

