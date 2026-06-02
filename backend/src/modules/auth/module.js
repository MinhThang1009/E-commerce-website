/**
 * @file module.js
 * @layer Module
 * @module auth
 * @description Entry point auth module — khởi tạo dependencies và đăng ký routes
 */
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');

const AuthController = require('@modules/auth/controllers/auth-controller');
const AuthService = require('@modules/auth/services/auth-service');
const SequelizeAuthRepository = require('@modules/auth/repositories/sequelize-auth-repository');
const buildRoutes = require('@modules/auth/routes');

// Auth module — DI wire repo → service → controller → router.
//
// External service được đóng gói thành adapter object (emailGateway,
// googleVerifier, tokenSigner) để service không phụ thuộc thư
// viện cụ thể. Unit test có thể inject mock dễ dàng.
module.exports = ({ User, logger, emailService }) => {
  if (!User) throw new Error('auth module: User model bắt buộc trong deps');
  if (!logger) throw new Error('auth module: logger bắt buộc trong deps');

  const authRepository = new SequelizeAuthRepository({ User });

  // Adapter: nodemailer-based email service → IEmailGateway port
  const emailGateway = {
    sendOtpEmail: (email, otp) => emailService.sendOtpEmail(email, otp),
    sendResetPasswordEmail: (email, token) => emailService.sendResetPasswordEmail(email, token),
  };

  // Adapter: Google OAuth client + axios fallback → IGoogleVerifier port
  const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const googleVerifier = {
    async verifyIdToken(idToken) {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      return ticket.getPayload();
    },
    async verifyAccessToken(accessToken) {
      const response = await axios.get(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
      );
      return response.data;
    },
  };

  // Adapter: jsonwebtoken → ITokenSigner port. Tách ra interface để service
  // không phụ thuộc lib jwt cụ thể (test mock dễ dàng).
  const tokenSigner = {
    signAccessToken({ id, role }) {
      return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
      });
    },
    signRefreshToken({ id }) {
      return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
      });
    },
    verifyAccessToken(token) {
      return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    },
    verifyRefreshToken(token) {
      // Ràng buộc algorithm tường minh (giống verifyAccessToken) chống tấn công algorithm confusion
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
    },
  };

  const authService = new AuthService({
    authRepository,
    emailGateway,
    googleVerifier,
    tokenSigner,
    logger,
  });

  const authController = new AuthController({ authService });
  const router = buildRoutes({ authController });

  return {
    basePath: '/auth',
    router,
    subscribeEvents() {
      // Auth module hiện không subscribe và không publish event nào.
    },
  };
};
