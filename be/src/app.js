const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');
const path = require('path');

// Initialize app
const app = express();

// // Trust reverse proxy headers when running behind Nginx/PM2
// if (process.env.NODE_ENV === 'production') {
//   app.set('trust proxy', 1);
// }

// Set security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  })
);

// Enable CORS
const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
};

// Check if CORS origin is set to wildcard in env
if (process.env.CORS_ORIGIN === '*') {
  corsOptions.origin = '*';
} else if (process.env.CORS_ORIGIN) {
  // Parse comma-separated origins if provided
  const origins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  corsOptions.origin = origins;
} else {
  // Use default based on environment
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

// Handle preflight requests
app.options('*', cors());

// // Development logging
// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// }

// // Limit requests from same IP (only in production)
// if (process.env.NODE_ENV === 'production') {
//   const limiter = rateLimit({
//     max: 100, // limit each IP to 100 requests per windowMs
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     message:
//       'Quá nhiều yêu cầu từ địa chỉ IP này, vui lòng thử lại sau 15 phút!',
//   });
//   app.use('/api', limiter);
// }

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parser
app.use(cookieParser());

// // Data sanitization against XSS
// app.use(xss()); // Commented out to allow HTML in news content

// Compression middleware
app.use(compression());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api', routes);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Không tìm thấy đường dẫn: ${req.originalUrl}`,
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
