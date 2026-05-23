/**
 * @file routes.js
 * @layer Route
 * @module upload
 * @description HTTP endpoints của upload
 */
const express = require('express');
const { authenticate } = require('@middlewares/authenticate');

module.exports = ({ uploadController }) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/uploads/{type}/single:
   *   post:
   *     summary: Upload một file theo loại (avatar, product, v.v.)
   *     tags: [Upload]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: type
   *         required: true
   *         schema:
   *           type: string
   *           enum: [avatar, product, reviews, categories, brands, users]
   * /api/uploads/{type}/multiple:
   *   post:
   *     summary: Upload nhiều file theo loại
   *     tags: [Upload]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: type
   *         required: true
   *         schema:
   *           type: string
   * /api/uploads/{type}/{filename}:
   *   delete:
   *     summary: Xóa file đã upload
   *     tags: [Upload]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: type
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: filename
   *         required: true
   *         schema:
   *           type: string
   */
  router.post('/:type/single', authenticate, uploadController.uploadSingle);
  router.post('/:type/multiple', authenticate, uploadController.uploadMultiple);
  router.delete('/:type/:filename', authenticate, uploadController.deleteFile);

  return router;
};
