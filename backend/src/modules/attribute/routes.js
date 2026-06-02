/**
 * @file routes.js
 * @layer Route
 * @module attribute
 * @description HTTP endpoints của attribute
 */
const express = require('express');
const router = express.Router();
const attributeController = require('@modules/attribute/controllers/attribute-controller');
const { authenticate } = require('@middlewares/authenticate');
const { authorize } = require('@middlewares/authorize');

// Routes công khai — dùng để hiển thị sản phẩm phía frontend
/**
 * @swagger
 * /api/attributes/groups:
 *   get:
 *     summary: Lấy tất cả nhóm thuộc tính
 *     tags: [Attributes]
 *   post:
 *     summary: Tạo nhóm thuộc tính mới (admin)
 *     tags: [Attributes]
 *     security:
 *       - bearerAuth: []
 * /api/attributes/products/{productId}/groups:
 *   get:
 *     summary: Lấy nhóm thuộc tính của sản phẩm
 *     tags: [Attributes]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 * /api/attributes/preview-name:
 *   post:
 *     summary: Xem trước tên sản phẩm tự động sinh
 *     tags: [Attributes]
 * /api/attributes/generate-name-realtime:
 *   post:
 *     summary: Sinh tên sản phẩm realtime
 *     tags: [Attributes]
 * /api/attributes/name-affecting:
 *   get:
 *     summary: Lấy danh sách thuộc tính ảnh hưởng đến tên sản phẩm
 *     tags: [Attributes]
 * /api/attributes/groups/{id}:
 *   put:
 *     summary: Cập nhật nhóm thuộc tính (admin)
 *     tags: [Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *   delete:
 *     summary: Xóa nhóm thuộc tính (admin)
 *     tags: [Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 * /api/attributes/groups/{attributeGroupId}/values:
 *   post:
 *     summary: Thêm giá trị vào nhóm thuộc tính (admin)
 *     tags: [Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attributeGroupId
 *         required: true
 *         schema:
 *           type: integer
 * /api/attributes/values/{id}:
 *   put:
 *     summary: Cập nhật giá trị thuộc tính (admin)
 *     tags: [Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *   delete:
 *     summary: Xóa giá trị thuộc tính (admin)
 *     tags: [Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 * /api/attributes/products/{productId}/groups/{attributeGroupId}:
 *   post:
 *     summary: Gán nhóm thuộc tính cho sản phẩm (admin)
 *     tags: [Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: attributeGroupId
 *         required: true
 *         schema:
 *           type: integer
 * /api/attributes/batch-generate-names:
 *   post:
 *     summary: Sinh tên hàng loạt cho nhiều sản phẩm (admin)
 *     tags: [Attributes]
 *     security:
 *       - bearerAuth: []
 */
router.get('/groups', attributeController.getAttributeGroups);
router.get('/products/:productId/groups', attributeController.getProductAttributeGroups);

// Routes tạo tên sản phẩm — công khai cho frontend dùng
router.post('/preview-name', attributeController.previewProductName);
router.post('/generate-name-realtime', attributeController.generateNameRealTime);
router.get('/name-affecting', attributeController.getNameAffectingAttributes);

// Routes quản lý thuộc tính — nghiệp vụ bán hàng (cấu hình sản phẩm) → staff
router.use(authenticate);
router.use(authorize('staff'));

// Quản lý nhóm thuộc tính
router.post('/groups', attributeController.createAttributeGroup);
router.put('/groups/:id', attributeController.updateAttributeGroup);
router.delete('/groups/:id', attributeController.deleteAttributeGroup);

// Quản lý giá trị thuộc tính
router.post('/groups/:attributeGroupId/values', attributeController.addAttributeValue);
router.put('/values/:id', attributeController.updateAttributeValue);
router.delete('/values/:id', attributeController.deleteAttributeValue);

// Gán nhóm thuộc tính cho sản phẩm
router.post(
  '/products/:productId/groups/:attributeGroupId',
  attributeController.assignAttributeGroupToProduct,
);

// Tạo tên hàng loạt
router.post('/batch-generate-names', attributeController.batchGenerateProductNames);

module.exports = router;
