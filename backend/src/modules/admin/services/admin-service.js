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
  ProductWarranty,
  ProductCategory,
  WarrantyPackage,
  User,
  Order,
  OrderItem,
  Review,
  Category,
  CartItem,
  LoyaltyHistory,
  SearchHistory,
  RecentlyViewed,
  InventoryLog,
  AuditLog,
  ChatMessage,
  Address,
} = adminRepository.getModels();

const logger = require('@utils/logger');
const { catchAsync } = require('@utils/catch-async');
const { AppError } = require('@shared/errors');
const { AdminAuditService } = require('@shared/admin-audit');
const {
  calculateTotalStock,
  updateProductTotalStock,
  validateVariantAttributes,
  generateVariantSku,
} = require('@utils/product-helpers');
const vectorStoreService = require('@services/vector-store/vector-store');

/**
 * Đệ quy parse chuỗi JSON để xử lý tình huống stringify nhiều lần.
 * Ví dụ: '"{\\"key\\":\\"val\\"}"' → { key: "val" }
 */
function deepParseJSON(val) {
  if (val === null || val === undefined) return {};
  if (typeof val === 'object' && !Array.isArray(val)) return val; // Đã là object rồi
  if (typeof val !== 'string') return {};

  let parsed = val;
  let maxAttempts = 5; // Ngăn vòng lặp vô hạn
  while (typeof parsed === 'string' && maxAttempts-- > 0) {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      return {}; // Không phải JSON hợp lệ
    }
  }

  if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
    return parsed;
  }
  return {};
}

/**
 * Đệ quy parse chuỗi JSON dạng mảng
 */
function deepParseJSONArray(val) {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return [];

  let parsed = val;
  let maxAttempts = 5;
  while (typeof parsed === 'string' && maxAttempts-- > 0) {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      return [];
    }
  }

  if (Array.isArray(parsed)) return parsed;
  return [];
}

/**
 * Dashboard - Thống kê tổng quan
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

  // AOV = Average Order Value (trung bình giá trị đơn hàng delivered)
  const aov = totalOrders > 0 ? (totalRevenue || 0) / totalOrders : 0;

  // Đơn hủy trong tháng hiện tại
  const cancelledOrdersMonth = await adminRepository.countOrders({
    status: 'cancelled',
    createdAt: { [Op.gte]: startOfMonth },
  });

  // Sản phẩm sắp hết hàng (stockQuantity <= 5)
  const lowStockCount = await adminRepository.countProducts({
    stockQuantity: { [Op.lte]: 5 },
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
 * Thống kê chi tiết theo khoảng thời gian
 */
const getDetailedStats = catchAsync(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  if (!startDate || !endDate) {
    throw new AppError('Vui lòng cung cấp ngày bắt đầu và ngày kết thúc', 400);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

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
 * Quản lý Users - Lấy danh sách user
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
 * Quản lý Users - Cập nhật thông tin user
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
 * Quản lý Users - Xóa user
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
 * User Management - Lấy chi tiết user
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
      { model: LoyaltyHistory, as: 'loyaltyHistories', limit: 10 },
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
 * Quản lý Products - Lấy chi tiết sản phẩm
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
        model: WarrantyPackage,
        as: 'warrantyPackages',
        through: {
          attributes: ['isDefault'],
          as: 'productWarranty',
        },
        required: false,
      },
    ],
  });

  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  // Làm sạch dữ liệu sản phẩm trước khi gửi về frontend
  const productJson = product.toJSON();

  // Deep-parse thuộc tính biến thể (xử lý trường hợp stringify nhiều lần)
  if (productJson.variants && Array.isArray(productJson.variants)) {
    productJson.variants = productJson.variants.map((v) => ({
      ...v,
      attributes: deepParseJSON(v.attributes),
      attributeValues: deepParseJSON(v.attributeValues || v.attributes),
      specifications: deepParseJSON(v.specifications),
    }));
  }

  // Deep-parse giá trị thuộc tính sản phẩm
  if (productJson.attributes && Array.isArray(productJson.attributes)) {
    productJson.attributes = productJson.attributes.map((attr) => ({
      ...attr,
      values: deepParseJSONArray(attr.values),
    }));
  }

  // Deep-parse thông số kỹ thuật
  if (productJson.specifications && typeof productJson.specifications !== 'object') {
    productJson.specifications = deepParseJSON(productJson.specifications);
  }

  res.status(200).json({
    status: 'success',
    data: { product: productJson },
  });
});

