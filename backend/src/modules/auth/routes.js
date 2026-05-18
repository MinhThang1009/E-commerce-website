/**
 * @file routes.js
 * @layer Route
 * @module auth
 * @description HTTP endpoints của auth
 */
const express = require('express');

const { authenticate } = require('@middlewares/authenticate');
const { otpLimiter } = require('@middlewares/rate-limiter');
const { validateRequest } = require('@middlewares/validate-request');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  emailSchema,
} = require('@modules/auth/validators/auth-validator');

// Auth module routes — mount tại basePath '/auth' (server.js wire vào /api/auth).
// Endpoint URL không đổi so với routes/auth.js cũ → integration tests pass.
module.exports = ({ authController }) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Đăng ký tài khoản mới
   *     tags: [Authentication]
   */
  router.post('/register', validateRequest(registerSchema), authController.register);

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Đăng nhập
   *     tags: [Authentication]
   */
  router.post('/login', validateRequest(loginSchema), authController.login);

  /**
   * @swagger
   * /api/auth/google:
   *   post:
   *     summary: Đăng nhập/Đăng ký bằng Google
   *     tags: [Authentication]
   */
  router.post('/google', authController.googleLogin);

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Đăng xuất
   *     tags: [Authentication]
   */
  router.post('/logout', authenticate, authController.logout);

  /**
   * @swagger
   * /api/auth/verify-otp:
   *   post:
   *     summary: Xác thực email bằng mã OTP
   *     tags: [Authentication]
   */
  router.post('/verify-otp', otpLimiter, authController.verifyOtp);

  /**
   * @swagger
   * /api/auth/resend-verification:
   *   post:
   *     summary: Gửi lại email xác thực
   *     tags: [Authentication]
   */
  router.post(
    '/resend-verification',
    otpLimiter,
    validateRequest(emailSchema),
    authController.resendVerification,
  );

  /**
   * @swagger
   * /api/auth/refresh-token:
   *   post:
   *     summary: Làm mới access token
   *     tags: [Authentication]
   */
  router.post('/refresh-token', authController.refreshToken);

  /**
   * @swagger
   * /api/auth/forgot-password:
   *   post:
   *     summary: Yêu cầu đặt lại mật khẩu
   *     tags: [Authentication]
   */
  router.post(
    '/forgot-password',
    otpLimiter,
    validateRequest(forgotPasswordSchema),
    authController.forgotPassword,
  );

  /**
   * @swagger
   * /api/auth/reset-password:
   *   post:
   *     summary: Đặt lại mật khẩu bằng token
   *     tags: [Authentication]
   */
  router.post(
    '/reset-password',
    validateRequest(resetPasswordSchema),
    authController.resetPassword,
  );

  /**
   * @swagger
   * /api/auth/me:
   *   get:
   *     summary: Lấy thông tin người dùng hiện tại
   *     tags: [Authentication]
   */
  router.get('/me', authenticate, authController.getCurrentUser);

  return router;
};
