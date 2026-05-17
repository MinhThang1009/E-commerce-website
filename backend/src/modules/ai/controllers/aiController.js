class AiController {
  constructor({ aiService, logger }) {
    this.aiService = aiService;
    this.logger = logger;
  }

  handleMessage = async (req, res) => {
    try {
      const { message, userId, sessionId, context = {} } = req.body;
      this.logger.info('Nhận tin nhắn chatbot:', { message, userId, sessionId });
      const data = await this.aiService.handleMessage({ message, userId, sessionId, context });
      res.json({ status: 'success', data });
    } catch (err) {
      this.logger.error('Lỗi chatbot:', err);
      // Match legacy: 400 cho validation, 500 fallback
      if (err.statusCode === 400) {
        return res.status(400).json({ status: 'error', message: err.message });
      }
      res.status(500).json({
        status: 'error',
        message: 'Xử lý tin nhắn thất bại',
        data: {
          response: 'Xin lỗi, tôi đang gặp một chút vấn đề. Vui lòng thử lại sau ít phút nhé! 😅',
          suggestions: ['Xem sản phẩm hot', 'Tìm khuyến mãi', 'Liên hệ hỗ trợ'],
        },
      });
    }
  };

  productSearch = async (req, res, next) => {
    try {
      const products = await this.aiService.productSearch({
        query: req.body.query,
        limit: req.body.limit,
      });
      res.json({ status: 'success', data: products });
    } catch (err) { next(err); }
  };

  getRecommendations = async (req, res, next) => {
    try {
      const data = await this.aiService.getRecommendations(req.query);
      res.json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  trackAnalytics = async (req, res, next) => {
    try {
      const { event, userId, sessionId, productId, value, metadata } = req.body;
      await this.aiService.trackAnalytics({ event, userId, sessionId, productId, value, metadata, timestamp: new Date() });
      res.json({ status: 'success', message: 'Ghi nhận dữ liệu phân tích thành công' });
    } catch (err) { next(err); }
  };

  addToCart = async (req, res, next) => {
    try {
      const { productId, variantId, quantity = 1, sessionId } = req.body;
      const data = await this.aiService.addToCart({ productId, variantId, quantity, sessionId, userId: req.user.id });
      res.json({ status: 'success', data });
    } catch (err) { next(err); }
  };
}

module.exports = AiController;
