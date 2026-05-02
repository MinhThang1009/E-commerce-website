const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyalty');
const { authenticate } = require('../middlewares/authenticate');

/**
 * @swagger
 * tags:
 *   name: Loyalty
 *   description: Quản lý điểm tích lũy
 */

/**
 * @swagger
 * /api/loyalty:
 *   get:
 *     summary: Lấy điểm tích lũy và lịch sử giao dịch của người dùng
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Thông tin điểm tích lũy
 */
router.get('/', authenticate, loyaltyController.getLoyaltyInfo);

module.exports = router;
