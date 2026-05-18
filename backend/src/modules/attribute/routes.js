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
router.get('/groups', attributeController.getAttributeGroups);
router.get('/products/:productId/groups', attributeController.getProductAttributeGroups);

// Routes tạo tên sản phẩm — công khai cho frontend dùng
router.post('/preview-name', attributeController.previewProductName);
router.post('/generate-name-realtime', attributeController.generateNameRealTime);
router.get('/name-affecting', attributeController.getNameAffectingAttributes);

// Routes admin — yêu cầu xác thực và role admin
router.use(authenticate);
router.use(authorize(['admin']));

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
