/**
 * @file adminService.js
 * @layer Service
 * @module admin
 * @description Business logic layer cho admin
 */
const adminRepository = require('@modules/admin/repositories/sequelize-admin-repository');
const sequelize = adminRepository.getSequelize();
const Op = adminRepository.getOp();
const Sequelize = adminRepository.getSequelizeFns();
const {
  Product,
  ProductImage,
  ProductSpecification,
  ProductVariant,
  ProductAttribute,
  ProductCategory,
  User,
  Order,
  OrderItem,
  Review,
  Category,
  CartItem,
  SearchHistory,
  RecentlyViewed,
  InventoryLog,
  ChatMessage,
  Address,
} = adminRepository.getModels();

const logger = require('@utils/logger');
const { catchAsync } = require('@utils/catch-async');
const { AppError } = require('@shared/errors');
const {
  calculateTotalStock,
  updateProductTotalStock,
  validateVariantAttributes,
  generateVariantSku,
} = require('@utils/product-helpers');
const vectorStoreService = require('@services/vector-store/vector-store');

/**
 * Đệ quy parse chuỗi JSON để xử lý tình huống dữ liệu bị stringify nhiều lần.
 * Gọi JSON.parse liên tục (tối đa 5 lần) đến khi nhận được object hoặc gặp lỗi.
 * @returns {Object} Object đã parse. Trả về `{}` nếu không parse được hoặc kết quả không phải object.
 */
function deepParseJSON(val) {
  let parsed = val;
  let maxAttempts = 5;
  try {
    while (typeof parsed === 'string' && maxAttempts-- > 0) {
      parsed = JSON.parse(parsed);
    }
    if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
      return parsed;
    }
  } catch (_) {
    // không parse được → trả về object rỗng
  }
  return {};
}

/**
 * Trả về bộ thống kê tổng quan cho trang Dashboard admin.
 *
 * Bao gồm: tổng users/products/orders/doanh thu toàn thời gian; số liệu tháng này;
 * MoM growth (tỷ lệ tăng trưởng tháng này so tháng trước = (tháng_này - tháng_trước)
 * / tháng_trước × 100, trả về 0 nếu tháng trước = 0 để tránh chia cho 0); AOV
 * (Average Order Value); top 5 sản phẩm bán chạy; phân bổ đơn theo trạng thái;
 * số đơn hủy tháng; số sản phẩm sắp hết hàng (stockQuantity ≤ 5).
 *
 * Doanh thu chỉ tính đơn `delivered` và paymentStatus không phải `refunded`/`failed`.
 *
 * @param {Object} req - HTTP request từ Express (không dùng params/body/query)
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const getDashboardStats = catchAsync(async (req, res) => {
  logger.info('[CONTROLLER] getDashboardStats started');
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  // Thống kê tổng quan
  const totalUsers = await adminRepository.countUsers({ role: 'customer' });
  logger.info('[DASHBOARD] Lấy totalUsers:', totalUsers);
  const totalProducts = await adminRepository.countProducts();
  logger.info('[DASHBOARD] Lấy totalProducts:', totalProducts);
  const totalOrders = await adminRepository.countOrders();
  logger.info('[DASHBOARD] Lấy totalOrders:', totalOrders);
  const totalRevenue = await adminRepository.sumOrderTotal({
    status: 'delivered',
    paymentStatus: { [Op.notIn]: ['refunded', 'failed'] },
  });
  logger.info('[DASHBOARD] Lấy totalRevenue:', totalRevenue);

  // Thống kê theo tháng
  const monthlyUsers = await adminRepository.countUsers({
    role: 'customer',
    createdAt: { [Op.gte]: startOfMonth },
  });

  const monthlyOrders = await adminRepository.countOrders({
    createdAt: { [Op.gte]: startOfMonth },
  });

  const monthlyRevenue = await adminRepository.sumOrderTotal({
    status: 'delivered',
    paymentStatus: { [Op.notIn]: ['refunded', 'failed'] },
    createdAt: { [Op.gte]: startOfMonth },
  });

  // So sánh với tháng trước
  const lastMonthUsers = await adminRepository.countUsers({
    role: 'customer',
    createdAt: {
      [Op.gte]: startOfLastMonth,
      [Op.lte]: endOfLastMonth,
    },
  });

  const lastMonthOrders = await adminRepository.countOrders({
    createdAt: {
      [Op.gte]: startOfLastMonth,
      [Op.lte]: endOfLastMonth,
    },
  });

  const lastMonthRevenue = await adminRepository.sumOrderTotal({
    status: 'delivered',
    paymentStatus: { [Op.notIn]: ['refunded', 'failed'] },
    createdAt: {
      [Op.gte]: startOfLastMonth,
      [Op.lte]: endOfLastMonth,
    },
  });

  // Tính tỷ lệ tăng trưởng
  const userGrowth = lastMonthUsers ? ((monthlyUsers - lastMonthUsers) / lastMonthUsers) * 100 : 0;
  const orderGrowth = lastMonthOrders
    ? ((monthlyOrders - lastMonthOrders) / lastMonthOrders) * 100
    : 0;
  const revenueGrowth = lastMonthRevenue
    ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  // Top sản phẩm bán chạy
  logger.info('[DASHBOARD] Đang lấy topProducts...');
  let topProducts = [];
  try {
    topProducts = await adminRepository.aggregateOrderItems({
      attributes: [
        'productId',
        [Sequelize.fn('SUM', Sequelize.col('OrderItem.quantity')), 'totalSold'],
        [Sequelize.fn('SUM', Sequelize.col('OrderItem.subtotal')), 'totalRevenue'],
      ],
      include: [
        {
          model: Product,
          attributes: ['nameVi', 'nameEn', 'basePrice'],
          include: [
            {
              model: ProductImage,
              as: 'productImages',
              attributes: ['imageUrl'],
              limit: 1,
            },
          ],
        },
      ],
      group: ['productId', 'Product.id'],
      order: [[Sequelize.fn('SUM', Sequelize.col('OrderItem.quantity')), 'DESC']],
      limit: 5,
    });
    logger.info('[DASHBOARD] Lấy topProducts xong:', topProducts.length);
  } catch (err) {
    logger.error('[DASHBOARD] LỖI khi lấy topProducts:', err.message);
    // Tiếp tục mà không có top products nếu lấy thất bại
  }

  // Breakdown số đơn hàng theo từng trạng thái
  const orderStatusCounts = await adminRepository.aggregateOrders({
    attributes: ['status', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true,
  });
  // Chuyển sang object { pending: N, processing: N, ... } để dễ đọc
  const ordersByStatus = orderStatusCounts.reduce(
    (acc, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    },
    { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
  );

  // AOV = Average Order Value — chia cho đơn delivered (cùng phân mẫu với totalRevenue)
  const deliveredOrders = await adminRepository.countOrders({
    status: 'delivered',
    paymentStatus: { [Op.notIn]: ['refunded', 'failed'] },
  });
  const aov = deliveredOrders > 0 ? (totalRevenue || 0) / deliveredOrders : 0;

  // Đơn hủy trong tháng hiện tại
  const cancelledOrdersMonth = await adminRepository.countOrders({
    status: 'cancelled',
    createdAt: { [Op.gte]: startOfMonth },
  });

  // Sản phẩm sắp hết hàng (stockQuantity <= 10, đồng bộ với widget low-stock trên dashboard)
  const lowStockCount = await adminRepository.countProducts({
    stockQuantity: { [Op.lte]: 10 },
  });

  res.status(200).json({
    status: 'success',
    data: {
      overview: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue || 0,
        aov: parseFloat(aov.toFixed(0)),
        cancelledOrdersMonth,
        lowStockCount,
        ordersByStatus,
      },
      monthly: {
        users: monthlyUsers,
        orders: monthlyOrders,
        revenue: monthlyRevenue || 0,
      },
      growth: {
        users: parseFloat(userGrowth.toFixed(2)),
        orders: parseFloat(orderGrowth.toFixed(2)),
        revenue: parseFloat(revenueGrowth.toFixed(2)),
      },
      topProducts: topProducts.map((item) => {
        const productData = item.Product ? item.Product.toJSON() : {};
        if (productData.productImages) {
          productData.images = productData.productImages.map((img) => img.imageUrl);
          productData.price = productData.basePrice;
        }
        productData.name = productData.nameVi || productData.nameEn || productData.name || '';
        return {
          product: productData,
          totalSold: parseInt(item.getDataValue('totalSold')),
          totalRevenue: parseFloat(item.getDataValue('totalRevenue')),
        };
      }),
    },
  });
});

/**
 * Thống kê chi tiết đơn hàng và user mới trong khoảng thời gian tùy chọn,
 * với khả năng nhóm theo giờ/ngày/tuần/tháng.
 *
 * Loại trừ đơn hàng `cancelled` và paymentStatus `refunded`/`failed`.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - Query parameters:
 * @param {string} req.query.startDate - Ngày bắt đầu (ISO string, bắt buộc)
 * @param {string} req.query.endDate - Ngày kết thúc (ISO string, bắt buộc)
 * @param {string} [req.query.groupBy='day'] - Đơn vị nhóm: `hour` | `day` | `week` | `month`
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 400 nếu thiếu startDate hoặc endDate
 */
const getDetailedStats = catchAsync(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  if (!startDate || !endDate) {
    throw new AppError('Vui lòng cung cấp ngày bắt đầu và ngày kết thúc', 400);
  }

  const start = new Date(startDate);
  // Set end về 23:59:59.999 để bao gồm toàn bộ ngày cuối
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Format theo groupBy
  let dateFormat;
  switch (groupBy) {
    case 'hour':
      dateFormat = '%Y-%m-%d %H:00:00';
      break;
    case 'day':
      dateFormat = '%Y-%m-%d';
      break;
    case 'week':
      dateFormat = '%Y-%u';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  // Thống kê đơn hàng theo thời gian — loại trừ đơn hủy và thanh toán thất bại
  const orderStats = await adminRepository.aggregateOrders({
    attributes: [
      [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat), 'period'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'orderCount'],
      [Sequelize.fn('SUM', Sequelize.col('total')), 'revenue'],
    ],
    where: {
      createdAt: {
        [Op.between]: [start, end],
      },
      status: { [Op.notIn]: ['cancelled'] },
      paymentStatus: { [Op.notIn]: ['refunded', 'failed'] },
    },
    group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat)],
    order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat), 'ASC']],
  });

  // Thống kê user mới theo thời gian
  const userStats = await adminRepository.aggregateUsers({
    attributes: [
      [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat), 'period'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'newUsers'],
    ],
    where: {
      role: 'customer',
      createdAt: {
        [Op.between]: [start, end],
      },
    },
    group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat)],
    order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat), 'ASC']],
  });

  res.status(200).json({
    status: 'success',
    data: {
      orders: orderStats.map((stat) => ({
        period: stat.getDataValue('period'),
        orderCount: parseInt(stat.getDataValue('orderCount')),
        revenue: parseFloat(stat.getDataValue('revenue') || 0),
      })),
      users: userStats.map((stat) => ({
        period: stat.getDataValue('period'),
        newUsers: parseInt(stat.getDataValue('newUsers')),
      })),
    },
  });
});

