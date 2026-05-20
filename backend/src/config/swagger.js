const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const SRC_DIR = path.join(__dirname, '..');

const SWAGGER_OPTIONS = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'E-commerce API Documentation',
      version: '1.0.0',
      description: 'Tài liệu API cho website thương mại điện tử',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: process.env.API_URL || `http://localhost:${process.env.PORT || 8888}`,
        description: 'Máy chủ phát triển',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    path.join(SRC_DIR, 'modules', '**', 'routes.js'),
    path.join(SRC_DIR, 'routes', '*.js'),
    path.join(SRC_DIR, 'models', '*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(SWAGGER_OPTIONS);

module.exports = swaggerSpec;