/**
 * Quản lý Products - Tạo sản phẩm mới
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
    warrantyPackageIds = [],
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
        where: { productId: product.id },
      });

      const variantPromises = variants.map(async (variant) => {
        // Đảm bảo variant.attributes luôn là một object
        const variantAttributes = deepParseJSON(variant.attributes);

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
          name: variant.name,
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

  // Xử lý warranty packages
  if (warrantyPackageIds && Array.isArray(warrantyPackageIds) && warrantyPackageIds.length > 0) {
    try {
      logger.info('Đang tạo warranty packages:', warrantyPackageIds);

      // Kiểm tra xem các warranty packages có tồn tại không
      logger.info('Tìm warranty packages theo IDs:', warrantyPackageIds);
      const existingWarrantyPackages = await adminRepository.findWarrantyPackages({
        where: { id: warrantyPackageIds, isActive: true },
      });
      logger.info('Tìm thấy warranty packages:', existingWarrantyPackages.length);

      if (existingWarrantyPackages.length > 0) {
        const warrantyPromises = existingWarrantyPackages.map(async (warrantyPackage, index) => {
          return await adminRepository.createProductWarranty({
            productId: product.id,
            warrantyPackageId: warrantyPackage.id,
            isDefault: index === 0, // Đặt warranty package đầu tiên làm mặc định
          });
        });

        await Promise.all(warrantyPromises);
        logger.info(
          `Đã tạo ${existingWarrantyPackages.length} liên kết warranty package cho sản phẩm ${product.id}`,
        );
      }
    } catch (error) {
      logger.error('Lỗi khi tạo warranty packages:', error);
      // Tiếp tục mà không có warranty packages nếu có lỗi
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
      {
        model: WarrantyPackage,
        as: 'warrantyPackages',
        through: {
          attributes: ['isDefault'],
          as: 'productWarranty',
        },
        required: false,
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

  // Ghi audit log
  logger.info('req.user trong createProduct:', req.user);
  AdminAuditService.logProductAction(req.user, 'CREATE', product.id, product.name);

  res.status(201).json({
    status: 'success',
    data: { product: productWithRelations },
  });
});

/**
 * Quản lý Products - Cập nhật sản phẩm
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
    warrantyPackageIds = [],
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

    // Theo dõi thay đổi để ghi audit log
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
      changes.images = images.length;
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
      const currentAttributes = await adminRepository.findProductAttributes({
        where: { productId: id },
        transaction,
      });
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
      const currentVariants = await adminRepository.findProductVariants({
        where: { productId: id },
        transaction,
      });
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
        const variantAttributes = deepParseJSON(variant.attributes || variant.attributeValues);

        const variantSku = variant.sku || generateVariantSku(sku || 'PROD', variantAttributes);

        const variantData = {
          name: variant.name,
          sku: variantSku,
          attributes: variantAttributes,
          attributeValues: variantAttributes,
          price: parseFloat(variant.price?.toString()) || 0,
          stockQuantity: parseInt((variant.stock || variant.stockQuantity || 0).toString()) || 0,
          images: variant.images || [],
          isDefault: variant.isDefault || (index === 0 && !variants.some((v) => v.isDefault)),
          isAvailable: variant.isAvailable !== false,
          compareAtPrice: variant.compareAtPrice || null,
          displayName:
            variant.displayName || variant.name || Object.values(variantAttributes).join(' - '),
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

      // Đồng bộ tổng tồn kho nếu có variants
      const totalStock = calculateTotalStock(finalVariants);
      await adminRepository.updateProductWhere(
        { stockQuantity: totalStock },
        { id },
        { transaction },
      );
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
      const currentSpecs = await adminRepository.findProductSpecs({
        where: { productId: id },
        transaction,
      });
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

    // 7. Cập nhật warranty packages
    if (req.body.hasOwnProperty('warrantyPackageIds') && Array.isArray(warrantyPackageIds)) {
      await adminRepository.destroyProductWarranties({ productId: id }, { transaction });
      if (warrantyPackageIds.length > 0) {
        const wp = await adminRepository.findWarrantyPackages({
          where: { id: warrantyPackageIds, isActive: true },
          transaction,
        });
        const wpPromises = wp.map((p, index) =>
          ProductWarranty.create(
            {
              productId: id,
              warrantyPackageId: p.id,
              isDefault: index === 0,
            },
            { transaction },
          ),
        );
        await Promise.all(wpPromises);
      }
    }

    await transaction.commit();

    // Ghi audit log (ngoài transaction là hợp lệ)
    AdminAuditService.logProductAction(req.user, 'UPDATE', id, name || product.name, changes);

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
        {
          model: WarrantyPackage,
          as: 'warrantyPackages',
          through: { attributes: ['isDefault'], as: 'productWarranty' },
          required: false,
        },
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
 * Quản lý Products - Xóa sản phẩm
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

    // Ghi audit log sau khi commit thành công
    AdminAuditService.logProductAction(req.user, 'DELETE', id, product.name);

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
 * Quản lý Products - Lấy danh sách sản phẩm với filter admin
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

  // Filter theo tìm kiếm
  if (search) {
    whereClause[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
      { shortDescription: { [Op.like]: `%${search}%` } },
      { sku: { [Op.like]: `%${search}%` } },
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

  // Filter theo stock
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
      model: WarrantyPackage,
      as: 'warrantyPackages',
      through: { attributes: [] },
      required: false,
    },
    {
      model: ProductImage,
      as: 'productImages',
      attributes: ['imageUrl', 'color', 'isThumbnail'],
      required: false,
    },
  ];

  // Filter theo category
  if (category) {
    includeClause[1].where = { id: category };
  }

  logger.info('[ADMIN] Đang lấy danh sách sản phẩm...');
  try {
    const { count, rows: products } = await adminRepository.findProducts({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy === 'price' ? 'basePrice' : sortBy, sortOrder.toUpperCase()]],
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
 * Quản lý Reviews - Lấy danh sách review
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
 * Quản lý Reviews - Xóa review
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
 * Quản lý Orders - Lấy danh sách đơn hàng
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
      [Op.between]: [new Date(startDate), new Date(endDate)],
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
 * Quản lý Orders - Cập nhật trạng thái đơn hàng
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
 * Quản lý Orders - Admin hủy đơn hàng và hoàn tồn kho
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
 * Quản lý Products - Cập nhật tồn kho trực tiếp (dùng cho trang Inventory)
 */
