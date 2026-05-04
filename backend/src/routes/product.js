const express = require('express');
const router = express.Router();
const productController = require('../controllers/product');
const { validateRequest } = require('../middlewares/validateRequest');
const { productSchema } = require('../validators/product');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { httpCacheHeaders } = require('../middlewares/cache');

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Quản lý sản phẩm
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID sản phẩm
 *         name:
 *           type: string
 *           description: Tên sản phẩm
 *         slug:
 *           type: string
 *           description: Slug sản phẩm dùng cho URL thân thiện SEO
 *         description:
 *           type: string
 *           description: Mô tả chi tiết sản phẩm
 *         shortDescription:
 *           type: string
 *           description: Mô tả ngắn sản phẩm
 *         price:
 *           type: number
 *           description: Giá sản phẩm
 *         compareAtPrice:
 *           type: number
 *           description: Giá gốc để so sánh (giá khuyến mãi)
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Danh sách URL ảnh sản phẩm
 *         thumbnail:
 *           type: string
 *           description: URL ảnh thumbnail sản phẩm
 *         inStock:
 *           type: boolean
 *           description: Trạng thái còn hàng
 *         stockQuantity:
 *           type: integer
 *           description: Số lượng tồn kho hiện có
 *         featured:
 *           type: boolean
 *           description: Sản phẩm nổi bật hay không
 *         rating:
 *           type: number
 *           description: Điểm đánh giá trung bình
 *         reviewCount:
 *           type: integer
 *           description: Số lượt đánh giá
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Ngày tạo
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Ngày cập nhật lần cuối
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Lấy danh sách sản phẩm có phân trang và lọc
 *     tags: [Products]
 *     parameters:
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
 *         description: Số sản phẩm mỗi trang
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
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Lọc theo slug danh mục
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Giá tối thiểu
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Giá tối đa
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: boolean
 *         description: Lọc theo trạng thái còn hàng
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Lọc theo trạng thái nổi bật
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm
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
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     products:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Product'
 */
router.get('/', httpCacheHeaders(60), productController.getAllProducts);

/**
 * @swagger
 * /api/products/recently-viewed:
 *   get:
 *     summary: Lấy danh sách sản phẩm đã xem gần đây của người dùng hiện tại
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số sản phẩm trả về
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm đã xem gần đây
 *       401:
 *         description: Chưa xác thực
 */
router.get('/recently-viewed', authenticate, productController.getRecentlyViewed);

/**
 * @swagger
 * /api/products/featured:
 *   get:
 *     summary: Lấy danh sách sản phẩm nổi bật
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 8
 *         description: Số sản phẩm trả về
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm nổi bật
 */
router.get('/featured', httpCacheHeaders(600), productController.getFeaturedProducts);

/**
 * @swagger
 * /api/products/new-arrivals:
 *   get:
 *     summary: Lấy danh sách sản phẩm mới về
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 8
 *         description: Số sản phẩm trả về
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm mới về
 */
router.get('/new-arrivals', httpCacheHeaders(300), productController.getNewArrivals);

/**
 * @swagger
 * /api/products/best-sellers:
 *   get:
 *     summary: Lấy danh sách sản phẩm bán chạy
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số sản phẩm trả về
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *           default: month
 *         description: Khoảng thời gian tính bán chạy
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm bán chạy
 */
router.get('/best-sellers', productController.getBestSellers);

/**
 * @swagger
 * /api/products/deals:
 *   get:
 *     summary: Lấy danh sách sản phẩm đang giảm giá
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: minDiscount
 *         schema:
 *           type: number
 *           default: 5
 *         description: Phần trăm giảm giá tối thiểu
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *         description: Số sản phẩm trả về
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [discount_desc, price_asc, price_desc]
 *           default: discount_desc
 *         description: Thứ tự sắp xếp
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm đang giảm giá
 */
router.get('/deals', productController.getDeals);

/**
 * @swagger
 * /api/products/filters:
 *   get:
 *     summary: Lấy các bộ lọc sản phẩm khả dụng
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: ID danh mục để lọc
 *     responses:
 *       200:
 *         description: Các bộ lọc khả dụng cho sản phẩm
 */
router.get('/filters', productController.getProductFilters);

/**
 * @swagger
 * /api/products/search:
 *   get:
 *     summary: Tìm kiếm sản phẩm
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm
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
 *         description: Số sản phẩm mỗi trang
 *     responses:
 *       200:
 *         description: Kết quả tìm kiếm
 *       400:
 *         description: Thiếu từ khóa tìm kiếm
 */
router.get('/search', productController.searchProducts);

// GET /api/products/suggestions?q=... — Gợi ý tên sản phẩm theo prefix, trả về tối đa 10 kết quả
router.get('/suggestions', productController.getProductSuggestions);

/**
 * @swagger
 * /api/products/slug/{slug}:
 *   get:
 *     summary: Lấy thông tin sản phẩm theo slug
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug của sản phẩm
 *     responses:
 *       200:
 *         description: Thông tin chi tiết sản phẩm
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.get('/slug/:slug', httpCacheHeaders(300), productController.getProductBySlug);

/**
 * @swagger
 * /api/products/{id}/related:
 *   get:
 *     summary: Lấy danh sách sản phẩm liên quan
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID sản phẩm
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4
 *         description: Số sản phẩm liên quan trả về
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm liên quan
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.get('/:id/related', productController.getRelatedProducts);

/**
 * @swagger
 * /api/products/{id}/variants:
 *   get:
 *     summary: Lấy danh sách biến thể sản phẩm
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID sản phẩm
 *     responses:
 *       200:
 *         description: Danh sách biến thể sản phẩm
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.get('/:id/variants', productController.getProductVariants);

/**
 * @swagger
 * /api/products/{id}/reviews-summary:
 *   get:
 *     summary: Lấy tóm tắt đánh giá của sản phẩm
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID sản phẩm
 *     responses:
 *       200:
 *         description: Tóm tắt đánh giá sản phẩm
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.get('/:id/reviews-summary', productController.getProductReviewsSummary);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Lấy thông tin sản phẩm theo ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID sản phẩm
 *     responses:
 *       200:
 *         description: Chi tiết sản phẩm
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.get('/:id', httpCacheHeaders(300), productController.getProductById);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Tạo sản phẩm mới
 *     tags: [Products]
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
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               shortDescription:
 *                 type: string
 *               price:
 *                 type: number
 *               compareAtPrice:
 *                 type: number
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *               thumbnail:
 *                 type: string
 *               categoryIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               inStock:
 *                 type: boolean
 *                 default: true
 *               stockQuantity:
 *                 type: integer
 *                 default: 0
 *               featured:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Tạo sản phẩm thành công
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
  validateRequest(productSchema),
  productController.createProduct
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Cập nhật sản phẩm
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID sản phẩm
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
 *               shortDescription:
 *                 type: string
 *               price:
 *                 type: number
 *               compareAtPrice:
 *                 type: number
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *               thumbnail:
 *                 type: string
 *               categoryIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               inStock:
 *                 type: boolean
 *               stockQuantity:
 *                 type: integer
 *               featured:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cập nhật sản phẩm thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validateRequest(productSchema),
  productController.updateProduct
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Xóa sản phẩm
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID sản phẩm
 *     responses:
 *       200:
 *         description: Xóa sản phẩm thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  productController.deleteProduct
);

module.exports = router;
