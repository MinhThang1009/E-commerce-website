require('dotenv').config();
// Kích hoạt nodemon restart khi thay đổi .env

// Fail fast nếu thiếu biến môi trường bắt buộc
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DB_NAME',
  'DB_HOST',
];

const missingVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  console.error(`[STARTUP ERROR] Thiếu biến môi trường bắt buộc: ${missingVars.join(', ')}`);
  console.error('Hãy kiểm tra file .env (xem .env.example để biết danh sách đầy đủ).');
  process.exit(1);
}

const app = require('./app');
const sequelize = require('./config/sequelize');
const logger = require('./utils/logger');

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
    // Thêm cột stripe vào bảng users
    try {
      await sequelize.query('ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);');
    } catch (e) {
      // Cột có thể đã tồn tại
    }

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

// Khởi động server
const startServer = async () => {
  await connectDB();
  await ensureColumns();

  const PORT = process.env.PORT || 8888;
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(
      `Server đang chạy ở chế độ ${process.env.NODE_ENV} trên cổng ${PORT}`
    );
  });

  // Khởi tạo Socket.io
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  require('./config/socket')(io);

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