const updateProductStock = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { stockQuantity } = req.body;

  const qty = parseInt(stockQuantity, 10);
  if (isNaN(qty) || qty < 0) {
    throw new AppError('Số lượng tồn kho phải là số nguyên không âm', 400);
  }

  const product = await adminRepository.findProductById(id);
  if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

  await product.update({ stockQuantity: qty });

  res.status(200).json({
    status: 'success',
    data: { id: product.id, stockQuantity: qty },
  });
});

/**
 * Quản lý Products - Clone sản phẩm
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
      {
        model: WarrantyPackage,
        as: 'warrantyPackages',
        through: { attributes: ['isDefault'] },
      },
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
    delete productData.warrantyPackages;

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

    // Gói bảo hành
    if (originalProduct.warrantyPackages && originalProduct.warrantyPackages.length > 0) {
      const warrantyData = originalProduct.warrantyPackages.map((wp) => ({
        productId: newProduct.id,
        warrantyPackageId: wp.id,
        isDefault: wp.ProductWarranty?.isDefault || false,
      }));
      await adminRepository.bulkCreateProductWarranties(warrantyData, { transaction });
    }

    await transaction.commit();

    // Ghi audit log
    AdminAuditService.logProductAction(req.user, 'CLONE', newProduct.id, newProduct.name, {
      originalProductId: id,
    });

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
 * Quản lý Products - Thay đổi nhanh trạng thái sản phẩm
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

  // Ghi audit log
  AdminAuditService.logProductAction(req.user, 'UPDATE_STATUS', product.id, product.name, {
    from: product.status,
    to: newStatus,
  });

  res.status(200).json({
    status: 'success',
    data: { product },
  });
});

// POST /api/admin/products/:productId/restock — Nhập hàng, tăng stock và ghi InventoryLog
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

/**
 * GET /api/admin/audit-logs — Lấy lịch sử thao tác admin từ DB
 * Query: page, limit, adminId, action, startDate, endDate
 */
