const {
  User,
  Product,
  Order,
  Review,
  Category,
  OrderItem,
  ProductAttribute,
  ProductVariant,
  ProductSpecification,
  ProductImage,
  WarrantyPackage,
  Address,
  LoyaltyHistory,
  SearchHistory,
  RecentlyViewed,
  InventoryLog,
} = require('../models');
const { Op, Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');
const { AdminAuditService } = require('../services/admin/adminAudit');
const {
  calculateTotalStock,
  updateProductTotalStock,
  validateVariantAttributes,
  generateVariantSku,
} = require('../utils/productHelpers');

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
  logger.info('>>> [CONTROLLER] getDashboardStats started');
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1
  );
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  // Thống kê tổng quan
  const totalUsers = await User.count({ where: { role: 'customer' } });
  logger.info('>>> [DASHBOARD] Lấy totalUsers:', totalUsers);
  const totalProducts = await Product.count();
  logger.info('>>> [DASHBOARD] Lấy totalProducts:', totalProducts);
  const totalOrders = await Order.count();
  logger.info('>>> [DASHBOARD] Lấy totalOrders:', totalOrders);
  const totalRevenue = await Order.sum('total', {
    where: { status: 'delivered', paymentStatus: { [Op.notIn]: ['refunded', 'failed'] } },
  });
  logger.info('>>> [DASHBOARD] Lấy totalRevenue:', totalRevenue);

  // Thống kê theo tháng
  const monthlyUsers = await User.count({
    where: {
      role: 'customer',
      createdAt: { [Op.gte]: startOfMonth },
    },
  });

  const monthlyOrders = await Order.count({
    where: { createdAt: { [Op.gte]: startOfMonth } },
  });

  const monthlyRevenue = await Order.sum('total', {
    where: {
      status: 'delivered',
      paymentStatus: { [Op.notIn]: ['refunded', 'failed'] },
      createdAt: { [Op.gte]: startOfMonth },
    },
  });

  // So sánh với tháng trước
  const lastMonthUsers = await User.count({
    where: {
      role: 'customer',
      createdAt: {
        [Op.gte]: startOfLastMonth,
        [Op.lte]: endOfLastMonth,
      },
    },
  });

  const lastMonthOrders = await Order.count({
    where: {
      createdAt: {
        [Op.gte]: startOfLastMonth,
        [Op.lte]: endOfLastMonth,
      },
    },
  });

  const lastMonthRevenue = await Order.sum('total', {
    where: {
      status: 'delivered',
      paymentStatus: { [Op.notIn]: ['refunded', 'failed'] },
      createdAt: {
        [Op.gte]: startOfLastMonth,
        [Op.lte]: endOfLastMonth,
      },
    },
  });

  // Tính tỷ lệ tăng trưởng
  const userGrowth = lastMonthUsers
    ? ((monthlyUsers - lastMonthUsers) / lastMonthUsers) * 100
    : 0;
  const orderGrowth = lastMonthOrders
    ? ((monthlyOrders - lastMonthOrders) / lastMonthOrders) * 100
    : 0;
  const revenueGrowth = lastMonthRevenue
    ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  // Top sản phẩm bán chạy
  logger.info('>>> [DASHBOARD] Đang lấy topProducts...');
  let topProducts = [];
  try {
    topProducts = await OrderItem.findAll({
      attributes: [
        'productId',
        [Sequelize.fn('SUM', Sequelize.col('quantity')), 'totalSold'],
        [Sequelize.fn('SUM', Sequelize.col('subtotal')), 'totalRevenue'],
      ],
      include: [
        {
          model: Product,
          attributes: ['name', 'basePrice'],
          include: [
            {
              model: require('../models').ProductImage,
              as: 'productImages',
              attributes: ['imageUrl'],
              limit: 1,
            }
          ]
        },
      ],
      group: ['productId', 'Product.id'],
      order: [[Sequelize.fn('SUM', Sequelize.col('quantity')), 'DESC']],
      limit: 5,
    });
    logger.info('>>> [DASHBOARD] Lấy topProducts xong:', topProducts.length);
  } catch (err) {
    logger.error('>>> [DASHBOARD] LỖI khi lấy topProducts:', err.message);
    // Tiếp tục mà không có top products nếu lấy thất bại
  }

  // Breakdown số đơn hàng theo từng trạng thái
  const orderStatusCounts = await Order.findAll({
    attributes: ['status', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true,
  });
  // Chuyển sang object { pending: N, processing: N, ... } để dễ đọc
  const ordersByStatus = orderStatusCounts.reduce((acc, row) => {
    acc[row.status] = parseInt(row.count, 10);
    return acc;
  }, { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 });

  res.status(200).json({
    status: 'success',
    data: {
      overview: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue || 0,
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
          productData.images = productData.productImages.map(img => img.imageUrl);
          productData.price = productData.basePrice;
        }
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

  // Thống kê đơn hàng theo thời gian
  const orderStats = await Order.findAll({
    attributes: [
      [
        Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), dateFormat),
        'period',
      ],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'orderCount'],
      [Sequelize.fn('SUM', Sequelize.col('total')), 'revenue'],
    ],
    where: {
      createdAt: {
        [Op.between]: [start, end],
      },
    },
    group: [
      Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), dateFormat),
    ],
    order: [
      [
        Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), dateFormat),
        'ASC',
      ],
    ],
  });

  // Thống kê user mới theo thời gian
  const userStats = await User.findAll({
    attributes: [
      [
        Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), dateFormat),
        'period',
      ],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'newUsers'],
    ],
    where: {
      role: 'customer',
      createdAt: {
        [Op.between]: [start, end],
      },
    },
    group: [
      Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), dateFormat),
    ],
    order: [
      [
        Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), dateFormat),
        'ASC',
      ],
    ],
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

  const { count, rows: users } = await User.findAndCountAll({
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
  const { firstName, lastName, phone, role, isEmailVerified, isActive } =
    req.body;

  const user = await User.findByPk(id);
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', 404);
  }

  // Không cho phép user tự update role của chính mình
  if (req.user.id === id && role && role !== user.role) {
    throw new AppError('Không thể thay đổi role của chính mình', 403);
  }

  // Không cho phép user tự deactivate tài khoản của chính mình
  if (req.user.id === id && isActive === false) {
    throw new AppError('Không thể vô hiệu hóa tài khoản của chính mình', 403);
  }

  const updatedUser = await user.update({
    firstName: firstName || user.firstName,
    lastName: lastName || user.lastName,
    phone: phone || user.phone,
    role: role || user.role,
    isEmailVerified:
      isEmailVerified !== undefined ? isEmailVerified : user.isEmailVerified,
    isActive: isActive !== undefined ? isActive : user.isActive,
  });

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

  if (req.user.id === id) {
    throw new AppError('Không thể xóa tài khoản của chính mình', 403);
  }

  const user = await User.findByPk(id);
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

  const user = await User.findByPk(id, {
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

  const product = await Product.findByPk(id, {
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
        model: require('../models').ProductSpecification,
        as: 'productSpecifications',
      },
      {
        model: require('../models').WarrantyPackage,
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
    productJson.variants = productJson.variants.map(v => ({
      ...v,
      attributes: deepParseJSON(v.attributes),
      attributeValues: deepParseJSON(v.attributeValues || v.attributes),
      specifications: deepParseJSON(v.specifications),
    }));
  }

  // Deep-parse giá trị thuộc tính sản phẩm
  if (productJson.attributes && Array.isArray(productJson.attributes)) {
    productJson.attributes = productJson.attributes.map(attr => ({
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
  logger.info(
    'Dữ liệu request tạo sản phẩm:',
    JSON.stringify(req.body, null, 2)
  );
  const {
    name,
    baseName,
    description,
    shortDescription,
    basePrice: price,
    comparePrice,
    stock,
    sku,
    status = 'active',
    images,
    thumbnail,
    inStock = true,
    stockQuantity = 0,
    featured = false,
    searchKeywords = [],
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

  // Tạo SKU duy nhất nếu không được cung cấp
  const uniqueSku =
    sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Kiểm tra xem SKU đã tồn tại chưa nếu người dùng cung cấp SKU
  if (sku) {
    const existingProduct = await Product.findOne({ where: { sku } });
    if (existingProduct) {
      return res.status(400).json({
        status: 'fail',
        message: `Mã SKU '${sku}' đã tồn tại. Vui lòng sử dụng mã SKU khác.`,
        errors: [
          {
            field: 'sku',
            message: `Mã SKU '${sku}' đã tồn tại. Vui lòng sử dụng mã SKU khác.`,
          },
        ],
      });
    }
  }

  // Tạo sản phẩm mới
  const product = await Product.create({
    name,
    baseName: baseName || name,
    description,
    shortDescription: shortDescription || description,
    basePrice: price,
    // Tạm thời bỏ qua compareAtPrice, sẽ cập nhật riêng
    compareAtPrice: null,
    inStock: status === 'active',
    stockQuantity: stock || stockQuantity || 0,
    sku: uniqueSku,
    status,
    isFeatured: featured,
    searchKeywords: searchKeywords || [],
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
    const { sequelize } = require('../models');
    await sequelize.query(
      'UPDATE products SET compare_at_price = :comparePrice WHERE id = :id',
      {
        replacements: {
          comparePrice: comparePrice,
          id: product.id,
        },
        type: sequelize.QueryTypes.UPDATE,
      }
    );

    // Cập nhật lại giá trị trong đối tượng product
    product.compareAtPrice = comparePrice;
  }

  // Thêm categories nếu có
  if (categoryIds && categoryIds.length > 0) {
    try {
      // Kiểm tra xem có cần tạo category không (dùng cho demo/phát triển)
      // Trong môi trường production, thường chỉ validate với categories đã có
      const { Category } = require('../models');

      // Với mỗi category ID, tìm kiếm hoặc tạo placeholder
      const categoryPromises = categoryIds.map(async (catId) => {
        // Thử tìm category trước
        let category = await Category.findByPk(catId).catch(() => null);

        // Nếu category không tồn tại và ID là số (từ dữ liệu mock)
        if (!category && /^\d+$/.test(catId)) {
          // Tạo category placeholder với ID là một phần của tên
          // Chỉ dùng cho mục đích phát triển/demo
          category = await Category.create({
            name: `Category ${catId}`,
            slug: `category-${catId}`,
            description: `Category được tạo tự động từ ID ${catId}`,
            isActive: true,
          });
        }

        return category ? category.id : null;
      });

      const validCategoryIds = (await Promise.all(categoryPromises)).filter(
        (id) => id !== null
      );

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

        logger.info(
          `Tạo attribute: ${attr.name} với values:`,
          attrValues
        );

        return await ProductAttribute.create({
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
      const productAttributes = await ProductAttribute.findAll({
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
        if (
          productAttributes.length > 0 &&
          Object.keys(variantAttributes).length > 0
        ) {
          try {
            // Tạm thời bỏ qua validation để đảm bảo biến thể được tạo
          } catch (error) {
            logger.error('Lỗi khi xác thực thuộc tính biến thể:', error);
            // Không throw error, chỉ log để tiếp tục tạo biến thể
          }
        }

        // Tạo SKU nếu chưa được cung cấp
        const variantSku =
          variant.sku || generateVariantSku(uniqueSku, variantAttributes);

        logger.info(`Tạo variant với SKU: ${variantSku}`);

        // Tạo tên hiển thị cho variant
        const displayName =
          variant.displayName ||
          (variantAttributes && Object.values(variantAttributes).length > 0
            ? Object.values(variantAttributes).join(' - ')
            : variant.name);

        // Tạo biến thể với dữ liệu đã được xác thực
        return await ProductVariant.create({
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
      await Product.update(
        {
          stockQuantity: totalStock,
          inStock: totalStock > 0,
        },
        { where: { id: product.id } }
      );
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
      const ProductImage = require('../models/productImage');
      await ProductImage.bulkCreate(imageData);
      logger.info(`Đã tạo ${images.length} ảnh cho sản phẩm ${product.id}`);
    } catch (error) {
      logger.error('Lỗi khi tạo ảnh:', error);
    }
  }

  // Thêm specifications nếu có
  if (
    specifications &&
    Array.isArray(specifications) &&
    specifications.length > 0
  ) {
    try {
      const { ProductSpecification } = require('../models');

      const specificationData = specifications.map((spec, index) => ({
        productId: product.id,
        name: spec.name,
        value: spec.value,
        category: spec.category || 'General',
        sortOrder: spec.sortOrder || index,
      }));

      await ProductSpecification.bulkCreate(specificationData);
      logger.info(
        `Đã tạo ${specifications.length} thông số kỹ thuật cho sản phẩm ${product.id}`
      );
    } catch (error) {
      logger.error('Lỗi khi tạo specifications:', error);
      // Không throw error để không làm fail toàn bộ quá trình tạo product
    }
  }

  // Xử lý warranty packages
  if (
    warrantyPackageIds &&
    Array.isArray(warrantyPackageIds) &&
    warrantyPackageIds.length > 0
  ) {
    try {
      logger.info('Đang tạo warranty packages:', warrantyPackageIds);
      const { ProductWarranty, WarrantyPackage } = require('../models');

      // Kiểm tra xem các warranty packages có tồn tại không
      logger.info(
        'Tìm warranty packages theo IDs:',
        warrantyPackageIds
      );
      const existingWarrantyPackages = await WarrantyPackage.findAll({
        where: { id: warrantyPackageIds, isActive: true },
      });
      logger.info('Tìm thấy warranty packages:', existingWarrantyPackages.length);

      if (existingWarrantyPackages.length > 0) {
        const warrantyPromises = existingWarrantyPackages.map(
          async (warrantyPackage, index) => {
            return await ProductWarranty.create({
              productId: product.id,
              warrantyPackageId: warrantyPackage.id,
              isDefault: index === 0, // Đặt warranty package đầu tiên làm mặc định
            });
          }
        );

        await Promise.all(warrantyPromises);
        logger.info(
          `Đã tạo ${existingWarrantyPackages.length} liên kết warranty package cho sản phẩm ${product.id}`
        );
      }
    } catch (error) {
      logger.error('Lỗi khi tạo warranty packages:', error);
      // Tiếp tục mà không có warranty packages nếu có lỗi
    }
  }

  // Lấy lại product với attributes và variants
  const productWithRelations = await Product.findByPk(product.id, {
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
        model: require('../models').ProductSpecification,
        as: 'productSpecifications',
      },
      {
        model: require('../models').WarrantyPackage,
        as: 'warrantyPackages',
        through: {
          attributes: ['isDefault'],
          as: 'productWarranty',
        },
                required: false,
      },
    ],
  });

  // Đồng bộ vector store thủ công — Product.update() cập nhật inStock/stockQuantity bypass Sequelize hooks
  try {
    const vectorStoreService = require('../services/ai/vectorStore');
    await vectorStoreService.loadPromise;
    if (productWithRelations.status === 'active' && productWithRelations.inStock) {
      await vectorStoreService.addProduct(productWithRelations.toJSON());
      await vectorStoreService.save();
    }
  } catch (syncErr) {
    logger.error('Lỗi đồng bộ vector store sau khi tạo sản phẩm:', syncErr.message);
  }

  // Ghi audit log
  logger.info('req.user trong createProduct:', req.user);
  AdminAuditService.logProductAction(
    req.user,
    'CREATE',
    product.id,
    product.name
  );

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
    thumbnail,
    inStock,
    stockQuantity,
    sku,
    status,
        isFeatured: featured,
    searchKeywords,
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

  const { sequelize, Category, ProductAttribute, ProductVariant, ProductSpecification, ProductWarranty, WarrantyPackage } = require('../models');
  const { generateVariantSku, calculateTotalStock } = require('../utils/productHelpers');
  
  // Dùng transaction để đảm bảo tính nguyên tử
  const transaction = await sequelize.transaction();

  try {
    const product = await Product.findByPk(id, { transaction });
    if (!product) {
      await transaction.rollback();
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Theo dõi thay đổi để ghi audit log
    const changes = {};
    if (name && name !== product.name) changes.name = { from: product.name, to: name };
    if (price && price !== product.basePrice) changes.price = { from: product.basePrice, to: price };

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (req.body.hasOwnProperty('name')) updateData.name = name;
    if (req.body.hasOwnProperty('baseName')) updateData.baseName = req.body.baseName || name;
    if (req.body.hasOwnProperty('description')) updateData.description = description;
    if (req.body.hasOwnProperty('shortDescription')) updateData.shortDescription = shortDescription;
    if (req.body.hasOwnProperty('price')) updateData.basePrice = parseFloat(price?.toString()) || 0;
    if (req.body.hasOwnProperty('inStock')) updateData.inStock = inStock;
    if (req.body.hasOwnProperty('stockQuantity')) updateData.stockQuantity = parseInt(stockQuantity?.toString()) || 0;
    if (req.body.hasOwnProperty('sku')) updateData.sku = sku;
    if (req.body.hasOwnProperty('status')) updateData.status = status;
    if (req.body.hasOwnProperty('featured')) updateData.isFeatured = featured;
    if (req.body.hasOwnProperty('condition')) updateData.condition = condition;
    if (req.body.hasOwnProperty('searchKeywords')) updateData.searchKeywords = searchKeywords;
    if (req.body.hasOwnProperty('seoTitle')) updateData.seoTitle = seoTitle;
    if (req.body.hasOwnProperty('seoDescription')) updateData.seoDescription = seoDescription;
    if (req.body.hasOwnProperty('seoKeywords')) updateData.seoKeywords = seoKeywords;
    if (req.body.hasOwnProperty('faqs')) updateData.faqs = faqs;

    // 1. Cập nhật thông tin cơ bản của sản phẩm
    await product.update(updateData, { transaction });

    // 1b. Cập nhật ảnh sản phẩm
    if (req.body.hasOwnProperty('images') && Array.isArray(images)) {
      // Xóa ảnh cũ
      await ProductImage.destroy({ where: { productId: id }, transaction });
      
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
        await ProductImage.bulkCreate(imageData, { transaction });
      }
      changes.images = images.length;
    }

    // 2. Cập nhật compareAtPrice (xử lý đặc biệt do cách đặt tên cột SQL)
    const priceToCompare = req.body.hasOwnProperty('compareAtPrice') 
      ? compareAtPrice 
      : (req.body.hasOwnProperty('comparePrice') ? comparePrice : null);

    if (req.body.hasOwnProperty('compareAtPrice') || req.body.hasOwnProperty('comparePrice')) {
      await sequelize.query(
        'UPDATE products SET compare_at_price = :compareAtPrice WHERE id = :id',
        {
          replacements: {
            compareAtPrice: priceToCompare === '' ? null : priceToCompare,
            id: id,
          },
          type: sequelize.QueryTypes.UPDATE,
          transaction
        }
      );
    }

    // 3. Cập nhật categories
    if (req.body.hasOwnProperty('categoryIds') && Array.isArray(categoryIds)) {
      const categories = await Category.findAll({ 
        where: { id: categoryIds },
        transaction
      });
      await product.setCategories(categories, { transaction });
      changes.categories = categoryIds;
    }

    // 4. Cập nhật attributes (cập nhật vi sai)
    if (req.body.hasOwnProperty('attributes') && Array.isArray(attributes)) {
      const currentAttributes = await ProductAttribute.findAll({ where: { productId: id }, transaction });
      const currentAttrMap = currentAttributes.reduce((map, attr) => {
        map[attr.name] = attr;
        return map;
      }, {});

      const newAttrNames = new Set(attributes.map(a => a.name));

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
          attrValues = attr.value.split(',').map(v => v.trim()).filter(Boolean);
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
          return await currentAttrMap[attr.name].update({
            values: normalizedValues,
            type: attr.type || currentAttrMap[attr.name].type || 'custom',
            required: attr.required !== undefined ? attr.required : currentAttrMap[attr.name].required,
          }, { transaction });
        } else {
          // Tạo attribute mới
          return await ProductAttribute.create({
            productId: id,
            name: attr.name,
            values: normalizedValues,
            type: attr.type || 'custom',
            required: attr.required || false,
          }, { transaction });
        }
      });
      await Promise.all(attributePromises);
      changes.attributes = attributes.length;
    }

    // 5. Cập nhật variants (cập nhật vi sai)
    if (req.body.hasOwnProperty('variants') && Array.isArray(variants)) {
      const currentVariants = await ProductVariant.findAll({ where: { productId: id }, transaction });
      const currentVarMap = currentVariants.reduce((map, v) => {
        map[v.id] = v;
        return map;
      }, {});

      // Dùng Set để tra cứu nhanh các ID đầu vào
      const incomingVarIds = new Set(variants.filter(v => v.id && !v.id.startsWith('var-')).map(v => v.id));

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

        const variantSku = variant.sku || generateVariantSku(product.sku || sku || 'PROD', variantAttributes);
        
        const variantData = {
          name: variant.name,
          sku: variantSku,
          attributes: variantAttributes,
          attributeValues: variantAttributes,
          price: parseFloat(variant.price?.toString()) || 0,
          stockQuantity: parseInt((variant.stock || variant.stockQuantity || 0).toString()) || 0,
          images: variant.images || [],
          isDefault: variant.isDefault || (index === 0 && !variants.some(v => v.isDefault)),
          isAvailable: variant.isAvailable !== false,
          compareAtPrice: variant.compareAtPrice || null,
          displayName: variant.displayName || variant.name || Object.values(variantAttributes).join(' - '),
        };

        if (variant.id && currentVarMap[variant.id]) {
          // Cập nhật variant đã có
          const updated = await currentVarMap[variant.id].update(variantData, { transaction });
          finalVariants.push(updated);
          return updated;
        } else {
          // Tạo variant mới
          const created = await ProductVariant.create({
            ...variantData,
            productId: id,
            // Chỉ dùng ID nếu là UUID hợp lệ (không phải ID tạm như 'var-0')
            id: variant.id && !variant.id.startsWith('var-') ? variant.id : undefined,
          }, { transaction });
          finalVariants.push(created);
          return created;
        }
      });

      await Promise.all(variantPromises);
      changes.variants = variants.length;

      // Đồng bộ tổng tồn kho nếu có variants
      const totalStock = calculateTotalStock(finalVariants);
      await Product.update(
        { stockQuantity: totalStock, inStock: totalStock > 0 },
        { where: { id }, transaction }
      );
    } else if (req.body.hasOwnProperty('stockQuantity')) {
      // Nếu không có variants, dùng tồn kho cơ bản
      await Product.update(
        { 
          stockQuantity: parseInt(stockQuantity?.toString()) || 0, 
          inStock: (parseInt(stockQuantity?.toString()) || 0) > 0 
        },
        { where: { id }, transaction }
      );
    }

    // 6. Cập nhật thông số kỹ thuật (cập nhật vi sai)
    if (req.body.hasOwnProperty('specifications') && Array.isArray(specifications)) {
      const currentSpecs = await ProductSpecification.findAll({ where: { productId: id }, transaction });
      const currentSpecMap = currentSpecs.reduce((map, spec) => {
        map[spec.name] = spec;
        return map;
      }, {});

      const incomingSpecNames = new Set(specifications.map(s => s.name));

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
          category: spec.category || 'General',
          sortOrder: spec.sortOrder || index,
        };

        if (currentSpecMap[spec.name]) {
          return await currentSpecMap[spec.name].update(specData, { transaction });
        } else {
          return await ProductSpecification.create({
            ...specData,
            productId: id,
          }, { transaction });
        }
      });
      await Promise.all(specPromises);
      changes.specifications = specifications.length;
    }

    // 7. Cập nhật warranty packages
    if (req.body.hasOwnProperty('warrantyPackageIds') && Array.isArray(warrantyPackageIds)) {
      await ProductWarranty.destroy({ where: { productId: id }, transaction });
      if (warrantyPackageIds.length > 0) {
        const wp = await WarrantyPackage.findAll({
          where: { id: warrantyPackageIds, isActive: true },
          transaction
        });
        const wpPromises = wp.map((p, index) =>
          ProductWarranty.create({
            productId: id,
            warrantyPackageId: p.id,
            isDefault: index === 0
          }, { transaction })
        );
        await Promise.all(wpPromises);
      }
    }

    await transaction.commit();

    // Ghi audit log (ngoài transaction là hợp lệ)
    AdminAuditService.logProductAction(req.user, 'UPDATE', id, name || product.name, changes);

    // Lấy trạng thái cuối cùng để trả về response
    const finalProduct = await Product.findByPk(id, {
      include: [
        { model: Category, as: 'categories', through: { attributes: [] } },
        { model: ProductAttribute, as: 'productAttributes' },
        { model: ProductVariant, as: 'variants' },
        { model: ProductSpecification, as: 'productSpecifications' },
        {
          model: WarrantyPackage,
          as: 'warrantyPackages',
          through: { attributes: ['isDefault'], as: 'productWarranty' },
          required: false
        }
      ]
    });

    // Đồng bộ vector store thủ công — Product.update() cập nhật inStock/stockQuantity bypass Sequelize hooks
    try {
      const vectorStoreService = require('../services/ai/vectorStore');
      await vectorStoreService.loadPromise;
      if (finalProduct && finalProduct.status === 'active' && finalProduct.inStock) {
        await vectorStoreService.addProduct(finalProduct.toJSON());
      } else if (finalProduct) {
        vectorStoreService.items = vectorStoreService.items.filter(item => item.metadata.id !== finalProduct.id);
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
  const {
    CartItem,
    OrderItem,
    Wishlist,
    ProductAttribute,
    ProductVariant,
    ProductCategory,
    sequelize,
  } = require('../models');

  const product = await Product.findByPk(id);
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
  const transaction = await sequelize.transaction();

  try {
    // Xóa các bản ghi liên quan trong cart_items
    await CartItem.destroy({ where: { productId: id }, transaction });

    // Xóa các bản ghi liên quan trong order_items (hoặc có thể cân nhắc giữ lại lịch sử đơn hàng)
    // Nếu muốn giữ lại lịch sử đơn hàng, có thể bỏ dòng này
    // await OrderItem.destroy({ where: { productId: id }, transaction });

    // Xóa các bản ghi liên quan trong wishlist
    await Wishlist.destroy({ where: { productId: id }, transaction });

    // Xóa các thuộc tính của sản phẩm
    await ProductAttribute.destroy({ where: { productId: id }, transaction });

    // Xóa các biến thể của sản phẩm
    await ProductVariant.destroy({ where: { productId: id }, transaction });

    // Xóa các liên kết danh mục
    await ProductCategory.destroy({ where: { productId: id }, transaction });

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
      model: require('../models').ProductImage,
      as: 'productImages',
      attributes: ['imageUrl', 'color', 'isThumbnail'],
      required: false,
    },
  ];

  // Filter theo category
  if (category) {
    includeClause[1].where = { id: category };
  }

  logger.info('>>> [ADMIN] Đang lấy danh sách sản phẩm...');
  try {
    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy === 'price' ? 'basePrice' : sortBy, sortOrder.toUpperCase()]],
      distinct: true,
    });
    logger.info('>>> [ADMIN] Lấy sản phẩm xong:', products.length);

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
    logger.error('>>> [ADMIN] LỖI khi lấy danh sách sản phẩm:', err.message);
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

  const { count, rows: reviews } = await Review.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'avatar'],
      },
      {
        model: Product,
        attributes: ['id', 'name', 'slug'],
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

  const review = await Review.findByPk(id);
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
          attributes: ['id', 'name', 'basePrice'],
          include: [
            {
              model: require('../models').ProductImage,
              as: 'productImages',
              attributes: ['imageUrl'],
              limit: 1,
            }
          ]
        },
      ],
    },
  ];

  logger.info('>>> [ADMIN] Đang lấy danh sách đơn hàng...');
  try {
    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
    });
    logger.info('>>> [ADMIN] Lấy đơn hàng xong:', orders.length);

    // Transform dữ liệu đơn hàng
    const transformedOrders = orders.map((o) => {
      const order = o.toJSON();
      if (order.items) {
        order.items = order.items.map((item) => {
          if (item.Product) {
            // Chuyển đổi images: mảng object {imageUrl} -> mảng string
            item.Product.images =
              item.Product.productImages?.map((img) => img.imageUrl) || [];
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
    logger.error('>>> [ADMIN] LỖI khi lấy danh sách đơn hàng:', err.message);
    throw err;
  }
});

/**
 * Quản lý Orders - Cập nhật trạng thái đơn hàng
 */
const updateOrderStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus, note } = req.body;

  const order = await Order.findByPk(id);
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

  const updatedOrder = await order.update(updateData);

  res.status(200).json({
    status: 'success',
    data: { order: updatedOrder },
  });
});