/**
 * Lấy danh sách user có phân trang, tìm kiếm và lọc. Password và token nhạy cảm
 * bị loại khỏi kết quả.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - Query parameters:
 * @param {number} [req.query.page=1] - Trang hiện tại
 * @param {number} [req.query.limit=20] - Số bản ghi mỗi trang (tối đa 100)
 * @param {string} [req.query.search=''] - Tìm theo firstName, lastName, email, phone
 * @param {string} [req.query.role=''] - Lọc theo role
 * @param {string} [req.query.sortBy='createdAt'] - Trường sắp xếp
 * @param {string} [req.query.sortOrder='DESC'] - `ASC` | `DESC`
 * @param {string} [req.query.isEmailVerified] - Lọc `'true'` hoặc `'false'`
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const getAllUsers = catchAsync(async (req, res) => {
  const {
    page = 1,
    search = '',
    role = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    isEmailVerified,
  } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const offset = (page - 1) * limit;
  const whereClause = {};

  // Filter theo tìm kiếm
  if (search) {
    whereClause[Op.or] = [
      { firstName: { [Op.like]: `%${search}%` } },
      { lastName: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
    ];
  }

  // Filter theo role
  if (role) {
    whereClause.role = role;
  }

  // Filter theo email verification
  if (isEmailVerified !== undefined) {
    whereClause.isEmailVerified = isEmailVerified === 'true';
  }

  const { count, rows: users } = await adminRepository.findUsers({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
    attributes: {
      exclude: ['password', 'verificationToken', 'resetPasswordToken'],
    },
  });

  res.status(200).json({
    status: 'success',
    data: {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit),
      },
    },
  });
});

/**
 * Admin cập nhật thông tin user — có thể thay đổi role, isEmailVerified, isActive
 * (khác user tự cập nhật). Ba ràng buộc: admin không tự đổi role mình; admin không
 * tự deactivate mình; chỉ role `admin` (không phải `manager`) mới đổi role user khác.
 * Chỉ cập nhật trường có trong req.body (dùng hasOwnProperty).
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID user cần cập nhật
 * @param {Object} req.body - `firstName`, `lastName`, `phone`, `role`, `isEmailVerified`, `isActive`
 * @param {Object} req.user - Thông tin admin đang đăng nhập
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 404 nếu không tìm thấy user
 * @throws {AppError} 403 nếu vi phạm ràng buộc bảo vệ
 */
const updateUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, phone, role, isEmailVerified, isActive } = req.body;

  const user = await adminRepository.findUserById(id);
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', 404);
  }

  const numericId = Number(id);

  // Không cho phép user tự update role của chính mình
  if (req.user.id === numericId && role && role !== user.role) {
    throw new AppError('Không thể thay đổi role của chính mình', 403);
  }

  // Không cho phép user tự deactivate tài khoản của chính mình
  if (req.user.id === numericId && isActive === false) {
    throw new AppError('Không thể vô hiệu hóa tài khoản của chính mình', 403);
  }

  // Chỉ admin mới được thay đổi role — manager không có quyền
  if (role && role !== user.role && req.user.role !== 'admin') {
    throw new AppError('Chỉ admin mới có quyền thay đổi role', 403);
  }

  const updatePayload = {
    role: role || user.role,
    isEmailVerified: isEmailVerified !== undefined ? isEmailVerified : user.isEmailVerified,
    isActive: isActive !== undefined ? isActive : user.isActive,
  };
  updatePayload.firstName = req.body.hasOwnProperty('firstName')
    ? firstName || user.firstName
    : user.firstName;
  updatePayload.lastName = req.body.hasOwnProperty('lastName')
    ? lastName || user.lastName
    : user.lastName;
  updatePayload.phone = req.body.hasOwnProperty('phone') ? phone : user.phone;

  const updatedUser = await user.update(updatePayload);

  res.status(200).json({
    status: 'success',
    data: { user: updatedUser },
  });
});

/**
 * Xóa vĩnh viễn user. Admin không được tự xóa chính mình (trả về 403 trước khi
 * truy vấn DB). Dữ liệu liên quan xử lý theo ON DELETE CASCADE trong schema.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID user cần xóa
 * @param {Object} req.user - Thông tin admin đang đăng nhập
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 403 nếu admin tự xóa chính mình
 * @throws {AppError} 404 nếu không tìm thấy user
 */
const deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (String(req.user.id) === String(id)) {
    throw new AppError('Không thể xóa tài khoản của chính mình', 403);
  }

  const user = await adminRepository.findUserById(id);
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', 404);
  }

  await user.destroy();

  res.status(200).json({
    status: 'success',
    message: 'Xóa người dùng thành công',
  });
});

/**
 * Lấy chi tiết user kèm lịch sử hoạt động: 10 đơn hàng gần nhất, 10 điểm tích
 * lũy gần nhất, 10 lịch sử tìm kiếm, 10 sản phẩm xem gần đây.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID user cần xem
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 404 nếu không tìm thấy user
 */
const getUserById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await adminRepository.findUserById(id, {
    include: [
      { model: Address, as: 'addresses' },
      {
        model: Order,
        as: 'orders',
        limit: 10,
        order: [['createdAt', 'DESC']],
      },
      { model: SearchHistory, as: 'searchHistories', limit: 10 },
      { model: RecentlyViewed, as: 'recentlyViewed', limit: 10 },
    ],
  });

  if (!user) {
    throw new AppError('Không tìm thấy người dùng', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

/**
 * Lấy chi tiết đầy đủ sản phẩm cho trang edit admin — kèm danh mục, thuộc tính,
 * biến thể, thông số kỹ thuật, gói bảo hành. Deep-parse các trường JSON lồng nhau:
 * `variants[].attributes` → object; `attributes[].values` → mảng.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID sản phẩm
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 404 nếu không tìm thấy sản phẩm
 */
const getProductById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const product = await adminRepository.findProductById(id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
      {
        model: ProductAttribute,
        as: 'productAttributes',
      },
      {
        model: ProductVariant,
        as: 'variants',
      },
      {
        model: ProductSpecification,
        as: 'productSpecifications',
      },
      {
        model: ProductImage,
        as: 'productImages',
        required: false,
      },
    ],
  });

  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  // Làm sạch dữ liệu sản phẩm trước khi gửi về frontend
  const productJson = product.toJSON();

  if (productJson.attributes && Array.isArray(productJson.attributes)) {
    productJson.attributes = productJson.attributes.map((attr) => ({
      ...attr,
      values: Array.isArray(attr.values) ? attr.values : [],
    }));
  }

  // Deep-parse thuộc tính biến thể (xử lý trường hợp stringify nhiều lần)
  if (productJson.variants && Array.isArray(productJson.variants)) {
    productJson.variants = productJson.variants.map((v) => ({
      ...v,
      attributes: deepParseJSON(v.attributes),
    }));
  }

  res.status(200).json({
    status: 'success',
    data: { product: productJson },
  });
});

