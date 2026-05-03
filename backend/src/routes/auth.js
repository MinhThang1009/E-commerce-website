const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  emailSchema,
} = require('../validators/user');
const { authenticate } = require('../middlewares/authenticate');
const { otpLimiter } = require('../middlewares/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Xác thực và phân quyền người dùng
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       409:
 *         description: Email đã tồn tại
 */
router.post(
  '/register',
  validateRequest(registerSchema),
  authController.register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       401:
 *         description: Thông tin đăng nhập không hợp lệ
 */
router.post('/login', validateRequest(loginSchema), authController.login);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Đăng nhập/Đăng ký bằng Google
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 */
router.post('/google', authController.googleLogin);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Đăng xuất thành công
 *       401:
 *         description: Chưa xác thực
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Xác thực email bằng mã OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *     responses:
 *       200:
 *         description: Xác thực email thành công
 *       400:
 *         description: OTP không hợp lệ hoặc đã hết hạn
 */
router.post('/verify-otp', otpLimiter, authController.verifyOtp);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Gửi lại email xác thực
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email xác thực đã được gửi
 *       404:
 *         description: Không tìm thấy người dùng
 */
router.post(
  '/resend-verification',
  validateRequest(emailSchema),
  authController.resendVerification
);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Làm mới access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Làm mới token thành công
 *       401:
 *         description: Refresh token không hợp lệ hoặc đã hết hạn
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Yêu cầu đặt lại mật khẩu
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email đặt lại mật khẩu đã được gửi
 *       404:
 *         description: Không tìm thấy người dùng
 */
router.post(
  '/forgot-password',
  otpLimiter,
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu bằng token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 *       400:
 *         description: Token không hợp lệ hoặc đã hết hạn
 */
router.post(
  '/reset-password',
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Lấy thông tin người dùng hiện tại
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thông tin người dùng thành công
 *       401:
 *         description: Chưa xác thực
 */
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;
