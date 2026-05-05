const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload');
const { authenticate } = require('../middlewares/authenticate');

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: Quản lý tải lên file
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UploadedFile:
 *       type: object
 *       properties:
 *         filename:
 *           type: string
 *           description: Tên file được tạo ra
 *         originalName:
 *           type: string
 *           description: Tên file gốc
 *         url:
 *           type: string
 *           description: URL của file
 *         size:
 *           type: number
 *           description: Kích thước file tính bằng byte
 */

/**
 * @swagger
 * /api/uploads/{type}/single:
 *   post:
 *     summary: Tải lên một file
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [reviews, products, users]
 *         description: Loại tải lên
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh cần tải lên
 *     responses:
 *       200:
 *         description: Tải file lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/UploadedFile'
 *       400:
 *         description: File không hợp lệ hoặc lỗi tải lên
 *       401:
 *         description: Chưa xác thực
 */
router.post('/:type/single', authenticate, uploadController.uploadSingle);

/**
 * @swagger
 * /api/uploads/{type}/multiple:
 *   post:
 *     summary: Tải lên nhiều file
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [reviews, products, users]
 *         description: Loại tải lên
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Các file ảnh cần tải lên (tối đa 5 cho reviews, 10 cho loại khác)
 *     responses:
 *       200:
 *         description: Tải nhiều file lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     files:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UploadedFile'
 *                     type:
 *                       type: string
 *                     count:
 *                       type: number
 *       400:
 *         description: File không hợp lệ hoặc lỗi tải lên
 *       401:
 *         description: Chưa xác thực
 */
router.post('/:type/multiple', authenticate, uploadController.uploadMultiple);

/**
 * @swagger
 * /api/uploads/{type}/{filename}:
 *   delete:
 *     summary: Xóa file đã tải lên
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [reviews, products, users]
 *         description: Loại tải lên
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Tên file cần xóa
 *     responses:
 *       200:
 *         description: Xóa file thành công
 *       404:
 *         description: Không tìm thấy file
 *       401:
 *         description: Chưa xác thực
 */
router.delete('/:type/:filename', authenticate, uploadController.deleteFile);

module.exports = router;