/**
 * Tạo sản phẩm mới với đầy đủ thông tin liên quan.
 *
 * Luồng xử lý: (1) Tạo Product cơ bản; (2) Cập nhật compareAtPrice qua raw SQL;
 * (3) Gán danh mục; (4) Tạo ProductAttribute; (5) Tạo ProductVariant + tính tổng
 * stockQuantity; (6) Tạo ProductImage; (7) Tạo ProductSpecification; (8) Liên kết
 * WarrantyPackage (package đầu tiên là isDefault); (9) Đồng bộ vector store AI
 * (bất đồng bộ, không block response).
 *
 * Chấp nhận cả `price` lẫn `basePrice` trong body (tương thích ngược).
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.body - Dữ liệu sản phẩm:
 * @param {string} req.body.name - Tên sản phẩm (bắt buộc)
 * @param {number} req.body.basePrice - Giá gốc (cũng chấp nhận `price`)
 * @param {string} [req.body.status='active'] - `active` | `inactive` | `draft`
 * @param {Array<number>} [req.body.categoryIds=[]] - Danh sách ID danh mục
 * @param {Array<Object>} [req.body.attributes=[]] - Thuộc tính sản phẩm
 * @param {Array<Object>} [req.body.variants=[]] - Biến thể sản phẩm
 * @param {Array} [req.body.images=[]] - URL ảnh (chuỗi hoặc object)
 * @param {Array<Object>} [req.body.specifications=[]] - Thông số kỹ thuật
 * @param {Array<number>} [req.body.warrantyPackageIds=[]] - ID gói bảo hành
 * @param {Object} req.user - Thông tin admin đang đăng nhập
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const createProduct = catchAsync(async (req, res) => {
  logger.info('Dữ liệu request tạo sản phẩm:', JSON.stringify(req.body, null, 2));
  const {
    name,
    baseName,
    description,
    shortDescription,
    basePrice: basePriceField,
    price: priceField,
    comparePrice,
    stock,
    sku,
    status = 'active',
    images,
    stockQuantity = 0,
    featured = false,
    seoTitle,
    seoDescription,
    seoKeywords = [],
    categoryIds = [],
    attributes = [],
    variants = [],
    // Các trường mới dành cho laptop/máy tính
    condition = 'new',
    specifications = {},
    faqs = [],
  } = req.body;

  // Chấp nhận cả 'price' lẫn 'basePrice' từ request body
  const price = basePriceField !== undefined ? basePriceField : priceField;

  // SKU đã chuyển sang product_variants — column products.sku đã drop
  // Giữ uniqueSku cho variant SKU generation
  const uniqueSku = sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Tạo sản phẩm mới
  const product = await adminRepository.createProductFull({
    name,
    baseName: baseName || name,
    description,
    shortDescription: shortDescription || description,
    basePrice: price,
    // Tạm thời bỏ qua compareAtPrice, sẽ cập nhật riêng
    compareAtPrice: null,
    stockQuantity: stock || stockQuantity || 0,
    status,
    isFeatured: featured,
    seoTitle: seoTitle || name,
    seoDescription: seoDescription || description,
    seoKeywords: seoKeywords || [],
    // Các trường mới dành cho laptop/máy tính
    condition,
    specifications: specifications || [],
    faqs: faqs || [],
  });

  // Cập nhật compareAtPrice riêng bằng truy vấn SQL trực tiếp nếu có
  logger.info('comparePrice từ request:', comparePrice);
  if (comparePrice !== undefined) {
    await sequelize.query('UPDATE products SET compare_at_price = :comparePrice WHERE id = :id', {
      replacements: {
        comparePrice: comparePrice,
        id: product.id,
      },
      type: sequelize.QueryTypes.UPDATE,
    });

    // Cập nhật lại giá trị trong đối tượng product
    product.compareAtPrice = comparePrice;
  }

  // Thêm categories nếu có
  if (categoryIds && categoryIds.length > 0) {
    try {
      // Kiểm tra xem có cần tạo category không (dùng cho demo/phát triển)
      // Trong môi trường production, thường chỉ validate với categories đã có

      // Với mỗi category ID, tìm kiếm hoặc tạo placeholder
      const categoryPromises = categoryIds.map(async (catId) => {
        // Thử tìm category trước
        let category = await adminRepository.findCategoryById(catId).catch(() => null);

        // Nếu category không tồn tại và ID là số (từ dữ liệu mock)
        if (!category && /^\d+$/.test(catId)) {
          // Tạo category placeholder với ID là một phần của tên
          // Chỉ dùng cho mục đích phát triển/demo
          category = await adminRepository.createCategory({
            name: `Category ${catId}`,
            slug: `category-${catId}`,
            description: `Category được tạo tự động từ ID ${catId}`,
            isActive: true,
          });
        }

        return category ? category.id : null;
      });

      const validCategoryIds = (await Promise.all(categoryPromises)).filter((id) => id !== null);

      if (validCategoryIds.length > 0) {
        await product.setCategories(validCategoryIds);
      }
    } catch (error) {
      logger.error('Lỗi khi xử lý categories:', error);
      // Tiếp tục mà không có categories nếu có lỗi
    }
  }

  // Xử lý attributes
  if (attributes && attributes.length > 0) {
    try {
      logger.info('Đang xử lý attributes:', attributes);
      const attributePromises = attributes.map(async (attr) => {
        // Xử lý giá trị thuộc tính: nếu là chuỗi có dấu phẩy, tách thành mảng
        let attrValues = [];
        if (typeof attr.value === 'string') {
          // Tách chuỗi thành mảng dựa trên dấu phẩy và loại bỏ khoảng trắng
          attrValues = attr.value
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v);
        } else if (Array.isArray(attr.value)) {
          attrValues = attr.value;
        } else if (attr.value) {
          // Nếu không phải chuỗi hoặc mảng nhưng có giá trị
          attrValues = [String(attr.value)];
        }

        logger.info(`Tạo attribute: ${attr.name} với values:`, attrValues);

        return await adminRepository.createProductAttribute({
          productId: product.id,
          name: attr.name,
          values: attrValues.length > 0 ? attrValues : ['Default'],
        });
      });
      await Promise.all(attributePromises);
    } catch (error) {
      logger.error('Lỗi khi tạo attributes:', error);
      throw error; // Ném lỗi để transaction có thể rollback
    }
  }

  // Xử lý variants
  let createdVariants = [];
  if (variants && variants.length > 0) {
    try {
      logger.info('Đang xử lý variants:', variants);

      // Lấy attributes để validate
      const productAttributes = await adminRepository.findProductAttributes({
        productId: product.id,
      });

      const variantPromises = variants.map(async (variant) => {
        const variantAttributes =
          variant.attributes &&
          typeof variant.attributes === 'object' &&
          !Array.isArray(variant.attributes)
            ? variant.attributes
            : {};

        logger.info(`Đang xử lý variant: ${variant.name}`, {
          price: variant.price,
          stock: variant.stock,
          sku: variant.sku,
          attributes: variantAttributes,
        });

        // Validate variant attributes - bỏ qua validation nếu không có thuộc tính
        // Validation thuộc tính biến thể — tạm thời bỏ qua, để đảm bảo biến thể được tạo

        // Tạo SKU nếu chưa được cung cấp
        const variantSku = variant.sku || generateVariantSku(uniqueSku, variantAttributes);

        logger.info(`Tạo variant với SKU: ${variantSku}`);

        // Tạo tên hiển thị cho variant
        const displayName =
          variant.displayName ||
          (variantAttributes && Object.values(variantAttributes).length > 0
            ? Object.values(variantAttributes).join(' - ')
            : variant.name);

        // Tạo biến thể với dữ liệu đã được xác thực
        return await adminRepository.createProductVariant({
          productId: product.id,
          variantName: variant.name || variant.variantName || displayName || variantSku,
          sku: variantSku,
          attributes: variantAttributes,
          price: parseFloat(variant.price) || 0,
          stockQuantity: parseInt(variant.stock) || 0,
          images: variant.images || [],
          displayName,
          sortOrder: variant.sortOrder || 0,
          isDefault: variant.isDefault || false,
          isAvailable: variant.isAvailable !== false,
        });
      });

      createdVariants = await Promise.all(variantPromises);

      // Cập nhật tổng tồn kho của sản phẩm từ các variants
      const totalStock = calculateTotalStock(createdVariants);
      await adminRepository.updateProductWhere({ stockQuantity: totalStock }, { id: product.id });
    } catch (error) {
      logger.error('Lỗi khi tạo variants:', error);
      throw error;
    }
  }

  // Xử lý hình ảnh (MỚI)
  if (images && Array.isArray(images) && images.length > 0) {
    try {
      const imageData = images.map((img, index) => {
        if (typeof img === 'string') {
          return {
            productId: product.id,
            imageUrl: img,
            isThumbnail: index === 0,
            color: null,
            variantId: null,
          };
        }
        return {
          productId: product.id,
          imageUrl: img.url || img.imageUrl,
          isThumbnail: img.isThumbnail || index === 0,
          color: img.color || null,
          variantId: img.variantId || null,
        };
      });
      await adminRepository.bulkCreateProductImages(imageData);
      logger.info(`Đã tạo ${images.length} ảnh cho sản phẩm ${product.id}`);
    } catch (error) {
      logger.error('Lỗi khi tạo ảnh:', error);
    }
  }

  // Thêm specifications nếu có
  if (specifications && Array.isArray(specifications) && specifications.length > 0) {
    try {
      const specificationData = specifications.map((spec, index) => ({
        productId: product.id,
        name: spec.name,
        value: spec.value,
        category: spec.category || 'General',
        sortOrder: spec.sortOrder || index,
      }));

      await adminRepository.bulkCreateProductSpecs(specificationData);
      logger.info(`Đã tạo ${specifications.length} thông số kỹ thuật cho sản phẩm ${product.id}`);
    } catch (error) {
      logger.error('Lỗi khi tạo specifications:', error);
      // Không throw error để không làm fail toàn bộ quá trình tạo product
    }
  }

  // Lấy lại product với attributes và variants
  const productWithRelations = await adminRepository.findProductById(product.id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
      {
        model: ProductAttribute,
        as: 'productAttributes',
      },
      {
        model: ProductVariant,
        as: 'variants',
      },
      {
        model: ProductImage,
        as: 'productImages',
        attributes: ['imageUrl', 'isThumbnail'],
        required: false,
      },
      {
        model: ProductSpecification,
        as: 'productSpecifications',
      },
    ],
  });

  try {
    const { enrichProductData } = require('@modules/ai/services/product/product-enricher');
    await vectorStoreService.loadPromise;
    if (productWithRelations.status === 'active') {
      await vectorStoreService.upsertProduct(enrichProductData(productWithRelations.toJSON()));
      await vectorStoreService.save();
    }
  } catch (syncErr) {
    logger.error('Lỗi đồng bộ vector store sau khi tạo sản phẩm:', syncErr.message);
  }

  res.status(201).json({
    status: 'success',
    data: { product: productWithRelations },
  });
});

/**
 * Cập nhật sản phẩm trong transaction — áp dụng delta update (chỉ cập nhật trường
 * có trong req.body qua hasOwnProperty). Các bước: (1) thông tin cơ bản;
 * (2) ảnh (replace toàn bộ); (3) compareAtPrice qua raw SQL; (4) danh mục;
 * (5) attributes vi sai; (6) variants vi sai + tính lại stockQuantity;
 * (7) specifications vi sai + auto-translate valueEn background;
 * (8) warranty packages (replace toàn bộ); (9) commit → sync vector store.
 * Sản phẩm inactive bị xóa khỏi vector store index.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID sản phẩm
 * @param {Object} req.body - Các trường cần cập nhật (chỉ trường có trong body mới thay đổi):
 *   `name`, `description`, `price`, `compareAtPrice`, `images`, `stockQuantity`,
 *   `status`, `featured`, `condition`, `seoTitle`, `seoDescription`, `seoKeywords`,
 *   `faqs`, `categoryIds`, `attributes`, `variants`, `specifications`
 * @param {Object} req.user - Thông tin admin đang đăng nhập
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 404 nếu không tìm thấy sản phẩm
 */
