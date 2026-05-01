require('dotenv').config();
// trigger nodemon restart for .env changes
const app = require('./app');
const sequelize = require('./config/sequelize');
const logger = require('./utils/logger');

// Load all models first (without relationships)
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

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  logger.error(err.stack);
  process.exit(1);
});

// Test database connection and sync models
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');

    // Load models and relationships
    require('./models');
    logger.info('Database models loaded successfully.');

    // NOTE: sequelize.sync() is disabled to prevent "Too many keys" MySQL 64-key limit error
    // Use migrations instead: npm run db:migrate
    // if (process.env.NODE_ENV === 'development' && process.env.DB_SYNC === 'true') {
    //   await sequelize.sync({ alter: true, foreignKeys: false });
    //   logger.info('Database tables synchronized successfully (preserving data).');
    // }
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    logger.error('Error details:', error.message);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

// Add missing columns if not exists
const ensureColumns = async () => {
  try {
    // Add stripe columns to users
    try {
      await sequelize.query('ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);');
    } catch (e) {
      // Column might already exist
    }

    try {
      await sequelize.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(255);');
    } catch (e) {
      // Column might already exist
    }
    
    // Add warranty columns to orders
    try {
      await sequelize.query(`ALTER TABLE orders ADD COLUMN warranty_cost DECIMAL(19, 2) DEFAULT 0;`);
    } catch (e) {
      // Column might already exist
    }

    // Add warranty columns to order_items
    try {
      await sequelize.query(`ALTER TABLE order_items ADD COLUMN warranty_package_ids JSON DEFAULT NULL;`);
    } catch (e) {
      // Column might already exist
    }
    
    // Add session_id column to chat_messages
    try {
      await sequelize.query('ALTER TABLE chat_messages ADD COLUMN session_id VARCHAR(255);');
    } catch (e) {
      // Column might already exist
    }

    try {
      await sequelize.query('ALTER TABLE chat_messages MODIFY COLUMN user_id INT NULL;');
    } catch (e) {
      // Column might already exist or not be UUID/CHAR
    }
    
    logger.info('✅ Missing columns ensured');
  } catch (error) {
    logger.error('Error ensuring columns:', error.message);
  }
};

// Start server
const startServer = async () => {
  await connectDB();
  await ensureColumns();

  const PORT = process.env.PORT || 8888;
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(
      `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
    );
  });

  // Setup Socket.io
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  require('./config/socket')(io);

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });

  // Handle SIGTERM signal
  process.on('SIGTERM', () => {
    logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
    server.close(() => {
      logger.info('💥 Process terminated!');
    });
  });
};

startServer();

