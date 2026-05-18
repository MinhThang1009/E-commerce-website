/**
 * @file authController.js
 * @layer Controller
 * @module auth
 * @description Xử lý HTTP request/response cho auth
 */
const ms = require('ms');
const { toAuthUserDto } = require('@modules/auth/dtos/auth-dto');

// Auth Controller — parse req → call service → format res. Mỗi handler là arrow
// function bound vào instance để truyền trực tiếp cho Express router không mất `this`.
class AuthController {
  constructor({ authService }) {
    this.authService = authService;
  }

  _setRefreshCookie(res, refreshToken) {
    const maxAge = ms(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge,
    });
  }

  _clearRefreshCookie(res) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
    });
  }

  register = async (req, res, next) => {
    try {
      const { email, password, firstName, lastName, phone } = req.body;
      const result = await this.authService.register({ email, password, firstName, lastName, phone });
      res.status(201).json({ status: 'success', message: result.message });
    } catch (err) {
      next(err);
    }
  };

  login = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const { token, refreshToken, user } = await this.authService.login({
        email,
        password,
        ip: req.ip,
      });
      this._setRefreshCookie(res, refreshToken);
      res.status(200).json({
        status: 'success',
        token,
        user: toAuthUserDto(user),
      });
    } catch (err) {
      next(err);
    }
  };

  googleLogin = async (req, res, next) => {
    try {
      const { token } = req.body;
      const result = await this.authService.googleLogin({ token });
      this._setRefreshCookie(res, result.refreshToken);
      res.status(200).json({
        status: 'success',
        token: result.token,
        user: toAuthUserDto(result.user),
      });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;
      const refreshToken = req.cookies?.refreshToken || null;
      await this.authService.logout({ accessToken, refreshToken });
      this._clearRefreshCookie(res);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  verifyOtp = async (req, res, next) => {
    try {
      const result = await this.authService.verifyOtp(req.body);
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) {
      next(err);
    }
  };

  resendVerification = async (req, res, next) => {
    try {
      const result = await this.authService.resendVerification(req.body);
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) {
      next(err);
    }
  };

  refreshToken = async (req, res, next) => {
    try {
      // Cookie ưu tiên, fallback body cho migration period
      const refreshTokenValue = req.cookies?.refreshToken || req.body?.refreshToken;
      const result = await this.authService.refreshToken({ refreshToken: refreshTokenValue });
      this._setRefreshCookie(res, result.refreshToken);
      res.status(200).json({ status: 'success', token: result.token });
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req, res, next) => {
    try {
      const result = await this.authService.forgotPassword(req.body);
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req, res, next) => {
    try {
      const result = await this.authService.resetPassword(req.body);
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) {
      next(err);
    }
  };

  getCurrentUser = async (req, res, next) => {
    try {
      const result = await this.authService.getCurrentUser({ userId: req.user.id });
      res.status(200).json({ status: 'success', data: toAuthUserDto(result.user) });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AuthController;