const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    baseName,
    description,
    shortDescription,
    price,
    compareAtPrice,
    comparePrice,
    images,
    stockQuantity,
    sku,
    status,
    isFeatured: featured,
    seoTitle,
    seoDescription,
    seoKeywords,
    categoryIds,
    attributes = [],
    variants = [],
    specifications = [],
    faqs = [],
    condition,
  } = req.body;

  // Dùng transaction để đảm bảo tính nguyên tử
  const transaction = await sequelize.transaction();

  try {
    const product = await adminRepository.findProductById(id, { transaction });
    if (!product) {
      await transaction.rollback();
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    const changes = {};
    if (name && name !== product.name) changes.name = { from: product.name, to: name };
    if (price && price !== product.basePrice)
      changes.price = { from: product.basePrice, to: price };

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (req.body.hasOwnProperty('name')) updateData.name = name;
    if (req.body.hasOwnProperty('baseName')) updateData.baseName = req.body.baseName || name;
    if (req.body.hasOwnProperty('description')) updateData.description = description;
    if (req.body.hasOwnProperty('shortDescription')) updateData.shortDescription = shortDescription;
    if (req.body.hasOwnProperty('price')) updateData.basePrice = parseFloat(price?.toString()) || 0;
    if (req.body.hasOwnProperty('stockQuantity'))
      updateData.stockQuantity = parseInt(stockQuantity?.toString()) || 0;
    // SKU đã chuyển sang product_variants — không set trên products nữa
    if (req.body.hasOwnProperty('status')) updateData.status = status;
    if (req.body.hasOwnProperty('featured')) updateData.isFeatured = featured;
    if (req.body.hasOwnProperty('condition')) updateData.condition = condition;
    if (req.body.hasOwnProperty('seoTitle')) updateData.seoTitle = seoTitle;
    if (req.body.hasOwnProperty('seoDescription')) updateData.seoDescription = seoDescription;
    if (req.body.hasOwnProperty('seoKeywords')) updateData.seoKeywords = seoKeywords;
    if (req.body.hasOwnProperty('faqs')) updateData.faqs = faqs;

    // 1. Cập nhật thông tin cơ bản của sản phẩm
    await product.update(updateData, { transaction });

    // 1b. Cập nhật ảnh sản phẩm
    if (req.body.hasOwnProperty('images') && Array.isArray(images)) {
      // Xóa ảnh cũ
      await adminRepository.destroyProductImages({ productId: id }, { transaction });

      if (images.length > 0) {
        const imageData = images.map((img, index) => {
          if (typeof img === 'string') {
            return {
              productId: id,
              imageUrl: img,
              isThumbnail: index === 0,
              color: null,
              variantId: null, // Mặc định null nếu chỉ là chuỗi
            };
          }
          return {
            productId: id,
            imageUrl: img.url || img.imageUrl,
            isThumbnail: img.isThumbnail || index === 0,
            color: img.color || null,
            variantId: img.variantId || null, // Lưu variantId nếu có
          };
        });
        await adminRepository.bulkCreateProductImages(imageData, { transaction });
      }
      changes.imageCount = images.length;
    }

    // 2. Cập nhật compareAtPrice (xử lý đặc biệt do cách đặt tên cột SQL)
    const priceToCompare = req.body.hasOwnProperty('compareAtPrice')
      ? compareAtPrice
      : req.body.hasOwnProperty('comparePrice')
        ? comparePrice
        : null;

    if (req.body.hasOwnProperty('compareAtPrice') || req.body.hasOwnProperty('comparePrice')) {
      await sequelize.query(
        'UPDATE products SET compare_at_price = :compareAtPrice WHERE id = :id',
        {
          replacements: {
            compareAtPrice: priceToCompare === '' ? null : priceToCompare,
            id: id,
          },
          type: sequelize.QueryTypes.UPDATE,
          transaction,
        },
      );
    }

    // 3. Cập nhật categories
    if (req.body.hasOwnProperty('categoryIds') && Array.isArray(categoryIds)) {
      const categories = await adminRepository.findCategories({
        where: { id: categoryIds },
        transaction,
      });
      await product.setCategories(categories, { transaction });
      changes.categories = categoryIds;
    }

    // 4. Cập nhật attributes (cập nhật vi sai)
    if (req.body.hasOwnProperty('attributes') && Array.isArray(attributes)) {
      const currentAttributes = await adminRepository.findProductAttributes(
        { productId: id },
        { transaction },
      );
      const currentAttrMap = currentAttributes.reduce((map, attr) => {
        map[attr.name] = attr;
        return map;
      }, {});

      const newAttrNames = new Set(attributes.map((a) => a.name));

      // 1. Xóa các attributes không có trong danh sách mới
      for (const attr of currentAttributes) {
        if (!newAttrNames.has(attr.name)) {
          await attr.destroy({ transaction });
        }
      }

      // 2. Tạo mới hoặc cập nhật attributes
      const attributePromises = attributes.map(async (attr) => {
        let attrValues = [];
        if (typeof attr.value === 'string') {
          attrValues = attr.value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        } else if (Array.isArray(attr.value)) {
          attrValues = attr.value;
        } else if (Array.isArray(attr.values)) {
          attrValues = attr.values;
        } else if (attr.value) {
          attrValues = [String(attr.value)];
        }

        const normalizedValues = attrValues.length > 0 ? attrValues : ['Default'];

        if (currentAttrMap[attr.name]) {
          // Cập nhật attribute đã có
          return await currentAttrMap[attr.name].update(
            {
              values: normalizedValues,
              type: attr.type || currentAttrMap[attr.name].type || 'custom',
              required:
                attr.required !== undefined ? attr.required : currentAttrMap[attr.name].required,
            },
            { transaction },
          );
        } else {
          // Tạo attribute mới
          return await adminRepository.createProductAttribute(
            {
              productId: id,
              name: attr.name,
              values: normalizedValues,
              type: attr.type || 'custom',
              required: attr.required || false,
            },
            { transaction },
          );
        }
      });
      await Promise.all(attributePromises);
      changes.attributes = attributes.length;
    }

    // 5. Cập nhật variants (cập nhật vi sai)
    if (req.body.hasOwnProperty('variants') && Array.isArray(variants)) {
      const currentVariants = await adminRepository.findProductVariants(
        { productId: id },
        { transaction },
      );
      const currentVarMap = currentVariants.reduce((map, v) => {
        map[v.id] = v;
        return map;
      }, {});

      // Dùng Set để tra cứu nhanh các ID đầu vào
      const incomingVarIds = new Set(
        variants.filter((v) => v.id && !String(v.id).startsWith('var-')).map((v) => v.id),
      );

      // 1. Xóa các variants không có trong danh sách đầu vào
      for (const variant of currentVariants) {
        if (!incomingVarIds.has(variant.id)) {
          await variant.destroy({ transaction });
        }
      }

      // 2. Tạo mới hoặc cập nhật variants
      const finalVariants = [];
      const variantPromises = variants.map(async (variant, index) => {
        const rawAttrs = variant.attributes || variant.attributeValues;
        const variantAttributes =
          rawAttrs && typeof rawAttrs === 'object' && !Array.isArray(rawAttrs) ? rawAttrs : {};

        const variantSku = variant.sku || generateVariantSku(sku || 'PROD', variantAttributes);

        const derivedName =
          variant.name ||
          variant.variantName ||
          Object.values(variantAttributes).join(' - ') ||
          variantSku;
        const variantData = {
          variantName: derivedName,
          sku: variantSku,
          attributes: variantAttributes,
          attributeValues: variantAttributes,
          price: parseFloat(variant.price?.toString()) || 0,
          stockQuantity: parseInt((variant.stock || variant.stockQuantity || 0).toString()) || 0,
          images: variant.images || [],
          isDefault: variant.isDefault || (index === 0 && !variants.some((v) => v.isDefault)),
          isAvailable: variant.isAvailable !== false,
          compareAtPrice: variant.compareAtPrice || null,
          displayName: variant.displayName || derivedName,
        };

        if (variant.id && currentVarMap[variant.id]) {
          // Cập nhật variant đã có
          const updated = await currentVarMap[variant.id].update(variantData, { transaction });
          finalVariants.push(updated);
          return updated;
        } else {
          // Tạo variant mới
          const created = await adminRepository.createProductVariant(
            {
              ...variantData,
              productId: id,
              // Chỉ dùng ID nếu là UUID hợp lệ (không phải ID tạm như 'var-0')
              id: variant.id && !String(variant.id).startsWith('var-') ? variant.id : undefined,
            },
            { transaction },
          );
          finalVariants.push(created);
          return created;
        }
      });

      await Promise.all(variantPromises);
      changes.variants = variants.length;

      // Lưu ảnh riêng cho từng variant vào product_images (variantId)
      for (let i = 0; i < variants.length; i++) {
        const variantInput = variants[i];
        const savedVariant = finalVariants[i];
        if (
          !savedVariant ||
          !Array.isArray(variantInput.images) ||
          variantInput.images.length === 0
        )
          continue;

        // Xóa ảnh cũ của variant này
        await adminRepository.destroyProductImages(
          { productId: id, variantId: savedVariant.id },
          { transaction },
        );

        // Tạo ảnh mới gắn với variantId
        const variantImageData = variantInput.images
          .filter((url) => url && typeof url === 'string')
          .map((url, idx) => ({
            productId: id,
            variantId: savedVariant.id,
            imageUrl: url,
            isThumbnail: idx === 0,
            color: null,
          }));
        if (variantImageData.length > 0) {
          await adminRepository.bulkCreateProductImages(variantImageData, { transaction });
        }
      }

      // Đồng bộ tổng tồn kho và basePrice (= min variant price) để sort admin hoạt động đúng
      const totalStock = calculateTotalStock(finalVariants);
      const minVariantPrice =
        finalVariants.length > 0
          ? Math.min(...finalVariants.map((v) => parseFloat(v.price) || 0).filter((p) => p > 0))
          : null;
      const stockUpdate = { stockQuantity: totalStock };
      if (minVariantPrice !== null && minVariantPrice > 0) stockUpdate.basePrice = minVariantPrice;
      await adminRepository.updateProductWhere(stockUpdate, { id }, { transaction });
    } else if (req.body.hasOwnProperty('stockQuantity')) {
      // Nếu không có variants, dùng tồn kho cơ bản
      await adminRepository.updateProductWhere(
        { stockQuantity: parseInt(stockQuantity?.toString()) || 0 },
        { id },
        { transaction },
      );
    }

    // 6. Cập nhật thông số kỹ thuật (cập nhật vi sai)
    if (req.body.hasOwnProperty('specifications') && Array.isArray(specifications)) {
      const currentSpecs = await adminRepository.findProductSpecs(
        { productId: id },
        { transaction },
      );
      const currentSpecMap = currentSpecs.reduce((map, spec) => {
        map[spec.name] = spec;
        return map;
      }, {});

      const incomingSpecNames = new Set(specifications.map((s) => s.name));

      // 1. Xóa các thông số không có trong danh sách mới
      for (const spec of currentSpecs) {
        if (!incomingSpecNames.has(spec.name)) {
          await spec.destroy({ transaction });
        }
      }

      // 2. Tạo mới hoặc cập nhật thông số
      const specPromises = specifications.map(async (spec, index) => {
        const specData = {
          name: spec.name,
          value: spec.value,
          valueEn: spec.valueEn || null,
          category: spec.category || 'General',
          sortOrder: spec.sortOrder || index,
        };

        if (currentSpecMap[spec.name]) {
          return await currentSpecMap[spec.name].update(specData, { transaction });
        } else {
          return await ProductSpecification.create(
            {
              ...specData,
              productId: id,
            },
            { transaction },
          );
        }
      });
      const savedSpecs = await Promise.all(specPromises);
      changes.specifications = specifications.length;

      // Translate background — không block response admin
      const specsNeedTranslation = savedSpecs.filter((s) => !s.valueEn && s.value);
      if (specsNeedTranslation.length > 0) {
        setImmediate(async () => {
          try {
            const { translateBatch } = require('@modules/ai/services/translate/translate-service');
            const translated = await translateBatch(specsNeedTranslation.map((s) => s.value));
            await Promise.all(
              specsNeedTranslation.map((s, i) => s.update({ valueEn: translated[i] || null })),
            );
            logger.info(
              `[Translate] Đã dịch ${specsNeedTranslation.length} specs cho product ${id}`,
            );
          } catch (err) {
            logger.warn(`[Translate] Lỗi auto-translate specs product ${id}:`, err.message);
          }
        });
      }
    }

    await transaction.commit();

    // Lấy trạng thái cuối cùng để trả về response
    const finalProduct = await adminRepository.findProductById(id, {
      include: [
        { model: Category, as: 'categories', through: { attributes: [] } },
        { model: ProductAttribute, as: 'productAttributes' },
        { model: ProductVariant, as: 'variants' },
        {
          model: ProductImage,
          as: 'productImages',
          attributes: ['imageUrl', 'isThumbnail'],
          required: false,
        },
        { model: ProductSpecification, as: 'productSpecifications' },
      ],
    });

    try {
      const { enrichProductData } = require('@modules/ai/services/product/product-enricher');
      await vectorStoreService.loadPromise;
      if (finalProduct && finalProduct.status === 'active') {
        await vectorStoreService.upsertProduct(enrichProductData(finalProduct.toJSON()));
      } else if (finalProduct) {
        vectorStoreService.items = vectorStoreService.items.filter(
          (item) => item.metadata.id !== finalProduct.id,
        );
      }
      await vectorStoreService.save();
    } catch (syncErr) {
      logger.error('Lỗi đồng bộ vector store sau khi cập nhật sản phẩm:', syncErr.message);
    }

    res.status(200).json({
      status: 'success',
      data: { product: finalProduct },
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    logger.error('Lỗi khi cập nhật sản phẩm:', error);
    throw error;
  }
});

/**
 * Xóa vĩnh viễn sản phẩm và dữ liệu liên quan trong transaction. Thứ tự xóa:
 * CartItem → Wishlist → ProductAttribute → ProductVariant → ProductCategory → Product.
 * OrderItem không bị xóa để giữ lịch sử đơn hàng (intentional).
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID sản phẩm
 * @param {Object} req.user - Thông tin admin đang đăng nhập
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 404 nếu không tìm thấy sản phẩm
 */
const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  const product = await adminRepository.findProductById(id);
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
  const transaction = await sequelize.transaction();

  try {
    // Xóa các bản ghi liên quan trong cart_items
    await adminRepository.destroyCartItems({ productId: id }, { transaction });

    // Xóa các bản ghi liên quan trong order_items (hoặc có thể cân nhắc giữ lại lịch sử đơn hàng)
    // Nếu muốn giữ lại lịch sử đơn hàng, có thể bỏ dòng này
    // await OrderItem.destroy({ where: { productId: id }, transaction });

    // Xóa các bản ghi liên quan trong wishlist
    await adminRepository.destroyWishlists({ productId: id }, { transaction });

    // Xóa các thuộc tính của sản phẩm
    await adminRepository.destroyProductAttributes({ productId: id }, { transaction });

    // Xóa các biến thể của sản phẩm
    await adminRepository.destroyProductVariants({ productId: id }, { transaction });

    // Xóa các liên kết danh mục
    await adminRepository.destroyProductCategories({ productId: id }, { transaction });

    // Cuối cùng xóa sản phẩm
    await product.destroy({ transaction });

    // Commit transaction nếu tất cả thành công
    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Xóa sản phẩm thành công',
    });
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await transaction.rollback();
    throw error;
  }
});

