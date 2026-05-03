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

// Khởi tạo ứng dụng Express
const app = express();

// // Tin tưởng reverse proxy headers khi chạy sau Nginx/PM2
// if (process.env.NODE_ENV === 'production') {
//   app.set('trust proxy', 1);
// }

// Thiết lập các HTTP security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
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

// Ghi log request trong môi trường development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
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
