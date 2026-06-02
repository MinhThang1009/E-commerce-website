/**
 * @file adminOrderService.js
 * @layer Service
 * @module admin
 * @description CRUD orders + reviews cho admin
 */
const adminRepository = require('@modules/admin/repositories/sequelize-admin-repository');
const sequelize = adminRepository.getSequelize();
const Op = adminRepository.getOp();
const Sequelize = adminRepository.getSequelizeFns();
const { Product, ProductImage, User, Order, OrderItem, Review, ProductVariant } =
  adminRepository.getModels();

const logger = require('@utils/logger');
const { catchAsync } = require('@utils/catch-async');
const { AppError } = require('@shared/errors');

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
    throw new AppError('Không tìm thấy đánh giá', 404);
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

  if (status === 'delivered' && order.paymentMethod === 'cod') {
    updateData.paymentStatus = 'paid';
  }

  if (status === 'cancelled' && order.status !== 'cancelled') {
    // Không cho hủy đơn đã giao qua đổi trạng thái — hàng đã đến tay khách,
    // hoàn kho sẽ tạo tồn ảo. Đồng bộ với adminCancelOrder (cũng chặn delivered).
    if (order.status === 'delivered') {
      throw new AppError('Không thể hủy đơn hàng đã giao', 400);
    }
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

module.exports = {
  getAllReviews,
  deleteReview,
  getAllOrders,
  updateOrderStatus,
  adminCancelOrder,
};