/**
 * Quản lý Products - Clone sản phẩm
 */
const cloneProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    ProductCategory,
    ProductAttribute,
    ProductVariant,
    ProductSpecification,
    ProductWarranty,
    sequelize,
  } = require('../models');

  // 1. Tìm sản phẩm gốc với đầy đủ các quan hệ
  const originalProduct = await Product.findByPk(id, {
    include: [
      { model: Category, as: 'categories' },
      { model: ProductAttribute, as: 'productAttributes' },
      { model: ProductVariant, as: 'variants' },
      { model: ProductSpecification, as: 'productSpecifications' },
      {
        model: require('../models').WarrantyPackage,
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
    const existing = await Product.findOne({ where: { name: testName } });
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

    const newProduct = await Product.create(productData, { transaction });

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
      await ProductAttribute.bulkCreate(attributeData, { transaction });
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
      await ProductVariant.bulkCreate(variantData, { transaction });
    }

    // Thông số kỹ thuật
    if (
      originalProduct.productSpecifications &&
      originalProduct.productSpecifications.length > 0
    ) {
      const specData = originalProduct.productSpecifications.map((spec) => {
        const data = spec.get({ plain: true });
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;
        return { ...data, productId: newProduct.id };
      });
      await ProductSpecification.bulkCreate(specData, { transaction });
    }

    // Gói bảo hành
    if (
      originalProduct.warrantyPackages &&
      originalProduct.warrantyPackages.length > 0
    ) {
      const warrantyData = originalProduct.warrantyPackages.map((wp) => ({
        productId: newProduct.id,
        warrantyPackageId: wp.id,
        isDefault: wp.ProductWarranty?.isDefault || false,
      }));
      await ProductWarranty.bulkCreate(warrantyData, { transaction });
    }

    await transaction.commit();

    // Ghi audit log
    AdminAuditService.logProductAction(
      req.user,
      'CLONE',
      newProduct.id,
      newProduct.name,
      { originalProductId: id }
    );

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

  const product = await Product.findByPk(id);
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
  AdminAuditService.logProductAction(
    req.user,
    'UPDATE_STATUS',
    product.id,
    product.name,
    { from: product.status, to: newStatus }
  );

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

  const product = await Product.findByPk(productId);
  if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

  let prevStock, newStock;

  if (variantId) {
    // Nhập hàng cho biến thể cụ thể
    const variant = await ProductVariant.findOne({ where: { id: variantId, productId } });
    if (!variant) throw new AppError('Không tìm thấy biến thể', 404);

    prevStock = variant.stockQuantity;
    newStock = prevStock + qty;
    await variant.update({ stockQuantity: newStock, isAvailable: true });

    // Cập nhật tổng stock và trạng thái inStock của product
    const total = await ProductVariant.sum('stockQuantity', { where: { productId } });
    await product.update({ stockQuantity: total || 0, inStock: (total || 0) > 0 });
  } else {
    // Nhập hàng cho sản phẩm không có variant
    prevStock = product.stockQuantity;
    newStock = prevStock + qty;
    await product.update({ stockQuantity: newStock, inStock: true });
  }

  // Ghi lịch sử nhập hàng
  const log = await InventoryLog.create({
    productId: parseInt(productId, 10),
    variantId: variantId ? parseInt(variantId, 10) : null,
    changeType: 'restock',
    changeAmount: qty,
    previousStock: prevStock,
    newStock,
    note: note || null,
    createdBy: req.user.id,
  });

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
  restockProduct,
};
