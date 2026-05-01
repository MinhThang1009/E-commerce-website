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
} = require('../models');
const { Op, Sequelize } = require('sequelize');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');
const { AdminAuditService } = require('../services/adminAuditService');
const {
  calculateTotalStock,
  updateProductTotalStock,
  validateVariantAttributes,
  generateVariantSku,
} = require('../utils/productHelpers');

/**
 * Recursively parse JSON strings to handle multi-layered stringification.
 * e.g. '"{\\"key\\":\\"val\\"}"' → { key: "val" }
 */
function deepParseJSON(val) {
  if (val === null || val === undefined) return {};
  if (typeof val === 'object' && !Array.isArray(val)) return val; // Already an object
  if (typeof val !== 'string') return {};
  
  let parsed = val;
  let maxAttempts = 5; // Prevent infinite loop
  while (typeof parsed === 'string' && maxAttempts-- > 0) {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      return {}; // Not valid JSON at all
    }
  }
  
  if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
    return parsed;
  }
  return {};
}

/**
 * Recursively parse JSON array strings
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
  console.info('>>> [CONTROLLER] getDashboardStats started');
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
  console.info('>>> [DASHBOARD] totalUsers fetched:', totalUsers);
  const totalProducts = await Product.count();
  console.info('>>> [DASHBOARD] totalProducts fetched:', totalProducts);
  const totalOrders = await Order.count();
  console.info('>>> [DASHBOARD] totalOrders fetched:', totalOrders);
  const totalRevenue = await Order.sum('total', {
    where: { status: 'delivered' },
  });
  console.info('>>> [DASHBOARD] totalRevenue fetched:', totalRevenue);

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
  console.info('>>> [DASHBOARD] fetching topProducts...');
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
    console.info('>>> [DASHBOARD] topProducts fetched:', topProducts.length);
  } catch (err) {
    console.error('>>> [DASHBOARD] ERROR fetching topProducts:', err.message);
    // Continue without top products if it fails
  }

  // Đơn hàng gần đây cần xử lý
  const pendingOrders = await Order.count({
    where: { status: 'pending' },
  });

  const processingOrders = await Order.count({
    where: { status: 'processing' },
  });

  res.status(200).json({
    status: 'success',
    data: {
      overview: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue || 0,
        pendingOrders,
        processingOrders,
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
        Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat),
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
      Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat),
    ],
    order: [
      [
        Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat),
        'ASC',
      ],
    ],
  });

  // Thống kê user mới theo thời gian
  const userStats = await User.findAll({
    attributes: [
      [
        Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat),
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
      Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat),
    ],
    order: [
      [
        Sequelize.fn('DATE_FORMAT', Sequelize.col('created_at'), dateFormat),
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
    limit = 10,
    search = '',
    role = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    isEmailVerified,
  } = req.query;

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
        as: 'attributes',
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

  // Sanitize product data before sending to frontend
  const productJson = product.toJSON();
  
  // Deep-parse variant attributes (fix multi-stringification)
  if (productJson.variants && Array.isArray(productJson.variants)) {
    productJson.variants = productJson.variants.map(v => ({
      ...v,
      attributes: deepParseJSON(v.attributes),
      attributeValues: deepParseJSON(v.attributeValues || v.attributes),
      specifications: deepParseJSON(v.specifications),
    }));
  }
  
  // Deep-parse product attribute values
  if (productJson.attributes && Array.isArray(productJson.attributes)) {
    productJson.attributes = productJson.attributes.map(attr => ({
      ...attr,
      values: deepParseJSONArray(attr.values),
    }));
  }
  
  // Deep-parse specifications
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
  console.log(
    'Create product request body:',
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
    // New fields for laptops/computers
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
    // New fields for laptops/computers
    condition,
    specifications: specifications || [],
    faqs: faqs || [],
  });

  // Cập nhật compareAtPrice riêng bằng truy vấn SQL trực tiếp nếu có
  console.log('comparePrice from request:', comparePrice);
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
      // Check if we need to create categories (for demo/development purposes)
      // In production, you would typically validate against existing categories
      const { Category } = require('../models');

      // For each category ID, either find it or create a placeholder
      const categoryPromises = categoryIds.map(async (catId) => {
        // Try to find the category first
        let category = await Category.findByPk(catId).catch(() => null);

        // If category doesn't exist and the ID is a simple number (from mock data)
        if (!category && /^\d+$/.test(catId)) {
          // Create a placeholder category with this ID as part of the name
          // This is just for development/demo purposes
          category = await Category.create({
            name: `Category ${catId}`,
            slug: `category-${catId}`,
            description: `Auto-created category from ID ${catId}`,
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
      console.error('Error handling categories:', error);
      // Continue without categories if there's an error
    }
  }

  // Xử lý attributes
  if (attributes && attributes.length > 0) {
    try {
      console.log('Processing attributes:', attributes);
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

        console.log(
          `Creating attribute: ${attr.name} with values:`,
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
      console.error('Error creating attributes:', error);
      throw error; // Ném lỗi để transaction có thể rollback
    }
  }

  // Xử lý variants
  let createdVariants = [];
  if (variants && variants.length > 0) {
    try {
      console.log('Processing variants:', variants);

      // Lấy attributes để validate
      const productAttributes = await ProductAttribute.findAll({
        where: { productId: product.id },
      });

      const variantPromises = variants.map(async (variant) => {
        // Đảm bảo variant.attributes luôn là một object
        const variantAttributes = deepParseJSON(variant.attributes);

        console.log(`Processing variant: ${variant.name}`, {
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
            console.error('Lỗi khi xác thực thuộc tính biến thể:', error);
            // Không throw error, chỉ log để tiếp tục tạo biến thể
          }
        }

        // Generate SKU if not provided
        const variantSku =
          variant.sku || generateVariantSku(uniqueSku, variantAttributes);

        console.log(`Creating variant with SKU: ${variantSku}`);

        // Generate display name for variant
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

      // Update product total stock from variants
      const totalStock = calculateTotalStock(createdVariants);
      await Product.update(
        {
          stockQuantity: totalStock,
          inStock: totalStock > 0,
        },
        { where: { id: product.id } }
      );
    } catch (error) {
      console.error('Error creating variants:', error);
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
      console.log(`Created ${images.length} images for product ${product.id}`);
    } catch (error) {
      console.error('Error creating images:', error);
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
      console.log(
        `Created ${specifications.length} specifications for product ${product.id}`
      );
    } catch (error) {
      console.error('Error creating specifications:', error);
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
      console.log('Creating warranty packages:', warrantyPackageIds);
      const { ProductWarranty, WarrantyPackage } = require('../models');

      // Kiểm tra xem các warranty packages có tồn tại không
      console.log(
        'Looking for warranty packages with IDs:',
        warrantyPackageIds
      );
      const existingWarrantyPackages = await WarrantyPackage.findAll({
        where: { id: warrantyPackageIds, isActive: true },
      });
      console.log('Found warranty packages:', existingWarrantyPackages.length);

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
        console.log(
          `Created ${existingWarrantyPackages.length} warranty package associations for product ${product.id}`
        );
      }
    } catch (error) {
      console.error('Error creating warranty packages:', error);
      // Continue without warranty packages if there's an error
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
        as: 'attributes',
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

  // Log audit
  console.log('req.user in createProduct:', req.user); // Debug log
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
  
  // Use transaction for atomicity
  const transaction = await sequelize.transaction();

  try {
    const product = await Product.findByPk(id, { transaction });
    if (!product) {
      await transaction.rollback();
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Track changes for audit
    const changes = {};
    if (name && name !== product.name) changes.name = { from: product.name, to: name };
    if (price && price !== product.basePrice) changes.price = { from: product.basePrice, to: price };

    // Prepare update data
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

    // 1. Update basic product info
    await product.update(updateData, { transaction });

    // 1b. Update product images
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

    // 2. Update compareAtPrice (handled specially due to SQL naming)
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

    // 3. Update categories
    if (req.body.hasOwnProperty('categoryIds') && Array.isArray(categoryIds)) {
      const categories = await Category.findAll({ 
        where: { id: categoryIds },
        transaction
      });
      await product.setCategories(categories, { transaction });
      changes.categories = categoryIds;
    }

    // 4. Update attributes (differential update)
    if (req.body.hasOwnProperty('attributes') && Array.isArray(attributes)) {
      const currentAttributes = await ProductAttribute.findAll({ where: { productId: id }, transaction });
      const currentAttrMap = currentAttributes.reduce((map, attr) => {
        map[attr.name] = attr;
        return map;
      }, {});

      const newAttrNames = new Set(attributes.map(a => a.name));

      // 1. Delete attributes not in the new list
      for (const attr of currentAttributes) {
        if (!newAttrNames.has(attr.name)) {
          await attr.destroy({ transaction });
        }
      }

      // 2. Create or Update attributes
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
          // Update existing
          return await currentAttrMap[attr.name].update({ 
            values: normalizedValues,
            type: attr.type || currentAttrMap[attr.name].type || 'custom',
            required: attr.required !== undefined ? attr.required : currentAttrMap[attr.name].required,
          }, { transaction });
        } else {
          // Create new
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

    // 5. Update variants (differential update)
    if (req.body.hasOwnProperty('variants') && Array.isArray(variants)) {
      const currentVariants = await ProductVariant.findAll({ where: { productId: id }, transaction });
      const currentVarMap = currentVariants.reduce((map, v) => {
        map[v.id] = v;
        return map;
      }, {});

      // Use a Set for quick lookup of incoming IDs
      const incomingVarIds = new Set(variants.filter(v => v.id && !v.id.startsWith('var-')).map(v => v.id));

      // 1. Delete variants that aren't in the incoming list
      for (const variant of currentVariants) {
        if (!incomingVarIds.has(variant.id)) {
          await variant.destroy({ transaction });
        }
      }

      // 2. Create or Update variants
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
          // Update existing variant
          const updated = await currentVarMap[variant.id].update(variantData, { transaction });
          finalVariants.push(updated);
          return updated;
        } else {
          // Create new variant
          const created = await ProductVariant.create({
            ...variantData,
            productId: id,
            // Only use ID if it's a valid UUID (not a temp ID like 'var-0')
            id: variant.id && !variant.id.startsWith('var-') ? variant.id : undefined,
          }, { transaction });
          finalVariants.push(created);
          return created;
        }
      });

      await Promise.all(variantPromises);
      changes.variants = variants.length;

      // Sync total stock if variants exist
      const totalStock = calculateTotalStock(finalVariants);
      await Product.update(
        { stockQuantity: totalStock, inStock: totalStock > 0 },
        { where: { id }, transaction }
      );
    } else if (req.body.hasOwnProperty('stockQuantity')) {
      // If no variants, use base stock
      await Product.update(
        { 
          stockQuantity: parseInt(stockQuantity?.toString()) || 0, 
          inStock: (parseInt(stockQuantity?.toString()) || 0) > 0 
        },
        { where: { id }, transaction }
      );
    }

    // 6. Update specifications (differential update)
    if (req.body.hasOwnProperty('specifications') && Array.isArray(specifications)) {
      const currentSpecs = await ProductSpecification.findAll({ where: { productId: id }, transaction });
      const currentSpecMap = currentSpecs.reduce((map, spec) => {
        map[spec.name] = spec;
        return map;
      }, {});

      const incomingSpecNames = new Set(specifications.map(s => s.name));

      // 1. Delete specs not in the incoming list
      for (const spec of currentSpecs) {
        if (!incomingSpecNames.has(spec.name)) {
          await spec.destroy({ transaction });
        }
      }

      // 2. Create or Update specs
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

    // 7. Update warranty packages
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

    // Log audit action (outside transaction is fine)
    AdminAuditService.logProductAction(req.user, 'UPDATE', id, name || product.name, changes);

    // Fetch final state for response
    const finalProduct = await Product.findByPk(id, {
      include: [
        { model: Category, as: 'categories', through: { attributes: [] } },
        { model: ProductAttribute, as: 'attributes' },
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

    res.status(200).json({
      status: 'success',
      data: { product: finalProduct },
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Update Product Error:', error);
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
    limit = 10,
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

  console.info('>>> [ADMIN] fetching products...');
  try {
    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy === 'price' ? 'basePrice' : sortBy, sortOrder.toUpperCase()]],
      distinct: true,
    });
    console.info('>>> [ADMIN] products fetched:', products.length);

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
    console.error('>>> [ADMIN] ERROR fetching products:', err.message);
    throw err;
  }
});

/**
 * Quản lý Reviews - Lấy danh sách review
 */
