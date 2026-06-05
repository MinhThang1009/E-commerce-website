/**
 * @file adminOrderService.js
 * @layer Service
 * @module admin
 * @description CRUD orders + reviews cho admin
 */
const adminRepository = require('@modules/admin/repositories/sequelize-admin-repository');
const Op = adminRepository.getOp();
const { Product, ProductImage, User, OrderItem } = adminRepository.getModels();

const logger = require('@utils/logger');
const { catchAsync } = require('@utils/catch-async');
const { AppError } = require('@shared/errors');
const { t } = require('@utils/i18n');

// ordersService được inject từ app.js (pattern setter — giống attribute.setNameGenerator).
// Hủy/đổi-trạng-thái đơn DELEGATE sang orders-service để dùng CHUNG 1 path (guard delivered/
// cancelled, hoàn kho atomic + SELECT FOR UPDATE theo trạng thái, publish order.cancelled),
// tránh logic trùng từng gây F8/F9/F11/K.
let _ordersService = null;
const setOrdersService = (svc) => {
  _ordersService = svc;
};

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

  if (productId) {
    whereClause.productId = productId;
  }

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

const deleteReview = catchAsync(async (req, res) => {
  const { id } = req.params;

  const review = await adminRepository.findReviewById(id);
  if (!review) {
    throw new AppError(t('admin.reviewNotFound', req.locale), 404);
  }

  await review.destroy();

  res.status(200).json({
    status: 'success',
    message: 'Xóa đánh giá thành công',
  });
});

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

  if (status) {
    whereClause.status = status;
  }

  if (startDate && endDate) {
    whereClause.createdAt = {
      [Op.between]: [
        new Date(startDate),
        (() => {
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          return endDateTime;
        })(),
      ],
    };
  }

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

    const transformedOrders = orders.map((o) => {
      const order = o.toJSON();
      if (order.items) {
        order.items = order.items.map((item) => {
          if (item.Product) {
            item.Product.images = item.Product.productImages?.map((img) => img.imageUrl) || [];
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

const updateOrderStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus, note } = req.body;

  // DELEGATE sang orders-service (1 path chung): guard delivered→400 / cancelled→422,
  // hoàn kho atomic + SELECT FOR UPDATE CHỈ khi pending/processing (shipped KHÔNG hoàn — INV-STK-6),
  // publish order.cancelled. KHÔNG còn logic hoàn kho trùng tại admin (F9/F11/F13/K fixed).
  await _ordersService.updateOrderStatus({ id, status, paymentStatus, note });

  const order = await adminRepository.findOrderById(id);
  res.status(200).json({ status: 'success', data: { order } });
});

const adminCancelOrder = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Giữ contract cũ: đơn đã hủy → 400 (orders-service coi cancelled→cancelled là no-op 200).
  const existing = await adminRepository.findOrderById(id);
  if (!existing) throw new AppError(t('admin.orderNotFound', req.locale), 404);
  if (existing.status === 'cancelled')
    throw new AppError(t('admin.orderAlreadyCancelled', req.locale), 400);

  // DELEGATE sang orders-service: guard delivered→400; hoàn kho atomic + lock CHỈ khi
  // pending/processing (shipped KHÔNG hoàn — INV-STK-6); publish order.cancelled (audit).
  await _ordersService.updateOrderStatus({ id, status: 'cancelled' });

  res.status(200).json({
    status: 'success',
    message: 'Đã hủy đơn hàng thành công',
    data: { orderId: parseInt(id, 10), status: 'cancelled' },
  });
});

module.exports = {
  setOrdersService,
  getAllReviews,
  deleteReview,
  getAllOrders,
  updateOrderStatus,
  adminCancelOrder,
};
