const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyalty.controller');
const { authenticate } = require('../middlewares/authenticate');

/**
 * @swagger
 * tags:
 *   name: Loyalty
 *   description: Loyalty point management
 */

/**
 * @swagger
 * /api/loyalty:
 *   get:
 *     summary: Get user loyalty points and transaction history
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
 *         description: Loyalty point information
 */
router.get('/', authenticate, loyaltyController.getLoyaltyInfo);

module.exports = router;