/**
 * Lấy danh sách sản phẩm có phân trang và bộ lọc đa tiêu chí cho trang quản lý admin.
 *
 * Trả về đầy đủ quan hệ: danh mục, biến thể, thuộc tính, thông số, gói bảo hành, ảnh.
 * Dữ liệu được transform: `productImages → images[]`, `basePrice → price`,
 * gộp category trực tiếp vào mảng `categories`.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - Query parameters:
 * @param {number} [req.query.page=1] - Trang hiện tại
 * @param {number} [req.query.limit=20] - Số bản ghi mỗi trang (tối đa 100)
 * @param {string} [req.query.search=''] - Tìm kiếm theo name, description, sku
 * @param {string} [req.query.category=''] - Lọc theo ID danh mục
 * @param {string} [req.query.status=''] - Lọc trạng thái: `active`|`inactive`|`draft`
 * @param {string} [req.query.sortBy='createdAt'] - Trường sắp xếp (dùng `price` → sort theo basePrice)
 * @param {string} [req.query.sortOrder='DESC'] - Thứ tự: `ASC` | `DESC`
 * @param {number} [req.query.priceMin] - Giá tối thiểu
 * @param {number} [req.query.priceMax] - Giá tối đa
 * @param {number} [req.query.stockMin] - Tồn kho tối thiểu
 * @param {number} [req.query.stockMax] - Tồn kho tối đa
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const getAllProducts = catchAsync(async (req, res) => {
  const {
    page = 1,
    search = '',
    category = '',
    status = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    priceMin,
    priceMax,
    stockMin,
    stockMax,
  } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const offset = (page - 1) * limit;
  const whereClause = {};

  // Filter theo tìm kiếm — dùng tên cột thật (sku ở product_variants, không phải products)
  if (search) {
    whereClause[Op.or] = [
      { nameVi: { [Op.like]: `%${search}%` } },
      { nameEn: { [Op.like]: `%${search}%` } },
      { shortDescriptionVi: { [Op.like]: `%${search}%` } },
    ];
  }

  // Filter theo status
  if (status) {
    whereClause.status = status;
  }

  // Filter theo giá (sử dụng basePrice theo schema mới)
  if (priceMin) {
    whereClause.basePrice = {
      ...whereClause.basePrice,
      [Op.gte]: parseFloat(priceMin),
    };
  }
  if (priceMax) {
    whereClause.basePrice = {
      ...whereClause.basePrice,
      [Op.lte]: parseFloat(priceMax),
    };
  }

  // Filter theo stock — dùng Product.stockQuantity (denormalized).
  // Giá trị display được recalculate từ variants sau query (xem transform bên dưới).
  // Nếu Product.stockQuantity lệch so với tổng variants, filter có thể trả kết quả không chính xác.
  // Fix đúng cần HAVING SUM(variants.stockQuantity) nhưng phá vỡ pagination — chấp nhận limitation này.
  if (stockMin) {
    whereClause.stockQuantity = {
      ...whereClause.stockQuantity,
      [Op.gte]: parseInt(stockMin),
    };
  }
  if (stockMax) {
    whereClause.stockQuantity = {
      ...whereClause.stockQuantity,
      [Op.lte]: parseInt(stockMax),
    };
  }

  const includeClause = [
    {
      model: Category,
      as: 'category',
    },
    {
      model: Category,
      as: 'categories',
      through: { attributes: [] },
    },
    {
      model: ProductVariant,
      as: 'variants',
      required: false,
    },
    {
      model: ProductAttribute,
      as: 'productAttributes',
      required: false,
    },
    {
      model: ProductSpecification,
      as: 'productSpecifications',
      required: false,
    },
    {
      model: ProductImage,
      as: 'productImages',
      attributes: ['imageUrl', 'color', 'isThumbnail'],
      required: false,
    },
  ];

  // Filter theo category — dùng required: true để INNER JOIN, loại sản phẩm không thuộc category
  if (category) {
    includeClause[1].where = { id: category };
    includeClause[1].required = true;
  }

  logger.info('[ADMIN] Đang lấy danh sách sản phẩm...');
  try {
    const { count, rows: products } = await adminRepository.findProducts({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [
        sortBy === 'stockQuantity' || sortBy === 'stock'
          ? [
              Sequelize.literal(
                '(SELECT COALESCE(SUM(pv.stock_quantity), 0) FROM product_variants pv WHERE pv.product_id = `Product`.`id` AND pv.deleted_at IS NULL)',
              ),
              sortOrder.toUpperCase(),
            ]
          : [
              sortBy === 'price' ? 'basePrice' : sortBy === 'name' ? 'nameVi' : sortBy,
              sortOrder.toUpperCase(),
            ],
      ],
      distinct: true,
    });
    logger.info('[ADMIN] Lấy sản phẩm xong:', products.length);

    // Transform dữ liệu để tương thích với Frontend
    const transformedProducts = products.map((p) => {
      const product = p.toJSON();

      // Chuyển đổi images: mảng object {imageUrl} -> mảng string
      product.images = product.productImages?.map((img) => img.imageUrl) || [];

      // Chuyển đổi price: basePrice -> price
      product.price = product.basePrice;

      // Chuyển đổi categories: gộp direct category và many-to-many categories
      if (!product.categories) product.categories = [];
      if (product.category) {
        if (!product.categories.some((cat) => cat.id === product.category.id)) {
          product.categories.push(product.category);
        }
      }

      // Tính tổng tồn kho từ variants (nguồn chính xác), không dùng Product.stockQuantity (có thể lệch)
      if (product.variants && product.variants.length > 0) {
        product.stockQuantity = product.variants.reduce(
          (sum, v) => sum + (v.stockQuantity || 0),
          0,
        );
      }

      return product;
    });

    res.status(200).json({
      status: 'success',
      data: {
        products: transformedProducts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (err) {
    logger.error('[ADMIN] LỖI khi lấy danh sách sản phẩm:', err.message);
    throw err;
  }
});

/**
 * Lấy danh sách đánh giá sản phẩm có phân trang và lọc theo sản phẩm hoặc
 * điểm số. Kết quả kèm thông tin user (id, tên, avatar) và sản phẩm (id, tên, slug).
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - Query parameters:
 * @param {number} [req.query.page=1] - Trang hiện tại
 * @param {number} [req.query.limit=20] - Số bản ghi mỗi trang (tối đa 100)
 * @param {string} [req.query.productId=''] - Lọc theo ID sản phẩm
 * @param {number} [req.query.rating=''] - Lọc theo điểm số (1–5)
 * @param {string} [req.query.sortBy='createdAt'] - Trường sắp xếp
 * @param {string} [req.query.sortOrder='DESC'] - Thứ tự: `ASC` | `DESC`
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const getAllReviews = catchAsync(async (req, res) => {
  const {
    page = 1,
    productId = '',
    rating = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
  } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const offset = (page - 1) * limit;
  const whereClause = {};

  // Filter theo product
  if (productId) {
    whereClause.productId = productId;
  }

  // Filter theo rating
  if (rating) {
    whereClause.rating = parseInt(rating);
  }

  const { count, rows: reviews } = await adminRepository.findReviews({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'avatar'],
      },
      {
        model: Product,
        attributes: ['id', 'nameVi', 'nameEn', 'slug'],
      },
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

  res.status(200).json({
    status: 'success',
    data: {
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit),
      },
    },
  });
});

/**
 * Xóa vĩnh viễn một đánh giá sản phẩm.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID đánh giá cần xóa
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 404 nếu không tìm thấy đánh giá
 */
const deleteReview = catchAsync(async (req, res) => {
  const { id } = req.params;

  const review = await adminRepository.findReviewById(id);
  if (!review) {
    throw new AppError('Không tìm thấy đánh giá', 404);
  }

  await review.destroy();

  res.status(200).json({
    status: 'success',
    message: 'Xóa đánh giá thành công',
  });
});