const getAuditLogs = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const offset = (page - 1) * limit;

  // Điều kiện lọc tuỳ chọn
  const where = {};
  if (req.query.adminId) where.adminId = parseInt(req.query.adminId, 10);
  if (req.query.action) where.action = req.query.action;
  if (req.query.entityType) where.entityType = req.query.entityType;
  if (req.query.startDate || req.query.endDate) {
    where.createdAt = {};
    if (req.query.startDate) where.createdAt[Op.gte] = new Date(req.query.startDate);
    if (req.query.endDate) where.createdAt[Op.lte] = new Date(req.query.endDate);
  }

  const { rows, count } = await adminRepository.findAuditLogs({
    where,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    include: [
      {
        model: User,
        as: 'admin',
        attributes: ['id', 'firstName', 'lastName', 'email'],
        required: false,
      },
    ],
  });

  res.status(200).json({
    status: 'success',
    data: {
      logs: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  });
});

// =============================================
// ANALYTICS ENDPOINTS — Phase 32
// =============================================

/**
 * GET /api/admin/analytics/order-status — Phân bổ trạng thái đơn hàng
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
 * GET /api/admin/analytics/top-products — Top sản phẩm theo doanh thu hoặc số lượng
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
 * GET /api/admin/analytics/revenue-by-category — Doanh thu theo danh mục
 * Dùng raw query vì Sequelize nested JOIN qua belongsToMany khó GROUP BY chính xác
 */
const getRevenueByCategoryAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  let dateFilter = '';
  const replacements = {};
  if (startDate && endDate) {
    dateFilter = 'AND o.created_at BETWEEN :startDate AND :endDate';
    replacements.startDate = startDate;
    replacements.endDate = endDate;
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
 * GET /api/admin/analytics/user-growth — Tăng trưởng user theo thời gian
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
      createdAt: { [Op.between]: [new Date(startDate), new Date(endDate)] },
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
 * GET /api/admin/analytics/payment-methods — Phân bổ phương thức thanh toán
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
 * GET /api/admin/analytics/low-stock — Sản phẩm sắp hết hàng
 */
const getLowStockAnalytics = catchAsync(async (req, res) => {
  const parsedThreshold = parseInt(req.query.threshold, 10);
  const threshold = Number.isFinite(parsedThreshold) ? parsedThreshold : 10;

  const products = await adminRepository.findProductsList({
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
        attributes: ['sku'],
        limit: 1,
      },
    ],
    where: { stockQuantity: { [Op.lte]: threshold } },
    order: [['stockQuantity', 'ASC']],
    limit: 20,
  });

  const data = products.map((p) => {
    const pJson = p.toJSON();
    return {
      id: pJson.id,
      name: pJson.nameVi || pJson.nameEn || pJson.name || '',
      sku: pJson.variants?.[0]?.sku || '',
      stockQuantity: pJson.stockQuantity,
      thumbnail: pJson.productImages?.[0]?.imageUrl || null,
    };
  });

  res.status(200).json({ status: 'success', data });
});

/**
 * GET /api/admin/reports/export — Xuất báo cáo CSV
 */
const exportReport = catchAsync(async (req, res) => {
  const { type = 'orders', startDate, endDate } = req.query;

  if (type === 'orders') {
    const where = {};
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
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
 * GET /api/admin/chatbot/stats — Thống kê AI chatbot
 */
const getChatbotStats = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const where = { messageType: 'ai_chatbot' };
  if (startDate && endDate) {
    where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
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
  getAuditLogs,
  getOrderStatusAnalytics,
  getTopProductsAnalytics,
  getRevenueByCategoryAnalytics,
  getUserGrowthAnalytics,
  getPaymentMethodsAnalytics,
  getLowStockAnalytics,
  exportReport,
  getChatbotStats,
};
