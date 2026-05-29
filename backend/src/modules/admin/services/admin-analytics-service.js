/**
 * @file adminAnalyticsService.js
 * @layer Service
 * @module admin
 * @description Analytics endpoints + export reports + chatbot stats cho admin
 */
const adminRepository = require('@modules/admin/repositories/sequelize-admin-repository');
const sequelize = adminRepository.getSequelize();
const Op = adminRepository.getOp();
const Sequelize = adminRepository.getSequelizeFns();
const { Product, ProductImage, ProductVariant, User, Order, ChatMessage } =
  adminRepository.getModels();

const logger = require('@utils/logger');
const { catchAsync } = require('@utils/catch-async');
const { AppError } = require('@shared/errors');

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

const getTopProductsAnalytics = catchAsync(async (req, res) => {
  const { metric = 'revenue', limit: qLimit = 5 } = req.query;
  const limitNum = Math.min(parseInt(qLimit, 10) || 5, 20);

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
        // Cần 'id' để Sequelize load association productImages (limit:1 → query riêng cần product_id)
        // và để group theo 'Product.id'
        attributes: ['id', 'nameVi', 'nameEn'],
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
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            return endDateTime;
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

const getLowStockAnalytics = catchAsync(async (req, res) => {
  const parsedThreshold = parseInt(req.query.threshold, 10);
  const threshold = Number.isFinite(parsedThreshold) ? parsedThreshold : 10;

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

const exportReport = catchAsync(async (req, res) => {
  const { type = 'orders', startDate, endDate } = req.query;

  if (type === 'orders') {
    const where = {};
    if (startDate && endDate) {
      where.createdAt = {
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

const getChatbotStats = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const where = { messageType: 'ai_chatbot' };
  if (startDate && endDate) {
    where.createdAt = {
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

  const totalSessions = await adminRepository.countChatMessages({
    distinct: true,
    col: 'session_id',
    where,
  });

  const totalMessages = await adminRepository.countChatMessages({ where });

  const avgMessagesPerSession =
    totalSessions > 0 ? parseFloat((totalMessages / totalSessions).toFixed(1)) : 0;

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
  getOrderStatusAnalytics,
  getTopProductsAnalytics,
  getRevenueByCategoryAnalytics,
  getUserGrowthAnalytics,
  getPaymentMethodsAnalytics,
  getLowStockAnalytics,
  exportReport,
  getChatbotStats,
};
