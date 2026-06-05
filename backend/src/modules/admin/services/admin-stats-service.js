/**
 * @file adminStatsService.js
 * @layer Service
 * @module admin
 * @description Dashboard stats và detailed stats cho admin
 */
const adminRepository = require('@modules/admin/repositories/sequelize-admin-repository');
const Op = adminRepository.getOp();
const Sequelize = adminRepository.getSequelizeFns();
const { Product, ProductImage } = adminRepository.getModels();

const logger = require('@utils/logger');
const { catchAsync } = require('@utils/catch-async');
const { AppError } = require('@shared/errors');
const { t } = require('@utils/i18n');

const getDashboardStats = catchAsync(async (req, res) => {
  logger.info('[CONTROLLER] getDashboardStats started');
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

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

  const userGrowth = lastMonthUsers ? ((monthlyUsers - lastMonthUsers) / lastMonthUsers) * 100 : 0;
  const orderGrowth = lastMonthOrders
    ? ((monthlyOrders - lastMonthOrders) / lastMonthOrders) * 100
    : 0;
  const revenueGrowth = lastMonthRevenue
    ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

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
  }

  const orderStatusCounts = await adminRepository.aggregateOrders({
    attributes: ['status', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true,
  });
  const ordersByStatus = orderStatusCounts.reduce(
    (acc, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    },
    { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
  );

  const deliveredOrders = await adminRepository.countOrders({
    status: 'delivered',
    paymentStatus: { [Op.notIn]: ['refunded', 'failed'] },
  });
  const aov = deliveredOrders > 0 ? (totalRevenue || 0) / deliveredOrders : 0;

  const cancelledOrdersMonth = await adminRepository.countOrders({
    status: 'cancelled',
    createdAt: { [Op.gte]: startOfMonth },
  });

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

const getDetailedStats = catchAsync(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(t('admin.startEndDateRequired', req.locale), 400);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

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

module.exports = { getDashboardStats, getDetailedStats };
