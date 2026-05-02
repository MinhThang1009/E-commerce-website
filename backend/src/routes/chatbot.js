const express = require('express');
const router = express.Router();
const ChatbotController = require('../controllers/chatbot');
const { authenticate } = require('../middlewares/authenticate');

const chatbotController = new ChatbotController();

/**
 * @swagger
 * tags:
 *   name: Chatbot
 *   description: AI Chatbot hỗ trợ bán hàng và chăm sóc khách hàng
 */

/**
 * @swagger
 * /api/chatbot/message:
 *   post:
 *     summary: Gửi tin nhắn đến AI chatbot
 *     tags: [Chatbot]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Tin nhắn của người dùng
 *               userId:
 *                 type: string
 *                 description: ID người dùng (tùy chọn để cá nhân hóa)
 *               sessionId:
 *                 type: string
 *                 description: ID phiên chat
 *               context:
 *                 type: object
 *                 description: Thông tin ngữ cảnh bổ sung (trang hiện tại, giỏ hàng, v.v.)
 *     responses:
 *       200:
 *         description: Phản hồi từ AI
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     response:
 *                       type: string
 *                       description: Phản hồi do AI tạo ra
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Câu hỏi gợi ý tiếp theo
 *                     products:
 *                       type: array
 *                       description: Sản phẩm được gợi ý
 *                     actions:
 *                       type: array
 *                       description: Hành động được gợi ý (thêm vào giỏ hàng, xem sản phẩm, v.v.)
 *                     sessionId:
 *                       type: string
 *                       description: ID phiên chat
 */
router.post('/message', (req, res) =>
  chatbotController.handleMessage(req, res)
);

/**
 * @swagger
 * /api/chatbot/products/search:
 *   post:
 *     summary: Tìm kiếm sản phẩm bằng AI
 *     tags: [Chatbot]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Câu truy vấn tìm kiếm sản phẩm bằng ngôn ngữ tự nhiên
 *               userId:
 *                 type: string
 *                 description: ID người dùng để cá nhân hóa kết quả
 *               limit:
 *                 type: integer
 *                 default: 10
 *                 description: Số sản phẩm trả về
 *     responses:
 *       200:
 *         description: Kết quả tìm kiếm sản phẩm
 */
router.post('/products/search', (req, res) =>
  chatbotController.aiProductSearch(req, res)
);

/**
 * @swagger
 * /api/chatbot/recommendations:
 *   get:
 *     summary: Lấy gợi ý sản phẩm được cá nhân hóa
 *     tags: [Chatbot]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: ID người dùng
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Số lượng gợi ý
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [trending, personal, similar, deals]
 *           default: personal
 *         description: Loại gợi ý
 *     responses:
 *       200:
 *         description: Gợi ý sản phẩm
 */
router.get('/recommendations', (req, res) =>
  chatbotController.getRecommendations(req, res)
);

/**
 * @swagger
 * /api/chatbot/analytics:
 *   post:
 *     summary: Theo dõi analytics tương tác với chatbot
 *     tags: [Chatbot]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 enum: [message_sent, product_clicked, product_added_to_cart, purchase_completed]
 *               userId:
 *                 type: string
 *               sessionId:
 *                 type: string
 *               productId:
 *                 type: string
 *               value:
 *                 type: number
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Ghi nhận analytics thành công
 */
router.post('/analytics', (req, res) =>
  chatbotController.trackAnalytics(req, res)
);

/**
 * @swagger
 * /api/chatbot/cart/add:
 *   post:
 *     summary: Thêm sản phẩm vào giỏ hàng qua chatbot
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: string
 *               variantId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *                 default: 1
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đã thêm sản phẩm vào giỏ hàng
 */
router.post('/cart/add', authenticate, (req, res) =>
  chatbotController.addToCart(req, res)
);

// Endpoint kiểm tra
router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Chatbot API is working!',
    timestamp: new Date().toISOString(),
  });
});

// Endpoint kiểm tra tin nhắn đơn giản
router.post('/test-message', async (req, res) => {
  try {
    const { message } = req.body;

    // Phản hồi đơn giản không cần logic phức tạp
    res.json({
      status: 'success',
      data: {
        response: `Bạn vừa nói: "${message}". Tôi đã nhận được tin nhắn! 😊`,
        suggestions: ['Tìm sản phẩm', 'Xem khuyến mãi', 'Liên hệ hỗ trợ'],
      },
    });
  } catch (error) {
    console.error('Test message error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test failed',
    });
  }
});

// Tin nhắn đơn giản qua controller
router.post('/simple-message', (req, res) =>
  chatbotController.handleSimpleMessage(req, res)
);

module.exports = router;
