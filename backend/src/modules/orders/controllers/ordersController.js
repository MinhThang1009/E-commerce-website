const { t } = require('../../../utils/i18n');

// Orders Controller — 11 handler. Trả response shape giữ nguyên cũ.
class OrdersController {
  constructor({ ordersService }) {
    this.ordersService = ordersService;
  }

  createOrder = async (req, res, next) => {
    try {
      const data = await this.ordersService.createOrder({
        user: req.user,
        body: req.body,
        sessionIdCookie: req.cookies && req.cookies.sessionId,
      });
      res.status(201).json({ status: 'success', data: { order: data } });
    } catch (err) { next(err); }
  };

  getUserOrders = async (req, res, next) => {
    try {
      const result = await this.ordersService.getUserOrders({
        userId: req.user.id, ...req.query,
      });
      res.status(200).json({ status: 'success', ...result });
    } catch (err) { next(err); }
  };

  getOrderById = async (req, res, next) => {
    try {
      const data = await this.ordersService.getOrderById({
        id: req.params.id, userId: req.user.id, role: req.user.role,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getOrderByNumber = async (req, res, next) => {
    try {
      const data = await this.ordersService.getOrderByNumber({
        number: req.params.number, userId: req.user.id,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  cancelOrder = async (req, res, next) => {
    try {
      const data = await this.ordersService.cancelOrder({
        id: req.params.id, userId: req.user.id, userEmail: req.user.email,
      });
      res.status(200).json({ status: 'success', message: t('orders.cancelled', req.locale), data });
    } catch (err) { next(err); }
  };

  getAllOrders = async (req, res, next) => {
    try {
      const result = await this.ordersService.getAllOrders(req.query);
      res.status(200).json({ status: 'success', ...result });
    } catch (err) { next(err); }
  };

  updateOrderStatus = async (req, res, next) => {
    try {
      const data = await this.ordersService.updateOrderStatus({
        id: req.params.id, status: req.body.status,
      });
      res.status(200).json({
        status: 'success',
        message: t('orders.statusUpdated', req.locale),
        data,
      });
    } catch (err) { next(err); }
  };

  repayOrder = async (req, res, next) => {
    try {
      const origin = req.get('origin') || process.env.FRONTEND_URL;
      const data = await this.ordersService.repayOrder({
        id: req.params.id, userId: req.user.id, originUrl: origin,
      });
      res.status(200).json({
        status: 'success',
        message: t('orders.repaymentReady', req.locale),
        data,
      });
    } catch (err) { next(err); }
  };

  confirmReceived = async (req, res, next) => {
    try {
      const result = await this.ordersService.confirmReceived({
        id: req.params.id, userId: req.user.id,
      });
      res.status(200).json({
        status: 'success',
        message: result.message,
        pointsEarned: result.pointsEarned,
        data: result.data,
      });
    } catch (err) { next(err); }
  };

  trackOrder = async (req, res, next) => {
    try {
      const data = await this.ordersService.trackOrder(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      // Match legacy behavior: 400/404 với plain shape
      if (err.statusCode === 400) {
        return res.status(400).json({ status: 'error', message: err.message });
      }
      if (err.statusCode === 404) {
        return res.status(404).json({ status: 'error', message: err.message });
      }
      next(err);
    }
  };

  estimateShipping = (req, res, next) => {
    try {
      const data = this.ordersService.estimateShipping(req.query);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  };
}

module.exports = OrdersController;