const getAllReviews = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    productId = '',
    rating = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
  } = req.query;

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
        attributes: ['id', 'firstName', 'lastName', 'avatar'],
      },
      {
        model: Product,
        attributes: ['id', 'name', 'images'],
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
    limit = 10,
    status = '',
    search = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    startDate,
    endDate,
  } = req.query;

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

  console.info('>>> [ADMIN] fetching orders...');
  try {
    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
    });
    console.info('>>> [ADMIN] orders fetched:', orders.length);

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
    console.error('>>> [ADMIN] ERROR fetching orders:', err.message);
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
      { model: ProductAttribute, as: 'attributes' },
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
    // Clone dữ liệu sản phẩm cơ bản
    const productData = originalProduct.get({ plain: true });
    delete productData.id;
    delete productData.createdAt;
    delete productData.updatedAt;
    delete productData.slug; // Slug sẽ được generate lại bởi hook
    delete productData.categories;
    delete productData.attributes;
    delete productData.variants;
    delete productData.productSpecifications;
    delete productData.warrantyPackages;

    productData.name = newName;
    productData.sku = newSku;
    productData.status = 'draft'; // Mặc định là bản nháp để admin kiểm tra lại

    const newProduct = await Product.create(productData, { transaction });

    // 5. Clone các quan hệ

    // Categories
    if (originalProduct.categories && originalProduct.categories.length > 0) {
      const categoryLinks = originalProduct.categories.map((cat) => ({
        productId: newProduct.id,
        categoryId: cat.id,
      }));
      await ProductCategory.bulkCreate(categoryLinks, { transaction });
    }

    // Attributes
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

    // Variants
    if (originalProduct.variants && originalProduct.variants.length > 0) {
      const variantData = originalProduct.variants.map((variant) => {
        const data = variant.get({ plain: true });
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;
        // Generate SKU mới cho variant dựa trên SKU mới của product
        // Giữ phần hậu tố của SKU variant nếu có
        const suffix = data.sku.includes('-')
          ? data.sku.split('-').pop()
          : Math.floor(Math.random() * 1000);
        data.sku = `${newSku}-${suffix}`;
        return { ...data, productId: newProduct.id };
      });
      await ProductVariant.bulkCreate(variantData, { transaction });
    }

    // Specifications
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

    // Warranty Packages
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

    // Log audit
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
    console.error('Error in cloneProduct:', error);
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

  // Log audit
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
};