/**
 * Lấy danh sách tất cả đơn hàng có phân trang, lọc theo trạng thái, khoảng thời
 * gian, và tìm kiếm theo số đơn. Kết quả kèm thông tin user và sản phẩm trong đơn
 * (kèm ảnh thumbnail). Dữ liệu được transform: `productImages → images[]`, `basePrice → price`.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - Query parameters:
 * @param {number} [req.query.page=1] - Trang hiện tại
 * @param {number} [req.query.limit=20] - Số bản ghi mỗi trang (tối đa 100)
 * @param {string} [req.query.status=''] - Lọc theo trạng thái đơn
 * @param {string} [req.query.search=''] - Tìm kiếm theo số đơn hàng (`number`)
 * @param {string} [req.query.sortBy='createdAt'] - Trường sắp xếp
 * @param {string} [req.query.sortOrder='DESC'] - Thứ tự: `ASC` | `DESC`
 * @param {string} [req.query.startDate] - Lọc từ ngày (ISO string)
 * @param {string} [req.query.endDate] - Lọc đến ngày (ISO string)
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const getAllOrders = catchAsync(async (req, res) => {
  const {
    page = 1,
    status = '',
    search = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    startDate,
    endDate,
  } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const offset = (page - 1) * limit;
  const whereClause = {};

  // Filter theo status
  if (status) {
    whereClause.status = status;
  }

  // Filter theo ngày
  if (startDate && endDate) {
    whereClause.createdAt = {
      [Op.between]: [
        new Date(startDate),
        (() => {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          return e;
        })(),
      ],
    };
  }

  // Filter theo tìm kiếm trong order number
  if (search) {
    whereClause[Op.or] = [{ number: { [Op.like]: `%${search}%` } }];
  }

  const includeClause = [
    {
      model: User,
      attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
    },
    {
      model: OrderItem,
      as: 'items',
      include: [
        {
          model: Product,
          attributes: ['id', 'nameVi', 'nameEn', 'basePrice'],
          include: [
            {
              model: ProductImage,
              as: 'productImages',
              attributes: ['imageUrl'],
              limit: 1,
            },
          ],
        },
      ],
    },
  ];

  logger.info('[ADMIN] Đang lấy danh sách đơn hàng...');
  try {
    const { count, rows: orders } = await adminRepository.findOrders({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true,
    });
    logger.info('[ADMIN] Lấy đơn hàng xong:', orders.length);

    // Transform dữ liệu đơn hàng
    const transformedOrders = orders.map((o) => {
      const order = o.toJSON();
      if (order.items) {
        order.items = order.items.map((item) => {
          if (item.Product) {
            // Chuyển đổi images: mảng object {imageUrl} -> mảng string
            item.Product.images = item.Product.productImages?.map((img) => img.imageUrl) || [];
            // Chuyển đổi price: basePrice -> price
            item.Product.price = item.Product.basePrice;
          }
          return item;
        });
      }
      return order;
    });

    res.status(200).json({
      status: 'success',
      data: {
        orders: transformedOrders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (err) {
    logger.error('[ADMIN] LỖI khi lấy danh sách đơn hàng:', err.message);
    throw err;
  }
});

/**
 * Cập nhật trạng thái và/hoặc trạng thái thanh toán của đơn hàng.
 *
 * Hai nhánh xử lý đặc biệt:
 * - `delivered` + COD → tự động set `paymentStatus = 'paid'`.
 * - `cancelled` (đơn chưa bị hủy) → chạy trong transaction: cập nhật trạng thái
 *   + hoàn tồn kho cho từng sản phẩm/variant. Hàm chỉ load `OrderItem` khi cần
 *   hủy (tối ưu: tránh JOIN không cần thiết cho các thao tác thông thường).
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID đơn hàng
 * @param {Object} req.body - Dữ liệu cập nhật:
 * @param {string} [req.body.status] - Trạng thái mới: `pending`|`processing`|`shipped`|`delivered`|`cancelled`
 * @param {string} [req.body.paymentStatus] - Trạng thái thanh toán mới
 * @param {string} [req.body.note] - Ghi chú (truyền `''` để xóa note)
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 404 nếu không tìm thấy đơn hàng
 */
const updateOrderStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus, note } = req.body;

  // Khi hủy đơn: cần load items để hoàn tồn kho
  const order = await adminRepository.findOrderById(id, {
    include:
      status === 'cancelled'
        ? [
            {
              model: OrderItem,
              as: 'items',
              include: [{ model: Product }, { model: ProductVariant }],
            },
          ]
        : [],
  });
  if (!order) {
    throw new AppError('Không tìm thấy đơn hàng', 404);
  }

  const updateData = {
    status: status || order.status,
    paymentStatus: paymentStatus || order.paymentStatus,
    note: note || (note === '' ? null : order.note),
  };

  // Tự động cập nhật trạng thái thanh toán thành 'paid' nếu đơn hàng đã giao thành công và thanh toán bằng COD
  if (status === 'delivered' && order.paymentMethod === 'cod') {
    updateData.paymentStatus = 'paid';
  }

  // Khi chuyển sang cancelled: hoàn tồn kho trong transaction
  if (status === 'cancelled' && order.status !== 'cancelled') {
    await sequelize.transaction(async (t) => {
      await order.update(updateData, { transaction: t });
      for (const item of order.items || []) {
        if (item.variantId && item.ProductVariant) {
          await item.ProductVariant.update(
            { stockQuantity: item.ProductVariant.stockQuantity + item.quantity },
            { transaction: t },
          );
        } else if (item.Product) {
          await item.Product.update(
            { stockQuantity: item.Product.stockQuantity + item.quantity },
            { transaction: t },
          );
        }
      }
    });
    const updatedOrder = await adminRepository.findOrderById(id);
    return res.status(200).json({ status: 'success', data: { order: updatedOrder } });
  }

  const updatedOrder = await order.update(updateData);

  res.status(200).json({
    status: 'success',
    data: { order: updatedOrder },
  });
});

/**
 * Admin hủy đơn hàng và hoàn tồn kho — chuyên biệt hơn `updateOrderStatus`.
 *
 * Kiểm tra nghiệp vụ trước khi hủy: không hủy đơn đã bị hủy (tránh hoàn kho
 * 2 lần), không hủy đơn đã giao. Toàn bộ trong transaction: cập nhật
 * `status = 'cancelled'` + tăng `stockQuantity` theo từng item.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID đơn hàng cần hủy
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 404 nếu không tìm thấy đơn hàng
 * @throws {AppError} 400 nếu đơn đã bị hủy hoặc đã giao
 */
const adminCancelOrder = catchAsync(async (req, res) => {
  const { id } = req.params;

  const order = await adminRepository.findOrderById(id, {
    include: [
      {
        model: OrderItem,
        as: 'items',
        include: [{ model: Product }, { model: ProductVariant }],
      },
    ],
  });

  if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);
  if (order.status === 'cancelled') throw new AppError('Đơn hàng đã bị hủy trước đó', 400);
  if (order.status === 'delivered') throw new AppError('Không thể hủy đơn hàng đã giao', 400);

  await sequelize.transaction(async (t) => {
    await order.update({ status: 'cancelled' }, { transaction: t });

    // Hoàn tồn kho cho từng sản phẩm trong đơn
    for (const item of order.items) {
      if (item.variantId && item.ProductVariant) {
        await item.ProductVariant.update(
          { stockQuantity: item.ProductVariant.stockQuantity + item.quantity },
          { transaction: t },
        );
      } else if (item.Product) {
        await item.Product.update(
          { stockQuantity: item.Product.stockQuantity + item.quantity },
          { transaction: t },
        );
      }
    }
  });

  res.status(200).json({
    status: 'success',
    message: 'Đã hủy đơn hàng và hoàn tồn kho thành công',
    data: { orderId: parseInt(id), status: 'cancelled' },
  });
});

/**
 * Ghi đè tồn kho sản phẩm bằng một giá trị tuyệt đối — dùng cho trang Inventory.
 *
 * Khác với `restockProduct` (cộng thêm + ghi log), hàm này đặt thẳng giá trị
 * `stockQuantity` mà không tạo `InventoryLog`.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID sản phẩm
 * @param {Object} req.body - `{ stockQuantity }` — Số lượng mới (số nguyên ≥ 0)
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 400 nếu stockQuantity không phải số nguyên hoặc âm
 * @throws {AppError} 404 nếu không tìm thấy sản phẩm
 */
const updateProductStock = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { stockQuantity, variantId } = req.body;

  const qty = parseInt(stockQuantity, 10);
  if (isNaN(qty) || qty < 0) {
    throw new AppError('Số lượng tồn kho phải là số nguyên không âm', 400);
  }

  const product = await adminRepository.findProductById(id);
  if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

  if (variantId) {
    const variant = await adminRepository.findProductVariantById(variantId, id);
    if (!variant) throw new AppError('Không tìm thấy biến thể', 404);
    await variant.update({ stockQuantity: qty });
    const total = (await adminRepository.sumProductVariantStock(id)) || 0;
    await product.update({ stockQuantity: total });
  } else {
    await product.update({ stockQuantity: qty });
  }

  res.status(200).json({
    status: 'success',
    data: { id: product.id, stockQuantity: qty },
  });
});

/**
 * Tạo bản sao hoàn chỉnh (deep clone) của sản phẩm, bao gồm: thông tin cơ bản,
 * danh mục, thuộc tính, biến thể (với SKU mới), thông số kỹ thuật, và gói bảo hành.
 * Ảnh (`ProductImage`) không được sao chép — admin cần upload lại.
 *
 * Tên clone theo pattern `{tên gốc} (1)`, `(2)`... cho đến khi không trùng.
 * Sản phẩm clone luôn có status `draft`. SKU mới: `SKU-{timestamp}-{random}`.
 * Toàn bộ trong transaction — rollback toàn bộ nếu bất kỳ bước nào thất bại.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID sản phẩm gốc
 * @param {Object} req.user - Thông tin admin đang đăng nhập
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 404 nếu không tìm thấy sản phẩm gốc
 */
const cloneProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  // 1. Tìm sản phẩm gốc với đầy đủ các quan hệ
  const originalProduct = await adminRepository.findProductById(id, {
    include: [
      { model: Category, as: 'categories' },
      { model: ProductAttribute, as: 'productAttributes' },
      { model: ProductVariant, as: 'variants' },
      { model: ProductSpecification, as: 'productSpecifications' },
    ],
  });

  if (!originalProduct) {
    throw new AppError('Không tìm thấy sản phẩm gốc', 404);
  }

  // 2. Tạo tên duy nhất cho sản phẩm clone
  let newName = originalProduct.name;
  let count = 1;
  let exists = true;
  while (exists) {
    const testName = `${originalProduct.name} (${count})`;
    const existing = await adminRepository.findProductOne({ nameVi: testName });
    if (!existing) {
      newName = testName;
      exists = false;
    } else {
      count++;
    }
  }

  // 3. Tạo SKU mới duy nhất
  const newSku = `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 4. Sử dụng transaction để clone dữ liệu
  const transaction = await sequelize.transaction();

  try {
    // Sao chép dữ liệu sản phẩm cơ bản
    const productData = originalProduct.get({ plain: true });
    delete productData.id;
    delete productData.createdAt;
    delete productData.updatedAt;
    delete productData.slug; // Slug sẽ được tạo lại bởi hook
    delete productData.categories;
    delete productData.attributes;
    delete productData.variants;
    delete productData.productSpecifications;
    productData.name = newName;
    productData.sku = newSku;
    productData.status = 'draft'; // Mặc định là bản nháp để admin kiểm tra lại

    const newProduct = await adminRepository.createProductFull(productData, { transaction });

    // 5. Sao chép các quan hệ

    // Danh mục
    if (originalProduct.categories && originalProduct.categories.length > 0) {
      const categoryLinks = originalProduct.categories.map((cat) => ({
        productId: newProduct.id,
        categoryId: cat.id,
      }));
      await ProductCategory.bulkCreate(categoryLinks, { transaction });
    }

    // Thuộc tính
    if (originalProduct.attributes && originalProduct.attributes.length > 0) {
      const attributeData = originalProduct.attributes.map((attr) => {
        const data = attr.get({ plain: true });
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;
        return { ...data, productId: newProduct.id };
      });
      await adminRepository.bulkCreateProductAttributes(attributeData, { transaction });
    }

    // Biến thể
    if (originalProduct.variants && originalProduct.variants.length > 0) {
      const variantData = originalProduct.variants.map((variant) => {
        const data = variant.get({ plain: true });
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;
        // Tạo SKU mới cho variant dựa trên SKU mới của product
        // Giữ phần hậu tố của SKU variant nếu có
        const suffix = data.sku.includes('-')
          ? data.sku.split('-').pop()
          : Math.floor(Math.random() * 1000);
        data.sku = `${newSku}-${suffix}`;
        return { ...data, productId: newProduct.id };
      });
      await adminRepository.bulkCreateProductVariants(variantData, { transaction });
    }

    // Thông số kỹ thuật
    if (originalProduct.productSpecifications && originalProduct.productSpecifications.length > 0) {
      const specData = originalProduct.productSpecifications.map((spec) => {
        const data = spec.get({ plain: true });
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;
        return { ...data, productId: newProduct.id };
      });
      await adminRepository.bulkCreateProductSpecs(specData, { transaction });
    }

    await transaction.commit();

    res.status(201).json({
      status: 'success',
      data: { product: newProduct },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Lỗi trong cloneProduct:', error);
    throw error;
  }
});

/**
 * Thay đổi nhanh trạng thái sản phẩm. Nếu không truyền `status` → tự động đảo
 * ngược giữa `active` và `inactive` (toggle). Nếu truyền `status` → đặt thẳng.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ id }` — ID sản phẩm
 * @param {Object} req.body - `{ status? }` — `active`|`inactive`|`draft` (tùy chọn)
 * @param {Object} req.user - Thông tin admin đang đăng nhập
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 404 nếu không tìm thấy sản phẩm
 * @throws {AppError} 400 nếu status không hợp lệ
 */
const toggleProductStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const product = await adminRepository.findProductById(id);
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  const validStatuses = ['active', 'inactive', 'draft'];
  if (status && !validStatuses.includes(status)) {
    throw new AppError('Trạng thái không hợp lệ', 400);
  }

  // Nếu không cung cấp status, mặc định là đảo ngược giữa active và inactive
  const newStatus = status || (product.status === 'active' ? 'inactive' : 'active');

  await product.update({ status: newStatus });

  res.status(200).json({
    status: 'success',
    data: { product },
  });
});

/**
 * Nhập thêm hàng vào kho — cộng thêm số lượng và ghi `InventoryLog`.
 *
 * Khác với `updateProductStock` (ghi đè tuyệt đối), hàm này cộng thêm vào tồn
 * kho hiện tại và tạo bản ghi InventoryLog (số trước, số sau, người thực hiện, ghi chú).
 *
 * - Có `variantId`: tăng stock variant + tính lại tổng stock của Product (SUM variants).
 * - Không có `variantId`: tăng stock trực tiếp trên Product.
 * - Sau khi cập nhật → đồng bộ vector store cho chatbot AI (bất đồng bộ).
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.params - `{ productId }` — ID sản phẩm
 * @param {Object} req.body - Dữ liệu nhập hàng:
 * @param {number} req.body.quantity - Số lượng nhập thêm (số nguyên dương, bắt buộc)
 * @param {number} [req.body.variantId] - ID biến thể (nếu nhập cho variant cụ thể)
 * @param {string} [req.body.note] - Ghi chú nhập hàng
 * @param {Object} req.user - Thông tin admin (lưu vào log `createdBy`)
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 400 nếu quantity không phải số nguyên dương
 * @throws {AppError} 404 nếu không tìm thấy sản phẩm hoặc biến thể
 */
const restockProduct = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const { variantId, quantity, note } = req.body;
  const qty = parseInt(quantity, 10);

  if (!qty || qty <= 0) {
    throw new AppError('Số lượng nhập phải là số nguyên dương', 400);
  }

  const product = await adminRepository.findProductById(productId);
  if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

  let prevStock, newStock;

  if (variantId) {
    // Nhập hàng cho biến thể cụ thể
    const variant = await adminRepository.findProductVariantById(variantId, productId);
    if (!variant) throw new AppError('Không tìm thấy biến thể', 404);

    prevStock = variant.stockQuantity;
    newStock = prevStock + qty;
    await variant.update({ stockQuantity: newStock, isAvailable: true });

    // Cập nhật tổng stock của product
    const total = (await adminRepository.sumProductVariantStock(productId)) || 0;
    await product.update({ stockQuantity: total || 0 });
  } else {
    // Nhập hàng cho sản phẩm không có variant
    prevStock = product.stockQuantity;
    newStock = prevStock + qty;
    await product.update({ stockQuantity: newStock });
  }

  // Ghi lịch sử nhập hàng
  const log = await adminRepository.createInventoryLog({
    productId: parseInt(productId, 10),
    variantId: variantId ? parseInt(variantId, 10) : null,
    changeType: 'restock',
    changeAmount: qty,
    previousStock: prevStock,
    newStock,
    note: note || null,
    createdBy: req.user.id,
  });

  // Đồng bộ vector store sau khi stock thay đổi để chatbot hiển thị đúng trạng thái tồn kho
  try {
    const { enrichProductData } = require('@modules/ai/services/product/product-enricher');
    await vectorStoreService.loadPromise;
    const productForIndex = await adminRepository.findProductById(productId, {
      include: [
        { model: Category, as: 'categories', through: { attributes: [] } },
        { model: ProductVariant, as: 'variants', attributes: ['stockQuantity'] },
        {
          model: ProductImage,
          as: 'productImages',
          attributes: ['imageUrl', 'isThumbnail'],
          required: false,
        },
      ],
    });
    if (productForIndex && productForIndex.status === 'active') {
      await vectorStoreService.upsertProduct(enrichProductData(productForIndex.toJSON()));
      await vectorStoreService.save();
    }
  } catch (syncErr) {
    logger.error('Lỗi đồng bộ vector store sau khi nhập hàng:', syncErr.message);
  }

  res.status(200).json({
    data: {
      productId: parseInt(productId, 10),
      variantId: variantId || null,
      previousStock: prevStock,
      newStock,
      quantity: qty,
      log,
    },
  });
});

// =============================================
// ANALYTICS ENDPOINTS — Phase 32
// =============================================

/**
 * Trả về phân bổ số lượng đơn hàng theo từng trạng thái để vẽ biểu đồ.
 * Kết quả: mảng `{ status, count, label }` — `label` là tên tiếng Việt.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - `{ startDate? }` — Lọc từ ngày này trở đi (ISO string)
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const getOrderStatusAnalytics = catchAsync(async (req, res) => {
  const { startDate } = req.query;
  const where = {};
  if (startDate) {
    where.createdAt = { [Op.gte]: new Date(startDate) };
  }

  const statusLabels = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    shipped: 'Đang giao',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
  };

  const statusDist = await adminRepository.aggregateOrders({
    attributes: ['status', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
    group: ['status'],
    where,
    raw: true,
  });

  const data = statusDist.map((row) => ({
    status: row.status,
    count: parseInt(row.count, 10),
    label: statusLabels[row.status] || row.status,
  }));

  res.status(200).json({ status: 'success', data });
});

/**
 * Trả về sản phẩm bán chạy nhất theo doanh thu hoặc số lượng bán, chỉ tính
 * đơn đã thanh toán (`paymentStatus = 'paid'`).
 * Kết quả mỗi item: `{ productId, name, thumbnail, revenue, soldCount }`.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - Query parameters:
 * @param {string} [req.query.metric='revenue'] - Tiêu chí sắp xếp: `revenue` | `quantity`
 * @param {number} [req.query.limit=5] - Số sản phẩm trả về (tối đa 20)
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const getTopProductsAnalytics = catchAsync(async (req, res) => {
  const { metric = 'revenue', limit: qLimit = 5 } = req.query;
  const limitNum = Math.min(parseInt(qLimit, 10) || 5, 20);

  // Sắp xếp theo metric được chọn
  const orderBy =
    metric === 'revenue'
      ? [[Sequelize.literal('revenue'), 'DESC']]
      : [[Sequelize.literal('soldCount'), 'DESC']];

  const topProducts = await adminRepository.aggregateOrderItems({
    attributes: [
      'productId',
      [Sequelize.fn('SUM', Sequelize.col('OrderItem.subtotal')), 'revenue'],
      [Sequelize.fn('SUM', Sequelize.col('OrderItem.quantity')), 'soldCount'],
    ],
    include: [
      {
        model: Order,
        attributes: [],
        where: { paymentStatus: 'paid' },
      },
      {
        model: Product,
        attributes: ['nameVi', 'nameEn'],
        include: [
          {
            model: ProductImage,
            as: 'productImages',
            attributes: ['imageUrl'],
            limit: 1,
          },
        ],
      },
    ],
    group: ['productId', 'Product.id'],
    order: orderBy,
    limit: limitNum,
    subQuery: false,
  });

  const data = topProducts.map((item) => {
    const prod = item.Product ? item.Product.toJSON() : {};
    return {
      productId: item.productId,
      name: prod.nameVi || prod.nameEn || prod.name || '',
      thumbnail: prod.productImages?.[0]?.imageUrl || null,
      revenue: parseFloat(item.getDataValue('revenue') || 0),
      soldCount: parseInt(item.getDataValue('soldCount') || 0, 10),
    };
  });

  res.status(200).json({ status: 'success', data });
});

/**
 * Trả về doanh thu theo danh mục — top 8 danh mục có doanh thu cao nhất, chỉ
 * tính đơn đã thanh toán (`payment_status = 'paid'`).
 *
 * Dùng **raw SQL** thay vì Sequelize ORM vì cần JOIN qua bảng trung gian
 * `product_categories` (many-to-many) và GROUP BY chính xác — Sequelize nested
 * JOIN qua `belongsToMany` khó đảm bảo GROUP BY đúng.
 *
 * Kết quả mỗi item: `{ categoryId, categoryName, revenue, orderItemCount }`.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - `{ startDate?, endDate? }` — Khoảng thời gian lọc
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const getRevenueByCategoryAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  let dateFilter = '';
  const replacements = {};
  if (startDate && endDate) {
    dateFilter = 'AND o.created_at BETWEEN :startDate AND :endDate';
    replacements.startDate = startDate;
    replacements.endDate = endDate + ' 23:59:59';
  }

  const [results] = await sequelize.query(
    `
    SELECT c.id AS categoryId, c.name_vi AS categoryName,
           COALESCE(SUM(oi.subtotal), 0) AS revenue,
           COUNT(DISTINCT oi.id) AS orderItemCount
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    JOIN product_categories pc ON pc.product_id = p.id
    JOIN categories c ON c.id = pc.category_id
    WHERE o.payment_status = 'paid' ${dateFilter}
    GROUP BY c.id, c.name_vi
    ORDER BY revenue DESC
    LIMIT 8
  `,
    { replacements },
  );

  const data = results.map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    revenue: parseFloat(row.revenue || 0),
    orderItemCount: parseInt(row.orderItemCount || 0, 10),
  }));

  res.status(200).json({ status: 'success', data });
});

/**
 * Trả về số user mới đăng ký theo từng mốc thời gian để vẽ biểu đồ xu hướng.
 * Chỉ đếm `role = 'customer'`. Kết quả mỗi item: `{ date, newUsers }`.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - Query parameters:
 * @param {string} req.query.startDate - Ngày bắt đầu (ISO string, bắt buộc)
 * @param {string} req.query.endDate - Ngày kết thúc (ISO string, bắt buộc)
 * @param {string} [req.query.groupBy='day'] - Nhóm theo: `day` | `week` | `month`
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 * @throws {AppError} 400 nếu thiếu startDate hoặc endDate
 */
const getUserGrowthAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  if (!startDate || !endDate) {
    throw new AppError('Vui lòng cung cấp startDate và endDate', 400);
  }

  let dateFormat;
  switch (groupBy) {
    case 'week':
      dateFormat = '%Y-%u';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const userGrowth = await adminRepository.aggregateUsers({
    attributes: [
      [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat), 'date'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'newUsers'],
    ],
    where: {
      role: 'customer',
      createdAt: {
        [Op.between]: [
          new Date(startDate),
          (() => {
            const e = new Date(endDate);
            e.setHours(23, 59, 59, 999);
            return e;
          })(),
        ],
      },
    },
    group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat)],
    order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat), 'ASC']],
    raw: true,
  });

  const data = userGrowth.map((row) => ({
    date: row.date,
    newUsers: parseInt(row.newUsers, 10),
  }));

  res.status(200).json({ status: 'success', data });
});

/**
 * Trả về phân bổ số lượng đơn và doanh thu theo từng phương thức thanh toán
 * (COD, MoMo, VNPay...), chỉ tính đơn đã thanh toán thành công.
 * Kết quả mỗi item: `{ method, count, revenue }`.
 *
 * @param {Object} req - HTTP request từ Express (không dùng params/body/query)
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const getPaymentMethodsAnalytics = catchAsync(async (req, res) => {
  const results = await adminRepository.aggregateOrders({
    attributes: [
      'paymentMethod',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      [Sequelize.fn('SUM', Sequelize.col('total')), 'revenue'],
    ],
    where: { paymentStatus: 'paid' },
    group: ['payment_method'],
    raw: true,
  });

  const data = results.map((row) => ({
    method: row.paymentMethod || 'unknown',
    count: parseInt(row.count, 10),
    revenue: parseFloat(row.revenue || 0),
  }));

  res.status(200).json({ status: 'success', data });
});

/**
 * Trả về tối đa 20 sản phẩm có tồn kho thấp nhất (≤ threshold), sắp xếp tăng dần.
 * Dùng cho dashboard cảnh báo hết hàng.
 * Kết quả mỗi item: `{ id, name, sku, stockQuantity, thumbnail }`.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - `{ threshold? }` — Ngưỡng tồn kho thấp (mặc định: 10)
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const getLowStockAnalytics = catchAsync(async (req, res) => {
  const parsedThreshold = parseInt(req.query.threshold, 10);
  const threshold = Number.isFinite(parsedThreshold) ? parsedThreshold : 10;

  // Lấy tất cả sản phẩm kèm variants để tính tổng kho chính xác
  // Không dùng WHERE trên Product.stockQuantity vì field này có thể bị lệch
  const allProducts = await adminRepository.findProductsList({
    attributes: ['id', 'nameVi', 'nameEn', 'stockQuantity', 'slug'],
    include: [
      {
        model: ProductImage,
        as: 'productImages',
        attributes: ['imageUrl'],
        limit: 1,
      },
      {
        model: ProductVariant,
        as: 'variants',
        attributes: ['sku', 'stockQuantity'],
      },
    ],
  });

  const data = allProducts
    .map((p) => {
      const pJson = p.toJSON();
      const variantStock = (pJson.variants || []).reduce(
        (sum, v) => sum + (v.stockQuantity || 0),
        0,
      );
      const stock = pJson.variants?.length > 0 ? variantStock : pJson.stockQuantity || 0;
      return {
        id: pJson.id,
        name: pJson.nameVi || pJson.nameEn || pJson.name || '',
        sku: pJson.variants?.[0]?.sku || '',
        stockQuantity: stock,
        thumbnail: pJson.productImages?.[0]?.imageUrl || null,
      };
    })
    .filter((p) => p.stockQuantity <= threshold)
    .sort((a, b) => a.stockQuantity - b.stockQuantity)
    .slice(0, 20);

  res.status(200).json({ status: 'success', data });
});

/**
 * Xuất báo cáo dạng file CSV, tải thẳng về trình duyệt với BOM UTF-8 để
 * Excel mở đúng ký tự tiếng Việt.
 *
 * Hỗ trợ 2 loại (`?type=`):
 * - `orders` (mặc định): thông tin khách hàng, trạng thái, thanh toán, tổng tiền.
 *   Có thể lọc theo ngày. Tối đa 5000 dòng.
 * - `products`: tên, SKU, giá, tồn kho, trạng thái. Tối đa 5000 dòng.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - Query parameters:
 * @param {string} [req.query.type='orders'] - Loại báo cáo: `orders` | `products`
 * @param {string} [req.query.startDate] - Lọc từ ngày (chỉ áp dụng cho `orders`)
 * @param {string} [req.query.endDate] - Lọc đến ngày (chỉ áp dụng cho `orders`)
 * @param {Object} res - HTTP response — hàm này gửi file CSV thay vì JSON
 * @throws {AppError} 400 nếu type không hợp lệ
 */
const exportReport = catchAsync(async (req, res) => {
  const { type = 'orders', startDate, endDate } = req.query;

  if (type === 'orders') {
    const where = {};
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [
          new Date(startDate),
          (() => {
            const e = new Date(endDate);
            e.setHours(23, 59, 59, 999);
            return e;
          })(),
        ],
      };
    }

    const orders = await adminRepository.aggregateOrders({
      where,
      attributes: [
        'id',
        'number',
        'status',
        'paymentStatus',
        'paymentMethod',
        'total',
        'createdAt',
      ],
      include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: 5000,
      raw: false,
    });

    // Tạo CSV thủ công để tránh dependency thêm package
    const csvHeader =
      'Order ID,Order Number,Customer,Email,Status,Payment Status,Payment Method,Total,Date\n';
    const csvRows = orders
      .map((o) => {
        const oJson = o.toJSON();
        const customer = oJson.User
          ? `${oJson.User.firstName || ''} ${oJson.User.lastName || ''}`.trim()
          : '';
        const email = oJson.User?.email || '';
        const date = new Date(oJson.createdAt).toISOString().split('T')[0];
        return `${oJson.id},"${oJson.number}","${customer}","${email}",${oJson.status},${oJson.paymentStatus},${oJson.paymentMethod || ''},${oJson.total},${date}`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orders_${new Date().toISOString().split('T')[0]}.csv"`,
    );
    res.status(200).send('﻿' + csvHeader + csvRows);
  } else if (type === 'products') {
    const products = await adminRepository.findProductsList({
      attributes: ['id', 'nameVi', 'nameEn', 'sku', 'basePrice', 'stockQuantity', 'status'],
      order: [['nameVi', 'ASC']],
      limit: 5000,
      raw: true,
    });

    const csvHeader = 'Product ID,Name,SKU,Base Price,Stock,Status\n';
    const csvRows = products
      .map(
        (p) =>
          `${p.id},"${(p.nameVi || p.nameEn || p.name || '').replace(/"/g, '""')}","${p.sku || ''}",${p.basePrice},${p.stockQuantity},${p.status || 'active'}`,
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="products_${new Date().toISOString().split('T')[0]}.csv"`,
    );
    res.status(200).send('﻿' + csvHeader + csvRows);
  } else {
    throw new AppError('Loại báo cáo không hợp lệ. Dùng "orders" hoặc "products"', 400);
  }
});

/**
 * Trả về thống kê hoạt động của AI chatbot từ bảng `ChatMessage`.
 *
 * Các chỉ số: `totalSessions` (distinct sessionId), `totalMessages`, `avgMessagesPerSession`,
 * `intentBreakdown` (đếm theo intent, chỉ user messages), `fallbackRate` (0–1),
 * `avgResponseTimeMs`. Chỉ tính messages có `messageType = 'ai_chatbot'`.
 *
 * @param {Object} req - HTTP request từ Express
 * @param {Object} req.query - `{ startDate?, endDate? }` — Khoảng thời gian lọc
 * @param {Object} res - HTTP response — hàm này tự gọi res.json() để trả kết quả
 */
const getChatbotStats = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const where = { messageType: 'ai_chatbot' };
  if (startDate && endDate) {
    where.createdAt = {
      [Op.between]: [
        new Date(startDate),
        (() => {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          return e;
        })(),
      ],
    };
  }

  // Tổng sessions (unique sessionId)
  const totalSessions = await adminRepository.countChatMessages({
    distinct: true,
    col: 'session_id',
    where,
  });

  // Tổng messages
  const totalMessages = await adminRepository.countChatMessages({ where });

  // Trung bình messages/session
  const avgMessagesPerSession =
    totalSessions > 0 ? parseFloat((totalMessages / totalSessions).toFixed(1)) : 0;

  // Phân loại intent (chỉ lấy messages từ user)
  const intentResults = await adminRepository.aggregateChatMessagesAdv({
    attributes: ['intent', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
    where: { ...where, role: 'user', intent: { [Op.not]: null } },
    group: ['intent'],
    raw: true,
  });

  const intentBreakdown = {};
  intentResults.forEach((row) => {
    intentBreakdown[row.intent] = parseInt(row.count, 10);
  });

  // Tỷ lệ fallback (assistant messages dùng fallback)
  const totalAssistantMessages = await adminRepository.countChatMessages({
    where: { ...where, role: 'assistant' },
  });
  const fallbackMessages = await adminRepository.countChatMessages({
    where: { ...where, role: 'assistant', isFallback: true },
  });
  const fallbackRate =
    totalAssistantMessages > 0
      ? parseFloat((fallbackMessages / totalAssistantMessages).toFixed(2))
      : 0;

  // Trung bình response time (chỉ assistant messages có responseTimeMs)
  const avgResponseTimeMs = await adminRepository.findOneChatMessage({
    attributes: [[Sequelize.fn('AVG', Sequelize.col('response_time_ms')), 'avgTime']],
    where: { ...where, role: 'assistant', responseTimeMs: { [Op.not]: null } },
    raw: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      totalSessions,
      totalMessages,
      avgMessagesPerSession,
      intentBreakdown,
      fallbackRate,
      avgResponseTimeMs: parseInt(avgResponseTimeMs?.avgTime || 0, 10),
    },
  });
});

module.exports = {
  getDashboardStats,
  getDetailedStats,
  getAllUsers,
  updateUser,
  deleteUser,
  getUserById,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  cloneProduct,
  toggleProductStatus,
  getAllProducts,
  getAllReviews,
  deleteReview,
  getAllOrders,
  updateOrderStatus,
  adminCancelOrder,
  updateProductStock,
  restockProduct,
  getOrderStatusAnalytics,
  getTopProductsAnalytics,
  getRevenueByCategoryAnalytics,
  getUserGrowthAnalytics,
  getPaymentMethodsAnalytics,
  getLowStockAnalytics,
  exportReport,
  getChatbotStats,
};
