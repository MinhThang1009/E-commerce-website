/**
 * @file DashboardPage.tsx
 * @layer Page
 * @feature admin
 * @description Page component của feature admin
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES, buildRoute } from '@/routes/paths';
import {
  useGetDashboardStatsQuery,
  useGetLowStockAnalyticsQuery,
} from '../api/admin-dashboard-api';
import { useGetAdminOrdersQuery } from '../api/admin-order-api';
import DashboardCharts from '../components/DashboardCharts';
import { proxyImg } from '@/utils/proxy-img';
import {
  DollarSign,
  ShoppingBag,
  Users,
  Package,
  Calculator,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';

// Màu sắc badge trạng thái
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  shipped: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const DashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();

  // Lấy thống kê dashboard
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
  } = useGetDashboardStatsQuery();

  // Lấy đơn hàng gần đây
  const { data: ordersData, isLoading: isOrdersLoading } = useGetAdminOrdersQuery({
    page: 1,
    limit: 5,
  });

  // Lấy sản phẩm sắp hết hàng (threshold mặc định = 10)
  const { data: lowStockData } = useGetLowStockAnalyticsQuery({ threshold: 10 });

  // Định dạng tiền tệ — luôn dùng VND (trang thương mại Việt Nam)
  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  // Định dạng ngày tháng
  const formatDate = (dateString: string) => {
    const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // Định dạng phần trăm tăng trưởng
  const formatGrowth = (growth: number) => {
    const isPositive = growth >= 0;
    return {
      value: Math.abs(growth).toFixed(1),
      isPositive,
      color: isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      icon: isPositive ? 'up' : 'down',
    };
  };

  if (isDashboardLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-8">
          {t('admin.dashboard.title')}
        </h1>

        {/* Loading các thẻ thống kê */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(7)].map((_, index) => (
            <div
              key={index}
              className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 animate-pulse"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24"></div>
                <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-700 rounded-full"></div>
              </div>
              <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-20 mb-2"></div>
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-32"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isDashboardError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-8">
          {t('admin.dashboard.title')}
        </h1>
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-8 text-center border border-neutral-200 dark:border-neutral-700">
          <div className="text-error-500 mb-4">
            <AlertCircle className="h-16 w-16 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
            {t('admin.dashboard.errors.loadingDashboard')}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400">
            {t('admin.dashboard.errors.failedToLoad')}
          </p>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.data;
  const recentOrders = ordersData?.data.orders || [];
  const lowStockProducts = lowStockData?.data || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100">
          {t('admin.dashboard.title')}
        </h1>
        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          {t('admin.dashboard.lastUpdated')}:{' '}
          {new Date().toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
        </div>
      </div>

      {/* Các thẻ thống kê — 7 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* KPI Cards — data-driven */}
        {[
          {
            label: t('admin.dashboard.stats.totalRevenue'),
            value: formatCurrency(stats?.overview.totalRevenue || 0),
            icon: DollarSign,
            bg: 'bg-primary-100 dark:bg-primary-900/30',
            iconColor: 'text-primary-600 dark:text-primary-400',
            growth: stats?.growth.revenue,
          },
          {
            label: t('admin.dashboard.stats.totalOrders'),
            value: stats?.overview.totalOrders || 0,
            icon: ShoppingBag,
            bg: 'bg-blue-100 dark:bg-blue-900/30',
            iconColor: 'text-blue-600 dark:text-blue-400',
            growth: stats?.growth.orders,
          },
          {
            label: t('admin.dashboard.stats.totalUsers'),
            value: stats?.overview.totalUsers || 0,
            icon: Users,
            bg: 'bg-green-100 dark:bg-green-900/30',
            iconColor: 'text-green-600 dark:text-green-400',
            growth: stats?.growth.users,
          },
          {
            label: t('admin.dashboard.stats.totalProducts'),
            value: stats?.overview.totalProducts || 0,
            icon: Package,
            bg: 'bg-yellow-100 dark:bg-yellow-900/30',
            iconColor: 'text-yellow-600 dark:text-yellow-400',
            subtitle: t('admin.dashboard.stats.activeProducts'),
          },
          {
            label: t('admin.dashboard.stats.aov'),
            value: formatCurrency(stats?.overview.aov || 0),
            icon: Calculator,
            bg: 'bg-indigo-100 dark:bg-indigo-900/30',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            subtitle: t('admin.dashboard.stats.averageOrderValue'),
          },
          {
            label: t('admin.dashboard.stats.cancelledThisMonth'),
            value: stats?.overview.cancelledOrdersMonth || 0,
            icon: XCircle,
            bg: 'bg-red-100 dark:bg-red-900/30',
            iconColor: 'text-red-600 dark:text-red-400',
            subtitle: t('admin.dashboard.stats.ordersThisMonth'),
          },
        ].map(({ label, value, icon: Icon, bg, iconColor, growth, subtitle }) => (
          <div
            key={label}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-6 border border-neutral-200 dark:border-neutral-700 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {label}
              </h2>
              <div className={`p-2 ${bg} rounded-xl`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">{value}</div>
            {growth !== undefined && (
              <div className={`mt-2 text-sm flex items-center ${formatGrowth(growth).color}`}>
                {formatGrowth(growth).isPositive ? (
                  <TrendingUp className="w-4 h-4 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 mr-1" />
                )}
                <span>
                  {formatGrowth(growth).value}% {t('admin.dashboard.stats.fromLastMonth')}
                </span>
              </div>
            )}
            {subtitle && !growth && (
              <div className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</div>
            )}
          </div>
        ))}

        {/* Sản phẩm sắp hết hàng */}
        <a
          href="#low-stock-widget"
          className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-6 border border-neutral-200 dark:border-neutral-700 hover:border-red-300 dark:hover:border-red-700 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {t('admin.dashboard.stats.lowStock')}
            </h2>
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl relative">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              {(stats?.overview.lowStockCount || 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  !
                </span>
              )}
            </div>
          </div>
          <div className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
            {stats?.overview.lowStockCount || 0}
          </div>
          <div className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {t('admin.dashboard.stats.productsLowStock')}
          </div>
        </a>
      </div>

      {/* Cảnh báo đơn hàng chờ xử lý */}
      {(stats?.overview.ordersByStatus?.pending ?? 0) > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-8">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0" />
            <span className="text-yellow-800 dark:text-yellow-200 font-medium">
              {t('admin.dashboard.alerts.pendingOrders', {
                count: stats?.overview.ordersByStatus?.pending,
              })}
            </span>
            <Link
              to={buildRoute.adminOrdersPending()}
              className="ml-auto text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 font-medium text-sm"
            >
              {t('admin.dashboard.alerts.viewOrders')} →
            </Link>
          </div>
        </div>
      )}

      {/* Biểu đồ phân tích */}
      <DashboardCharts />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Đơn hàng gần đây */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
              {t('admin.dashboard.sections.recentOrders')}
            </h2>
            <Link
              to={ROUTES.ADMIN_ORDERS}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
            >
              {t('admin.dashboard.sections.viewAll')}
            </Link>
          </div>
          <div className="overflow-x-auto">
            {isOrdersLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="animate-pulse flex items-center space-x-4">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-20"></div>
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-32"></div>
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24"></div>
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-16"></div>
                  </div>
                ))}
              </div>
            ) : recentOrders.length > 0 ? (
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
                <thead className="bg-neutral-50 dark:bg-neutral-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      {t('admin.dashboard.table.order')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      {t('admin.dashboard.table.customer')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      {t('admin.dashboard.table.date')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      {t('admin.dashboard.table.total')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      {t('admin.dashboard.table.status')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-700">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-800 dark:text-neutral-100">
                        #{order.number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
                        {order.shippingFirstName} {order.shippingLastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[order.status]}`}
                        >
                          {t(`admin.dashboard.orderStatus.${order.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-neutral-500 dark:text-neutral-400">
                {t('admin.dashboard.table.noRecentOrders')}
              </div>
            )}
          </div>
        </div>

        {/* Sản phẩm bán chạy */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
              {t('admin.dashboard.sections.topProducts')}
            </h2>
            <Link
              to={ROUTES.ADMIN_PRODUCTS}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
            >
              {t('admin.dashboard.sections.viewAll')}
            </Link>
          </div>
          <div className="p-6">
            {stats?.topProducts && stats.topProducts.length > 0 ? (
              <div className="space-y-4">
                {stats.topProducts.map((item, index) => (
                  <div key={item.product.id ?? index} className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-700">
                      {item.product.images?.[0] ? (
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-500">
                          {(item.product.name || '?').charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">
                        {item.product.name}
                      </p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {item.totalSold} {t('admin.dashboard.table.sold')}
                        </span>
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(item.totalRevenue)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 rounded-full">
                        {index + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-neutral-500 dark:text-neutral-400">
                {t('admin.dashboard.table.noProductData')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Widget */}
      {lowStockProducts.length > 0 && (
        <div
          id="low-stock-widget"
          className="mt-8 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              {t('admin.dashboard.lowStock.title')}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {t('admin.dashboard.lowStock.product')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {t('admin.dashboard.lowStock.sku')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {t('admin.dashboard.lowStock.stock')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {t('admin.dashboard.lowStock.action')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-700">
                {lowStockProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {product.thumbnail ? (
                          <img
                            src={proxyImg(product.thumbnail)}
                            alt={product.name}
                            className="w-8 h-8 rounded object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs text-neutral-500">
                            {(product.name || '?').charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
                      {product.sku || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${
                          product.stockQuantity === 0
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                        }`}
                      >
                        {product.stockQuantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={buildRoute.adminProductEdit(product.id)}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                      >
                        {t('admin.dashboard.lowStock.edit')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
