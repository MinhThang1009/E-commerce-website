// Cart Controller — parse req → call service → format res. Service xử lý cookie
// gián tiếp qua callback (controller set cookie, service chỉ pass sessionId).
class CartController {
  constructor({ cartService }) {
    this.cartService = cartService;
  }

  getCart = async (req, res, next) => {
    try {
      const { data } = await this.cartService.getCart({
        user: req.user,
        cookieSessionId: req.cookies && req.cookies.sessionId,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getCartCount = async (req, res, next) => {
    try {
      const result = await this.cartService.getCartCount({
        user: req.user,
        cookieSessionId: req.cookies && req.cookies.sessionId,
      });
      res.status(200).json({ status: 'success', data: { count: result.count } });
    } catch (err) { next(err); }
  };

  addToCart = async (req, res, next) => {
    try {
      const setSessionCookie = (sessionId) => {
        res.cookie('sessionId', sessionId, {
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          sameSite: 'strict',
        });
      };

      const { data } = await this.cartService.addToCart({
        user: req.user,
        cookieSessionId: req.cookies && req.cookies.sessionId,
        body: req.body,
        setSessionCookie,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  updateCartItem = async (req, res, next) => {
    try {
      const { data } = await this.cartService.updateCartItem({
        user: req.user,
        cookieSessionId: req.cookies && req.cookies.sessionId,
        itemId: req.params.id,
        quantity: req.body.quantity,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  removeCartItem = async (req, res, next) => {
    try {
      const { data } = await this.cartService.removeCartItem({
        user: req.user,
        cookieSessionId: req.cookies && req.cookies.sessionId,
        itemId: req.params.id,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  clearCart = async (req, res, next) => {
    try {
      const result = await this.cartService.clearCart({
        user: req.user,
        cookieSessionId: req.cookies && req.cookies.sessionId,
      });
      res.status(200).json({ status: 'success', message: result.message, data: result.data });
    } catch (err) { next(err); }
  };

  syncCart = async (req, res, next) => {
    try {
      const { data } = await this.cartService.syncCart({
        user: req.user,
        cookieSessionId: req.cookies && req.cookies.sessionId,
        items: req.body.items,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  mergeCart = async (req, res, next) => {
    try {
      const clearSessionCookie = () => res.clearCookie('sessionId');

      const { data } = await this.cartService.mergeCart({
        user: req.user,
        cookieSessionId: req.cookies && req.cookies.sessionId,
        clearSessionCookie,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  validateCart = async (req, res, next) => {
    try {
      const data = await this.cartService.validateCart({
        user: req.user,
        cookieSessionId: req.cookies && req.cookies.sessionId,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };
}

module.exports = CartController;
