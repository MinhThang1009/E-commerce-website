require('module-alias/register'); // phải là dòng đầu tiên trước mọi require khác
require('dotenv').config();
// Kích hoạt nodemon restart khi thay đổi .env — last touched: 2026-05-21

// Import logger trước validation để startup error có cùng định dạng với mọi log khác
const logger = require('@utils/logger');

// Fail fast nếu thiếu biến môi trường bắt buộc — server sẽ exit(1) thay vì crash âm thầm khi xử lý request
const REQUIRED_ENV_VARS = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'EMAIL_USERNAME',
  'EMAIL_PASSWORD',
];

// Check undefined thay vì falsy — DB_PASSWORD có thể là empty string trên XAMPP local dev
const missingVars = REQUIRED_ENV_VARS.filter((key) => process.env[key] === undefined);
if (missingVars.length > 0) {
  logger.error(`[STARTUP ERROR] Thiếu biến môi trường bắt buộc: ${missingVars.join(', ')}`);
  logger.error('Hãy kiểm tra file .env (xem .env.example để biết danh sách đầy đủ).');
  process.exit(1);
}

// JWT secret phải đủ mạnh — reject các giá trị placeholder/yếu
const MIN_SECRET_LENGTH = 32;
['JWT_SECRET', 'JWT_REFRESH_SECRET'].forEach((key) => {
  const val = process.env[key];
  if (val && val.length < MIN_SECRET_LENGTH) {
    logger.error(
      `[STARTUP ERROR] ${key} quá ngắn (${val.length} ký tự, tối thiểu ${MIN_SECRET_LENGTH}). Tạo mới: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`,
    );
    process.exit(1);
  }
});

const app = require('./app');
const sequelize = require('@config/sequelize');
const { exec } = require('child_process');
const { getRedisClient } = require('@config/redis');

// Load tất cả model trước (chưa có quan hệ)
const models = [
  require('@models/user'),
  require('@models/address'),
  require('@models/category'),
  require('@models/product'),
  require('@models/product-category'),
  require('@models/product-attribute'),
  require('@models/product-variant'),
  require('@models/review'),
  require('@models/cart'),
  require('@models/cart-item'),
  require('@models/order'),
  require('@models/order-item'),
  require('@models/wishlist'),
  require('@models/image'),
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
    require('@models');
    logger.info('Đã load toàn bộ model.');

    // Tự động sync schema khi DB_SYNC=true (dev only).
    // foreignKeys: false — tránh lỗi "Too many keys" của MySQL (giới hạn 64 key/bảng).
    // alter: true — chỉ thêm column/bảng mới, KHÔNG xóa dữ liệu hiện có.
    if (process.env.NODE_ENV !== 'production' && process.env.DB_SYNC === 'true') {
      await sequelize.sync({ alter: true, foreignKeys: false });
      logger.info('Đồng bộ schema database thành công.');
    }
  } catch (error) {
    logger.error('Không thể kết nối database:', error);
    logger.error('Chi tiết lỗi:', error.message);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

// Legacy ensureColumns đã xóa — các cột (google_id, warranty_cost,
// warranty_package_ids, session_id, user_id nullable) đã có trong
// migration_full.sql và migrations 2026050501+. Không cần ALTER inline.

// Kiểm tra và tự động rebuild vector store nếu lệch > 5% so với DB
const checkVectorStoreSync = async () => {
  try {
    // Lazy require sau khi connectDB() xong để đảm bảo associations đã được setup
    const { Product, ProductVariant } = require('@models');
    const vectorStoreService = require('@services/vector-store/vector-store');
    // Đợi vector store load xong trước khi so sánh
    await vectorStoreService.loadPromise;
    // Fix: `inStock` không phải column/VIRTUAL.
    // "Còn hàng" = product có ít nhất 1 variant với stock_quantity > 0 (stock thực ở variant level)
    const { Op } = require('sequelize');
    const activeCount = await Product.count({
      where: { status: 'active' },
      include: [
        {
          model: ProductVariant,
          as: 'variants',
          where: { stockQuantity: { [Op.gt]: 0 } },
          required: true,
          attributes: [],
        },
      ],
      distinct: true,
    });
    const vectorCount = vectorStoreService.items.length;
    if (activeCount === 0) return; // Chưa có dữ liệu — bỏ qua
    const deviation = Math.abs(activeCount - vectorCount) / activeCount;
    if (deviation > 0.05) {
      logger.warn(
        `Vector store lệch >5% so với DB (DB: ${activeCount}, vector: ${vectorCount}). Tự động rebuild...`,
      );
      // Dùng exec (async) để không block event loop trong lúc rebuild
      exec(
        'npm run ai:rebuild-vectors',
        { cwd: __dirname + '/..', timeout: 120000 },
        (rebuildErr) => {
          if (rebuildErr) {
            logger.error('Rebuild vector store thất bại:', rebuildErr.message);
          } else {
            logger.info('Đã rebuild vector store tự động.');
          }
        },
      );
    } else {
      logger.info(`Vector store OK: ${vectorCount} vectors / ${activeCount} sản phẩm active.`);
    }
  } catch (err) {
    logger.warn('Không thể kiểm tra vector store sync:', err.message);
  }
};

// Categories và Brands không cần warm riêng — catalogService.getAllCategories()
// và getAllBrands() tự cache khi request đầu tiên đến, kèm productCount đầy đủ.
// warmCache chỉ dùng cho data service không tự cache (nếu có thêm sau).
const warmCache = async () => {
  try {
    logger.info('[Cache] Catalog cache sẽ được warm khi request đầu tiên đến.');
  } catch (err) {
    logger.warn(`[Cache] Warming thất bại: ${err?.message || err}`);
  }
};

// Khởi động server
const startServer = async () => {
  await connectDB();

  // Khởi tạo Redis client sớm — nếu Redis không khả dụng thì dùng in-memory fallback
  await getRedisClient();

  const PORT = process.env.PORT || 8888;
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server đang chạy ở chế độ ${process.env.NODE_ENV} trên cổng ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Cổng ${PORT} đã bị chiếm. Chạy "npm run kill" để giải phóng rồi thử lại.`);
      process.exit(1);
    }
    throw err;
  });

  // Kiểm tra vector store sync sau khi server start (không block startup)
  checkVectorStoreSync().catch((err) => logger.warn('Vector store check failed:', err.message));

  // Cache warming — pre-load categories và brands vào Redis sau khi DB sẵn sàng
  warmCache().catch((err) => logger.warn('Cache warming failed:', err.message));

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
