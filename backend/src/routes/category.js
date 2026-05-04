const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category');
const { validateRequest } = require('../middlewares/validateRequest');
const { categorySchema } = require('../validators/category');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { httpCacheHeaders } = require('../middlewares/cache');

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Quản lý danh mục
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID danh mục
 *         name:
 *           type: string
 *           description: Tên danh mục
 *         slug:
 *           type: string
 *           description: Slug danh mục dùng cho URL thân thiện SEO
 *         description:
 *           type: string
 *           description: Mô tả danh mục
 *         image:
 *           type: string
 *           description: URL ảnh danh mục
 *         parentId:
 *           type: integer
 *           description: ID danh mục cha
 *         level:
 *           type: integer
 *           description: Cấp độ danh mục trong cây phân cấp
 *         isActive:
 *           type: boolean
 *           description: Trạng thái kích hoạt của danh mục
 *         sortOrder:
 *           type: integer
 *           description: Thứ tự sắp xếp
 *         children:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Category'
 *           description: Danh mục con
 *         productCount:
 *           type: integer
 *           description: Số lượng sản phẩm trong danh mục
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Ngày tạo
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Ngày cập nhật lần cuối
 */

// Route công khai

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Lấy danh sách tất cả danh mục
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: integer
 *         description: Lọc theo ID danh mục cha
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Lọc theo trạng thái kích hoạt
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm
 *     responses:
 *       200:
 *         description: Danh sách danh mục
 */
router.get('/', httpCacheHeaders(1800), categoryController.getAllCategories);

/**
 * @swagger
 * /api/categories/tree:
 *   get:
 *     summary: Lấy cây phân cấp danh mục
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Cây phân cấp danh mục
 */
router.get('/tree', httpCacheHeaders(1800), categoryController.getCategoryTree);

/**
 * @swagger
 * /api/categories/featured:
 *   get:
 *     summary: Lấy danh sách danh mục nổi bật
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Danh sách danh mục nổi bật
 */
router.get('/featured', httpCacheHeaders(1800), categoryController.getFeaturedCategories);

/**
 * @swagger
 * /api/categories/slug/{slug}:
 *   get:
 *     summary: Lấy thông tin danh mục theo slug
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug danh mục
 *     responses:
 *       200:
 *         description: Chi tiết danh mục
 *       404:
 *         description: Không tìm thấy danh mục
 */
router.get('/slug/:slug', categoryController.getCategoryBySlug);

/**
 * @swagger
 * /api/categories/{id}/products:
 *   get:
 *     summary: Lấy danh sách sản phẩm theo danh mục
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID danh mục
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số mục mỗi trang
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Trường để sắp xếp
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Thứ tự sắp xếp
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm trong danh mục
 *       404:
 *         description: Không tìm thấy danh mục
 */
router.get('/:id/products', categoryController.getProductsByCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Lấy thông tin danh mục theo ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID danh mục
 *     responses:
 *       200:
 *         description: Chi tiết danh mục
 *       404:
 *         description: Không tìm thấy danh mục
 */
router.get('/:id', categoryController.getCategoryById);

// Route của admin

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Tạo danh mục mới
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *               parentId:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               sortOrder:
 *                 type: integer
 *                 default: 0
 *     responses:
 *       201:
 *         description: Tạo danh mục thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 */
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validateRequest(categorySchema),
  categoryController.createCategory
);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Cập nhật danh mục
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID danh mục
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *               parentId:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *               sortOrder:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Cập nhật danh mục thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy danh mục
 */
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validateRequest(categorySchema),
  categoryController.updateCategory
);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Xóa danh mục
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID danh mục
 *     responses:
 *       200:
 *         description: Xóa danh mục thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy danh mục
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  categoryController.deleteCategory
);

module.exports = router;
