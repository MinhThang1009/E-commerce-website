/**
 * @file routes.js
 * @layer Route
 * @module warrantyPackage
 * @description HTTP endpoints của warrantyPackage
 */
const express = require('express');
const router = express.Router();
const ctrl = require('@modules/warranty-package/controllers/warranty-package-controller');
const { authenticate } = require('@middlewares/authenticate');
const { adminAuthenticate } = require('@middlewares/admin-auth');
const { validateRequest } = require('@middlewares/validate-request');
const {
  createSchema,
  updateSchema,
} = require('@modules/warranty-package/validators/warranty-package-validator');

/**
 * @swagger
 * /api/warranty-packages:
 *   get:
 *     summary: Lấy danh sách gói bảo hành
 *     tags: [Warranty]
 *   post:
 *     summary: Tạo gói bảo hành mới (admin)
 *     tags: [Warranty]
 *     security:
 *       - bearerAuth: []
 * /api/warranty-packages/product/{productId}:
 *   get:
 *     summary: Lấy gói bảo hành theo sản phẩm
 *     tags: [Warranty]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 * /api/warranty-packages/{id}:
 *   get:
 *     summary: Lấy gói bảo hành theo ID
 *     tags: [Warranty]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *   put:
 *     summary: Cập nhật gói bảo hành (admin)
 *     tags: [Warranty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *   delete:
 *     summary: Xóa gói bảo hành (admin)
 *     tags: [Warranty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get('/', ctrl.getAllWarrantyPackages);
router.get('/product/:productId', ctrl.getWarrantyPackagesByProduct);
router.get('/:id', ctrl.getWarrantyPackageById);

router.post('/', adminAuthenticate, validateRequest(createSchema), ctrl.createWarrantyPackage);
router.put('/:id', adminAuthenticate, validateRequest(updateSchema), ctrl.updateWarrantyPackage);
router.delete('/:id', adminAuthenticate, ctrl.deleteWarrantyPackage);

module.exports = router;
